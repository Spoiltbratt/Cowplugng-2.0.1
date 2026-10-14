import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LucideIcon, X, TrendingUp, TrendingDown, Inbox, Eye } from 'lucide-react';
import { cn } from '../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  title?: string;
  icon?: LucideIcon;
  subtitle?: string;
  action?: React.ReactNode;
}

// ... (Replaces rounded-2xl with rounded-sm, rounded-xl with rounded-sm, etc. - selectively applied to main components)
export const Card: React.FC<CardProps> = ({ children, className, bodyClassName, title, icon: Icon, subtitle, action }) => {
  return (
    <div className={cn("bg-white border border-slate-200/60 rounded-sm overflow-hidden shadow-sm min-w-0", className)}>
      {(title || Icon || action) && (
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 md:px-8 md:py-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/30 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {Icon && (
              <div className="p-2 sm:p-2.5 bg-emerald-50 rounded-sm text-emerald-700 border border-emerald-100/60 shadow-sm shrink-0">
                <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="text-xs sm:text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2 truncate">
                  <span className="truncate">{title}</span>
                  {title === "Sourcing Requests" && (
                    <span className="bg-emerald-100/60 text-emerald-800 text-[9px] px-2 py-0.5 rounded-sm font-semibold uppercase tracking-widest shrink-0">
                      Live Feed
                    </span>
                  )}
                </h3>
              )}
              {subtitle && <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn("p-4 sm:p-6 md:p-8 min-w-0", bodyClassName)}>{children}</div>
    </div>
  );
};
// ... (Continued replacements in UI.tsx)


interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading, 
  className, 
  ...props 
}) => {
  const variants = {
    primary: "bg-emerald-700 text-white hover:bg-emerald-800 shadow-[0_4px_12px_rgba(5,150,105,0.25)] active:scale-[0.98] border border-emerald-600 font-semibold",
    secondary: "bg-slate-900 text-white hover:bg-slate-800 shadow-md active:scale-[0.98] border border-slate-950 font-semibold",
    outline: "border-2 border-slate-100 text-slate-700 bg-white hover:bg-emerald-50 hover:border-emerald-600/30 hover:text-emerald-700 shadow-xs font-semibold",
    ghost: "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 font-semibold",
    danger: "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100/80 font-semibold",
  };

  const sizes = {
    sm: "px-4 py-2 text-[10px] uppercase tracking-widest",
    md: "px-6 py-3 text-sm tracking-tight",
    lg: "px-8 py-4 text-base tracking-tight",
  };

  return (
    <button 
      className={cn(
        "rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed select-none font-sans cursor-pointer",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : null}
      {children}
    </button>
  );
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  isLoading,
  className,
  ...props
}) => {
  const variants = {
    primary: "bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm active:scale-95 border border-emerald-600",
    secondary: "bg-slate-900 text-white hover:bg-slate-800 shadow-sm active:scale-95 border border-slate-950",
    outline: "border border-slate-200 text-slate-700 bg-white hover:bg-emerald-50 hover:border-emerald-500/40 hover:text-emerald-700 active:scale-95 shadow-2xs",
    ghost: "text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 active:scale-95",
    danger: "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 active:scale-95",
  };

  const sizes = {
    sm: "w-8 h-8 rounded-xl",
    md: "w-10 h-10 rounded-xl",
    lg: "w-12 h-12 rounded-2xl",
  };

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none group relative",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <Icon className={cn(iconSizes[size], "transition-transform duration-200 group-hover:scale-110")} />
      )}
    </button>
  );
};


export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; rightElement?: React.ReactNode }> = ({ 
  label, 
  error, 
  rightElement,
  className, 
  ...props 
}) => {
  const finalValue = props.hasOwnProperty('value') ? (props.value ?? '') : undefined;
  
  return (
    <div className="space-y-2 w-full">
      {label && <label className="text-[10px] font-medium uppercase tracking-widest text-slate-400 ml-1">{label}</label>}
      <div className="relative">
        <input 
          className={cn(
            "w-full bg-slate-50/50 border border-slate-200/80 rounded-2xl px-5 py-3.5 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 focus:bg-white transition-all shadow-sm",
            rightElement && "pr-12",
            error && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10",
            className
          )}
          {...props}
          value={finalValue}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  );
};

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }> = ({
  label,
  error,
  className,
  children,
  ...props
}) => {
  return (
    <div className="space-y-1.5 w-full">
      {label && <label className="text-xs font-bold uppercase tracking-wider text-slate-700">{label}</label>}
      <select
        className={cn(
          "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all shadow-xs cursor-pointer",
          error && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; variant?: 'success' | 'warning' | 'info' | 'error' | 'default'; className?: string }> = ({ children, variant = 'default', className }) => {
  const variants = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200/60 font-semibold",
    warning: "bg-amber-50 text-amber-700 border-amber-200/60 font-semibold",
    info: "bg-sky-50 text-sky-700 border-sky-200/60 font-semibold",
    error: "bg-rose-50 text-rose-700 border-rose-200/60 font-semibold",
    default: "bg-slate-100 text-slate-700 border-slate-200/60 font-semibold",
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] uppercase tracking-[0.1em] border shadow-xs", variants[variant], className)}>
      {children}
    </span>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  className?: string;
  footer?: React.ReactNode;
  onClick?: () => void;
}

export const ModernStatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  className,
  footer,
  onClick
}) => {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group",
        onClick && "cursor-pointer hover:border-emerald-200",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-50 rounded-xl text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
             <Icon className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
        </div>
        <button className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
           <Eye className="w-4 h-4" />
        </button>
      </div>
      <h3 className="text-3xl font-bold text-slate-900 tracking-tighter mb-1">{value}</h3>
      <p className="text-xs text-slate-400 font-medium mb-4">{subtext}</p>
      {footer && (
        <div className="pt-4 border-t border-slate-100 mt-auto">
          {footer}
        </div>
      )}
    </div>
  );
};

