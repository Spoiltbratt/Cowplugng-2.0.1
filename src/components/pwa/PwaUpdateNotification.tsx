import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { usePwa } from '../../lib/PwaContext';
import { useAppBranding } from '../../lib/BrandingContext';

export const PwaUpdateNotification: React.FC = () => {
  const { hasUpdate, applyUpdate } = usePwa();
  const { appName } = useAppBranding();
  const [dismissed, setDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!hasUpdate || dismissed) {
    return null;
  }

  const handleUpdate = () => {
    setIsUpdating(true);
    applyUpdate();
  };

  const displayName = appName || 'CowPlug NG';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-6 left-6 z-[100] max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-2xl p-4 border border-slate-800 flex items-center justify-between gap-3 overflow-hidden"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate leading-tight">
              Update Available
            </h4>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              New features ready for {displayName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Updating...' : 'Refresh'}</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
