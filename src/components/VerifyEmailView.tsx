import React, { useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { auth, logActivity } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Button } from './UI';
import { 
  Mail, 
  RefreshCw, 
  Send, 
  CheckCircle2, 
  LogOut, 
  AlertCircle, 
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const VerifyEmailView: React.FC = () => {
  const { user, signOut, reloadUser } = useAuth();
  const [resending, setResending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);

  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!auth.currentUser || cooldown > 0) return;
    setResending(true);
    setStatusMessage(null);

    try {
      await sendEmailVerification(auth.currentUser);
      setCooldown(60);
      setStatusMessage({
        type: 'success',
        text: `Verification email successfully resent to ${auth.currentUser.email}. Please check your inbox and spam folder.`
      });
      await logActivity(
        auth.currentUser.uid,
        auth.currentUser.displayName || auth.currentUser.email || 'User',
        'RESEND_EMAIL_VERIFICATION',
        'AUTH',
        auth.currentUser.uid,
        `Verification email resent to ${auth.currentUser.email}`
      );
    } catch (err: any) {
      console.error("Error resending email verification:", err);
      if (err.code === 'auth/too-many-requests') {
        setStatusMessage({
          type: 'error',
          text: 'Too many requests sent. Please wait a few minutes before trying again.'
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: err.message || 'Failed to send verification email. Please try again.'
        });
      }
    } finally {
      setResending(false);
    }
  };

  const handleRefreshStatus = async () => {
    setRefreshing(true);
    setStatusMessage(null);

    try {
      await reloadUser();
      const currentUser = auth.currentUser;
      if (currentUser?.emailVerified) {
        setStatusMessage({
          type: 'success',
          text: 'Email address verified! Accessing your CowPlugNG portal...'
        });
      } else {
        setStatusMessage({
          type: 'info',
          text: 'Email is not verified yet. Please click the verification link sent to your inbox, then click "Refresh Status".'
        });
      }
    } catch (err: any) {
      console.error("Error refreshing email status:", err);
      setStatusMessage({
        type: 'error',
        text: 'Failed to refresh verification status. Please try again.'
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-8 font-sans selection:bg-emerald-600/10">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[500px] bg-white rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.06)] border border-slate-100 p-8 sm:p-12 relative overflow-hidden"
      >
        {/* Top Header & Logo */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex items-center justify-center mb-6 shadow-lg shadow-emerald-900/5 relative">
            <Mail className="w-10 h-10 text-emerald-700" />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center border-2 border-white">
              <span className="text-[10px] font-black text-white">!</span>
            </div>
          </div>

          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-2">
            Verify Your Email
          </h1>
          <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-sm">
            We sent a verification link to secure your CowPlugNG account. Please confirm your email address to continue.
          </p>
        </div>

        {/* Recipient Email Address Badge */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sent To</p>
              <p className="text-sm font-bold text-slate-900 truncate">{user?.email || 'Your email address'}</p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0">
            Pending
          </span>
        </div>

        {/* Status Message Notification */}
        <AnimatePresence mode="wait">
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                statusMessage.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                  : statusMessage.type === 'error'
                  ? 'bg-rose-50 border-rose-100 text-rose-800'
                  : 'bg-amber-50 border-amber-100 text-amber-800'
              }`}>
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : statusMessage.type === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <p className="text-xs font-bold leading-relaxed">{statusMessage.text}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* How-To Instructions */}
        <div className="bg-emerald-900/5 border border-emerald-900/10 rounded-2xl p-5 mb-8 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-800" />
            <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider">Quick Instructions</h4>
          </div>
          <ol className="text-xs text-slate-600 font-medium space-y-2 list-decimal list-inside">
            <li>Check your email inbox or spam/junk folder.</li>
            <li>Click the verification link from Firebase / CowPlugNG.</li>
            <li>Return here and click <strong className="text-slate-900 font-bold">Refresh Verification Status</strong>.</li>
          </ol>
        </div>

        {/* Primary Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleRefreshStatus}
            isLoading={refreshing}
            className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-widest bg-emerald-900 hover:bg-emerald-800 text-white shadow-xl shadow-emerald-950/10 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Verification Status</span>
          </Button>

          <Button
            onClick={handleResend}
            isLoading={resending}
            disabled={cooldown > 0}
            variant="outline"
            className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-widest border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4 text-emerald-700" />
            <span>
              {cooldown > 0 ? `Resend Email in ${cooldown}s` : 'Resend Verification Email'}
            </span>
          </Button>

          <div className="pt-4 border-t border-slate-100 flex justify-center">
            <button
              type="button"
              onClick={() => signOut()}
              className="text-xs font-bold text-slate-400 hover:text-slate-800 transition-colors flex items-center gap-2 group py-2 px-4 rounded-xl hover:bg-slate-100/60"
            >
              <LogOut className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
              <span>Sign Out & Return Later</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Footer Branding */}
      <div className="mt-8 text-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
          CowPlugNG • Smart Agriculture & Secure Infrastructure
        </p>
      </div>
    </div>
  );
};
