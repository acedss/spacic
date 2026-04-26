import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // Fail fast on startup rather than hanging for the 30 s default.
            // Reconnects are still handled automatically by Mongoose after initial connect.
            serverSelectionTimeoutMS: 5000,
        });
        console.log(`[DB] Connected to MongoDB ${conn.connection.host}`);

        mongoose.connection.on('disconnected', () =>
            console.error('[DB] MongoDB disconnected — reconnecting automatically'));
        mongoose.connection.on('reconnected', () =>
            console.log('[DB] MongoDB reconnected'));
    } catch (error) {
        console.error('[DB] Failed to connect to MongoDB:', error.message);
        process.exit(1);
    }
};
