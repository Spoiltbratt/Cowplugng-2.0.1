import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db, logActivity, handleFirestoreError, OperationType, sanitizeFirestoreData } from './firebase';
import { uploadToCloudinary } from './cloudinary';
import { useAuth } from './AuthContext';
import { AppBrandingConfig } from '../types';
import { updateDocumentPwaMetadata } from './pwaIcons';

export const DEFAULT_BRANDING: AppBrandingConfig = {
  appName: 'CowPlugNG',
  tagline: 'Smart Agriculture. Secure Tomorrow.',
  primaryColor: '#059669', // Emerald-600
  fontFamily: 'Manrope',
  logoUrl: '', // Defaults to built-in logo (empty string for Firestore safety)
  cloudinaryPublicId: '',
  logoSize: 100,
  logoOffsetX: 0,
  logoOffsetY: 0,
  logoWidth: undefined,
};

interface BrandingContextType {
  branding: AppBrandingConfig;
  logoUrl?: string;
  appName: string;
  tagline: string;
  primaryColor: string;
  fontFamily: string;
  isLoading: boolean;
  isCustomLogoActive: boolean;
  uploadLogo: (
    file: File, 
    onProgress?: (progress: number) => void
  ) => Promise<{ 
    url: string; 
    publicId?: string;
    dimensions: { width: number; height: number }; 
    fileSize: number; 
    fileType: string 
  }>;
  saveBranding: (newBranding: Partial<AppBrandingConfig>) => Promise<void>;
  removeLogo: () => Promise<void>;
  resetToDefault: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, isAdmin, isSuperAdmin } = useAuth();
  const [branding, setBranding] = useState<AppBrandingConfig>(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to real-time branding updates from Firestore (settings/global)
  useEffect(() => {
    const settingsDocRef = doc(db, 'settings', 'global');

    const unsubscribe = onSnapshot(
      settingsDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const brandingData = data.branding || {};
          const customUrl = (typeof brandingData.logoUrl === 'string' && brandingData.logoUrl.trim().length > 0)
            ? brandingData.logoUrl.trim()
            : undefined;

          const resolvedBranding: AppBrandingConfig = {
            appName: data.companyName || brandingData.appName || DEFAULT_BRANDING.appName || 'CowPlugNG',
            tagline: brandingData.tagline || DEFAULT_BRANDING.tagline || 'Smart Agriculture. Secure Tomorrow.',
            primaryColor: brandingData.primaryColor || DEFAULT_BRANDING.primaryColor || '#059669',
            fontFamily: brandingData.fontFamily || DEFAULT_BRANDING.fontFamily || 'Manrope',
            logoUrl: customUrl,
            cloudinaryPublicId: brandingData.cloudinaryPublicId || undefined,
            updatedAt: brandingData.updatedAt || undefined,
            updatedBy: brandingData.updatedBy || undefined,
            updatedByName: brandingData.updatedByName || undefined,
            fileSize: brandingData.fileSize || undefined,
            dimensions: brandingData.dimensions || undefined,
            fileType: brandingData.fileType || undefined,
            logoSize: typeof brandingData.logoSize === 'number' ? brandingData.logoSize : 100,
            logoOffsetX: typeof brandingData.logoOffsetX === 'number' ? brandingData.logoOffsetX : 0,
            logoOffsetY: typeof brandingData.logoOffsetY === 'number' ? brandingData.logoOffsetY : 0,
            logoWidth: typeof brandingData.logoWidth === 'number' && brandingData.logoWidth > 0 ? brandingData.logoWidth : undefined,
          };

          setBranding(resolvedBranding);
          updateDocumentPwaMetadata(resolvedBranding);
        } else {
          setBranding(DEFAULT_BRANDING);
          updateDocumentPwaMetadata(DEFAULT_BRANDING);
        }
        setIsLoading(false);
      },
      (error) => {
        console.warn('Could not listen to branding settings, using defaults:', error);
        handleFirestoreError(error, OperationType.GET, 'settings/global');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Helper to validate and calculate image dimensions
  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: 0, height: 0 });
      };
      img.src = url;
    });
  };

  // Upload logo to Cloudinary
  const uploadLogo = useCallback(
    async (
      file: File,
      onProgress?: (progress: number) => void
    ): Promise<{
      url: string;
      publicId?: string;
      dimensions: { width: number; height: number };
      fileSize: number;
      fileType: string;
    }> => {
      // Format validation
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        throw new Error('invalid-argument: Unsupported format. Please upload a PNG, JPG, WebP, or SVG image.');
      }

      // Max size: 5MB
      const maxSizeBytes = 5 * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        throw new Error('invalid-argument: File size exceeds the 5MB limit. Please choose a smaller image.');
      }

      const dimensions = await getImageDimensions(file);
      if (onProgress) onProgress(25);

      try {
        if (onProgress) onProgress(50);
        console.log('[Branding Upload] Uploading logo to Cloudinary...');
        const result = await uploadToCloudinary(file, profile?.uid || 'admin', 'branding');

        // Step 4 & 5: Validate before proceeding
        console.log('[Branding Upload] Cloudinary response received:', {
          response: result,
          secureUrl: result?.url,
          urlType: typeof result?.url,
          urlValue: result?.url,
          publicId: result?.publicId,
        });

        if (!result || typeof result !== 'object') {
          throw new Error('invalid-response: Cloudinary upload did not return a valid result object.');
        }

        if (!result.url || typeof result.url !== 'string' || result.url.trim() === '') {
          throw new Error('invalid-argument: Cloudinary did not return a valid URL string.');
        }

        const trimmedUrl = result.url.trim();
        if (!trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('data:')) {
          throw new Error(`invalid-argument: Cloudinary returned an invalid URL protocol: "${trimmedUrl.substring(0, 15)}..."`);
        }

        if (onProgress) onProgress(100);

        return {
          url: trimmedUrl,
          publicId: result.publicId,
          dimensions,
          fileSize: file.size,
          fileType: file.type,
        };
      } catch (err: any) {
        console.error('[Branding Upload Error]:', err);
        throw err;
      }
    },
    [profile]
  );

  // Save branding changes to Firestore document settings/global
  const saveBranding = useCallback(
    async (newBranding: Partial<AppBrandingConfig>): Promise<void> => {
      const settingsDocRef = doc(db, 'settings', 'global');
      
      let existingData: Record<string, any> = {};
      try {
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          existingData = docSnap.data();
        }
      } catch (getErr: any) {
        console.warn('[Branding Save] Could not read existing settings/global doc, proceeding with merge:', getErr);
      }
      
      const existingBranding = existingData.branding || {};

      // Defensive values construction - strictly NO undefined values
      const targetAppName = (typeof newBranding.appName === 'string' && newBranding.appName.trim() !== '')
        ? newBranding.appName.trim()
        : (existingBranding.appName || existingData.companyName || DEFAULT_BRANDING.appName || 'CowPlugNG');

      const targetTagline = (typeof newBranding.tagline === 'string')
        ? newBranding.tagline.trim()
        : (existingBranding.tagline || DEFAULT_BRANDING.tagline || 'Smart Agriculture. Secure Tomorrow.');

      const targetPrimaryColor = (typeof newBranding.primaryColor === 'string' && newBranding.primaryColor.trim() !== '')
        ? newBranding.primaryColor.trim()
        : (existingBranding.primaryColor || DEFAULT_BRANDING.primaryColor || '#059669');

      const targetFontFamily = (typeof newBranding.fontFamily === 'string' && newBranding.fontFamily.trim() !== '')
        ? newBranding.fontFamily.trim()
        : (existingBranding.fontFamily || DEFAULT_BRANDING.fontFamily || 'Manrope');

      // Determine final logo URL
      let finalLogoUrl = '';
      if (newBranding.logoUrl !== undefined) {
        finalLogoUrl = (typeof newBranding.logoUrl === 'string' && newBranding.logoUrl.trim() !== '')
          ? newBranding.logoUrl.trim()
          : '';
      } else if (typeof existingBranding.logoUrl === 'string' && existingBranding.logoUrl.trim() !== '') {
        finalLogoUrl = existingBranding.logoUrl.trim();
      }

      const targetLogoSize = typeof newBranding.logoSize === 'number'
        ? newBranding.logoSize
        : (typeof existingBranding.logoSize === 'number' ? existingBranding.logoSize : 100);

      const targetLogoOffsetX = typeof newBranding.logoOffsetX === 'number'
        ? newBranding.logoOffsetX
        : (typeof existingBranding.logoOffsetX === 'number' ? existingBranding.logoOffsetX : 0);

      const targetLogoOffsetY = typeof newBranding.logoOffsetY === 'number'
        ? newBranding.logoOffsetY
        : (typeof existingBranding.logoOffsetY === 'number' ? existingBranding.logoOffsetY : 0);

      let targetLogoWidth: number | undefined = undefined;
      if (newBranding.logoWidth !== undefined) {
        targetLogoWidth = typeof newBranding.logoWidth === 'number' && newBranding.logoWidth > 0 ? newBranding.logoWidth : undefined;
      } else if (typeof existingBranding.logoWidth === 'number' && existingBranding.logoWidth > 0) {
        targetLogoWidth = existingBranding.logoWidth;
      }

      const brandingPayload: Record<string, any> = {
        ...existingBranding,
        appName: targetAppName,
        tagline: targetTagline,
        primaryColor: targetPrimaryColor,
        fontFamily: targetFontFamily,
        logoSize: targetLogoSize,
        logoOffsetX: targetLogoOffsetX,
        logoOffsetY: targetLogoOffsetY,
        updatedAt: Date.now(),
        updatedBy: profile?.uid || 'admin',
        updatedByName: profile?.displayName || 'Administrator',
      };

      if (targetLogoWidth !== undefined) {
        brandingPayload.logoWidth = targetLogoWidth;
      } else {
        delete brandingPayload.logoWidth;
      }

      if (finalLogoUrl) {
        brandingPayload.logoUrl = finalLogoUrl;
        
        const publicIdVal = newBranding.cloudinaryPublicId ?? existingBranding.cloudinaryPublicId;
        if (publicIdVal) brandingPayload.cloudinaryPublicId = publicIdVal;

        const fileSizeVal = newBranding.fileSize ?? existingBranding.fileSize;
        if (fileSizeVal !== undefined && fileSizeVal !== null) brandingPayload.fileSize = fileSizeVal;

        const dimensionsVal = newBranding.dimensions ?? existingBranding.dimensions;
        if (dimensionsVal) brandingPayload.dimensions = dimensionsVal;

        const fileTypeVal = newBranding.fileType ?? existingBranding.fileType;
        if (fileTypeVal) brandingPayload.fileType = fileTypeVal;
      } else {
        // Safe empty values for reset/default fallback
        brandingPayload.logoUrl = '';
        brandingPayload.cloudinaryPublicId = '';
      }

      // Ensure absolutely NO undefined values are passed to setDoc
      const updatedSettingsDoc = sanitizeFirestoreData({
        ...existingData,
        companyName: targetAppName,
        branding: brandingPayload,
      });

      console.log('[Branding Save] Writing branding payload to settings/global in Firestore:', {
        companyName: targetAppName,
        logoUrl: brandingPayload.logoUrl,
        branding: brandingPayload
      });

      try {
        await setDoc(settingsDocRef, updatedSettingsDoc, { merge: true });
        console.log('[Branding Save] Successfully persisted branding to settings/global');

        // Immediately update centralized state so UI reflects new logo without needing reload
        const nextBranding: AppBrandingConfig = {
          appName: targetAppName,
          tagline: targetTagline,
          primaryColor: targetPrimaryColor,
          fontFamily: targetFontFamily,
          logoUrl: finalLogoUrl || undefined,
          cloudinaryPublicId: brandingPayload.cloudinaryPublicId || undefined,
          fileSize: brandingPayload.fileSize,
          dimensions: brandingPayload.dimensions,
          fileType: brandingPayload.fileType,
          logoSize: targetLogoSize,
          logoOffsetX: targetLogoOffsetX,
          logoOffsetY: targetLogoOffsetY,
          logoWidth: targetLogoWidth,
          updatedAt: brandingPayload.updatedAt,
          updatedBy: brandingPayload.updatedBy,
          updatedByName: brandingPayload.updatedByName,
        };
        setBranding(nextBranding);
        updateDocumentPwaMetadata(nextBranding);
      } catch (firestoreErr: any) {
        console.error('[Branding Save Firestore Error]:', firestoreErr, {
          code: firestoreErr?.code,
          message: firestoreErr?.message,
          userUid: profile?.uid,
          userEmail: profile?.email,
          userRole: profile?.role
        });
        throw firestoreErr;
      }

      // Non-blocking activity log
      try {
        await logActivity(
          profile?.uid || 'admin',
          profile?.displayName || 'Administrator',
          'UPDATE_APP_BRANDING',
          'SETTING',
          'global',
          `Updated application branding: Logo ${brandingPayload.logoUrl ? 'Cloudinary custom' : 'default'}, Name: ${targetAppName}`
        );
      } catch (logErr) {
        console.warn('[Branding Save] Activity log failed (non-blocking):', logErr);
      }
    },
    [profile]
  );

  // Remove custom logo and revert to default built-in CowPlugNG logo
  const removeLogo = useCallback(async (): Promise<void> => {
    if (!isAdmin && !isSuperAdmin) {
      throw new Error('Unauthorized: Only administrators can remove the application logo.');
    }

    const settingsDocRef = doc(db, 'settings', 'global');
    const docSnap = await getDoc(settingsDocRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data();
    const existingBranding = data.branding || {};

    const updatedBranding = sanitizeFirestoreData({
      ...existingBranding,
      appName: existingBranding.appName || data.companyName || 'CowPlugNG',
      tagline: existingBranding.tagline || 'Smart Agriculture. Secure Tomorrow.',
      primaryColor: existingBranding.primaryColor || '#059669',
      fontFamily: existingBranding.fontFamily || 'Manrope',
      logoUrl: '',
      cloudinaryPublicId: '',
      updatedAt: Date.now(),
      updatedBy: profile?.uid || 'admin',
      updatedByName: profile?.displayName || 'Administrator',
    });

    delete (updatedBranding as any).fileSize;
    delete (updatedBranding as any).dimensions;
    delete (updatedBranding as any).fileType;
    delete (updatedBranding as any).storagePath;

    const cleanSettingsDoc = sanitizeFirestoreData({
      ...data,
      branding: updatedBranding,
    });

    await setDoc(settingsDocRef, cleanSettingsDoc, { merge: true });

    await logActivity(
      profile?.uid || 'admin',
      profile?.displayName || 'Administrator',
      'REMOVE_APP_LOGO',
      'SETTING',
      'global',
      'Removed custom application logo and reverted to default CowPlugNG branding.'
    );
  }, [isAdmin, isSuperAdmin, profile]);

  // Reset all branding to default
  const resetToDefault = useCallback(async (): Promise<void> => {
    if (!isAdmin && !isSuperAdmin) {
      throw new Error('Unauthorized: Only administrators can reset branding.');
    }
    await saveBranding({
      appName: 'CowPlugNG',
      tagline: 'Smart Agriculture. Secure Tomorrow.',
      primaryColor: '#059669',
      fontFamily: 'Manrope',
      logoUrl: '',
      cloudinaryPublicId: '',
      logoSize: 100,
      logoOffsetX: 0,
      logoOffsetY: 0,
      logoWidth: undefined,
    });
  }, [isAdmin, isSuperAdmin, saveBranding]);

  return (
    <BrandingContext.Provider
      value={{
        branding,
        logoUrl: branding.logoUrl,
        appName: branding.appName || DEFAULT_BRANDING.appName || 'CowPlugNG',
        tagline: branding.tagline || DEFAULT_BRANDING.tagline || 'Smart Agriculture. Secure Tomorrow.',
        primaryColor: branding.primaryColor || DEFAULT_BRANDING.primaryColor || '#059669',
        fontFamily: branding.fontFamily || DEFAULT_BRANDING.fontFamily || 'Manrope',
        isLoading,
        isCustomLogoActive: !!branding.logoUrl && branding.logoUrl.trim() !== '',
        uploadLogo,
        saveBranding,
        removeLogo,
        resetToDefault,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
};

export const useAppBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useAppBranding must be used within a BrandingProvider');
  }
  return context;
};
