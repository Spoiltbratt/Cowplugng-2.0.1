import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Card, Badge, Button, ModernStatCard, CompactStatCard, PageHeader, DashboardSkeleton } from './UI';
import { 
  Users, 
  CreditCard, 
  AlertCircle, 
  TrendingUp, 
  Eye, 
  ArrowRight,
  ClipboardList,
  Stethoscope,
  Briefcase,
  Megaphone,
  Truck,
  History,
  FileText,
  Settings,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  Plus,
  ShieldCheck
} from 'lucide-react';
import { CowIcon as Cow } from './CowIcon';
import { formatCurrency, formatDate, cn, isHistoryAnimal } from '../lib/utils';
import { Livestock, SourcingRequest, PaymentReceipt, PaymentStatus, UserProfile, UserRole, LivestockStatus, ConsultationRequestStatus, VerificationStatus } from '../types';

export const AdminDashboard: React.FC<{ onViewTab: (tab: string) => void }> = ({ onViewTab }) => {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === UserRole.SUPER_ADMIN;

// ... around line 31 ...
  const [stats, setStats] = useState({
    totalInvestors: 0,
    b2bBuyers: 0,
    transporters: 0,
    sellers: 0,
    totalLivestock: 0,
    activeLivestock: 0,
    pendingInvestorApprovals: 0,
    pendingPaymentVerifications: 0,
    pendingSourcingRequests: 0,
    pendingDeliveries: 0,
    totalRevenue: 0,
    marketplaceItems: 0,
    // Database record counts
    totalUsers: 0,
    totalInvoices: 0,
    totalAnnouncements: 0,
    totalActivityLogs: 0,
    totalConsultations: 0,
    totalDeliveries: 0,
    totalPayments: 0,
    totalHealthRecords: 0,
    pendingKycReview: 0
  });

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let activeSubscriptions = 0;
    const checkLoaded = () => {
      activeSubscriptions++;
      if (activeSubscriptions >= 2) {
        setIsLoading(false);
      }
    };

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const users = snap.docs.map(doc => doc.data() as UserProfile);
      setStats(prev => ({
        ...prev,
        totalUsers: snap.size,
        totalInvestors: users.filter(u => u.role === UserRole.INVESTOR).length,
        b2bBuyers: users.filter(u => u.role === UserRole.INVESTOR && u.investmentPlan === 'Premium').length,
        transporters: users.filter(u => u.role === UserRole.CUSTODIAN).length,
        sellers: users.filter(u => u.role === UserRole.CUSTODIAN).length,
        pendingInvestorApprovals: users.filter(u => u.role === UserRole.INVESTOR && u.status === 'pending').length,
        pendingKycReview: users.filter(u => u.verificationStatus === VerificationStatus.SUBMITTED || u.verificationStatus === VerificationStatus.UNDER_REVIEW).length,
      }));
      checkLoaded();
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    const unsubLivestock = onSnapshot(collection(db, 'livestock'), (snap) => {
      const animals = snap.docs.map(doc => doc.data() as Livestock);
      const visibleAnimals = animals.filter(a => !isHistoryAnimal(a));
      setStats(prev => ({
        ...prev,
        totalLivestock: visibleAnimals.length,
        activeLivestock: animals.filter(a => a.status === LivestockStatus.ACTIVE).length,
        marketplaceItems: animals.length
      }));
      checkLoaded();
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'livestock'));

    const unsubPayments = onSnapshot(collection(db, 'paymentReceipts'), (snap) => {
      const receipts = snap.docs.map(doc => doc.data() as PaymentReceipt);
      const verified = receipts.filter(r => r.status === PaymentStatus.VERIFIED);
      const totalRev = verified.reduce((acc, r) => acc + (r.amount || 0), 0);
      
      setStats(prev => ({
        ...prev,
        totalPayments: snap.size,
        pendingPaymentVerifications: receipts.filter(r => r.status === PaymentStatus.UNDER_REVIEW).length,
        totalRevenue: totalRev
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'paymentReceipts'));

    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (snap) => {
      setStats(prev => ({ ...prev, totalInvoices: snap.size }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'invoices'));

    const unsubLogs = onSnapshot(collection(db, 'activityLogs'), (snap) => {
      setStats(prev => ({ ...prev, totalActivityLogs: snap.size }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'activityLogs'));

    const unsubHealth = onSnapshot(collection(db, 'healthRecords'), (snap) => {
      setStats(prev => ({ ...prev, totalHealthRecords: snap.size }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'healthRecords'));

    const unsubSourcing = onSnapshot(collection(db, 'consultationRequests'), (snap) => {
      setStats(prev => ({
        ...prev,
        totalConsultations: snap.size,
        pendingSourcingRequests: snap.docs.filter(d => d.data().status === ConsultationRequestStatus.PENDING_CONTACT).length,
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'consultationRequests'));

    const unsubDelivery = onSnapshot(collection(db, 'deliveryRequests'), (snap) => {
      setStats(prev => ({
        ...prev,
        totalDeliveries: snap.size,
        pendingDeliveries: snap.docs.filter(d => d.data().status === 'PENDING').length,
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'deliveryRequests'));

    const unsubAnn = onSnapshot(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(3)), (snap) => {
      setAnnouncements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setStats(prev => ({ ...prev, totalAnnouncements: snap.size }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'announcements'));

    return () => {
      unsubUsers();
      unsubLivestock();
      unsubPayments();
      unsubInvoices();
      unsubLogs();
      unsubHealth();
      unsubSourcing();
      unsubDelivery();
      unsubAnn();
    };
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Heading & Subtext */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin Dashboard</h1>
        <p className="text-slate-500 mt-1 font-medium">Manage livestock, customers and daily operations.</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CompactStatCard title="Customers" value={stats.totalUsers} icon={Users} onClick={() => onViewTab('users')} />
        <CompactStatCard title="KYC Pending" value={stats.pendingKycReview} icon={ShieldCheck} onClick={() => onViewTab('kyc')} />
        <CompactStatCard title="Livestock" value={stats.totalLivestock} icon={Cow} onClick={() => onViewTab('livestock')} />
        <CompactStatCard title="Pending Requests" value={stats.pendingSourcingRequests} icon={AlertTriangle} onClick={() => onViewTab('sourcing')} />
        <CompactStatCard title="Pending Payments" value={stats.pendingPaymentVerifications} icon={FileText} onClick={() => onViewTab('payments')} />
        <CompactStatCard title="Invoices" value={stats.totalInvoices} icon={FileText} onClick={() => onViewTab('invoices')} />
        <CompactStatCard title="Deliveries" value={stats.pendingDeliveries} icon={Clock} onClick={() => onViewTab('sourcing')} />
        <CompactStatCard title="Revenue" value={formatCurrency(stats.totalRevenue)} icon={TrendingUp} />
      </div>

      {/* Financial Health Summary */}
      <Card 
        title="Investor Accounts & Audit" 
        icon={History}
        className="border-emerald-100 bg-emerald-50/20"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-2">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Investor Spending</p>
            <p className="text-2xl font-black text-emerald-600">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-[10px] font-medium text-emerald-600/60">From verified payment receipts</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Livestock Assets</p>
            <p className="text-2xl font-black text-slate-900">{stats.totalLivestock}</p>
            <p className="text-[10px] font-medium text-slate-500">Active portfolio items</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pending Payments</p>
            <p className="text-2xl font-black text-amber-600">{stats.pendingPaymentVerifications}</p>
            <p className="text-[10px] font-medium text-amber-600/60">Awaiting admin verification</p>
          </div>
          <div className="flex items-end justify-end">
            <Button variant="primary" size="sm" onClick={() => onViewTab('audit')} className="w-full sm:w-auto">
              Run Full Account Audit <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Needs Attention */}
        <Card title="Needs Attention" icon={AlertTriangle}>
          <div className="space-y-3">
            {stats.pendingKycReview > 0 && (
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                <span className="text-xs font-bold text-slate-700">{stats.pendingKycReview} KYC to Review</span>
                <Button variant="ghost" size="sm" onClick={() => onViewTab('kyc')}>View <ArrowRight className="w-3 h-3" /></Button>
              </div>
            )}
            {stats.pendingPaymentVerifications > 0 && (
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                <span className="text-xs font-bold text-slate-700">{stats.pendingPaymentVerifications} Payments to Review</span>
                <Button variant="ghost" size="sm" onClick={() => onViewTab('payments')}>View <ArrowRight className="w-3 h-3" /></Button>
              </div>
            )}
            {stats.pendingSourcingRequests > 0 && (
              <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl">
                <span className="text-xs font-bold text-slate-700">{stats.pendingSourcingRequests} Requests Pending</span>
                <Button variant="ghost" size="sm" onClick={() => onViewTab('sourcing')}>View <ArrowRight className="w-3 h-3" /></Button>
              </div>
            )}
            {(stats.pendingPaymentVerifications === 0 && stats.pendingSourcingRequests === 0) && (
              <div className="text-center py-6">
                <p className="text-sm font-medium text-slate-500">You're all caught up!</p>
              </div>
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card title="Recent Activity" icon={Activity}>
          <div className="space-y-4">
            {announcements.map((ann: any) => (
              <div key={ann.id} className="flex items-center gap-3 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-700 truncate">{ann.title}</span>
                <span className="text-slate-500 ml-auto font-medium">{formatDate(ann.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => onViewTab('livestock')}>Add Livestock <Plus className="w-4 h-4" /></Button>
        <Button variant="outline" onClick={() => onViewTab('users')}>Add Customer <Plus className="w-4 h-4" /></Button>
        <Button variant="outline" onClick={() => onViewTab('invoices')}>Create Invoice <Plus className="w-4 h-4" /></Button>
        <Button variant="outline" onClick={() => onViewTab('sourcing')}>View Requests</Button>
      </div>
    </div>
  );
};
