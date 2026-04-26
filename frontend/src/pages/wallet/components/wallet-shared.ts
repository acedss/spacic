import { Zap, Star, Crown } from 'lucide-react';

export const TIER_CONFIG = {
    FREE:    { label: 'Free',    icon: Zap,   color: 'text-zinc-400',   bg: 'bg-zinc-400/10'   },
    PREMIUM: { label: 'Premium', icon: Star,  color: 'text-purple-400', bg: 'bg-purple-400/10' },
    CREATOR: { label: 'Creator', icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
} as const;

export type TxFilter = 'all' | 'coins' | 'winpoints';

export const COIN_TYPES = new Set(['topup', 'donation', 'minigame_debit', 'minigame_refund', 'admin_gift', 'admin_adjust']);
export const WP_TYPES   = new Set(['goal_payout', 'minigame_win', 'creator_earning', 'withdrawal', 'withdrawal_fee']);
