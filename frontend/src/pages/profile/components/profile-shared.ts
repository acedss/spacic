import { User, Shield, CreditCard, BarChart2, Zap, Crown, Star } from 'lucide-react';
import type { ElementType } from 'react';

export type SectionId = 'profile' | 'account' | 'billing' | 'stats';

export const NAV: { id: SectionId; label: string; icon: ElementType }[] = [
    { id: 'profile', label: 'Profile',       icon: User       },
    { id: 'account', label: 'Account',       icon: Shield     },
    { id: 'billing', label: 'Billing',       icon: CreditCard },
    { id: 'stats',   label: 'Creator Stats', icon: BarChart2  },
];

export const TIER_META: Record<string, { label: string; icon: ElementType; accent: string }> = {
    FREE:    { label: 'Free',    icon: Zap,   accent: 'oklch(0.6 0.01 285)' },
    PREMIUM: { label: 'Premium', icon: Star,  accent: 'oklch(0.72 0.18 295)' },
    CREATOR: { label: 'Creator', icon: Crown, accent: 'oklch(0.88 0.12 75)'  },
};

export const SECTION_TITLES: Record<SectionId, { eyebrow: string; title: string }> = {
    profile: { eyebrow: 'Identity',     title: 'Your Profile'  },
    account: { eyebrow: 'Security',     title: 'Account'       },
    billing: { eyebrow: 'Plan & Wallet', title: 'Billing'       },
    stats:   { eyebrow: 'Analytics',    title: 'Creator Stats' },
};
