import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './lib/AuthContext';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { AuthView } from './components/AuthView';
import { VerifyEmailView } from './components/VerifyEmailView';
import { DashboardLayout } from './components/DashboardLayout';
import { AdminDashboard } from './components/AdminDashboard';
import { InvestorDashboard } from './components/InvestorDashboard';
import { InvestorManager } from './components/admin/InvestorManager';
import { LivestockManager } from './components/admin/LivestockManager';
import { ConsultationManager } from './components/admin/ConsultationManager';
import { InvoiceManager } from './components/admin/InvoiceManager';
import { PaymentVerifier } from './components/admin/PaymentVerifier';
import { DeliveryManager } from './components/admin/DeliveryManager';
import { OpportunityManager } from './components/admin/OpportunityManager';
import { AnnouncementManager } from './components/admin/AnnouncementManager';
import { ActivityLogs } from './components/admin/ActivityLogs';
import { PlatformSettings } from './components/admin/PlatformSettings';
import { LandingSettings } from './components/admin/LandingSettings';
import { AdminManager } from './components/admin/AdminManager';
import { InvestmentManager } from './components/admin/InvestmentManager';
import { AdminKycManager } from './components/admin/AdminKycManager';
import { InvestorAuditManager } from './components/admin/InvestorAuditManager';
import { LiquidationManager } from './components/admin/LiquidationManager';
import { TestingResetManager } from './components/admin/TestingResetManager';
import { HealthRecordManager } from './components/admin/HealthRecordManager';
import { AccountSettings } from './components/AccountSettings';
import { Card, Badge, Button } from './components/UI';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  Users, 
  HeartPulse,
  ReceiptText, 
  ArrowLeftRight, 
  Briefcase, 
  Megaphone,
  TriangleAlert,
  History,
  Lock,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { CowIcon as Beef } from './components/CowIcon';
import { MyLivestock } from './components/investor/MyLivestock';
import { MySpending } from './components/investor/MySpending';
import { MyInvoices } from './components/investor/MyInvoices';
import { MyReceipts } from './components/investor/MyReceipts';
import { NotificationCenter } from './components/investor/NotificationCenter';
import { InvestorSourcingManager } from './components/investor/InvestorSourcingManager';
import { MyPortfolio } from './components/investor/MyPortfolio';
import { LandingPage } from './components/LandingPage';
import { KycVerification } from './components/KycVerification';
import { VerificationIssueView } from './components/investor/VerificationIssueView';
import { VerificationStatus } from './types';
import { PwaInstallModal } from './components/pwa/PwaInstallModal';
import { PwaUpdateNotification } from './components/pwa/PwaUpdateNotification';

