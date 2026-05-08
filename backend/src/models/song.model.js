import mongoose from "mongoose";

// ── Vocabulary ────────────────────────────────────────────────────────────────
// Closed enums kept short so seed data + admin UI stay tight.
// `mood` and `genre` are stored as arrays of strings (free-form tags allowed,
// but the admin form suggests these canonical buckets first).

export const SONG_GENRES = [
    'pop', 'rock', 'hip-hop', 'rnb', 'electronic', 'house', 'techno',
    'jazz', 'classical', 'indie', 'folk', 'country', 'metal', 'lofi',
    'ambient', 'soundtrack', 'world', 'experimental', 'k-pop', 'latin',
];

export const SONG_MOODS = [
    'happy', 'sad', 'energetic', 'chill', 'romantic', 'dark', 'epic',
    'nostalgic', 'angry', 'peaceful', 'dreamy', 'focused', 'party',
];

export const MUSICAL_KEYS = [
    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
    'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm',
];

const songSchema = new mongoose.Schema({
    // ── Required (set at upload) ──────────────────────────────────────────────
    title:    { type: String, required: true, trim: true, maxlength: 200 },
    artist:   { type: String, required: true, trim: true, maxlength: 200 }, // display string (legacy + canonical)
    imageUrl: { type: String, required: true },
    s3Key:    { type: String, required: true },
    duration: { type: Number, required: true, min: 1 },

    // ── Optional metadata (rich admin form) ───────────────────────────────────
    artistId: { type: mongoose.Schema.ObjectId, ref: 'Artist', default: null }, // soft link
    albumId:  { type: mongoose.Schema.ObjectId, ref: 'Album',  default: null },

    description:    { type: String, default: '', maxlength: 2000 },
    genre:          { type: [String], default: [] },     // multi-select
    mood:           { type: [String], default: [] },     // multi-select
    tags:           { type: [String], default: [] },     // free-form keywords
    language:       { type: String, default: '' },        // ISO 639-1 e.g. 'en', 'ja'
    bpm:            { type: Number, default: null, min: 30, max: 300 },
    musicalKey:     { type: String, default: null, enum: [null, ...MUSICAL_KEYS] },
    explicit:       { type: Boolean, default: false },
    releaseDate:    { type: Date,   default: null },
    originalArtist: { type: String, default: '' },       // for covers
    license:        { type: String, default: '' },        // e.g. CC-BY, royalty-free, owned
    isrc:           { type: String, default: '' },        // International Standard Recording Code

    // Derived audio features (0–1) — useful for RecSys + filtering
    energy:         { type: Number, default: null, min: 0, max: 1 },
    danceability:   { type: Number, default: null, min: 0, max: 1 },
    valence:        { type: Number, default: null, min: 0, max: 1 }, // musical positivity

    // ── Streaming analytics — denormalized counters ──────────────────────────
    streamCount: { type: Number, default: 0 },
    uniquePlays: { type: Number, default: 0 },
    skipCount:   { type: Number, default: 0 },
}, { timestamps: true });

// Indexes for admin search/filter.
// `language_override` is set to a non-existent field so MongoDB does NOT
// treat the user-facing `language` metadata field (ISO 639-1 like 'en')
// as a per-document stemmer override — empty/unsupported values would
// otherwise crash inserts with "language override unsupported".
songSchema.index(
    { title: 'text', artist: 'text', tags: 'text' },
    { default_language: 'english', language_override: 'textLanguage' }
);
songSchema.index({ artistId: 1 });
songSchema.index({ albumId: 1 });
songSchema.index({ genre: 1 });
songSchema.index({ createdAt: -1 });

export const Song = mongoose.model("Song", songSchema);
