// Small line icons, drawn here so the app needs no icon library. 24 by 24,
// stroked in the current text colour. Decorative: each sits beside a label.

import type { ReactNode } from "react";

function Icon({ children, className = "h-6 w-6" }: { children: ReactNode; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

type P = { className?: string };

export const SunIcon = ({ className }: P) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);

export const MoonIcon = ({ className }: P) => (
  <Icon className={className}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </Icon>
);

export const BasketIcon = ({ className }: P) => (
  <Icon className={className}>
    <path d="M3 10h18l-2 9a2 2 0 0 1-2 1.6H7A2 2 0 0 1 5 19.1L3 10Z" />
    <path d="m8 10 3-6M16 10l-3-6M9 14v3M15 14v3M12 14v3" />
  </Icon>
);

export const ReceiptIcon = ({ className }: P) => (
  <Icon className={className}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </Icon>
);

export const PhoneIcon = ({ className }: P) => (
  <Icon className={className}>
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </Icon>
);

export const StoreIcon = ({ className }: P) => (
  <Icon className={className}>
    <path d="M4 9.5 5.5 4h13L20 9.5" />
    <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
    <path d="M5.5 11.5V20h13v-8.5M10 20v-5h4v5" />
  </Icon>
);

export const TableIcon = ({ className }: P) => (
  <Icon className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M3 14h18M9 9v11" />
  </Icon>
);

export const InboxIcon = ({ className }: P) => (
  <Icon className={className}>
    <path d="M3 13h5l1.5 2.5h5L16 13h5" />
    <path d="M5.5 5h13L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2.5-8Z" />
  </Icon>
);

export const SearchIcon = ({ className }: P) => (
  <Icon className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Icon>
);

export const PlugIcon = ({ className }: P) => (
  <Icon className={className}>
    <path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0V7ZM12 16v5" />
  </Icon>
);

export const ArrowIcon = ({ className = "h-4 w-4" }: P) => (
  <Icon className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
