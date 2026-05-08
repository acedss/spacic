// One-shot migration. Rewrites Song.imageUrl values that still point at
// the dev fallback (http://localhost:4000/covers/<file>.jpg) so they use
// the real public S3 host.
//
// Run from backend/:
//   node src/scripts/fixSongImageUrls.js          # dry-run, prints what would change
//   node src/scripts/fixSongImageUrls.js --apply  # write the changes
//
// Idempotent: songs already on S3 are skipped.

import 'dotenv/config';
import mongoose from 'mongoose';
import { Song } from '../models/song.model.js';

const APPLY = process.argv.includes('--apply');

const BAD_PREFIX_RE = /^https?:\/\/localhost:\d+\/covers\//i;

const s3CoverUrl = (filename) =>
    `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/covers/${filename}`;

const run = async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI missing');
    if (!process.env.S3_BUCKET_NAME || !process.env.AWS_REGION) {
        throw new Error('S3_BUCKET_NAME and AWS_REGION must be set');
    }

    await mongoose.connect(uri);
    console.log(`[fixSongImageUrls] connected (apply=${APPLY})`);

    const songs = await Song.find({ imageUrl: { $regex: BAD_PREFIX_RE } })
        .select('_id title imageUrl')
        .lean();

    console.log(`[fixSongImageUrls] ${songs.length} songs need rewriting`);

    let changed = 0;
    for (const s of songs) {
        const filename = s.imageUrl.replace(BAD_PREFIX_RE, '');
        const next = s3CoverUrl(filename);
        console.log(`  - ${s.title}\n      ${s.imageUrl}\n   →  ${next}`);
        if (APPLY) {
            await Song.updateOne({ _id: s._id }, { $set: { imageUrl: next } });
            changed += 1;
        }
    }

    console.log(`[fixSongImageUrls] ${APPLY ? `updated ${changed}` : 'dry-run, nothing written'}`);
    await mongoose.disconnect();
};

run().catch((err) => {
    console.error('[fixSongImageUrls] failed:', err);
    process.exit(1);
});
