// Curated chat/donation/reaction/emoji scripts per ghost listener.
// Each ghost has a personality so the recorded chat reads like a real room,
// not "user1: hi / user2: hi / user3: hi". Lines are oldies-themed to match
// the seeded music.

export interface GhostScript {
    chat:        string[];          // 6+ messages — script picks in order
    donateCoins: number[];          // amounts in coins, fired on a timer
    reactions:   ('like' | 'dislike')[];
    emoji:       string[];
}

export const GHOST_SCRIPTS: Record<string, GhostScript> = {
    // demo_listener_lila — chatty, generous, all-in for jazz standards
    demo_listener_lila: {
        chat: [
            'this song never gets old 🎷',
            'okay the bridge here gives me chills',
            'who else is just sitting in the dark with a glass of wine',
            'tell me this isnt the best room on spacic right now',
            'sending love from the late shift ❤️',
            'somebody put this on a vinyl already',
        ],
        donateCoins: [100, 250, 500],
        reactions:   ['like'],
        emoji:       ['❤️', '🔥', '🎷'],
    },
    // demo_listener_aki — lurker who chimes in with short reactions
    demo_listener_aki: {
        chat: [
            'pure vibes',
            'mood',
            'this is THE one',
            'goosebumps',
            'no skips today',
            '🥃',
        ],
        donateCoins: [100, 200],
        reactions:   ['like'],
        emoji:       ['🥃', '✨'],
    },
    // demo_listener_juno — high-energy hype-poster
    demo_listener_juno: {
        chat: [
            'OK CREATOR!! 🔥🔥',
            'turn it UP',
            'we eatin tonight',
            'this is going on every playlist i own',
            'bro the chord change at 1:42??',
            'best room hands down',
        ],
        donateCoins: [250, 500, 1000],
        reactions:   ['like'],
        emoji:       ['🔥', '🚀', '🎉'],
    },
    // demo_listener_ren — quiet, reflective, occasional skip-vote
    demo_listener_ren: {
        chat: [
            'this one for the soul',
            'reminds me of my granddad',
            'its raining where i am, perfect timing',
            'soft launch, big feelings',
            'thank you for this set',
            'staying for the whole hour',
        ],
        donateCoins: [100, 100],
        reactions:   ['like'],
        emoji:       ['🌧️', '🕯️'],
    },
};

// Default fallback in case a clerkId is unknown — keeps the script alive.
export const DEFAULT_SCRIPT: GhostScript = {
    chat:        ['great room', 'love this', 'first time here', 'subscribed', 'this is fire'],
    donateCoins: [50],
    reactions:   ['like'],
    emoji:       ['🔥'],
};
