import { SVGProps } from 'react';

export function DrinkingFountainIcon({ className, strokeWidth = 2, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 21V10a7 7 0 0 1 14 0v2h3" />
      <path d="M8 21V10a4 4 0 0 1 8 0v5h3" />
      <path d="M3 21h8" />
      <path d="M19 17.5s1.5 1.7 1.5 2.5a1.5 1.5 0 0 1-3 0c0-.8 1.5-2.5 1.5-2.5Z" />
    </svg>
  );
}
