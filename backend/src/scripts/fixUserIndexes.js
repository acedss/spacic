import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../models/user.model.js';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MONGODB_URI is required');
    process.exit(1);
}

const dropIndexIfExists = async (name) => {
    try {
        await User.collection.dropIndex(name);
        console.log(`[fix-user-indexes] Dropped index: ${name}`);
    } catch (error) {
        if (error?.codeName === 'IndexNotFound' || error?.code === 27) return;
        throw error;
    }
};

const run = async () => {
    await mongoose.connect(MONGODB_URI);
    console.log('[fix-user-indexes] Connected to MongoDB');

    // Legacy schema persisted null in optional unique fields.
    // Remove null-valued fields so they become "missing" instead of a shared unique value.
    const unsetStripe = await User.updateMany(
        { stripeCustomerId: null },
        { $unset: { stripeCustomerId: '' } },
    );
    const unsetUsername = await User.updateMany(
        { username: null },
        { $unset: { username: '' } },
    );
    console.log(`[fix-user-indexes] Unset stripeCustomerId on ${unsetStripe.modifiedCount} users`);
    console.log(`[fix-user-indexes] Unset username on ${unsetUsername.modifiedCount} users`);

    await dropIndexIfExists('stripeCustomerId_1');
    await dropIndexIfExists('username_1');

    await User.collection.createIndex(
        { stripeCustomerId: 1 },
        { name: 'stripeCustomerId_unique_if_string', unique: true, partialFilterExpression: { stripeCustomerId: { $type: 'string' } } },
    );
    await User.collection.createIndex(
        { username: 1 },
        { name: 'username_unique_if_string', unique: true, partialFilterExpression: { username: { $type: 'string' } } },
    );

    console.log('[fix-user-indexes] Index migration complete');
    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error('[fix-user-indexes] Failed:', error);
    try {
        await mongoose.disconnect();
    } catch {}
    process.exit(1);
});
