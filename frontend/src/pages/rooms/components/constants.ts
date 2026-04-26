export const TAG_GRADIENTS: Record<string, string> = {
    'Late Night':  'linear-gradient(145deg, oklch(0.18 0.05 230), oklch(0.12 0.03 250))',
    'Ambient':     'linear-gradient(145deg, oklch(0.18 0.04 255), oklch(0.12 0.03 270))',
    'Indie':       'linear-gradient(145deg, oklch(0.18 0.05 270), oklch(0.12 0.04 280))',
    'R&B':         'linear-gradient(145deg, oklch(0.18 0.07 295), oklch(0.12 0.05 305))',
    'Focus':       'linear-gradient(145deg, oklch(0.18 0.06 305), oklch(0.12 0.05 320))',
    'Hype':        'linear-gradient(145deg, oklch(0.2 0.07 330), oklch(0.14 0.05 345))',
    'Chill':       'linear-gradient(145deg, oklch(0.18 0.06 0),   oklch(0.13 0.05 340))',
    'Jazz':        'linear-gradient(145deg, oklch(0.18 0.06 10),  oklch(0.12 0.04 355))',
    'Electronic':  'linear-gradient(145deg, oklch(0.18 0.06 15),  oklch(0.12 0.04 5))',
    'Acoustic':    'linear-gradient(145deg, oklch(0.18 0.06 30),  oklch(0.12 0.04 15))',
    'Soul':        'linear-gradient(145deg, oklch(0.18 0.06 40),  oklch(0.13 0.05 25))',
    'Lo-fi':       'linear-gradient(145deg, oklch(0.18 0.04 225), oklch(0.13 0.04 240))',
    'Pop':         'linear-gradient(145deg, oklch(0.2 0.07 320),  oklch(0.14 0.05 335))',
    'Hip-Hop':     'linear-gradient(145deg, oklch(0.18 0.06 285), oklch(0.13 0.05 295))',
    'Classical':   'linear-gradient(145deg, oklch(0.18 0.03 240), oklch(0.13 0.02 255))',
    'Country':     'linear-gradient(145deg, oklch(0.18 0.05 45),  oklch(0.13 0.04 30))',
    'Reggae':      'linear-gradient(145deg, oklch(0.18 0.06 150), oklch(0.13 0.04 140))',
    'Metal':       'linear-gradient(145deg, oklch(0.16 0.02 270), oklch(0.10 0.01 260))',
}

export const TAG_ORDER = ['Late Night', 'Ambient', 'Indie', 'R&B', 'Focus', 'Hype', 'Chill', 'Jazz', 'Electronic', 'Acoustic', 'Soul', 'Lo-fi', 'Pop', 'Hip-Hop', 'Classical', 'Country', 'Reggae', 'Metal']

export const SORT_OPTIONS = [
    { value: 'listeners', label: 'Most listeners' },
    { value: 'newest',    label: 'Newest' },
    { value: 'donations', label: 'Most donated' },
] as const

export type SortOption = typeof SORT_OPTIONS[number]['value']

export const PAGE_SIZE = 12
