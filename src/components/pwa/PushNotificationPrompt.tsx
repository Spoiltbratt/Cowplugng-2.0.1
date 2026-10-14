import React, { useState, useEffect } from 'react';
import { Bell, BellRing, X, Shield, Smartphone, CheckCircle, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { checkPushStatus, requestPushPermissionAndRegister, PushDeviceStatus } from '../../lib/pushNotifications';
import { motion, AnimatePresence } from 'motion/react';

export const PushNotificationPrompt: React.FC = () => {
  const { profile } = useAuth();
  const [status, setStatus] = useState<PushDeviceStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!profile) return;

    // Check if dismissed previously
    const isDismissed = localStorage.getItem('cowplug_push_prompt_dismissed');

    checkPushStatus().then((currentStatus) => {
      setStatus(currentStatus);

      // Show prompt if supported, permission is default, and not previously dismissed
      if (currentStatus.isSupported && currentStatus.permission === 'default' && !isDismissed) {
        // Delay slightly for natural UX after page load
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 3500);
        return () => clearTimeout(timer);
      } else if (currentStatus.isSupported && currentStatus.permission === 'granted' && !currentStatus.isRegistered) {
        // Automatically sync token if already granted in browser but not registered in this session
        requestPushPermissionAndRegister(profile).catch(() => {});
      }
    });
  }, [profile]);

  const handleEnable = async () => {
    if (!profile) return;
    setIsRegistering(true);
    setFeedback(null);

    const result = await requestPushPermissionAndRegister(profile);
    setIsRegistering(false);

    if (result.success) {
      setFeedback({
        type: 'success',
        message: 'Push notifications activated! You will receive real-time alerts on this device.'
      });
      setTimeout(() => {
        setIsVisible(false);
      }, 3000);
    } else {
      setFeedback({
        type: 'error',
        message: result.error || 'Could not enable push notifications on this browser.'
      });
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('cowplug_push_prompt_dismissed', 'true');
    setIsVisible(false);
  };

  if (!isVisible || !status?.isSupported) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-5 right-5 left-5 sm:left-auto sm:max-w-md z-50 pointer-events-auto"
        id="cowplug-push-notification-banner"
      >
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-5 rounded-2xl border border-emerald-500/30 shadow-2xl relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <BellRing className="w-5 h-5 animate-pulse" />
            </div>

            <div className="space-y-1.5 flex-1 pr-4">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white tracking-tight">
                  Enable Real-Time Push Alerts
                </h4>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {status.platform === 'android' ? 'Android' : status.platform === 'ios' ? 'iOS' : 'Device'}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                Receive instant phone & desktop notifications for livestock status, invoices, payment approvals, and liquidation payouts even when CowPlugNG is closed.
              </p>

              {feedback && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 mt-2 ${
                    feedback.type === 'success'
                      ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/80 border border-rose-500/50 text-rose-200'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{feedback.message}</span>
                </motion.div>
              )}

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  onClick={handleEnable}
                  disabled={isRegistering}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/40 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  id="enable-push-notifications-btn"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>{isRegistering ? 'Enabling...' : 'Enable Push Alerts'}</span>
                </button>

                <button
                  onClick={handleDismiss}
                  className="px-3 py-2 rounded-xl text-slate-400 hover:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Not Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
