import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  title?: string;
  icon?: LucideIcon;
  subtitle?: string;
}

export const Card: React.FC<CardProps> = ({ children, className, bodyClassName, title, icon: Icon, subtitle }) => {
  return (
    <div className={cn("bg-brand-card border border-brand-border rounded-xl overflow-hidden", className)}>
      {(title || Icon) && (
        <div className="px-6 py-4 border-b border-brand-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              {title}
              {title === "Sourcing Requests" && (
                <span className="bg-brand-muted text-[10px] px-1.5 py-0.5 rounded text-gray-400 uppercase tracking-widest font-bold">Live Feed</span>
              )}
            </h3>
            {subtitle && <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{subtitle}</p>}
          </div>
          {Icon && <Icon className="w-4 h-4 text-brand-green" />}
        </div>
      )}
      <div className={cn("p-6", bodyClassName)}>{children}</div>
    </div>
  );
};

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
    primary: "bg-brand-green text-white hover:bg-green-500 shadow-lg shadow-brand-green/10",
    secondary: "bg-brand-orange text-white hover:bg-orange-600",
    outline: "border border-brand-border text-gray-300 hover:text-white hover:bg-brand-muted",
    ghost: "text-gray-500 hover:text-white hover:bg-brand-muted",
    danger: "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20",
  };

  const sizes = {
    sm: "px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
    md: "px-4 py-2 text-sm font-semibold",
    lg: "px-6 py-3 text-base font-semibold",
  };

  return (
    <button 
      className={cn(
        "rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : null}
      {children}
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
    <div className="space-y-1.5 w-full">
      {label && <label className="text-sm font-medium text-gray-300">{label}</label>}
      <div className="relative">
        <input 
          className={cn(
            "w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all",
            rightElement && "pr-11",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
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
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; variant?: 'success' | 'warning' | 'info' | 'error' | 'default' }> = ({ children, variant = 'default' }) => {
  const variants = {
    success: "bg-brand-green/10 text-brand-green border-brand-green/20",
    warning: "bg-brand-orange/10 text-brand-orange border-brand-orange/20",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    error: "bg-red-500/10 text-red-500 border-red-500/20",
    default: "bg-brand-muted text-gray-400 border-brand-border",
  };

  return (
    <span className={cn("px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", variants[variant])}>
      {children}
    </span>
  );
};
