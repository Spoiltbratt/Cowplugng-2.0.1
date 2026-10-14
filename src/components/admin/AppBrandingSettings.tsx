import React, { useState, useRef, useEffect } from 'react';
import { 
  Palette, 
  Upload, 
  Trash2, 
  RotateCcw, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Image as ImageIcon, 
  Eye, 
  Sparkles, 
  Layers, 
  Smartphone, 
  Monitor, 
  FileText, 
  Lock,
  ArrowRight,
  Info,
  Check,
  Cloud,
  Sliders,
  Move,
  Maximize2,
  Minus,
  Plus
} from 'lucide-react';
import { useAppBranding, DEFAULT_BRANDING } from '../../lib/BrandingContext';
import { BrandLogo, DEFAULT_LOGO_FALLBACK } from '../BrandLogo';
import { Card, Button, Input, Badge } from '../UI';
import { cn, formatDate } from '../../lib/utils';
import { useAuth } from '../../lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export const AppBrandingSettings: React.FC = () => {
  const { profile } = useAuth();
  const { 
    branding, 
    logoUrl, 
    appName, 
    tagline, 
    primaryColor, 
    fontFamily, 
    isLoading,
    isCustomLogoActive,
    uploadLogo, 
    saveBranding, 
    removeLogo,
    resetToDefault
  } = useAppBranding();

  // Local form state
  const [formData, setFormData] = useState({
    appName: appName || 'CowPlugNG',
    tagline: tagline || 'Smart Agriculture. Secure Tomorrow.',
    primaryColor: primaryColor || '#059669',
    fontFamily: fontFamily || 'Manrope',
    logoUrl: logoUrl,
    cloudinaryPublicId: branding.cloudinaryPublicId,
    fileSize: branding.fileSize,
    dimensions: branding.dimensions,
    fileType: branding.fileType,
  });

  // Staged logo preview (for local preview before saving, or after upload)
  const [stagedLogoUrl, setStagedLogoUrl] = useState<string | undefined>(logoUrl);
  const [stagedMeta, setStagedMeta] = useState<{
    fileSize?: number;
    dimensions?: { width: number; height: number };
    fileType?: string;
    cloudinaryPublicId?: string;
  }>({
    fileSize: branding.fileSize,
    dimensions: branding.dimensions,
    fileType: branding.fileType,
    cloudinaryPublicId: branding.cloudinaryPublicId,
  });

  // Logo Display Controls state
  const [logoSize, setLogoSize] = useState<number>(branding.logoSize ?? 100);
  const [logoOffsetX, setLogoOffsetX] = useState<number>(branding.logoOffsetX ?? 0);
  const [logoOffsetY, setLogoOffsetY] = useState<number>(branding.logoOffsetY ?? 0);
  const [logoWidth, setLogoWidth] = useState<string>(
    branding.logoWidth && branding.logoWidth > 0 ? String(branding.logoWidth) : ''
  );

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewTab, setPreviewTab] = useState<'sidebar' | 'desktop' | 'mobile' | 'auth' | 'invoice'>('sidebar');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when branding updates from context
  useEffect(() => {
    setFormData({
      appName: branding.appName || 'CowPlugNG',
      tagline: branding.tagline || 'Smart Agriculture. Secure Tomorrow.',
      primaryColor: branding.primaryColor || '#059669',
      fontFamily: branding.fontFamily || 'Manrope',
      logoUrl: branding.logoUrl,
      cloudinaryPublicId: branding.cloudinaryPublicId,
      fileSize: branding.fileSize,
      dimensions: branding.dimensions,
      fileType: branding.fileType,
    });
    setStagedLogoUrl(branding.logoUrl);
    setStagedMeta({
      fileSize: branding.fileSize,
      dimensions: branding.dimensions,
      fileType: branding.fileType,
      cloudinaryPublicId: branding.cloudinaryPublicId,
    });
    setLogoSize(branding.logoSize ?? 100);
    setLogoOffsetX(branding.logoOffsetX ?? 0);
    setLogoOffsetY(branding.logoOffsetY ?? 0);
    setLogoWidth(branding.logoWidth && branding.logoWidth > 0 ? String(branding.logoWidth) : '');
  }, [branding]);

  // Handle file selection, Cloudinary upload, validation, and immediate Firestore save
  const handleFileSelect = async (file: File) => {
    setUploadError(null);
    setSaveSuccess(false);

    // Format validation
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setUploadError('Invalid format: Please select a PNG, JPG, WebP, or SVG file.');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setUploadError('File size exceeds 5MB limit. Please choose a smaller image.');
      return;
    }

    try {
      setIsUploading(true);
      setIsSaving(true);
      setUploadProgress(20);
      setUploadStatusText('Uploading logo to Cloudinary...');

      // Step 1: Upload to Cloudinary
      const result = await uploadLogo(file, (progress) => {
        setUploadProgress(progress);
      });

      if (!result || typeof result !== 'object') {
        throw new Error('invalid-response: Cloudinary upload did not return a valid result object.');
      }

      if (!result.url || typeof result.url !== 'string' || result.url.trim() === '') {
        throw new Error('invalid-argument: Cloudinary did not return a valid secure URL string.');
      }

      const secureUrl = result.url.trim();
      if (!secureUrl.startsWith('https://') && !secureUrl.startsWith('http://') && !secureUrl.startsWith('data:')) {
        throw new Error(`invalid-argument: Cloudinary URL does not use a valid protocol: "${secureUrl.substring(0, 20)}..."`);
      }

      // Step 2: Save directly to Firestore settings/global
      setUploadStatusText('Saving logo to Firestore settings/global...');
      setUploadProgress(90);

      const parsedWidth = logoWidth.trim() !== '' && !isNaN(Number(logoWidth)) && Number(logoWidth) > 0 ? Number(logoWidth) : undefined;

      await saveBranding({
        appName: formData.appName?.trim() || 'CowPlugNG',
        tagline: formData.tagline?.trim() || 'Smart Agriculture. Secure Tomorrow.',
        primaryColor: formData.primaryColor?.trim() || '#059669',
        fontFamily: formData.fontFamily?.trim() || 'Manrope',
        logoUrl: secureUrl,
        cloudinaryPublicId: result.publicId || '',
        fileSize: result.fileSize,
        dimensions: result.dimensions,
        fileType: result.fileType,
        logoSize,
        logoOffsetX,
        logoOffsetY,
        logoWidth: parsedWidth,
      });

      // Step 3: Update UI state
      setStagedLogoUrl(secureUrl);
      setStagedMeta({
        fileSize: result.fileSize,
        dimensions: result.dimensions,
        fileType: result.fileType,
        cloudinaryPublicId: result.publicId,
      });

      setFormData(prev => ({
        ...prev,
        logoUrl: secureUrl,
        cloudinaryPublicId: result.publicId,
        fileSize: result.fileSize,
        dimensions: result.dimensions,
        fileType: result.fileType,
      }));

      setUploadProgress(100);
      setSaveSuccess(true);
      setUploadStatusText('Logo uploaded and applied successfully across CowPlugNG');
      setTimeout(() => {
        setUploadStatusText(null);
      }, 5000);
    } catch (err: any) {
      console.error('[App Branding] Logo upload & save failure:', err);
      const errCode = err?.code || (err?.message?.includes(':') ? err.message.split(':')[0] : 'save-failed');
      const errMsg = err?.message || String(err);
      setUploadError(`Failed to save logo to Firestore [${errCode}]: ${errMsg}. Your current logo remains active.`);
    } finally {
      setIsUploading(false);
      setIsSaving(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Save Logo Display Settings specifically
  const handleSaveLogoDisplay = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setUploadError(null);
    try {
      const parsedWidth = logoWidth.trim() !== '' && !isNaN(Number(logoWidth)) && Number(logoWidth) > 0 ? Number(logoWidth) : undefined;
      await saveBranding({
        logoSize,
        logoOffsetX,
        logoOffsetY,
        logoWidth: parsedWidth,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err: any) {
      console.error('[App Branding] Error saving logo display settings:', err);
      setUploadError(`Failed to save logo display settings: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset Logo Display Controls to Application Defaults
  const handleResetDisplayDefaults = () => {
    setLogoSize(100);
    setLogoOffsetX(0);
    setLogoOffsetY(0);
    setLogoWidth('');
  };

  // Master Save All Branding Settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setUploadError(null);

    try {
      const cleanLogoUrl = (typeof stagedLogoUrl === 'string' && stagedLogoUrl.trim().length > 0)
        ? stagedLogoUrl.trim()
        : '';

      const parsedWidth = logoWidth.trim() !== '' && !isNaN(Number(logoWidth)) && Number(logoWidth) > 0 ? Number(logoWidth) : undefined;

      await saveBranding({
        appName: formData.appName?.trim() || 'CowPlugNG',
        tagline: formData.tagline?.trim() || 'Smart Agriculture. Secure Tomorrow.',
        primaryColor: formData.primaryColor?.trim() || '#059669',
        fontFamily: formData.fontFamily?.trim() || 'Manrope',
        logoUrl: cleanLogoUrl,
        cloudinaryPublicId: stagedMeta.cloudinaryPublicId || '',
        fileSize: stagedMeta.fileSize,
        dimensions: stagedMeta.dimensions,
        fileType: stagedMeta.fileType,
        logoSize,
        logoOffsetX,
        logoOffsetY,
        logoWidth: parsedWidth,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 6000);
    } catch (err: any) {
      console.error('[App Branding] Error saving branding settings to Firestore:', err);
      const errCode = err?.code || 'save-failed';
      const errMsg = err?.message || String(err);
      setUploadError(`Failed to save branding to Firestore [${errCode}]: ${errMsg}. Your current logo remains active.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!window.confirm('Are you sure you want to remove the custom logo and revert to the default CowPlugNG brand logo?')) {
      return;
    }

    setIsSaving(true);
    setUploadError(null);
    try {
      await removeLogo();
      setStagedLogoUrl(undefined);
      setStagedMeta({});
      setFormData(prev => ({
        ...prev,
        logoUrl: undefined,
        cloudinaryPublicId: undefined,
        fileSize: undefined,
        dimensions: undefined,
        fileType: undefined,
      }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err: any) {
      console.error('[App Branding] Error removing logo:', err);
      const errCode = err?.code || 'remove-failed';
      const errMsg = err?.message || String(err);
      setUploadError(`Failed to remove logo [${errCode}]: ${errMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const parsedCustomWidth = logoWidth.trim() !== '' && !isNaN(Number(logoWidth)) && Number(logoWidth) > 0 ? Number(logoWidth) : undefined;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center">
              <Palette className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">App Branding Settings</h2>
            <Badge variant="success" className="text-[9px] font-black uppercase tracking-wider">
              Global Brand Control
            </Badge>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl font-medium leading-relaxed">
            Manage the official CowPlugNG logo, display sizing, offsets, corporate identity, and typography across all investor and administrative views in real time via Cloudinary CDN.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={handleRemoveLogo}
            disabled={!isCustomLogoActive && !stagedLogoUrl || isSaving || isUploading}
            className="text-xs font-bold text-slate-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Revert to Default
          </Button>
          <Button
            onClick={handleSave}
            isLoading={isSaving}
            disabled={isUploading}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-lg shadow-emerald-700/20"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {isSaving ? 'Applying logo across CowPlugNG...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Success Banner */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center gap-3 shadow-xs"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-xs">
              <span className="font-black block">Branding Applied Successfully</span>
              <span>Your branding and logo display adjustments are synchronized globally in real-time.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Alert */}
      {uploadError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-2xl flex items-start gap-3 shadow-xs animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold block">Action Required</span>
            <span>{uploadError}</span>
          </div>
        </div>
      )}

      {/* Main Grid Layout: 7 Cols Left (Controls) + 5 Cols Right (Live Previews) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Card 1: Logo Asset & Cloudinary Upload */}
          <Card 
            title="Official Application Logo" 
            icon={ImageIcon}
            className="border-slate-200/80 shadow-md bg-white"
          >
            <div className="space-y-6">
              
              {/* Active / Staged Logo Display Box */}
              <div className="p-6 bg-slate-50/80 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row items-center gap-6">
                
                {/* Clean Logo Preview Area */}
                <div className="w-full sm:w-56 h-36 bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                  <img 
                    src={stagedLogoUrl || DEFAULT_LOGO_FALLBACK} 
                    alt="Active Application Logo"
                    className="max-h-full max-w-full w-auto object-contain select-none"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Logo Metadata & Clean Status Label */}
                <div className="flex-1 min-w-0 text-center sm:text-left space-y-3">
                  <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">Current App Logo</span>
                    {stagedLogoUrl ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        CUSTOM CLOUDINARY LOGO
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                        OFFICIAL DEFAULT LOGO
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 bg-white p-3 rounded-xl border border-slate-200/60">
                    <div>
                      <span className="font-bold text-slate-400 block text-[9px] uppercase">Format</span>
                      <span className="font-mono font-bold text-slate-800">
                        {stagedMeta.fileType ? stagedMeta.fileType.split('/')[1]?.toUpperCase() : 'SVG/PNG'}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 block text-[9px] uppercase">File Size</span>
                      <span className="font-mono font-bold text-slate-800">
                        {formatBytes(stagedMeta.fileSize)}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 block text-[9px] uppercase">Dimensions</span>
                      <span className="font-mono font-bold text-slate-800">
                        {stagedMeta.dimensions ? `${stagedMeta.dimensions.width}×${stagedMeta.dimensions.height}px` : 'Natural Aspect Ratio'}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 block text-[9px] uppercase">CDN Storage</span>
                      <span className="font-mono font-bold text-emerald-700 truncate block">
                        {stagedLogoUrl ? 'Cloudinary Secured' : 'Local Asset'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  className="hidden"
                />

                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3 group",
                    isDragging 
                      ? "border-emerald-500 bg-emerald-50/50 scale-[1.01]" 
                      : "border-slate-200 hover:border-emerald-400 hover:bg-slate-50/70 bg-white"
                  )}
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Upload className="w-6 h-6" />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                      Click to upload new logo, or drag and drop
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Recommended: High-res transparent PNG, WebP, SVG, or JPG (Square or horizontal, max 5MB)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[9px] font-bold uppercase tracking-wider">PNG</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[9px] font-bold uppercase tracking-wider">JPG</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[9px] font-bold uppercase tracking-wider">WebP</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[9px] font-bold uppercase tracking-wider">SVG</span>
                  </div>
                </div>
              </div>

              {/* Upload Progress Bar */}
              {isUploading && (
                <div className="space-y-2 p-4 bg-emerald-50/80 rounded-2xl border border-emerald-100 animate-pulse">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 animate-spin" />
                      Uploading logo to Cloudinary...
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-emerald-200/60 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  {stagedLogoUrl ? 'Replace Logo' : 'Upload New Logo'}
                </Button>

                {stagedLogoUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRemoveLogo}
                    disabled={isSaving || isUploading}
                    className="text-xs font-bold text-red-600 hover:bg-red-50 hover:border-red-200 rounded-xl cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Remove Logo
                  </Button>
                )}
              </div>

            </div>
          </Card>

          {/* Card 2: Logo Display Controls (Size, Position, Width) */}
          <Card 
            title="Logo Display Controls" 
            icon={Sliders}
            className="border-slate-200/80 shadow-md bg-white"
          >
            <div className="space-y-6">
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Control how the global CowPlugNG logo is rendered across navigation headers, sidebars, and mobile views. Real-time controls preserve the original aspect ratio automatically without distortion or cropping.
              </p>

              {/* 1. Logo Size Slider */}
              <div className="space-y-2.5 p-4 bg-slate-50/70 border border-slate-200/70 rounded-2xl">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-emerald-700" />
                    1. Logo Size
                  </label>
                  <span className="font-mono font-bold text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md min-w-[58px] text-center">
                    {logoSize}%
                  </span>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setLogoSize(prev => Math.max(50, prev - 1))}
                    disabled={logoSize <= 50}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-sm disabled:opacity-40 cursor-pointer shadow-xs"
                    title="Decrease logo size by 1%"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input 
                    type="range"
                    min="50"
                    max="200"
                    step="1"
                    value={logoSize}
                    onChange={(e) => setLogoSize(Number(e.target.value))}
                    className="flex-1 accent-emerald-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setLogoSize(prev => Math.min(200, prev + 1))}
                    disabled={logoSize >= 200}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-sm disabled:opacity-40 cursor-pointer shadow-xs"
                    title="Increase logo size by 1%"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>50% (Min)</span>
                  <span className="text-slate-600 font-bold">100% (Default)</span>
                  <span>200% (Max)</span>
                </div>
              </div>

              {/* 2. Horizontal Position Slider */}
              <div className="space-y-2.5 p-4 bg-slate-50/70 border border-slate-200/70 rounded-2xl">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5 text-emerald-700" />
                    2. Horizontal Position (Left / Right)
                  </label>
                  <span className="font-mono font-bold text-xs text-slate-800 bg-white border border-slate-200 px-2.5 py-0.5 rounded-md min-w-[58px] text-center">
                    {logoOffsetX > 0 ? `+${logoOffsetX}px` : `${logoOffsetX}px`}
                  </span>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setLogoOffsetX(prev => Math.max(-100, prev - 1))}
                    disabled={logoOffsetX <= -100}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-sm disabled:opacity-40 cursor-pointer shadow-xs"
                    title="Move left by 1px"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input 
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={logoOffsetX}
                    onChange={(e) => setLogoOffsetX(Number(e.target.value))}
                    className="flex-1 accent-emerald-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setLogoOffsetX(prev => Math.min(100, prev + 1))}
                    disabled={logoOffsetX >= 100}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-sm disabled:opacity-40 cursor-pointer shadow-xs"
                    title="Move right by 1px"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>-100px (Left)</span>
                  <span className="text-slate-600 font-bold">0px (Default)</span>
                  <span>+100px (Right)</span>
                </div>
              </div>

              {/* 3. Vertical Position Slider */}
              <div className="space-y-2.5 p-4 bg-slate-50/70 border border-slate-200/70 rounded-2xl">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5 text-emerald-700 rotate-90" />
                    3. Vertical Position (Up / Down)
                  </label>
                  <span className="font-mono font-bold text-xs text-slate-800 bg-white border border-slate-200 px-2.5 py-0.5 rounded-md min-w-[58px] text-center">
                    {logoOffsetY > 0 ? `+${logoOffsetY}px` : `${logoOffsetY}px`}
                  </span>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setLogoOffsetY(prev => Math.max(-100, prev - 1))}
                    disabled={logoOffsetY <= -100}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-sm disabled:opacity-40 cursor-pointer shadow-xs"
                    title="Move up by 1px"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input 
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={logoOffsetY}
                    onChange={(e) => setLogoOffsetY(Number(e.target.value))}
                    className="flex-1 accent-emerald-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setLogoOffsetY(prev => Math.min(100, prev + 1))}
                    disabled={logoOffsetY >= 100}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-sm disabled:opacity-40 cursor-pointer shadow-xs"
                    title="Move down by 1px"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>-100px (Up)</span>
                  <span className="text-slate-600 font-bold">0px (Default)</span>
                  <span>+100px (Down)</span>
                </div>
              </div>

              {/* 4. Optional Logo Width */}
              <div className="p-4 bg-slate-50/70 border border-slate-200/70 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-900">
                    4. Optional Logo Width
                  </label>
                  <span className="text-[11px] font-mono font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                    {logoWidth && Number(logoWidth) > 0 ? `${logoWidth}px` : 'Auto (Application Default)'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Input 
                    type="number"
                    min="40"
                    max="400"
                    placeholder="Auto (e.g. 180)"
                    value={logoWidth}
                    onChange={(e) => setLogoWidth(e.target.value)}
                    className="font-mono text-xs font-bold w-40"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLogoWidth('')}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl"
                  >
                    Reset to Auto
                  </Button>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  Maintains original aspect ratio automatically. Sensible range for headers and sidebars is 80px – 280px.
                </p>
              </div>

              {/* Display Controls Action Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetDisplayDefaults}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Reset to Default
                </Button>

                <Button
                  type="button"
                  onClick={handleSaveLogoDisplay}
                  isLoading={isSaving}
                  disabled={isUploading}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md shadow-emerald-700/20 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Save Logo Settings
                </Button>
              </div>

            </div>
          </Card>

          {/* Card 3: Brand Identity Details (Name, Tagline, Color) */}
          <Card 
            title="App Identity & Aesthetics" 
            icon={Sparkles}
            className="border-slate-200/80 shadow-md bg-white"
          >
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">
                  Application Name
                </label>
                <Input 
                  value={formData.appName}
                  onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                  placeholder="e.g. CowPlugNG"
                  className="font-bold text-sm"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Shown in browser titles, email templates, navigation headers, and legal notices.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">
                  Official Brand Slogan / Tagline
                </label>
                <Input 
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  placeholder="e.g. Smart Agriculture. Secure Tomorrow."
                  className="text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">
                    Primary Brand Color
                  </label>
                  <div className="flex gap-2.5 items-center">
                    <input 
                      type="color" 
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="w-10 h-10 rounded-xl border border-slate-200 bg-transparent cursor-pointer shrink-0"
                    />
                    <Input 
                      value={formData.primaryColor} 
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="font-mono text-xs font-bold" 
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5 block">
                    Primary Typography Font
                  </label>
                  <Input 
                    value={formData.fontFamily}
                    onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
                    placeholder="e.g. Manrope"
                    className="text-xs font-medium"
                  />
                </div>
              </div>
            </div>
          </Card>

        </div>

        {/* RIGHT COLUMN: Live Cross-App Multi-Context Preview Suite (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card 
            title="Live Cross-Application Preview" 
            icon={Eye}
            className="border-slate-200/80 shadow-md bg-white sticky top-24"
          >
            <div className="space-y-4">
              <p className="text-xs text-slate-500 font-medium">
                Live interactive rendering with your immediate slider adjustments:
              </p>

              {/* Archetype Selector Tabs: Sidebar | Navbar | Mobile */}
              <div className="flex gap-1.5 p-1.5 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
                {[
                  { id: 'sidebar', label: 'Sidebar', icon: Layers },
                  { id: 'desktop', label: 'Navbar', icon: Monitor },
                  { id: 'mobile', label: 'Mobile', icon: Smartphone },
                  { id: 'auth', label: 'Auth Card', icon: Lock },
                  { id: 'invoice', label: 'Invoice', icon: FileText },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPreviewTab(tab.id as any)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold tracking-tight transition-all shrink-0 cursor-pointer",
                      previewTab === tab.id
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Live Preview Display Box */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-inner border border-slate-800 min-h-[220px] flex flex-col justify-center">
                
                {/* 1. Desktop Sidebar Preview */}
                {previewTab === 'sidebar' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest block">
                      Desktop Sidebar Preview
                    </span>
                    <div className="p-4 bg-white rounded-xl text-slate-900 space-y-3 shadow-sm border border-slate-100">
                      <div className="flex items-center pb-3 border-b border-slate-100 overflow-hidden">
                        <BrandLogo 
                          variant="sidebar" 
                          overrideLogoSize={logoSize}
                          overrideOffsetX={logoOffsetX}
                          overrideOffsetY={logoOffsetY}
                          overrideWidth={parsedCustomWidth}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="px-3 py-2 bg-emerald-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-between">
                          <span>Home Dashboard</span>
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                        <div className="px-3 py-2 text-slate-500 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                          My Livestock
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Desktop Navbar Preview */}
                {previewTab === 'desktop' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest block">
                      Desktop Navbar Preview
                    </span>
                    <div className="p-4 bg-white rounded-xl text-slate-900 flex items-center justify-between shadow-sm border border-slate-100 overflow-hidden">
                      <div className="flex items-center">
                        <BrandLogo 
                          variant="header" 
                          overrideLogoSize={logoSize}
                          overrideOffsetX={logoOffsetX}
                          overrideOffsetY={logoOffsetY}
                          overrideWidth={parsedCustomWidth}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          JD
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Mobile Header / Sidebar Preview */}
                {previewTab === 'mobile' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest block">
                      Mobile Header / Sidebar Preview
                    </span>
                    <div className="p-3 bg-white rounded-xl text-slate-900 flex items-center justify-between shadow-sm border border-slate-100 overflow-hidden">
                      <div className="flex items-center">
                        <BrandLogo 
                          variant="compact" 
                          overrideLogoSize={logoSize}
                          overrideOffsetX={logoOffsetX}
                          overrideOffsetY={logoOffsetY}
                          overrideWidth={parsedCustomWidth}
                        />
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                        <span className="text-xs font-bold">≡</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Auth Card Preview */}
                {previewTab === 'auth' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest block">
                      Investor Login Card Preview
                    </span>
                    <div className="p-6 bg-white rounded-2xl text-slate-900 text-center space-y-2 shadow-sm border border-slate-100 overflow-hidden">
                      <div className="flex justify-center pb-1">
                        <BrandLogo 
                          variant="auth" 
                          overrideLogoSize={logoSize}
                          overrideOffsetX={logoOffsetX}
                          overrideOffsetY={logoOffsetY}
                          overrideWidth={parsedCustomWidth}
                        />
                      </div>
                      <h4 className="font-black text-base text-slate-900">Welcome Back</h4>
                      <p className="text-[10px] text-slate-500">Sign in to manage your {formData.appName} portfolio</p>
                    </div>
                  </div>
                )}

                {/* 5. Invoice Preview */}
                {previewTab === 'invoice' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest block">
                      Billing Document Header Preview
                    </span>
                    <div className="p-4 bg-white rounded-xl text-slate-900 flex items-center justify-between shadow-sm border border-slate-100 overflow-hidden">
                      <div className="flex items-center">
                        <BrandLogo 
                          variant="invoice" 
                          overrideLogoSize={logoSize}
                          overrideOffsetX={logoOffsetX}
                          overrideOffsetY={logoOffsetY}
                          overrideWidth={parsedCustomWidth}
                        />
                      </div>
                      <span className="text-[10px] font-black font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                        INV-2026-001
                      </span>
                    </div>
                  </div>
                )}

              </div>

              {/* Background Contrast Check */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                  Contrast & Legibility Check
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden">
                    <BrandLogo 
                      variant="header" 
                      overrideLogoSize={logoSize}
                      overrideOffsetX={logoOffsetX}
                      overrideOffsetY={logoOffsetY}
                      overrideWidth={parsedCustomWidth}
                    />
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden">
                    <BrandLogo 
                      variant="header" 
                      dark={true}
                      overrideLogoSize={logoSize}
                      overrideOffsetX={logoOffsetX}
                      overrideOffsetY={logoOffsetY}
                      overrideWidth={parsedCustomWidth}
                    />
                  </div>
                </div>
              </div>

              {/* Quick Save CTA */}
              <Button
                onClick={handleSave}
                isLoading={isSaving}
                disabled={isUploading}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-3 rounded-xl shadow-lg shadow-emerald-700/20"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Applying logo across CowPlugNG...' : 'Apply Branding Globally'}
              </Button>

            </div>
          </Card>
        </div>

      </div>
    </div>
  );
};
