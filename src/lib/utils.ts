import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  if (isNaN(amount)) return '₦0';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(timestamp: number) {
  if (!timestamp || isNaN(timestamp)) return 'N/A';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(timestamp));
  } catch (e) {
    return 'N/A';
  }
}

export function formatRelativeTime(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return '';
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 0) return 'Just now';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 45) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

export function formatFullDateTime(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return 'N/A';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date(timestamp));
  } catch (e) {
    return 'N/A';
  }
}

/**
 * Cleanly format weight values to avoid duplication like "30.0KGkg" or missing units.
 * Normalizes to "X kg" consistently.
 */
export function formatWeight(weight: string | number | undefined | null): string {
  if (weight === undefined || weight === null || weight === '') return 'N/A';
  if (typeof weight === 'number') {
    if (isNaN(weight)) return 'N/A';
    return `${weight} kg`;
  }
  const cleanStr = String(weight).trim();
  if (!cleanStr) return 'N/A';

  // Strip any trailing kg, KG, Kg, kgs, etc. (case-insensitive)
  const numericMatch = cleanStr.match(/^([0-9]+(?:\.[0-9]+)?)/);
  if (numericMatch) {
    return `${numericMatch[1]} kg`;
  }
  // Fallback: replace any duplicate variations
  const stripped = cleanStr.replace(/(?:kg|KG|Kg|kG)+$/i, '').trim();
  return `${stripped} kg`;
}

export const HISTORY_STATUSES = ['SOLD', 'DELIVERED', 'DECEASED', 'TRANSFERRED', 'ARCHIVED', 'RETIRED'];

export function isHistoryAnimal(a: any): boolean {
  if (!a) return false;
  const status = (a.status || '').toUpperCase();
  const liqStatus = (a.liquidationStatus || '').toUpperCase();
  return HISTORY_STATUSES.includes(status) || liqStatus === 'SOLD' || liqStatus === 'COMPLETED';
}


