import mongoose from "mongoose";

// A minigame lives inside a room session.
// trigger.type determines when it fires automatically:
//   before_song  — during the transition into song at trigger.songIndex
//   after_song   — right after song at trigger.songIndex ends
//   manual       — creator fires it any time via room:game_trigger socket event
const minigameSchema = new mongoose.Schema({
    roomId:    { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    type: {
        type: String,
        enum: ['song_guesser', 'lyric_fill', 'trivia', 'skip_battle'],
        required: true,
    },
    title:  { type: String, required: true, trim: true, maxlength: 100 },
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'active', 'completed', 'cancelled'],
        default: 'draft',
    },

    trigger: {
        type:      { type: String, enum: ['before_song', 'after_song', 'manual'], default: 'manual' },
        songIndex: { type: Number, default: null },
    },

    durationSeconds: { type: Number, default: 30, min: 10, max: 120 },
    coinReward:      { type: Number, default: 0,  min: 0 },

    // Per-type configuration
    config: {
        question:      { type: String, default: null }, // trivia / lyric_fill
        answer:        { type: String, default: null }, // correct text answer (song_guesser, lyric_fill)
        lyric:         { type: String, default: null }, // lyric_fill: the lyric with blank
        options:       [{ type: String }],              // trivia: A/B/C/D choices
        correctOption: { type: Number, default: null }, // trivia: index into options[]
    },

    participantCount: { type: Number, default: 0 },
    winner: {
        userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        username: { type: String, default: null },
        answer:   { type: String, default: null },
    },
    startedAt:   { type: Date, default: null },
    completedAt: { type: Date, default: null },
}, { timestamps: true });

minigameSchema.index({ roomId: 1, status: 1 });
minigameSchema.index({ roomId: 1, 'trigger.type': 1, 'trigger.songIndex': 1 });

export const Minigame = mongoose.model("Minigame", minigameSchema);
