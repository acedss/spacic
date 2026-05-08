// One-shot maintenance script.
// Drops any Song indexes that no longer match the current schema definition
// and rebuilds them. Run after changing index options in song.model.js:
//
//   node src/scripts/syncSongIndexes.js
//
// Safe to re-run; syncIndexes() is a no-op when indexes already match.

import 'dotenv/config';
import mongoose from 'mongoose';
import { Song } from '../models/song.model.js';

const run = async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI is not set');
        process.exit(1);
    }
    await mongoose.connect(uri);
    console.log('[syncSongIndexes] connected');

    const before = await Song.collection.indexes();
    console.log('[syncSongIndexes] indexes before:', before.map(i => ({ name: i.name, language_override: i.language_override })));

    // Force-drop the text index because Mongoose's syncIndexes() doesn't always
    // detect option-only diffs (e.g. language_override change with same keys).
    const textIndex = before.find(i => i.name === 'title_text_artist_text_tags_text');
    if (textIndex) {
        await Song.collection.dropIndex(textIndex.name);
        console.log('[syncSongIndexes] dropped text index:', textIndex.name);
    }

    // Now let Mongoose recreate everything from the schema.
    await Song.syncIndexes();

    const after = await Song.collection.indexes();
    console.log('[syncSongIndexes] indexes after:', after.map(i => ({ name: i.name, language_override: i.language_override })));

    await mongoose.disconnect();
    console.log('[syncSongIndexes] done');
};

run().catch((err) => {
    console.error('[syncSongIndexes] failed:', err);
    process.exit(1);
});
