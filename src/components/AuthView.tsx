import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserRole } from '../types';
import { Button, Input, Card } from './UI';
import { Beef as Cow, ShieldCheck, TrendingUp, Users, X, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

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

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    role: UserRole.INVESTOR,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isForgotPassword) {
        await sendPasswordResetEmail(auth, formData.email);
        setResetSuccess(true);
        return;
      }

      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.status === 'suspended') {
            await auth.signOut();
            throw new Error("Your account has been suspended. Please contact support.");
          }
        }
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        await updateProfile(user, { displayName: formData.displayName });
        
        // Create user profile
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: formData.email,
          displayName: formData.displayName,
          name: formData.displayName, // Consistent structure
          role: formData.role,
          status: 'pending',
          accountStatus: 'pending', // Consistent structure
          isVerified: false,
          createdAt: Date.now(),
          investorId: formData.role === UserRole.INVESTOR ? `INV-${Math.floor(1000 + Math.random() * 9000)}` : null,
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleView = () => {
    setIsLogin(!isLogin);
    setIsForgotPassword(false);
    setResetSuccess(false);
    setError(null);
  };

  const showForgot = () => {
    setIsForgotPassword(true);
    setResetSuccess(false);
    setError(null);
  };

  const backToLogin = () => {
    setIsForgotPassword(false);
    setResetSuccess(false);
    setError(null);
  };

  const getTitle = () => {
    if (isForgotPassword) return "Reset Password";
    return isLogin ? "Welcome Back" : "Create Account";
  };

  const getSubtitle = () => {
    if (isForgotPassword) return "Enter your email to receive a reset link";
    return isLogin ? "Sign in to manage your livestock assets" : "Join our network of professional investors";
  };

  const handleContactSupport = () => {
    onBack?.();
    // Slight delay to ensure LandingPage is mounted before scrolling
    setTimeout(() => {
      const element = document.getElementById('contact');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 150);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Visual Side */}
      <div className="hidden lg:flex flex-col bg-brand-surface p-12 justify-between border-r border-brand-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-green rounded-lg flex items-center justify-center">
            <Cow className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">CowPlug<span className="text-brand-green">NG</span></span>
        </div>

        <div className="space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-4xl font-bold leading-tight">
              Enterprise Livestock <br />
              <span className="text-brand-green">Management Excellence.</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-md">
              Secure your investment in professional livestock agriculture with Africa's most transparent tracking platform.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-brand-green/10 rounded-lg border border-brand-green/20">
                <ShieldCheck className="w-5 h-5 text-brand-green" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Verified Assets</h4>
                <p className="text-xs text-gray-500">Unique Tag numbers for every animal.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-2 bg-brand-orange/10 rounded-lg border border-brand-orange/20">
                <TrendingUp className="w-5 h-5 text-brand-orange" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Real-time Growth</h4>
                <p className="text-xs text-gray-500">Track health and weight updates.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-500">
          © 2026 CowPlugNG Version 2.0. All rights reserved.
        </div>
      </div>

      {/* Form Side */}
      <div className="flex items-center justify-center p-6 bg-brand-dark">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-8 h-8 bg-brand-green rounded-lg flex items-center justify-center">
              <Cow className="w-5 h-5 text-brand-dark" />
            </div>
            <span className="font-bold text-xl tracking-tight">CowPlugNG</span>
          </div>

          <Card title={getTitle()} subtitle={getSubtitle()}>
            {onBack && (
              <button 
                onClick={onBack}
                className="absolute top-6 right-6 text-gray-400 hover:text-brand-green transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <AnimatePresence mode="wait">
              {resetSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="py-6 text-center space-y-4"
                >
                  <div className="w-16 h-16 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto border border-brand-green/30">
                    <CheckCircle2 className="w-8 h-8 text-brand-green" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xl font-bold">Email Sent!</h4>
                    <p className="text-gray-400 text-sm">
                      Check your inbox for instructions to reset your password.
                    </p>
                  </div>
                  <Button onClick={backToLogin} className="w-full h-11 mt-4">
                    Return to Sign In
                  </Button>
                </motion.div>
              ) : (
                <motion.form 
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onSubmit={handleSubmit} 
                  className="space-y-4"
                >
                  {!isLogin && !isForgotPassword && (
                    <Input 
                      label="Full Name" 
                      placeholder="John Doe" 
                      required 
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    />
                  )}
                  <Input 
                    label="Email Address" 
                    type="email" 
                    placeholder="email@example.com" 
                    required 
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                  
                  {!isForgotPassword && (
                    <div className="space-y-1.5">
                      <Input 
                        label="Password" 
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••" 
                        required 
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        rightElement={
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-gray-500 hover:text-gray-300 transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        }
                      />
                      {isLogin && (
                        <div className="flex justify-end">
                          <button 
                            type="button"
                            onClick={showForgot}
                            className="text-xs text-brand-green hover:underline"
                          >
                            Forgot Password?
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {error && <p className="text-sm text-red-500 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}

                  <Button type="submit" className="w-full h-11 font-bold tracking-tight" isLoading={loading}>
                    {isForgotPassword ? "Send Reset Link" : (isLogin ? "Sign In" : "Register Account")}
                  </Button>

                  <div className="mt-6 text-center space-y-4">
                    <button 
                      type="button"
                      onClick={isForgotPassword ? backToLogin : toggleView} 
                      className="text-sm text-gray-400 hover:text-brand-green transition-colors"
                    >
                      {isForgotPassword 
                        ? "Back to Sign In" 
                        : (isLogin ? "Don't have an account? Register" : "Already have an account? Sign In")}
                    </button>

                    <div className="pt-4 border-t border-brand-border">
                      <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Need Assistance?</p>
                      <button 
                        type="button"
                        onClick={handleContactSupport}
                        className="text-sm font-medium text-brand-green hover:underline flex items-center justify-center gap-2 mx-auto"
                      >
                        Contact Support Desk
                      </button>
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
