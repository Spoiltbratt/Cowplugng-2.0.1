import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, notifyAdmins, logActivity } from '../lib/firebase';
import { UserRole, VerificationStatus } from '../types';
import { Button } from './UI';
import { 
  Mail, 
  Lock, 
  User, 
  Phone, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  ArrowLeft,
  ShieldCheck,
  ChevronRight,
  UserPlus
} from 'lucide-react';
import { CowIcon as Cow } from './CowIcon';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { BrandLogo } from './BrandLogo';

interface AuthViewProps {
  onBack?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onBack }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isRegistrationDisabled, setIsRegistrationDisabled] = useState(false);

  React.useEffect(() => {
    const checkSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'global'));
        if (snap.exists()) {
          setIsRegistrationDisabled(!!snap.data().siteControls?.disableNewSignups);
        }
      } catch (e) {
        console.error(e);
      }
    };
    checkSettings();
  }, []);

  React.useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && result.user) {
          setLoading(true);
          try {
            await handleGoogleUser(result.user);
          } catch (err: any) {
            console.error("Redirect result error:", err);
            const hostname = window.location.hostname;
            const code = err.code || 'unknown';
            setError(`${err.message || "Failed to authenticate with Google."}\nCode: ${code} | Hostname: ${hostname}`);
          } finally {
            setLoading(false);
          }
        }
      })
      .catch((err) => {
        console.error("Get redirect result error:", err);
      });
  }, []);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    phoneNumber: '',
    role: UserRole.INVESTOR,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isForgotPassword) {
        if (!formData.email) throw new Error("Please enter your email address.");
        await sendPasswordResetEmail(auth, formData.email);
        await logActivity(
          'system',
          'Platform Security',
          'PASSWORD_RESET_REQUESTED',
          'AUTH',
          formData.email,
          `Password reset link requested for ${formData.email}`
        );
        setResetSuccess(true);
        return;
      }
 
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.status === 'suspended') {
            console.warn("User is suspended. Continuing login so App.tsx can show suspended screen.");
          }
          await logActivity(
            userCredential.user.uid,
            userData.displayName || userData.name || userData.email,
            'LOGIN',
            'AUTH',
            userCredential.user.uid,
            `User logged into the platform`
          );
        }
      } else {
        if (isRegistrationDisabled) {
          throw new Error("New investor registrations are currently closed because all investment slots are filled up.");
        }
        if (formData.password !== formData.confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        if (!agreedToTerms) {
          throw new Error("You must agree to the Terms & Conditions.");
        }
 
        const { user } = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        await updateProfile(user, { displayName: formData.displayName });
        
        try {
          await sendEmailVerification(user);
        } catch (emailErr) {
          console.warn("Could not send initial verification email:", emailErr);
        }
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: formData.email,
          displayName: formData.displayName,
          name: formData.displayName,
          phoneNumber: formData.phoneNumber,
          role: formData.role,
          status: 'pending',
          accountStatus: 'pending',
          isVerified: false,
          verificationStatus: VerificationStatus.NOT_STARTED,
          createdAt: Date.now(),
          investorId: formData.role === UserRole.INVESTOR ? `INV-${Math.floor(1000 + Math.random() * 9000)}` : null,
        });
 
        await logActivity(
          user.uid,
          formData.displayName,
          'REGISTER',
          'AUTH',
          user.uid,
          `New user registered as ${formData.role}`
        );
 
        await notifyAdmins(
          'New Investor Registration',
          `${formData.displayName} has registered as a ${formData.role} and is awaiting activation.`,
          'Security Alerts',
          'INFO'
        );
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleUser = async (user: any) => {
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      await logActivity(
        user.uid,
        user.displayName || user.email || 'User',
        'GOOGLE_LOGIN',
        'AUTH',
        user.uid,
        `User logged in via Google Authentication`
      );
    } else {
      const emailLower = user.email?.toLowerCase() || '';
      let roleToAssign = UserRole.INVESTOR;
      if (emailLower === 'tugbobodare4@gmail.com') {
        roleToAssign = UserRole.SUPER_ADMIN;
      }

      const newProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        name: user.displayName || user.email?.split('@')[0] || 'User',
        role: roleToAssign,
        status: 'active',
        accountStatus: 'active',
        isVerified: roleToAssign === UserRole.SUPER_ADMIN,
        verificationStatus: roleToAssign === UserRole.SUPER_ADMIN ? VerificationStatus.APPROVED : VerificationStatus.NOT_STARTED,
        createdAt: Date.now(),
        investorId: roleToAssign === UserRole.INVESTOR ? `INV-${Math.floor(1000 + Math.random() * 9000)}` : null,
      };

      await setDoc(userDocRef, newProfile);
      await logActivity(
        user.uid,
        newProfile.displayName,
        'GOOGLE_REGISTER',
        'AUTH',
        user.uid,
        `New user registered via Google Auth as ${roleToAssign}`
      );

      await notifyAdmins(
        'New Google Investor Registration',
        `${newProfile.displayName} registered via Google as ${roleToAssign}.`,
        'Security Alerts',
        'INFO'
      );
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      if (isStandalone) {
        await signInWithRedirect(auth, provider);
        return;
      }
      const userCredential = await signInWithPopup(auth, provider);
      await handleGoogleUser(userCredential.user);
    } catch (err: any) {
      console.error("Google Authentication error:", err);
      const hostname = window.location.hostname;
      const code = err.code || 'unknown';

      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request' || err.code === 'auth/web-storage-unsupported') {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr: any) {
          console.error("Redirect retry error:", redirectErr);
        }
      }

      let msg = "Failed to authenticate with Google.";
      if (err.code === 'auth/unauthorized-domain') {
        msg = `This website address is not authorised for Google sign-in. Add ${hostname} under Firebase, Authentication, Settings, Authorized domains.`;
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = "Google sign-in is not enabled in Firebase.";
      } else if (err.code === 'auth/network-request-failed') {
        msg = "Network problem. Check your connection and try again.";
      } else if (err.code === 'auth/popup-closed-by-user') {
        msg = "Sign-in popup was closed before completion.";
      } else if (err.message) {
        msg = err.message;
      }

      setError(`${msg}\nCode: ${code} | Hostname: ${hostname}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleView = () => {
    if (isLogin && isRegistrationDisabled) return;
    setIsLogin(!isLogin);
    setIsForgotPassword(false);
    setResetSuccess(false);
    setError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const backToLogin = () => {
    setIsForgotPassword(false);
    setResetSuccess(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-8 font-sans selection:bg-brand-green/10" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Global Back Button (Home) */}
      {!onBack && (
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => window.location.href = '/'}
          className="fixed top-8 left-8 p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-slate-900 hover:border-emerald-600/30 hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-500 group flex items-center gap-2 z-50 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest pr-2">Back to Home</span>
        </motion.button>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={isLogin ? (isForgotPassword ? "forgot" : "login") : "register"}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[460px] bg-white rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.06)] border border-slate-100 p-8 sm:p-12 relative overflow-hidden"
        >
          {/* Internal Back Icon for Integrated Views */}
          {onBack && (
            <button 
              onClick={onBack}
              className="absolute top-8 left-8 p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all group z-20"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>
          )}

          {/* Logo Section */}
          <div className="flex flex-col items-center mb-10">
            <BrandLogo variant="auth" />
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">
              {isForgotPassword ? "Secure Recovery" : (isLogin ? "Welcome Back" : "Create Account")}
            </h1>
            <p className="text-slate-500 text-sm font-medium tracking-tight">
              {isForgotPassword 
                ? "Enter your email to receive a recovery link." 
                : (isLogin ? "Sign in to manage your livestock portfolio." : "Register to start your agricultural investment journey.")}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {resetSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-8 py-4"
              >
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Check Your Email</h3>
                  <p className="text-sm text-slate-500 font-medium">Recovery instructions have been sent to your inbox.</p>
                </div>
                <Button onClick={backToLogin} className="w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-700/20">
                  Return to Login
                </Button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && !isForgotPassword && (
                  <>
                    <AuthInput 
                      icon={User}
                      placeholder="Investor Full Name"
                      value={formData.displayName}
                      onChange={(val) => setFormData({ ...formData, displayName: val })}
                      required
                    />
                    <AuthInput 
                      icon={Phone}
                      placeholder="Phone Number (+234)"
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(val) => setFormData({ ...formData, phoneNumber: val })}
                      required
                    />
                  </>
                )}

                <AuthInput 
                  icon={Mail}
                  placeholder="Email Address"
                  type="email"
                  value={formData.email}
                  onChange={(val) => setFormData({ ...formData, email: val })}
                  required
                />

                {!isForgotPassword && (
                  <>
                    <AuthInput 
                      icon={Lock}
                      placeholder="Security Password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(val) => setFormData({ ...formData, password: val })}
                      required
                      rightElement={
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-emerald-700 transition-colors p-2">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                    />

                    {!isLogin && (
                      <>
                        <AuthInput 
                          icon={Lock}
                          placeholder="Verify Password"
                          type={showConfirmPassword ? "text" : "password"}
                          value={formData.confirmPassword}
                          onChange={(val) => setFormData({ ...formData, confirmPassword: val })}
                          required
                          rightElement={
                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="text-slate-400 hover:text-emerald-700 transition-colors p-2">
                              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          }
                        />

                        <div className="flex items-start gap-3 px-2 pt-2 pb-2">
                          <div className="flex items-center h-5">
                            <input
                              id="terms"
                              type="checkbox"
                              checked={agreedToTerms}
                              onChange={(e) => setAgreedToTerms(e.target.checked)}
                              className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer transition-all accent-emerald-600"
                              required
                            />
                          </div>
                          <label htmlFor="terms" className="text-[11px] font-bold text-slate-600 cursor-pointer select-none leading-tight">
                            I acknowledge that I have read and agree to the 
                            <button type="button" className="text-emerald-700 hover:underline mx-1">Terms of Service</button> 
                            and 
                            <button type="button" className="text-emerald-700 hover:underline ml-1">Privacy Policy</button>.
                          </label>
                        </div>
                      </>
                    )}

                    {isLogin && (
                      <div className="flex justify-end px-1">
                        <button 
                          type="button"
                          onClick={() => setIsForgotPassword(true)}
                          className="text-xs font-black text-emerald-700 hover:text-emerald-800 transition-colors uppercase tracking-widest"
                        >
                          Forgot Password?
                        </button>
                      </div>
                    )}
                  </>
                )}

                {isRegistrationDisabled && isLogin && !isForgotPassword && (
                  <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-3">
                    <UserPlus className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-900 leading-snug">
                        Investor Registrations Closed
                      </p>
                      <p className="text-[10px] font-medium text-amber-700 leading-tight mt-0.5">
                        All available investment slots are currently filled up. Signups will reopen once new slots become available. Existing investors can log in below.
                      </p>
                    </div>
                  </div>
                )}

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3"
                  >
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <p className="text-[11px] font-black text-rose-700 uppercase tracking-tighter leading-tight">{error}</p>
                  </motion.div>
                )}

                <div className="pt-4 space-y-4">
                  <Button 
                    type="submit" 
                    isLoading={loading}
                    className="w-full h-16 rounded-[1.25rem] font-black text-sm uppercase tracking-[0.15em] shadow-2xl shadow-emerald-800/20 active:scale-[0.98] transition-all"
                  >
                    {isForgotPassword ? "Send Recovery Link" : (isLogin ? "LOGIN" : "Create Account")}
                  </Button>

                  {!isForgotPassword && (
                    <>
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="px-3 font-bold text-slate-400 text-[10px] tracking-wider">
                            Or Continue With
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full h-14 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-[1.25rem] font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-sm active:scale-[0.98] cursor-pointer"
                      >
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>Continue with Google</span>
                      </button>
                    </>
                  )}
                </div>

                <div className="pt-8 text-center space-y-4">
                  <button 
                    type="button"
                    onClick={isForgotPassword ? backToLogin : toggleView}
                    disabled={isLogin && isRegistrationDisabled}
                    className={cn(
                      "text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors group",
                      (isLogin && isRegistrationDisabled) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isForgotPassword 
                      ? "Remembered your credentials?" 
                      : (isLogin 
                          ? (isRegistrationDisabled ? "Registrations are currently closed" : "New to CowPlugNG?") 
                          : "Already an investor?")}
                    {!isRegistrationDisabled || !isLogin || isForgotPassword ? (
                      <span className="text-emerald-700 ml-2 group-hover:underline underline-offset-4 decoration-2">
                        {isForgotPassword ? "Sign In" : (isLogin ? "Register Now" : "Login Instead")}
                      </span>
                    ) : null}
                  </button>
                </div>
              </form>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
      
      {/* Footer Branding */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-12 text-center"
      >
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Secured by CowPlugNG Infrastructure</p>
        <div className="flex items-center justify-center gap-6">
          <button className="text-[10px] font-black text-slate-400 hover:text-emerald-700 transition-colors uppercase tracking-widest">Privacy Policy</button>
          <div className="w-1 h-1 rounded-full bg-slate-300" />
          <button className="text-[10px] font-black text-slate-400 hover:text-emerald-700 transition-colors uppercase tracking-widest">Service Terms</button>
          <div className="w-1 h-1 rounded-full bg-slate-300" />
          <button className="text-[10px] font-black text-slate-400 hover:text-emerald-700 transition-colors uppercase tracking-widest">Global Support</button>
        </div>
      </motion.div>
    </div>
  );
};

interface AuthInputProps {
  icon: any;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  rightElement?: React.ReactNode;
}

const AuthInput: React.FC<AuthInputProps> = ({ icon: Icon, placeholder, type = "text", value, onChange, required, rightElement }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative group">
      <div className={cn(
        "absolute left-5 top-1/2 -translate-y-1/2 transition-colors duration-300 z-10",
        isFocused ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-500"
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <input 
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        required={required}
        className={cn(
          "w-full h-14 pl-14 pr-12 bg-[#f0f0f0] border border-slate-100 dark:border-slate-800 rounded-full text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-sm",
          isFocused && "shadow-xl shadow-emerald-600/5"
        )}
      />
      {rightElement && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2 z-10">
          {rightElement}
        </div>
      )}
    </div>
  );
};