export default function App() {
  const { 
    user, profile, loading, error, 
    isAdmin, isSuperAdmin, isInvestor
  } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (profile?.verificationStatus === VerificationStatus.VERIFICATION_ISSUE && activeTab === 'dashboard') {
      setActiveTab('verification-issue');
    }
  }, [profile, activeTab]);

  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [hasRedirected, setHasRedirected] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceNoticeMessage, setMaintenanceNoticeMessage] = useState<string>(
    'Our ecosystem is currently undergoing scheduled technical improvements to enhance your investment security and platform performance. We will be back online shortly.'
  );

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const settingsRef = doc(db, 'settings', 'global');
        const snap = await getDoc(settingsRef);
        if (snap.exists()) {
          const data = snap.data();
          const maintenanceActive = !!data.siteControls?.maintenanceMode;
          if (data.siteControls?.maintenanceMessage) {
            setMaintenanceNoticeMessage(data.siteControls.maintenanceMessage);
          }
          if (maintenanceActive && !isSuperAdmin && !isAdmin) {
            setIsMaintenanceMode(true);
          } else {
            setIsMaintenanceMode(false);
          }
        }
      } catch (e) {
        console.error("Settings check error:", e);
      }
    };
    checkMaintenance();
  }, [isSuperAdmin, isAdmin]);

  // Safety timeout for loading state
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        // If still loading after 10 seconds, something might be stuck
        // We'll force loading to false but the UI will likely show the profile error or fallback
        console.warn("Auth loading timeout reached. Forcing load completion.");
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const handleViewTab = (tab: string, invoiceId?: string) => {
    setActiveTab(tab);
    if (invoiceId) {
      setActiveInvoiceId(invoiceId);
    } else {
      setActiveInvoiceId(null);
    }
  };

  const handleResubmit = async () => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        verificationStatus: VerificationStatus.NOT_STARTED,
        isVerified: false
      });
    } catch (err) {
      console.error("Resubmit error:", err);
    }
  };

  useEffect(() => {
    if (profile && !hasRedirected) {
      if (isAdmin || isSuperAdmin) {
        setActiveTab('dashboard');
      } else if (isInvestor) {
        setActiveTab('dashboard');
      }
      setHasRedirected(true);
    }
  }, [profile, isAdmin, isSuperAdmin, isInvestor, hasRedirected]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-12 h-12 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
        <p className="text-brand-green font-bold tracking-widest uppercase text-xs">CowPlugNG Loading...</p>
        <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider animate-pulse">Establishing Secure Session</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {showAuth ? (
          <AuthView onBack={() => setShowAuth(false)} />
        ) : (
          <LandingPage onLogin={() => setShowAuth(true)} />
        )}
        <PwaInstallModal />
        <PwaUpdateNotification />
      </>
    );
  }

  // Require Email Verification before allowing access to application features
  if (!user.emailVerified) {
    return (
      <>
        <VerifyEmailView />
        <PwaInstallModal />
        <PwaUpdateNotification />
      </>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6 p-6 text-center">
        {error ? (
          <div className="space-y-6 max-w-sm animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Synchronization Error</h3>
              <p className="text-slate-600 text-sm">
                {error?.message || "We're having trouble retrieving your profile. This can happen if your account was just created or if there's a connection issue."}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button onClick={() => window.location.reload()} className="w-full">
                Retry Synchronization
              </Button>
              <Button variant="outline" onClick={() => import('./lib/firebase').then(({ auth }) => auth.signOut())} className="w-full">
                Sign Out & Try Again
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
            <div className="space-y-1">
              <p className="text-slate-900 font-black tracking-tighter text-lg uppercase">Synchronizing Identity...</p>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Verifying cloud profile with Firestore</p>
            </div>
            
            {/* Timeout Help Box */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 8 }}
              className="mt-8 p-6 bg-white border border-slate-200 rounded-lg shadow-sm text-left max-w-xs"
            >
              <h4 className="text-sm font-bold text-slate-900 mb-2">Taking a while?</h4>
              <p className="text-xs text-slate-500 mb-4">The verification process is taking longer than expected. Please check your connection or try again.</p>
              <div className="flex gap-3">
                <Button size="sm" onClick={() => window.location.reload()} className="flex-1">Retry</Button>
                <Button size="sm" variant="outline" onClick={() => import('./lib/firebase').then(({ auth }) => auth.signOut())} className="flex-1">Return</Button>
              </div>
            </motion.div>
          </>
        )}
      </div>
    );
  }

  // Mandatory Identity Verification Check
  // Admins bypass KYC for themselves to manage the platform, 
  // but regular users must be approved.
  if (!isAdmin && 
      (!profile.verificationStatus ||
       profile.verificationStatus === VerificationStatus.NOT_STARTED || 
       profile.verificationStatus === VerificationStatus.REJECTED ||
       profile.verificationStatus === VerificationStatus.SUBMITTED ||
       profile.verificationStatus === VerificationStatus.UNDER_REVIEW)) {
    return <KycVerification userProfile={profile} />;
  }

  // Account Suspension Check
  if (profile.status === 'suspended' || profile.accountStatus === 'suspended') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-red-100 p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Account Suspended</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Your account has been temporarily suspended by the administration. You currently do not have access to the platform's features.
          </p>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-3">
            <p className="text-sm font-bold text-slate-700">What to do next:</p>
            <ul className="text-xs text-slate-500 space-y-2 list-disc list-inside">
              <li>Check your email for any communication regarding this suspension.</li>
              <li>Contact our customer support team to resolve the issue.</li>
              <li>Once resolved, your account will be reactivated by an admin.</li>
            </ul>
          </div>
          <div className="pt-4 space-y-3">
            <Button className="w-full" onClick={() => window.location.href = "mailto:support@cowplug.com"}>
              Contact Support
            </Button>
            <Button variant="outline" className="w-full" onClick={() => import('./lib/firebase').then(({ auth }) => auth.signOut())}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    // Admin Views
    if (isAdmin) {
      switch (activeTab) {
        case 'dashboard': return <AdminDashboard onViewTab={handleViewTab} />;
        case 'kyc': return <AdminKycManager />;
        case 'users': return <AdminManager />;
        case 'investors': return <InvestorManager />;
        case 'livestock': return <LivestockManager />;
        case 'liquidations': return <LiquidationManager />;
        case 'investments': return <InvestmentManager />;
        case 'sourcing': return <ConsultationManager />;
        case 'invoices': return <InvoiceManager />;
        case 'payments': return <PaymentVerifier />;
        case 'opportunities': return <OpportunityManager />;
        case 'health-records': return <HealthRecordManager />;
        case 'announcements': return <AnnouncementManager />;
        case 'notifications': return <NotificationCenter />;
        case 'logs': return <ActivityLogs />;
        case 'audit': return <InvestorAuditManager />;
        case 'landing-settings': return <LandingSettings />;
        case 'branding': return <PlatformSettings initialTab="branding" />;
        case 'settings': return <PlatformSettings initialTab="general" />;
        case 'testing-reset': return <TestingResetManager />;
        case 'account': return <AccountSettings />;
        default: return <AdminDashboard onViewTab={handleViewTab} />;
      }
    }

    // Investor Views
    if (isInvestor) {
      switch (activeTab) {
        case 'dashboard': return <InvestorDashboard onViewTab={handleViewTab} />;
        case 'spending': return <MySpending onViewTab={handleViewTab} />;
        case 'portfolio': return <MyPortfolio onViewTab={handleViewTab} />;
        case 'my-livestock': return <MyLivestock />;
        case 'sourcing':
        case 'requests': return <InvestorSourcingManager onViewTab={handleViewTab} />;
        case 'invoices': return <MyInvoices onViewTab={handleViewTab} />;
        case 'receipts': return <MyReceipts initialInvoiceId={activeInvoiceId} onClearInvoice={() => setActiveInvoiceId(null)} />;
        case 'notifications': return <NotificationCenter />;
        case 'verification-issue': return <VerificationIssueView profile={profile!} onContactSupport={() => setActiveTab('notifications')} onResubmit={handleResubmit} />;
        case 'account': return <AccountSettings />;
        default: return <InvestorDashboard onViewTab={handleViewTab} />;
      }
    }

    return <div>No role assigned. Contact Admin.</div>;
  };

  if (isMaintenanceMode && !isSuperAdmin && !isAdmin) {
    if (!user && showAuth) {
      return <AuthView onBack={() => setShowAuth(false)} />;
    }

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans text-white">
        <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-700">
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 bg-emerald-600/20 border border-emerald-500/30 rounded-3xl flex items-center justify-center shadow-2xl rotate-3">
              <Lock className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span className="font-black text-2xl tracking-tighter text-white">
                  CowPlug<span className="text-emerald-400">NG</span>
                </span>
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">System Under Maintenance</h1>
              <p className="text-emerald-400 font-extrabold text-[10px] uppercase tracking-[0.2em] mt-2">
                Site Locked for Scheduled Upgrades
              </p>
            </div>
          </div>

          <div className="p-6 bg-slate-800/80 border border-slate-700/80 rounded-3xl text-left space-y-4 shadow-xl backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Broadcast Notice from Administration</span>
            </div>
            <p className="text-slate-200 text-sm font-medium leading-relaxed whitespace-pre-wrap">
              {maintenanceNoticeMessage}
            </p>
            <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400 font-semibold">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Status: Maintenance Active
              </span>
              <span>CowPlug Core</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <Button onClick={() => window.location.reload()} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl py-3 font-bold text-xs uppercase tracking-wider">
              Refresh Status
            </Button>
            {!user ? (
              <button 
                type="button" 
                onClick={() => setShowAuth(true)}
                className="text-xs text-slate-400 hover:text-emerald-400 transition-colors font-medium underline underline-offset-4"
              >
                Administrator Portal Access
              </button>
            ) : (
              <Button 
                variant="outline" 
                onClick={() => import('./lib/firebase').then(({ auth }) => auth.signOut())} 
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 rounded-2xl text-xs font-bold"
              >
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderContent()}
      </DashboardLayout>
      <PwaInstallModal />
      <PwaUpdateNotification />
    </>
  );
}

const PlaceholderView = ({ title, icon: Icon }: any) => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-3xl font-bold mb-1">{title}</h2>
        <p className="text-slate-600">Module currently under technical maintenance</p>
      </div>
      <div className="p-4 bg-brand-surface rounded-2xl border border-brand-border">
        <Icon className="w-8 h-8 text-brand-green" />
      </div>
    </div>

    <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed border-2 border-brand-border">
      <div className="w-20 h-20 bg-brand-green/10 rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="w-10 h-10 text-brand-green" />
      </div>
      <h3 className="text-2xl font-bold mb-2">Module Coming Soon</h3>
      <p className="text-slate-600 max-w-sm">
        We are rebuilding the {title} module to provide a more robust enterprise-grade experience.
      </p>
      <div className="mt-8 flex gap-4">
        <Button variant="outline">Back to Home</Button>
        <Button>Contact Support</Button>
      </div>
    </Card>
  </div>
);
