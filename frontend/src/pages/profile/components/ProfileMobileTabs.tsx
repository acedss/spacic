import { useUser } from '@clerk/clerk-react';
import { cn } from '@/lib/utils';
import { NAV, type SectionId } from './profile-shared';

interface Props {
    active: SectionId;
    onChange: (id: SectionId) => void;
}

export const ProfileMobileTabs = ({ active, onChange }: Props) => {
    const { user } = useUser();

    return (
        <div className="md:hidden flex overflow-x-auto border-b hair shrink-0 px-2 py-1 gap-1" style={{ background: 'var(--ink-1)' }}>
            <div className="flex items-center gap-2 px-2 mr-2 shrink-0">
                <img src={user?.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                <span className="text-[12px] font-semibold text-white truncate max-w-[100px]">{user?.firstName}</span>
            </div>
            {NAV.map(({ id, label, icon: Icon }) => (
                <button
                    key={id}
                    onClick={() => onChange(id)}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] whitespace-nowrap transition-colors shrink-0 press',
                        active === id ? 'bg-white/10 text-white font-semibold' : 'text-white/40 hover:text-white',
                    )}>
                    <Icon className="size-3" />
                    {label}
                </button>
            ))}
        </div>
    );
};
