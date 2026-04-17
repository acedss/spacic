import { UserProfile } from '@clerk/clerk-react'

export const AccountSection = () => (
    <div className="w-full max-w-2xl">
        <UserProfile
            appearance={{
                variables: {
                    colorBackground: '#09090b',
                    colorInputBackground: '#18181b',
                    colorInputText: '#ffffff',
                    colorText: '#ffffff',
                    colorTextSecondary: '#a1a1aa',
                    colorPrimary: '#a855f7',
                    colorDanger: '#f87171',
                    borderRadius: '0.75rem',
                },
                elements: {
                    rootBox: 'w-full',
                    card: 'bg-zinc-900 border border-white/10 shadow-2xl rounded-2xl',
                    navbar: 'border-r border-white/10',
                    navbarButton: 'text-zinc-400 hover:text-white hover:bg-white/5',
                    navbarButtonIcon: 'text-zinc-500',
                    headerTitle: 'text-white',
                    headerSubtitle: 'text-zinc-400',
                    formButtonPrimary: 'bg-purple-600 hover:bg-purple-500',
                    formFieldInput: 'bg-zinc-800 border-white/10 text-white',
                    formFieldLabel: 'text-zinc-300',
                    dividerLine: 'bg-white/10',
                    profileSectionTitle: 'text-white',
                    profileSectionContent: 'text-zinc-400',
                    badge: 'bg-purple-500/20 text-purple-300',
                    accordionTriggerButton: 'text-zinc-300 hover:text-white',
                },
            }}
        />
    </div>
)
