export const GENRES = [
    { id: 'ambient', label: 'Ambient', hue: 'oklch(0.68 0.21 240)' },
    { id: 'lofi', label: 'Lo-fi', hue: 'oklch(0.7 0.18 200)' },
    { id: 'indie', label: 'Indie', hue: 'oklch(0.72 0.2 150)' },
    { id: 'rnb', label: 'R&B', hue: 'oklch(0.72 0.22 20)' },
    { id: 'electronic', label: 'Electronic', hue: 'oklch(0.68 0.21 295)' },
    { id: 'jazz', label: 'Jazz', hue: 'oklch(0.78 0.15 75)' },
    { id: 'classical', label: 'Classical', hue: 'oklch(0.75 0.1 60)' },
    { id: 'hiphop', label: 'Hip-Hop', hue: 'oklch(0.7 0.2 330)' },
    { id: 'soul', label: 'Soul', hue: 'oklch(0.74 0.18 40)' },
    { id: 'acoustic', label: 'Acoustic', hue: 'oklch(0.76 0.12 90)' },
    { id: 'pop', label: 'Pop', hue: 'oklch(0.75 0.22 340)' },
    { id: 'focus', label: 'Focus', hue: 'oklch(0.7 0.15 210)' },
    { id: 'experimental', label: 'Experimental', hue: 'oklch(0.65 0.2 280)' },
    { id: 'folk', label: 'Folk', hue: 'oklch(0.77 0.13 80)' },
] as const;

export const MOODS = ['Late Night', 'Ambient', 'Chill', 'Focus', 'Hype', 'Sad Hours', 'Morning Coffee', 'Indie Vibes', 'Jazz Bar', 'Lo-fi Study', 'After Hours', 'Road Trip'];

export type GenreId = typeof GENRES[number]['id'];

export interface OnboardingSong {
    _id: string; title: string; artist: string; imageUrl: string; duration: number;
}
export interface OnboardingCreator {
    _id: string; fullName: string; imageUrl: string; username?: string;
    creatorStats?: { totalRoomsHosted?: number; totalStreams?: number };
}
export interface OnboardingRoom {
    _id: string; title: string; description?: string; listenerCount: number;
    creatorId?: { fullName: string; imageUrl: string };
    playlist?: Array<{ imageUrl?: string }>;
}

export const AVATAR_BG = (seed: string) =>
    `oklch(0.55 0.18 ${(seed.charCodeAt(0) * 47 + (seed.charCodeAt(1) ?? 0) * 13) % 360})`;

export const TOTAL_STEPS = 7;
