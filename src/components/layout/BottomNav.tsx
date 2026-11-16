import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/dashboard', label: 'داشبورد', icon: 'grid' },
  { to: '/flows', label: 'گردش کالا', icon: 'flow' },
  { to: '/cost', label: 'بهای تمام شده', icon: 'cost' },
] as const;

function Icon({ name, active }: { name: string; active: boolean }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: active ? 'currentColor' : 'none',
    stroke: 'currentColor',
    strokeWidth: active ? 0 : 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (name === 'grid') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="8" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
        <rect x="13" y="13" width="8" height="8" rx="2" />
      </svg>
    );
  }
  if (name === 'flow') {
    return (
      <svg {...common}>
        <path d="M7 7h11l-3-3 1.4-1.4L21.8 8l-5.4 5.4L15 12l3-3H7a3 3 0 00-3 3v4H2v-4a5 5 0 015-5z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

export function BottomNav() {
  return (
    <nav className="absolute bottom-0 left-0 right-0 h-[84px] bg-cream/90 dark:bg-[#0E0D0B]/90 backdrop-blur-xl border-t border-black/5 dark:border-cream/10 flex justify-around items-center px-3 pb-5 pt-2.5 z-20">
      {TABS.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors flex-1 ${
              isActive ? 'text-orange' : 'text-muted-light dark:text-muted-dark'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon name={icon} active={isActive} />
              <span className="text-[10.5px] font-semibold">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}