export const CompactStatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  className,
  onClick
}) => {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group",
        onClick && "cursor-pointer hover:border-emerald-200",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">{title}</p>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">{value}</h3>
          {subtext && <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">{subtext}</p>}
        </div>
        <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:text-emerald-700 transition-colors">
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  className,
  onClick
}) => {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white border border-slate-200/60 rounded-[2rem] p-8 shadow-[0_10px_30px_rgba(0,0,0,0.02)] transition-all duration-500 relative overflow-hidden group",
        onClick && "cursor-pointer hover:border-emerald-600/30 hover:shadow-[0_20px_50px_rgba(5,150,105,0.08)] hover:-translate-y-1",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4 relative z-10">
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{value}</h3>
          {subtext && <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{subtext}</p>}
        </div>
        <div className="p-4 bg-slate-50 group-hover:bg-emerald-700 rounded-2xl text-slate-400 group-hover:text-white border border-slate-100 group-hover:border-emerald-600 shadow-sm transition-all duration-500 group-hover:rotate-6">
          <Icon className="w-6 h-6" />
        </div>
      </div>

      {trend && (
        <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between text-[11px] relative z-10">
          <span className={cn("inline-flex items-center gap-1 font-black", trend.isPositive !== false ? "text-emerald-600" : "text-rose-600")}>
            {trend.isPositive !== false ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {trend.value}
          </span>
          <span className="text-slate-400 font-bold uppercase tracking-wider">vs prev. month</span>
        </div>
      )}
      
      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -mr-12 -mt-12" />
    </div>
  );
};

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, badge, actions }) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 mb-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
          {badge && <Badge variant="success">{badge}</Badge>}
        </div>
        {subtitle && <p className="text-sm text-slate-600 font-medium max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
};

export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
}> = ({ isOpen, onClose, title, subtitle, children, maxWidth = 'lg' }) => {
  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    full: 'max-w-full'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 15 }}
            transition={{ 
              type: "spring", 
              damping: 30, 
              stiffness: 400,
              mass: 0.8
            }}
            className={cn(
              "relative w-full bg-white rounded-2xl sm:rounded-[2rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden z-10 my-2 sm:my-6 max-h-[94vh] flex flex-col",
              widthClasses[maxWidth]
            )}
          >
            <div className="px-4 py-3.5 sm:px-6 sm:py-5 md:px-8 md:py-6 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/30 shrink-0">
              <div className="min-w-0 pr-2">
                <h3 className="text-base sm:text-lg md:text-2xl font-bold text-slate-900 tracking-tight truncate">{title}</h3>
                {subtitle && <p className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.15em] mt-1 truncate">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 sm:p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl sm:rounded-2xl transition-all cursor-pointer group shadow-sm border border-slate-100 shrink-0 min-w-[38px] min-h-[38px] flex items-center justify-center"
                title="Close modal"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6 group-hover:rotate-90 transition-transform duration-500" />
              </button>
            </div>
            <div className="p-3.5 sm:p-6 md:p-8 max-h-[calc(94vh-85px)] overflow-y-auto no-scrollbar min-w-0">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("animate-pulse bg-slate-200/80 rounded-xl", className)} />
);

export const StatCardSkeleton: React.FC = () => (
  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs relative overflow-hidden space-y-3">
    <div className="flex justify-between items-start">
      <div className="space-y-2.5 w-2/3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-36" />
      </div>
      <Skeleton className="w-11 h-11 rounded-2xl shrink-0" />
    </div>
  </div>
);

export const CardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4", className)}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-xl" />
        <Skeleton className="h-5 w-40" />
      </div>
      <Skeleton className="h-7 w-20 rounded-lg" />
    </div>
    <div className="space-y-3 pt-2">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  </div>
);

export const DashboardSkeleton: React.FC<{ title?: string }> = ({ title = "Loading Dashboard..." }) => (
  <div className="space-y-8 animate-in fade-in duration-300">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-28 rounded-xl" />
        <Skeleton className="h-9 w-36 rounded-xl" />
      </div>
    </div>

    {/* Stat Cards Skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>

    {/* Main Content Grid Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  </div>
);

export const EmptyState: React.FC<{
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon: Icon = Inbox, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-slate-900 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};

