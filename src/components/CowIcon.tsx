import React from 'react';

export interface CowIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const CowIcon: React.FC<CowIconProps> = ({ 
  className = "w-4 h-4", 
  size, 
  ...props 
}) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...(size ? { width: size, height: size } : {})}
    {...props}
  >
    {/* Cow Head / Horns silhouette representing live cattle / livestock */}
    <path d="M12 3c-2.5 0-4.5 1.5-5 3.5C5 7 3 9 3 11c0 3 2.5 6 6 7h6c3.5-1 6-4 6-7 0-2-2-4-4-4.5-.5-2-2.5-3.5-5-3.5z" />
    <path d="M5 8l3 1.5" />
    <path d="M19 8l-3 1.5" />
    <circle cx="9" cy="12" r="1" fill="currentColor" />
    <circle cx="15" cy="12" r="1" fill="currentColor" />
    <path d="M10 15c1 1 3 1 4 0" />
  </svg>
);

export default CowIcon;
