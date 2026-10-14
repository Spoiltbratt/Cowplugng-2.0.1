import React from 'react';
import { AlertCircle, MessageSquare, Phone, Mail, ShieldAlert, ArrowRight } from 'lucide-react';
import { UserProfile } from '../../types';
import { Card, Button } from '../UI';
import { motion } from 'motion/react';

interface VerificationIssueViewProps {
  profile: UserProfile;
  onContactSupport: () => void;
  onResubmit?: () => void;
}

export const VerificationIssueView: React.FC<VerificationIssueViewProps> = ({ 
  profile, 
  onContactSupport,
  onResubmit
}) => {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Account Verification Issue</h2>
            <p className="text-slate-500 text-sm font-medium">Resolution Required</p>
          </div>
        </div>

        <Card className="p-8 border-amber-200 bg-white overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
          
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">Information Review Needed</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                We've identified an issue with your account information that needs to be reviewed before you can continue using CowPlugNG.
              </p>
            </div>

            <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <MessageSquare className="w-3.5 h-3.5" />
                Message from Verification Team
              </div>
              <p className="text-slate-800 text-sm font-medium italic border-l-4 border-slate-200 pl-4 py-1">
                "{profile.verificationIssueMessage || "Please contact our support team to resolve an issue with your identity verification."}"
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-4">
              <Button 
                className="flex-1 h-12 bg-slate-900 hover:bg-slate-800 text-white font-black"
                onClick={onContactSupport}
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                Contact Us
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 h-12 border-slate-200 text-slate-600 font-bold"
                onClick={onResubmit}
              >
                Resubmit Information
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 border-slate-100 bg-white flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Phone className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Support Line</p>
              <p className="text-xs font-bold text-slate-700">+234 800 COWPLUG</p>
            </div>
          </Card>
          <Card className="p-4 border-slate-100 bg-white flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Mail className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Email Support</p>
              <p className="text-xs font-bold text-slate-700">support@cowplug.ng</p>
            </div>
          </Card>
        </div>

        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex gap-4">
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-amber-900">Why was my account flagged?</p>
            <p className="text-[10px] text-amber-800 leading-relaxed">
              To maintain the security of CowPlugNG, all accounts must undergo rigorous verification. 
              Flags are usually raised when NIN information is unclear, mismatched, or requires additional documentation. 
              This is a standard procedure and our team is ready to help you resolve it quickly.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
