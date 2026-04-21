import { User } from '../models/user.model.js';
import { Listener } from '../models/listener.model.js';
import { Transaction } from '../models/transaction.model.js';

// GET /api/users/:userId/public-profile  — no auth required
export const getPublicProfile = async (req, res, next) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .select('fullName imageUrl username userTier role activityStats creatorStats createdAt')
            .lean();
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Total coins donated (sum of completed donation transactions)
        const donationAgg = await Transaction.aggregate([
            { $match: { userId: user._id, type: 'donation', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const totalCoinsDonated = donationAgg[0]?.total ?? 0;

        // Minigame wins
        const minigameWins = await Transaction.countDocuments({
            userId: user._id, type: 'minigame_win', status: 'completed',
        });

        // Listening hours — sum of (leftAt - joinedAt) across completed sessions
        const listenAgg = await Listener.aggregate([
            { $match: { userId: user._id, leftAt: { $ne: null } } },
            { $project: { duration: { $subtract: ['$leftAt', '$joinedAt'] } } },
            { $group: { _id: null, totalMs: { $sum: '$duration' } } },
        ]);
        const listeningHours = Math.round((listenAgg[0]?.totalMs ?? 0) / 3_600_000 * 10) / 10;

        // Compute badges
        const badges = [];
        if (user.role === 'CREATOR' || user.userTier === 'CREATOR') badges.push({ id: 'creator', label: 'Creator', emoji: '🎙️' });
        if (totalCoinsDonated >= 5000)       badges.push({ id: 'mega_donor',    label: 'Mega Donor',    emoji: '💎' });
        else if (totalCoinsDonated >= 1000)  badges.push({ id: 'top_donor',     label: 'Top Donor',     emoji: '🪙' });
        if (minigameWins >= 10)              badges.push({ id: 'champion',      label: 'Champion',      emoji: '🏆' });
        else if (minigameWins >= 3)          badges.push({ id: 'winner',        label: 'Winner',        emoji: '🥇' });
        if ((user.activityStats?.roomsJoined ?? 0) >= 50)  badges.push({ id: 'regular',  label: 'Regular',  emoji: '🎵' });
        if ((user.activityStats?.gamesPlayed ?? 0) >= 10)  badges.push({ id: 'gamer',    label: 'Gamer',    emoji: '🎮' });
        const accountAgeDays = (Date.now() - new Date(user.createdAt).getTime()) / 86_400_000;
        if (accountAgeDays >= 90) badges.push({ id: 'veteran', label: 'Veteran', emoji: '⭐' });

        res.json({
            success: true,
            data: {
                _id:          user._id,
                fullName:     user.fullName,
                imageUrl:     user.imageUrl,
                username:     user.username ?? null,
                userTier:     user.userTier,
                role:         user.role,
                joinedAt:     user.createdAt,
                stats: {
                    roomsJoined:      user.activityStats?.roomsJoined  ?? 0,
                    gamesPlayed:      user.activityStats?.gamesPlayed  ?? 0,
                    donationsMade:    user.activityStats?.donationsMade ?? 0,
                    totalCoinsDonated,
                    minigameWins,
                    listeningHours,
                },
                creatorStats: (user.role === 'CREATOR' || user.userTier === 'CREATOR')
                    ? user.creatorStats : null,
                badges,
            },
        });
    } catch (err) {
        next(err);
    }
};
