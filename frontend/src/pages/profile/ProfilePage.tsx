import { useState } from 'react';
import { ProfileSection } from './components/ProfileSection';
import { AccountSection } from './components/AccountSection';
import { BillingSection } from './components/BillingSection';
import { StatsSection } from './components/StatsSection';
import { ProfileSidebar } from './components/ProfileSidebar';
import { ProfileMobileTabs } from './components/ProfileMobileTabs';
import { SECTION_TITLES, type SectionId } from './components/profile-shared';

const ProfilePage = () => {
    const [active, setActive] = useState<SectionId>('profile');
    const { eyebrow, title } = SECTION_TITLES[active];

    return (
        <div className="flex flex-col md:flex-row h-full min-h-0" style={{ background: 'var(--ink-0)' }}>
            <ProfileSidebar active={active} onChange={setActive} />
            <ProfileMobileTabs active={active} onChange={setActive} />

            <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-7 md:px-10 md:py-8 max-w-3xl">
                    <div className="mb-7">
                        <p className="mono text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>{eyebrow}</p>
                        <h2 className="serif italic text-white" style={{ fontSize: 26 }}>{title}</h2>
                    </div>

                    {active === 'profile' && <ProfileSection />}
                    {active === 'account' && <AccountSection />}
                    {active === 'billing' && <BillingSection />}
                    {active === 'stats'   && <StatsSection />}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
