import React, { useState } from 'react';
import { useAppBranding } from '../lib/BrandingContext';
import { cn } from '../lib/utils';

export interface BrandLogoProps {
  variant?: 'full' | 'horizontal' | 'header' | 'icon' | 'sidebar' | 'compact' | 'invoice' | 'auth' | 'landing' | 'footer';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  imgClassName?: string;
  textClassName?: string;
  showTagline?: boolean;
  dark?: boolean;
  onClick?: () => void;
  overrideLogoSize?: number;
  overrideOffsetX?: number;
  overrideOffsetY?: number;
  overrideWidth?: number;
}

export const DEFAULT_LOGO_FALLBACK = '/favicon.svg';

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className,
  imgClassName,
  textClassName,
  showTagline = true,
  dark = false,
  onClick,
  overrideLogoSize,
  overrideOffsetX,
  overrideOffsetY,
  overrideWidth,
}) => {
  const { logoUrl, appName, tagline, branding } = useAppBranding();
  const [hasImageError, setHasImageError] = useState(false);
  const [hasFallbackError, setHasFallbackError] = useState(false);

  // If active custom logo exists and hasn't errored out, use it with cache-busting version; otherwise use default fallback asset
  const rawImageSrc = !hasImageError && logoUrl ? logoUrl : DEFAULT_LOGO_FALLBACK;
  const version = branding.updatedAt || '';
  const activeImageSrc = (rawImageSrc && rawImageSrc !== DEFAULT_LOGO_FALLBACK && version && !rawImageSrc.includes('v='))
    ? `${rawImageSrc}${rawImageSrc.includes('?') ? '&' : '?'}v=${version}`
    : rawImageSrc;

  // Active display values (from global branding or live override)
  const activeSize = overrideLogoSize !== undefined ? overrideLogoSize : (branding.logoSize ?? 100);
  const activeOffsetX = overrideOffsetX !== undefined ? overrideOffsetX : (branding.logoOffsetX ?? 0);
  const activeOffsetY = overrideOffsetY !== undefined ? overrideOffsetY : (branding.logoOffsetY ?? 0);
  const activeWidth = overrideWidth !== undefined ? overrideWidth : branding.logoWidth;

  const isAuth = variant === 'auth';
  const transformOrigin = isAuth ? 'center center' : 'left center';
  const scale = activeSize / 100;
  const transform = `translate(${activeOffsetX}px, ${activeOffsetY}px) scale(${scale})`;

  const logoStyle: React.CSSProperties = {
    transform,
    transformOrigin,
    ...(activeWidth && activeWidth > 0 ? { width: `${activeWidth}px`, maxWidth: 'none' } : {}),
  };

  // Sizing definitions for symbol
  const symbolSizeClasses: Record<string, string> = {
    icon: 'h-8 w-8',
    compact: 'h-8 w-8',
    sidebar: 'h-10 w-10',
    header: 'h-10 w-10',
    horizontal: 'h-10 w-10',
    landing: 'h-10 w-10 sm:h-11 sm:w-11',
    auth: 'h-14 w-14 sm:h-16 sm:w-16',
    invoice: 'h-12 w-12',
    footer: 'h-9 w-9',
    full: 'h-12 w-12',
  };

  // Typography sizing per variant
  const titleSizeClasses: Record<string, string> = {
    compact: 'text-base sm:text-lg',
    sidebar: 'text-xl tracking-tight',
    header: 'text-xl tracking-tight',
    horizontal: 'text-xl tracking-tight',
    landing: 'text-xl sm:text-2xl tracking-tight',
    auth: 'text-2xl sm:text-3xl tracking-tight',
    invoice: 'text-2xl tracking-tight',
    footer: 'text-lg tracking-tight',
    full: 'text-2xl tracking-tight',
  };

  const taglineSizeClasses: Record<string, string> = {
    compact: 'text-[7.5px] tracking-[0.14em]',
    sidebar: 'text-[9px] tracking-[0.18em]',
    header: 'text-[9px] tracking-[0.18em]',
    horizontal: 'text-[9px] tracking-[0.18em]',
    landing: 'text-[9.5px] tracking-[0.18em]',
    auth: 'text-[11px] tracking-[0.2em]',
    invoice: 'text-[10px] tracking-[0.18em]',
    footer: 'text-[8.5px] tracking-[0.16em]',
    full: 'text-[10px] tracking-[0.18em]',
  };

  const symbolClass = symbolSizeClasses[variant] || 'h-10 w-10';
  const titleClass = titleSizeClasses[variant] || 'text-xl tracking-tight';
  const tagClass = taglineSizeClasses[variant] || 'text-[9px] tracking-[0.18em]';

  // Format brand name
  const renderWordmark = () => {
    const rawName = appName || 'CowPlug NG';
    const cleanName = rawName.trim();

    if (cleanName.toLowerCase() === 'cowplugng' || cleanName.toLowerCase() === 'cowplug ng' || cleanName.toLowerCase() === 'cowplug') {
      return (
        <span className={cn(
          "font-black leading-none select-none inline-flex items-center gap-0.5",
          dark ? "text-white" : "text-slate-900",
          titleClass,
          textClassName
        )}>
          <span>CowPlug</span>
          <span className="text-emerald-600 ml-1">NG</span>
        </span>
      );
    }

    return (
      <span className={cn(
        "font-black leading-none select-none",
        dark ? "text-white" : "text-slate-900",
        titleClass,
        textClassName
      )}>
        {cleanName}
      </span>
    );
  };

  // Format tagline
  const renderTagline = () => {
    return (
      <span className={cn(
        "font-black uppercase leading-tight select-none whitespace-nowrap mt-1 block",
        dark ? "text-emerald-400" : "text-emerald-800",
        tagClass
      )}>
        SMART AGRICULTURE.
      </span>
    );
  };

  // Pure Icon-only variant (only for collapsed sidebar or explicit icon request)
  if (variant === 'icon') {
    return (
      <div
        onClick={onClick}
        className={cn(
          "inline-flex items-center justify-center select-none shrink-0",
          onClick && "cursor-pointer hover:opacity-90 transition-opacity",
          className
        )}
      >
        <img
          src={activeImageSrc}
          alt={appName || 'CowPlug NG'}
          style={logoStyle}
          className={cn("h-8 w-8 object-contain transition-transform duration-150", imgClassName)}
          referrerPolicy="no-referrer"
          onError={() => {
            if (!hasImageError && logoUrl) {
              setHasImageError(true);
            } else {
              setHasFallbackError(true);
            }
          }}
        />
      </div>
    );
  }

  // Auth variant: Centered or horizontal corporate lockup
  if (variant === 'auth') {
    return (
      <div
        onClick={onClick}
        className={cn(
          "flex flex-col items-center justify-center select-none mb-6",
          onClick && "cursor-pointer hover:opacity-90 transition-opacity",
          className
        )}
      >
        <div className="flex items-center gap-3.5 mb-2">
          {!hasFallbackError && (
            <div className="shrink-0 flex items-center justify-center">
              <img
                src={activeImageSrc}
                alt={appName || 'CowPlug NG'}
                style={logoStyle}
                className={cn(
                  "object-contain transition-all duration-150",
                  symbolClass,
                  imgClassName
                )}
                referrerPolicy="no-referrer"
                onError={() => {
                  if (!hasImageError && logoUrl) {
                    setHasImageError(true);
                  } else {
                    setHasFallbackError(true);
                  }
                }}
              />
            </div>
          )}
          <div className="flex flex-col items-start justify-center">
            {renderWordmark()}
            {renderTagline()}
          </div>
        </div>
      </div>
    );
  }

  // Complete Brand Presentation: [CowPlugNG logo/symbol]  CowPlug NG
  //                                                       SMART AGRICULTURE.
  return (
    <div
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-3 select-none shrink-0",
        onClick && "cursor-pointer hover:opacity-95 transition-opacity duration-200",
        className
      )}
    >
      {/* Symbol */}
      {!hasFallbackError && (
        <div className="shrink-0 flex items-center justify-center">
          <img
            src={activeImageSrc}
            alt={appName || 'CowPlug NG'}
            style={logoStyle}
            className={cn(
              "object-contain transition-all duration-150",
              symbolClass,
              imgClassName
            )}
            referrerPolicy="no-referrer"
            onError={() => {
              if (!hasImageError && logoUrl) {
                setHasImageError(true);
              } else {
                setHasFallbackError(true);
              }
            }}
          />
        </div>
      )}

      {/* Wordmark + Tagline Lockup */}
      <div className="flex flex-col justify-center min-w-0">
        {renderWordmark()}
        {renderTagline()}
      </div>
    </div>
  );
};


