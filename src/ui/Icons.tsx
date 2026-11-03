import type { ComponentKind } from '../data/components';

export type IconName = ComponentKind | 'env' | 'optimizer' | 'library';

const PATHS: Record<IconName, JSX.Element> = {
  env: (
    <>
      <path d="M4 15a4 4 0 0 1 .5-8A5.5 5.5 0 0 1 15 6.5 3.5 3.5 0 0 1 16 13.5" />
      <path d="M3 19h11M6 22h9M15 17h5" />
    </>
  ),
  frame: (
    <>
      <circle cx="5.5" cy="5.5" r="3" />
      <circle cx="18.5" cy="5.5" r="3" />
      <circle cx="5.5" cy="18.5" r="3" />
      <circle cx="18.5" cy="18.5" r="3" />
      <path d="M7.6 7.6l8.8 8.8M16.4 7.6l-8.8 8.8" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    </>
  ),
  battery: (
    <>
      <rect x="2.5" y="7" width="17" height="10" rx="2" />
      <path d="M21.5 10.5v3M6 12h4M8 10v4M13 12h3" />
    </>
  ),
  esc: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
      <path d="M12.5 8.5l-2 3.5h3l-2 3.5" />
    </>
  ),
  motor: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.2" />
      <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" />
    </>
  ),
  prop: (
    <>
      <circle cx="12" cy="12" r="1.8" />
      <path d="M13.5 10.8C15 7 18 3.5 20.5 4.5c1.6.7-.6 4.4-5.3 7" />
      <path d="M10.5 13.2C9 17 6 20.5 3.5 19.5c-1.6-.7.6-4.4 5.3-7" />
    </>
  ),
  optimizer: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      <path d="M3 8l6-5 6 7 6-4" />
    </>
  ),
  library: (
    <>
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="9.5" y="4" width="5" height="16" rx="1" />
      <path d="M16.5 5.5l4.3-1.2 3 15.4-4.2 1.1z" />
    </>
  ),
};

/** Line icons for component categories, drawn with currentColor. */
export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={`icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
