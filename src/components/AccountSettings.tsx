import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { User, Mail, Phone, MapPin, Shield, CheckCircle, Save, AlertCircle, ShieldCheck } from 'lucide-react';
import { Card, Button, Input, Badge } from './UI';
import { motion, AnimatePresence } from 'motion/react';
import { VerificationStatus } from '../types';

export const AccountSettings: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVerified = profile?.verificationStatus === VerificationStatus.APPROVED;

  const [formData, setFormData] = useState({
    displayName: profile?.displayName || '',
    phoneNumber: profile?.phoneNumber || '',
    address: profile?.address || '',
  });

  const maskNin = (nin: string | undefined) => {
    if (!nin) return null;
    return `••••••••${nin.slice(-4)}`;
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);
    setSuccess(false);
    setError(null);

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        ...formData,
        updatedAt: Date.now()
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setError("Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Account Identity</h2>
          <p className="text-slate-500 text-sm mt-1">Manage your professional investor profile and contact information.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
          <Shield className="w-4 h-4 text-emerald-700" />
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Secured by CowPlugNG</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <Card className="text-center p-8 sticky top-24">
            <div className="relative inline-block mb-6">
              <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-brand-green to-emerald-800 flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-brand-green/20">
                {profile?.displayName?.[0] || 'U'}
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-brand-green" />
              </div>
            </div>
            
            <h3 className="text-xl font-bold text-slate-900 flex items-center justify-center gap-2">
              {profile?.displayName}
              {isVerified && <ShieldCheck className="w-5 h-5 text-emerald-600" title="Verified Identity" />}
            </h3>
            <p className="text-xs font-black text-brand-green uppercase tracking-[0.2em] mt-2">
              {profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN' ? 'Administrator' : 'Livestock Investor'}
            </p>
            
            <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
              {isVerified && (
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Identity Verified</p>
                    <p className="text-xs font-bold text-slate-700">{maskNin(profile?.ninNumber)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 text-left">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <Mail className="w-4 h-4 text-slate-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Verified Email</p>
                  <p className="text-xs font-bold text-slate-700 truncate">{profile?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-left">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <Shield className="w-4 h-4 text-slate-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Investor ID</p>
                  <p className="text-xs font-mono font-bold text-slate-700">{profile?.investorId || 'CPG-PENDING'}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Personal Information" icon={User}>
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                  <Input
                    label="Display Name / Full Name"
                    placeholder="Enter your full name"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    icon={User}
                    required
                    disabled={isVerified}
                  />
                  {isVerified && (
                    <p className="absolute -bottom-5 left-1 text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                      * Legal name locked after verification. Contact support for changes.
                    </p>
                  )}
                </div>
                <Input
                  label="Mobile Number"
                  placeholder="+234..."
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  icon={Phone}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Current Physical Address</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
                  <textarea
                    rows={3}
                    placeholder="Enter your registered address for dispatches..."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-12 py-3.5 text-slate-900 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all resize-none"
                  />
                </div>
              </div>

              <AnimatePresence>
                {success && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 text-sm font-bold"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Identity profile updated successfully.
                  </motion.div>
                )}
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 text-sm font-bold"
                  >
                    <AlertCircle className="w-5 h-5" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="pt-4 flex justify-end">
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="h-14 px-10 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-brand-green/20"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Identity Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Security & Access" icon={Shield}>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-xl shadow-xs">
                  <Mail className="w-5 h-5 text-brand-green" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Email Authentication</h4>
                  <p className="text-xs text-slate-500 font-medium">Your primary login email cannot be changed.</p>
                </div>
              </div>
              <Badge variant="success">Verified</Badge>
            </div>
            
            <div className="mt-4 p-6 rounded-2xl bg-brand-green/[0.03] border border-brand-green/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900">Password Management</h4>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  To update your security credentials, please follow the password reset link sent to your email.
                </p>
              </div>
              <Button variant="outline" className="h-11 rounded-xl text-xs font-bold border-brand-green/20 text-brand-green hover:bg-brand-green/5">
                Request Reset Link
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
