interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export type IconName =
  | 'grid' | 'flow' | 'cost' | 'plus' | 'minus' | 'close'
  | 'back' | 'chevron-down' | 'chevron-left' | 'chevron-right'
  | 'sun' | 'moon' | 'search' | 'scan' | 'check' | 'trash'
  | 'edit' | 'box' | 'store' | 'warehouse' | 'calendar'
  | 'tag' | 'user' | 'note' | 'arrow-up' | 'arrow-down'
  | 'refresh' | 'draft' | 'warning' | 'money' | 'list'
  | 'chart' | 'arrow-left' | 'plus-circle';

const PATHS: Record<IconName, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </>
  ),
  flow: <path d="M7 7h11l-3-3 1.4-1.4L21.8 8l-5.4 5.4L15 12l3-3H7a3 3 0 00-3 3v4H2v-4a5 5 0 015-5z" />,
  cost: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />,
  plus: <path d="M13 5a1 1 0 10-2 0v6H5a1 1 0 100 2h6v6a1 1 0 102 0v-6h6a1 1 0 100-2h-6V5z" />,
  minus: <rect x="4" y="11" width="16" height="2" rx="1" />,
  close: <path d="M18 6L6 18M6 6l12 12" />,
  back: <path d="M9 18l6-6-6-6" />,
  'chevron-down': <path d="M7 10l5 5 5-5H7z" />,
  'chevron-left': <path d="M15 18l-6-6 6-6" />,
  'chevron-right': <path d="M9 18l6-6-6-6" />,
  sun: <circle cx="12" cy="12" r="4" />,
  moon: <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />,
  search: <path d="M10 2a8 8 0 105.29 14L20.6 21.3 22 19.9l-5.3-5.3A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z" />,
  scan: <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 8v8M11 8v8M15 8v8M19 8v8" />,
  check: <polyline points="20 6 9 17 4 12" />,
  trash: <path d="M6 19c0 1.1.9 2 2 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />,
  edit: <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />,
  box: <><path d="M20 7l-8-4-8 4 8 4 8-4z" /><path d="M4 7v10l8 4 8-4V7" opacity=".4" /></>,
  store: <><path d="M4 4h16l-1 6H5L4 4z" /><path d="M5 12v8h14v-8" fill="none" stroke="currentColor" strokeWidth="2" /></>,
  warehouse: <path d="M12 2L2 9v12h6v-7h8v7h6V9L12 2z" />,
  calendar: <path d="M7 2v3M17 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />,
  tag: <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01" />,
  user: <path d="M12 2a5 5 0 015 5c0 2-1 4-3 5 4 1 7 3 7 6v4H3v-4c0-3 3-5 7-6-2-1-3-3-3-5a5 5 0 015-5z" />,
  note: <path d="M4 4h16v2H4zm0 6h16v2H4zm0 6h10v2H4z" />,
  'arrow-up': <polygon points="12,6 20,16 4,16" />,
  'arrow-down': <polygon points="12,18 4,8 20,8" />,
  refresh: <path d="M12 3v1.5l3.5 3.5L12 12.5V9a5 5 0 105 5h2a7 7 0 11-7-7V3z" />,
  draft: <><path d="M6 2h9l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" opacity=".4" /><polyline points="17 21 17 13 7 13 7 21" fill="none" stroke="currentColor" strokeWidth="2" /></>,
  warning: <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9a1 1 0 011 1v4a1 1 0 11-2 0v-4a1 1 0 011-1zm0 8.5a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4z" />,
  money: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />,
  list: <path d="M4 5h16v2H4zm0 6h16v2H4zm0 6h10v2H4z" />,
  chart: <path d="M5 20V10h4v10H5zm5 0V4h4v16h-4zm5 0v-7h4v7h-4z" />,
  'arrow-left': <path d="M19 12H5M12 19l-7-7 7-7" />,
  'plus-circle': <><circle cx="12" cy="12" r="9" opacity=".3" /><path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
};

export function Icon({ name, size = 20, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}