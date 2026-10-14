import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Video as VideoIcon, FileText, AlertCircle, X, ZoomIn, Download, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// ==========================================
// 1. RESPONSIVE IMAGE COMPONENT
// ==========================================
export interface ResponsiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  containerClassName?: string;
  fallbackIcon?: React.ReactNode;
  fallbackText?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
  aspectRatio?: 'square' | 'video' | '16/10' | '4/3' | 'auto';
  onZoom?: () => void;
  showZoomBadge?: boolean;
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  alt = 'Livestock media',
  className,
  containerClassName,
  fallbackIcon,
  fallbackText = 'Image not available',
  objectFit = 'cover',
  aspectRatio = 'auto',
  onZoom,
  showZoomBadge = false,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reset state if src changes
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  const aspectClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    '16/10': 'aspect-[16/10]',
    '4/3': 'aspect-[4/3]',
    auto: '',
  };

  const fitClasses = {
    cover: 'object-cover',
    contain: 'object-contain',
    fill: 'object-fill',
    none: 'object-none',
  };

  if (!src || hasError) {
    return (
      <div 
        className={cn(
          "w-full h-full min-h-[80px] bg-slate-100 flex flex-col items-center justify-center p-4 text-slate-400 select-none text-center",
          aspectClasses[aspectRatio],
          containerClassName
        )}
      >
        {fallbackIcon || <ImageIcon className="w-8 h-8 mb-1.5 opacity-40 text-slate-500 shrink-0" />}
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 max-w-[90%] truncate">
          {fallbackText}
        </span>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "relative w-full h-full overflow-hidden bg-slate-50 group",
        aspectClasses[aspectRatio],
        containerClassName
      )}
      onClick={onZoom}
    >
      {isLoading && (
        <div className="absolute inset-0 bg-slate-100 animate-pulse flex items-center justify-center z-10">
          <ImageIcon className="w-6 h-6 text-slate-300 animate-pulse" />
        </div>
      )}

      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        className={cn(
          "w-full h-full max-w-full transition-all duration-300",
          fitClasses[objectFit],
          isLoading ? 'opacity-0 scale-95' : 'opacity-100 scale-100',
          onZoom && 'cursor-pointer group-hover:scale-105',
          className
        )}
        {...props}
      />

      {showZoomBadge && onZoom && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onZoom();
          }}
          className="absolute bottom-2 right-2 p-2 bg-slate-900/70 hover:bg-slate-900 text-white rounded-xl backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer shadow-sm"
          title="Click to view full image"
          aria-label="View full image"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// ==========================================
// 2. RESPONSIVE VIDEO COMPONENT
// ==========================================
export interface ResponsiveVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  containerClassName?: string;
  aspectRatio?: 'video' | '16/9' | '4/3' | 'square' | 'auto';
  fallbackTitle?: string;
  onExpand?: () => void;
  showExpandButton?: boolean;
}

export const ResponsiveVideo: React.FC<ResponsiveVideoProps> = ({
  src,
  containerClassName,
  className,
  aspectRatio = 'video',
  fallbackTitle = 'Livestock Video',
  onExpand,
  showExpandButton = false,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const aspectClasses = {
    video: 'aspect-video',
    '16/9': 'aspect-[16/9]',
    '4/3': 'aspect-[4/3]',
    square: 'aspect-square',
    auto: '',
  };

  if (!src || hasError) {
    return (
      <div className={cn("w-full bg-slate-900 text-white rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3", aspectClasses[aspectRatio], containerClassName)}>
        <VideoIcon className="w-10 h-10 text-slate-500" />
        <div className="space-y-1">
          <p className="text-xs font-semibold">{fallbackTitle}</p>
          <p className="text-[10px] text-slate-400">Video preview unavailable or format not supported</p>
        </div>
        {src && (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-medium rounded-xl transition-colors border border-slate-700"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open in player
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative w-full max-w-full overflow-hidden bg-black rounded-2xl group", aspectClasses[aspectRatio], containerClassName)}>
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        onError={() => setHasError(true)}
        className={cn("w-full h-full max-w-full object-contain", className)}
        {...props}
      />
      {showExpandButton && onExpand && (
        <button
          type="button"
          onClick={onExpand}
          className="absolute top-3 right-3 p-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer shadow-md"
          title="Expand video"
          aria-label="Expand video"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// ==========================================
// 3. RESPONSIVE MEDIA LIGHTBOX MODAL
// ==========================================
export interface MediaLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaType?: 'image' | 'video' | 'pdf';
  title?: string;
  caption?: string;
}

export const MediaLightboxModal: React.FC<MediaLightboxModalProps> = ({
  isOpen,
  onClose,
  mediaUrl,
  mediaType = 'image',
  title,
  caption,
}) => {
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mediaUrl) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl flex flex-col z-10 border border-slate-800"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/90 shrink-0">
            <div className="min-w-0 pr-3">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">{title || 'Media View'}</h3>
              {caption && <p className="text-xs text-slate-400 truncate mt-0.5">{caption}</p>}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={mediaUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700"
                title="Download file"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </a>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close viewer (Esc)"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Media Container */}
          <div className="flex-1 flex items-center justify-center p-3 sm:p-6 overflow-auto bg-black/60 min-h-[220px]">
            {mediaType === 'video' ? (
              <video
                src={mediaUrl}
                controls
                autoPlay
                playsInline
                className="w-full max-h-[75vh] object-contain rounded-xl"
              />
            ) : mediaType === 'pdf' ? (
              <div className="w-full h-[70vh] flex flex-col items-center justify-center p-6 text-center">
                <FileText className="w-16 h-16 text-emerald-400 mb-4 opacity-80" />
                <h4 className="text-base font-bold mb-2">PDF Document Ready</h4>
                <p className="text-xs text-slate-400 max-w-md mb-6">
                  For optimal readability on your device, view the PDF in full-screen or download it to your storage.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <a
                    href={mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shadow-lg"
                  >
                    <ExternalLink className="w-4 h-4" /> Open Fullscreen PDF
                  </a>
                  <a
                    href={mediaUrl}
                    download
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 border border-slate-700"
                  >
                    <Download className="w-4 h-4" /> Download PDF
                  </a>
                </div>
              </div>
            ) : (
              <img
                src={mediaUrl}
                alt={title || 'Enlarged media preview'}
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-lg select-none"
              />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
