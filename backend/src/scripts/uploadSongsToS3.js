// Upload local /songs/*.mp3 to S3 and extract embedded covers to S3 + local disk.
//
// For each .mp3 in <repo>/songs/:
//   1. Parse ID3 tags (title, artist, duration, embedded cover) via music-metadata.
//   2. Sanitise filename → s3Key like songs/<safe>.mp3.
//   3. Upload audio to s3://<bucket>/songs/<safe>.mp3 (private; played via presigned GET URL).
//   4. Resize embedded cover (400x400 cover-fit, JPEG q80) and:
//        a. write to public/covers/<safe>.jpg (kept as a local artifact; not served).
//        b. upload to s3://<bucket>/covers/<safe>.jpg (private; rendered via presigned GET URL).
//   5. Append { title, artist, duration, s3Key, imageUrl } to backend/src/scripts/songs.manifest.json
//      where imageUrl is a 7-day presigned GET URL — same scheme as the admin upload flow.
//
// Usage: node src/scripts/uploadSongsToS3.js

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { parseFile } from 'music-metadata';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SONGS_DIR    = path.resolve(__dirname, '..', '..', '..', 'songs');
const COVERS_DIR   = path.resolve(__dirname, '..', '..', 'public', 'covers');
const MANIFEST     = path.resolve(__dirname, 'songs.manifest.json');

// 7-day presigned GET URL — matches admin.controller.js SONG_IMAGE_PRESIGN_TTL.
// 7 days is the SigV4 maximum; covers will need to be re-presigned after that.
const COVER_PRESIGN_TTL_SECONDS = 7 * 24 * 3600;

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const BUCKET = process.env.S3_BUCKET_NAME;

// Match the admin pattern: store a long-lived presigned GET URL as imageUrl
// rather than relying on bucket policy / public ACL.
const presignedCoverUrl = (key) =>
    getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: COVER_PRESIGN_TTL_SECONDS });

// Sanitise YouTube-derived filenames into S3-safe slugs.
const slugify = (s) => s
    .replace(/\.mp3$/i, '')
    .replace(/[\u2010-\u2015\u2018\u2019\u201C\u201D]/g, '-')   // smart dashes/quotes → -
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

// Best-effort title/artist split from common YouTube patterns:
//   "Artist - Title (Official Audio)"  →  { artist, title }
//   "Title (Official Music Video)"     →  { artist: '', title }
const guessTitleArtist = (filenameNoExt, idTitle, idArtist) => {
    if (idTitle && idArtist) return { title: idTitle, artist: idArtist };
    const cleaned = filenameNoExt
        .replace(/\s*\((Official\s*)?(Music\s*)?(Video|Audio|Lyrics?|Live|Lyric Video)[^)]*\)/gi, '')
        .replace(/\s*\[(Official\s*)?(Music\s*)?(Video|Audio)[^\]]*\]/gi, '')
        .replace(/\s+\(legendado\)/gi, '')
        .replace(/\s+ft\.\s+.*$/i, '')
        .trim();
    const dashIdx = cleaned.indexOf(' - ');
    if (dashIdx > 0) {
        return { artist: cleaned.slice(0, dashIdx).trim(), title: cleaned.slice(dashIdx + 3).trim() };
    }
    return { artist: idArtist || '', title: idTitle || cleaned };
};

const uploadAudio = async (filePath, s3Key) => {
    const Body = fs.readFileSync(filePath);
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key: s3Key, Body, ContentType: 'audio/mpeg',
    }));
};

const writeCover = async (pictureBuffer, mime, safeName) => {
    if (!pictureBuffer) return null;

    // Produce the JPEG once as a buffer so we can both write it to disk
    // (dev fallback for the /covers/* static route) AND push it to S3.
    const jpegBuf = await sharp(pictureBuffer)
        .resize(400, 400, { fit: 'cover' })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();

    // Local copy — preserves the existing dev workflow where Express serves
    // /covers/* directly from public/covers. Cheap; ~30 KB per file.
    const outPath = path.join(COVERS_DIR, `${safeName}.jpg`);
    await fs.promises.writeFile(outPath, jpegBuf);

    // S3 upload — same client + PutObjectCommand pattern as uploadAudio().
    // Public read access is granted by the bucket *policy* (not per-object ACL)
    // because the bucket has Object Ownership = "Bucket owner enforced", which
    // disables ACLs entirely. Cache headers match the Express static route.
    const coverKey = `covers/${safeName}.jpg`;
    await s3.send(new PutObjectCommand({
        Bucket:       BUCKET,
        Key:          coverKey,
        Body:         jpegBuf,
        ContentType:  'image/jpeg',
        CacheControl: 'public, max-age=604800, immutable',
    }));

    return await presignedCoverUrl(coverKey);
};

const main = async () => {
    if (!BUCKET) throw new Error('S3_BUCKET_NAME missing in .env');
    if (!fs.existsSync(SONGS_DIR)) throw new Error(`Songs dir not found: ${SONGS_DIR}`);
    fs.mkdirSync(COVERS_DIR, { recursive: true });

    const files = fs.readdirSync(SONGS_DIR).filter((f) => f.toLowerCase().endsWith('.mp3'));
    console.log(`Found ${files.length} MP3s in ${SONGS_DIR}\n`);

    const manifest = [];
    let i = 0;
    for (const file of files) {
        i += 1;
        const full = path.join(SONGS_DIR, file);
        const safe = slugify(file);
        process.stdout.write(`[${String(i).padStart(2, '0')}/${files.length}] ${file}\n`);
        try {
            const { common, format } = await parseFile(full, { duration: true });
            const { title, artist } = guessTitleArtist(file.replace(/\.mp3$/i, ''), common.title, common.artist);

            const s3Key = `songs/${safe}.mp3`;
            await uploadAudio(full, s3Key);

            const picture = common.picture?.[0];
            const imageUrl = picture
                ? await writeCover(picture.data, picture.format, safe)
                : 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400';

            const duration = Math.round(format.duration ?? 0);
            manifest.push({ title, artist, duration, s3Key, imageUrl });
            console.log(`     → ${title} — ${artist} (${duration}s) ${picture ? '✓ cover' : '… placeholder'}`);
        } catch (err) {
            console.error(`     ✗ FAILED: ${err.message}`);
        }
    }

    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    console.log(`\n✓ Manifest written: ${MANIFEST} (${manifest.length} entries)`);
};

main().catch((e) => { console.error(e); process.exit(1); });
