import mongoose from 'mongoose';

// Tracks every significant social referral action:
//   'invite_sent'    — user clicked Invite btn next to an online friend
//   'activity_join'  — user clicked "Join Room" from the Friends Activity sidebar
//   'link'           — user joined via a shared /rooms/:id?ref=userId link
//
// Analytics use-cases: top referrers, invite→join funnel, viral growth.

const inviteLogSchema = new mongoose.Schema({
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    joinerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roomId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    type: {
        type:    String,
        enum:    ['invite_sent', 'activity_join', 'link'],
        default: 'link',
    },
}, { timestamps: true });

// Unique per (referrer, joiner, room, type) — same pair can appear for different action types
inviteLogSchema.index({ referrerId: 1, joinerId: 1, roomId: 1, type: 1 }, { unique: true });

export const InviteLog = mongoose.model('InviteLog', inviteLogSchema);
