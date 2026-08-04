import { SVGProps } from 'react';

export function DrinkingFountainIcon({ className, strokeWidth = 2, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 21h12M8 21V9h8v12M8 9h8M10 5h4M12 5v4M16 11h2a2 2 0 0 1 2 2v1M10 14h4" />
      <path d="M20 14c0 1-1 2-1 2s-1-1-1-2a1 1 0 0 1 2 0Z" />
    </svg>
  );
}
