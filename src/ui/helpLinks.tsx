import type { ReactNode } from 'react';

export const REPO = 'https://github.com/kothf/HoverLab';

export const ext = (href: string, text: ReactNode) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {text}
  </a>
);
