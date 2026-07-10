import React, { useState, useEffect } from 'react';
import { useAuth } from './lib/AuthContext';
import { AuthView } from './components/AuthView';
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
import { AdminManager } from './components/admin/AdminManager';
import { Card, Badge, Button } from './components/UI';
import { 
  Users, 
  Beef as Cow, 
  FileText, 
  CreditCard, 
  Briefcase, 
  Megaphone,
  AlertCircle,
  History
} from 'lucide-react';
import { MyLivestock } from './components/investor/MyLivestock';
import { MyInvoices } from './components/investor/MyInvoices';
import { MyReceipts } from './components/investor/MyReceipts';
import { NotificationCenter } from './components/investor/NotificationCenter';
import { LandingPage } from './components/LandingPage';

export default function App() {
  const { 
    user, profile, loading, error, 
    isAdmin, isSuperAdmin, isInvestor
  } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [hasRedirected, setHasRedirected] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

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
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-12 h-12 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
        <p className="text-brand-green font-bold tracking-widest uppercase text-xs">CowPlugNG Loading...</p>
      </div>
    );
  }

  if (!user) {
    return showAuth ? (
      <AuthView onBack={() => setShowAuth(false)} />
    ) : (
      <LandingPage onLogin={() => setShowAuth(true)} />
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center gap-6 p-6 text-center">
        {error ? (
          <div className="space-y-6 max-w-sm animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Synchronization Error</h3>
              <p className="text-gray-400 text-sm">
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
              <p className="text-brand-green font-bold tracking-widest uppercase text-xs">Synchronizing Identity...</p>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">Verifying cloud profile with Firestore</p>
            </div>
          </>
        )}
      </div>
    );
  }

  const renderContent = () => {
    // Admin Views
    if (isAdmin) {
      switch (activeTab) {
        case 'dashboard': return <AdminDashboard onViewTab={setActiveTab} />;
        case 'users': return <AdminManager />;
        case 'investors': return <InvestorManager />;
        case 'livestock': return <LivestockManager />;
        case 'investments': return <PlaceholderView title="Investment Tracker" icon={Briefcase} />;
        case 'sourcing': return <ConsultationManager />;
        case 'invoices': return <InvoiceManager />;
        case 'payments': return <PaymentVerifier />;
        case 'opportunities': return <OpportunityManager />;
        case 'health-records': return <PlaceholderView title="Platform Medical Records" icon={Cow} />;
        case 'announcements': return <AnnouncementManager />;
        case 'logs': return <ActivityLogs />;
        case 'settings': return <PlatformSettings />;
        default: return <AdminDashboard onViewTab={setActiveTab} />;
      }
    }

    // Investor Views
    if (isInvestor) {
      switch (activeTab) {
        case 'dashboard': return <InvestorDashboard onViewTab={setActiveTab} />;
        case 'portfolio': return <PlaceholderView title="My Portfolio" icon={Briefcase} />;
        case 'my-livestock': return <MyLivestock />;
        case 'sourcing': return <PlaceholderView title="Livestock Sourcing" icon={Cow} />;
        case 'invoices': return <MyInvoices />;
        case 'receipts': return <MyReceipts />;
        case 'notifications': return <NotificationCenter />;
        default: return <InvestorDashboard onViewTab={setActiveTab} />;
      }
    }

    return <div>No role assigned. Contact Admin.</div>;
  };

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </DashboardLayout>
  );
}

const PlaceholderView = ({ title, icon: Icon }: any) => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-3xl font-bold mb-1">{title}</h2>
        <p className="text-gray-400">Module currently under technical maintenance</p>
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
      <p className="text-gray-400 max-w-sm">
        We are rebuilding the {title} module to provide a more robust enterprise-grade experience.
      </p>
      <div className="mt-8 flex gap-4">
        <Button variant="outline">Back to Home</Button>
        <Button>Contact Support</Button>
      </div>
    </Card>
  </div>
);
