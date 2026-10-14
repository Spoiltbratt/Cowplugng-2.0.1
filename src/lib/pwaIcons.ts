import { AppBrandingConfig } from '../types';

/**
 * Generates transformed Cloudinary URLs or local fallback URLs for PWA icons
 * Ensures icons are square, centered on a clean white background, and adhere to Android maskable safe-zones.
 */
export function getPwaIconUrl(
  logoUrl?: string,
  size: 192 | 512 | 180 | 64 | 32 = 512,
  maskable: boolean = false,
  version?: number | string
): string {
  if (!logoUrl || typeof logoUrl !== 'string' || !logoUrl.trim()) {
    if (maskable) {
      return size === 192 ? '/icons/icon-maskable-192x192.png' : '/icons/icon-maskable-512x512.png';
    }
    if (size === 180) return '/icons/apple-touch-icon.png';
    if (size === 64 || size === 32) return '/favicon.png';
    return size === 192 ? '/icons/icon-192x192.png' : '/icons/icon-512x512.png';
  }

  const cleanUrl = logoUrl.trim();

  // If it's a Cloudinary URL, use Cloudinary's on-the-fly transformation pipeline
  if (cleanUrl.includes('cloudinary.com') && cleanUrl.includes('/upload/')) {
    let transformation = '';
    if (maskable) {
      // For maskable icons (Android Adaptive Icons), keep the graphic within the 65% safe zone
      const innerSize = Math.round(size * 0.65);
      transformation = `b_white,c_pad,h_${innerSize},w_${innerSize}/b_white,c_pad,h_${size},w_${size}`;
    } else {
      // Standard icon: center cleanly on white square
      transformation = `b_white,c_pad,h_${size},w_${size}`;
    }

    const transformedUrl = cleanUrl.replace('/upload/', `/upload/${transformation}/`);
    return version ? `${transformedUrl}${transformedUrl.includes('?') ? '&' : '?'}v=${version}` : transformedUrl;
  }

  // Fallback for non-Cloudinary direct URLs
  return version ? `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}v=${version}` : cleanUrl;
}

/**
 * Updates DOM head elements (favicons, apple-touch-icon, manifest link, theme-color) dynamically in real-time
 */
export function updateDocumentPwaMetadata(branding: AppBrandingConfig): void {
  if (typeof document === 'undefined') return;

  const appName = branding.appName || 'CowPlugNG';
  const logoUrl = branding.logoUrl;
  const version = branding.updatedAt || Date.now();
  const primaryColor = branding.primaryColor || '#064e3b';

  // 1. Update Apple Touch Icon
  const appleIconUrl = getPwaIconUrl(logoUrl, 180, false, version);
  const appleTouchIcons = document.querySelectorAll<HTMLLinkElement>("link[rel='apple-touch-icon']");
  if (appleTouchIcons.length > 0) {
    appleTouchIcons.forEach((el) => {
      el.href = appleIconUrl;
    });
  } else {
    const link = document.createElement('link');
    link.rel = 'apple-touch-icon';
    link.href = appleIconUrl;
    document.head.appendChild(link);
  }

  // 2. Update Favicons (32x32, 192x192)
  const favicon32Url = getPwaIconUrl(logoUrl, 32, false, version);
  const favicon192Url = getPwaIconUrl(logoUrl, 192, false, version);

  const favicons = document.querySelectorAll<HTMLLinkElement>("link[rel='icon']");
  favicons.forEach((el) => {
    const sizes = el.getAttribute('sizes');
    if (sizes === '192x192') {
      el.href = favicon192Url;
    } else if (sizes === '32x32' || !sizes) {
      el.href = favicon32Url;
    }
  });

  // 3. Update Web Manifest link with cache-busting version
  const manifestLink = document.querySelector<HTMLLinkElement>("link[rel='manifest']");
  if (manifestLink) {
    manifestLink.href = `/manifest.webmanifest?v=${version}`;
  }

  // 4. Update Meta Tags
  const themeColorMeta = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");
  if (themeColorMeta) {
    themeColorMeta.content = primaryColor;
  }

  const appTitleMeta = document.querySelector<HTMLMetaElement>("meta[name='apple-mobile-web-app-title']");
  if (appTitleMeta) {
    appTitleMeta.content = appName;
  }

  const appNameMeta = document.querySelector<HTMLMetaElement>("meta[name='application-name']");
  if (appNameMeta) {
    appNameMeta.content = appName;
  }
}
