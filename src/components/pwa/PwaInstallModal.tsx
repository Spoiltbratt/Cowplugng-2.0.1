import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, 
  Smartphone, 
  Share2, 
  PlusSquare, 
  CheckCircle2, 
  X, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  WifiOff, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { usePwa } from '../../lib/PwaContext';
import { useAppBranding } from '../../lib/BrandingContext';
import { getPwaIconUrl } from '../../lib/pwaIcons';
import { Button, Badge } from '../UI';
import { BrandLogo } from '../BrandLogo';

export const PwaInstallModal: React.FC = () => {
  const { 
    showInstallModal, 
    closeInstallModal, 
    promptInstall, 
    isNativePromptSupported, 
    isIOS, 
    isAndroid,
    isStandalone 
  } = usePwa();
  const { appName, branding } = useAppBranding();

  if (isStandalone || !showInstallModal) {
    return null;
  }

  const brandDisplayName = appName || 'CowPlug NG';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={closeInstallModal}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 320 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10"
        >
          {/* Top Banner Gradient */}
          <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />
            
            <button
              onClick={closeInstallModal}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              {/* App Icon */}
              <div className="w-16 h-16 rounded-2xl bg-white p-1.5 backdrop-blur-md border border-white/20 shadow-lg flex items-center justify-center shrink-0 overflow-hidden">
                <img 
                  src={getPwaIconUrl(branding.logoUrl, 192, false, branding.updatedAt)} 
                  alt={brandDisplayName}
                  className="w-full h-full object-contain rounded-xl"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/icons/icon-192x192.png';
                  }}
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="success" className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[9px] font-black uppercase tracking-wider">
                    Official Progressive App
                  </Badge>
                </div>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                  Install {brandDisplayName}
                </h3>
                <p className="text-xs font-semibold text-emerald-200 uppercase tracking-widest mt-0.5">
                  Smart Agriculture
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-7 space-y-6">
            {/* Highlights Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">Standalone Mode</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Full-screen app experience without browser bars</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">Faster Access</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">One-tap launch directly from your home screen</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">Real-Time Sync</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Live portfolio, invoices & veterinary telemetry</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0">
                  <WifiOff className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">Reliable Shell</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Cached app shell for instant startup</p>
                </div>
              </div>
            </div>

            {/* Platform-Specific Installation Steps */}
            {(() => {
              const ua = window.navigator.userAgent.toLowerCase();
              const isInApp = /fban|fbios|instagram|tiktok|snapchat|twitter|linkedin/i.test(ua);

              if (isIOS) {
                return (
                  <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900">
                        How to install on iPhone & iPad (Safari)
                      </h4>
                    </div>

                    <div className="space-y-3 text-left">
                      <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-emerald-100/80 shadow-xs">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                          1
                        </div>
                        <div className="text-xs text-slate-700 leading-relaxed">
                          Tap the <strong className="text-slate-900 font-bold inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200"><Share2 className="w-3.5 h-3.5 text-blue-600" /> Share</strong> button in Safari.
                        </div>
                      </div>

                      <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-emerald-100/80 shadow-xs">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                          2
                        </div>
                        <div className="text-xs text-slate-700 leading-relaxed">
                          Tap <strong className="text-slate-900 font-bold inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200"><PlusSquare className="w-3.5 h-3.5 text-emerald-700" /> Add to Home Screen</strong>.
                        </div>
                      </div>

                      <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-emerald-100/80 shadow-xs">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                          3
                        </div>
                        <div className="text-xs text-slate-700 leading-relaxed">
                          Tap <strong className="text-slate-900 font-bold mx-1">Add</strong>.
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 text-center">
                      <Button
                        onClick={closeInstallModal}
                        className="w-full h-12 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm shadow-md"
                      >
                        Got It, Thank You
                      </Button>
                    </div>
                  </div>
                );
              } else if (isInApp) {
                return (
                  <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5 text-center">
                    <p className="text-xs font-bold text-blue-900 leading-relaxed">
                      Open this page in Chrome or Safari to install
                    </p>
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        alert("Link copied to clipboard!");
                      }}
                      className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Copy link</span>
                    </Button>
                  </div>
                );
              } else {
                return (
                  <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5 text-center">
                    <p className="text-xs font-bold text-amber-900 leading-relaxed">
                      Getting the installer ready. Tap Download again in a few seconds.
                    </p>
                    <p className="text-[11px] text-amber-800">
                      Browser menu, then Install app.
                    </p>
                    <Button
                      onClick={promptInstall}
                      className="w-full h-12 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs shadow-md"
                    >
                      Tap Download Again
                    </Button>
                  </div>
                );
              }
            })()}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
