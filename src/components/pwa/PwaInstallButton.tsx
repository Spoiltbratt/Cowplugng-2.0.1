import React from 'react';
import { Download, Smartphone, Sparkles, Check } from 'lucide-react';
import { usePwa } from '../../lib/PwaContext';
import { useAppBranding } from '../../lib/BrandingContext';
import { cn } from '../../lib/utils';

export interface PwaInstallButtonProps {
  variant?: 'primary' | 'outline' | 'header' | 'sidebar' | 'banner' | 'compact' | 'pill';
  className?: string;
  label?: string;
  showIcon?: boolean;
  onClickCustom?: () => void;
}

export const PwaInstallButton: React.FC<PwaInstallButtonProps> = ({
  variant = 'primary',
  className,
  label,
  showIcon = true,
  onClickCustom
}) => {
  const { 
    isInstallable, 
    isStandalone, 
    isInstalled, 
    promptInstall, 
    openInstallModal 
  } = usePwa();
  const { appName } = useAppBranding();

  // If app is already opened in standalone mode, hide the install button completely
  if (isStandalone) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClickCustom) {
      onClickCustom();
    } else {
      promptInstall();
    }
  };

  const displayName = appName || 'CowPlug NG';
  const defaultText = label || `Install ${displayName}`;

  // Header button style (for desktop header navigation)
  if (variant === 'header') {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200/80 transition-all shadow-xs cursor-pointer group",
          className
        )}
        title={`Install ${displayName} to your home screen or desktop`}
      >
        {showIcon && <Smartphone className="w-4 h-4 text-emerald-700 group-hover:scale-110 transition-transform" />}
        <span className="truncate whitespace-nowrap">{defaultText}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      </button>
    );
  }

  // Sidebar widget style (for Dashboard sidebar footer / quick action)
  if (variant === 'sidebar') {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-emerald-900 to-emerald-950 text-white shadow-md hover:shadow-lg transition-all group cursor-pointer border border-emerald-800/40 text-left",
          className
        )}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Smartphone className="w-4 h-4 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate leading-tight">Install App</p>
            <p className="text-[10px] text-emerald-200/80 truncate">Fast standalone access</p>
          </div>
        </div>
        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 group-hover:bg-emerald-500/30 transition-colors">
          <Download className="w-3.5 h-3.5" />
        </div>
      </button>
    );
  }

  // Compact Pill style (for mobile menus or floating buttons)
  if (variant === 'pill' || variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-100 hover:bg-emerald-200/80 border border-emerald-300/60 transition-all shadow-xs cursor-pointer",
          className
        )}
      >
        {showIcon && <Download className="w-3.5 h-3.5 text-emerald-700" />}
        <span className="whitespace-nowrap">{label || 'Install App'}</span>
      </button>
    );
  }

  // Banner style
  if (variant === 'banner') {
    return (
      <div className={cn("p-4 bg-emerald-900 text-white rounded-2xl flex items-center justify-between gap-4 shadow-lg border border-emerald-800", className)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h4 className="text-sm font-bold leading-tight">Install {displayName} on Your Phone</h4>
            <p className="text-xs text-emerald-200 mt-0.5">One-tap access, live notifications & faster performance.</p>
          </div>
        </div>
        <button
          onClick={handleClick}
          className="px-4 py-2 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 transition-colors cursor-pointer shadow-sm"
        >
          Install Now
        </button>
      </div>
    );
  }

  // Outline variant
  if (variant === 'outline') {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-emerald-800 border-2 border-emerald-600/30 hover:border-emerald-700 hover:bg-emerald-50/80 transition-all cursor-pointer",
          className
        )}
      >
        {showIcon && <Download className="w-4 h-4 text-emerald-700" />}
        <span>{defaultText}</span>
      </button>
    );
  }

  // Default Primary Button
  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-black text-white bg-emerald-700 hover:bg-emerald-800 shadow-lg shadow-emerald-700/20 transition-all cursor-pointer group",
        className
      )}
    >
      {showIcon && <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />}
      <span>{defaultText}</span>
    </button>
  );
};
