import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Card, Badge, Button } from './UI';
import { 
  Users, 
  CreditCard, 
  Beef as Cow, 
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
  Settings
} from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import { Livestock, SourcingRequest, PaymentReceipt, UserProfile, UserRole, LivestockStatus, ConsultationRequestStatus } from '../types';

export const AdminDashboard: React.FC<{ onViewTab: (tab: string) => void }> = ({ onViewTab }) => {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [stats, setStats] = useState({
    totalInvestors: 0,
    totalLivestock: 0,
    activeLivestock: 0,
    pendingInvestorApprovals: 0,
    pendingPaymentVerifications: 0,
    pendingSourcingRequests: 0,
    pendingDeliveries: 0,
    totalRevenue: 0,
    monthlyRevenue: 0
  });

  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);



  useEffect(() => {
    // In a production app, these would be separate listeners or a combined function
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const users = snap.docs.map(doc => doc.data() as UserProfile);
      setStats(prev => ({
        ...prev,
        totalInvestors: users.filter(u => u.role === UserRole.INVESTOR).length,
        pendingInvestorApprovals: users.filter(u => u.role === UserRole.INVESTOR && u.status === 'pending').length,
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    const unsubLivestock = onSnapshot(collection(db, 'livestock'), (snap) => {
      const animals = snap.docs.map(doc => doc.data() as Livestock);
      const visibleAnimals = animals.filter(a => 
        a.status !== LivestockStatus.DELIVERED && 
        a.status !== LivestockStatus.DECEASED && 
        a.status !== LivestockStatus.TRANSFERRED && 
        a.status !== LivestockStatus.ARCHIVED &&
        a.status !== LivestockStatus.SOLD
      );
      setStats(prev => ({
        ...prev,
        totalLivestock: visibleAnimals.length,
        activeLivestock: animals.filter(a => a.status === LivestockStatus.ACTIVE).length,
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'livestock'));

    const unsubPayments = onSnapshot(collection(db, 'paymentReceipts'), (snap) => {
      const receipts = snap.docs.map(doc => doc.data() as PaymentReceipt);
      const verified = receipts.filter(r => r.status === 'APPROVED');
      const totalRev = verified.reduce((acc, r) => acc + (r.amount || 0), 0);
      
      setStats(prev => ({
        ...prev,
        pendingPaymentVerifications: receipts.filter(r => r.status === 'AWAITING_VERIFICATION').length,
        totalRevenue: totalRev
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'paymentReceipts'));

    const unsubSourcing = onSnapshot(collection(db, 'consultationRequests'), (snap) => {
      setStats(prev => ({
        ...prev,
        pendingSourcingRequests: snap.docs.filter(d => d.data().status === ConsultationRequestStatus.PENDING_CONTACT).length,
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'consultationRequests'));

    const unsubDelivery = onSnapshot(collection(db, 'deliveryRequests'), (snap) => {
      setStats(prev => ({
        ...prev,
        pendingDeliveries: snap.docs.filter(d => d.data().status === 'PENDING').length,
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'deliveryRequests'));

    const unsubAnn = onSnapshot(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(3)), (snap) => {
      setAnnouncements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'announcements'));

    return () => {
      unsubUsers();
      unsubLivestock();
      unsubPayments();
      unsubSourcing();
      unsubDelivery();
      unsubAnn();
    };
  }, []);

  const StatCard = ({ title, value, icon: Icon, color, onClickTab }: any) => (
    <Card className="hover:border-brand-green/30 transition-all group overflow-hidden relative">
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">{title}</p>
          <h3 className="text-xl font-bold text-white">{typeof value === 'number' && title.includes('Revenue') ? formatCurrency(value) : value}</h3>
        </div>
        <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
          <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-brand-border flex justify-between items-center relative z-10">
        <button 
          onClick={() => onViewTab(onClickTab)}
          className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-brand-green flex items-center gap-1 transition-colors"
        >
          <Eye className="w-3 h-3" />
          Manage {title.split(' ')[1] || 'Module'}
        </button>
      </div>
      <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full ${color} opacity-5 blur-2xl group-hover:opacity-10 transition-opacity`} />
    </Card>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-1 tracking-tight">Admin Command Center</h2>
          <p className="text-gray-400 text-sm">Enterprise-grade control for CowPlugNG operations.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => onViewTab('logs')}>
            <History className="w-4 h-4 mr-2" />
            Audit Logs
          </Button>
          <Button variant="primary" size="sm" onClick={() => onViewTab('announcements')}>
            <Megaphone className="w-4 h-4 mr-2" />
            Broadcast
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard title="User Management" value={stats.totalInvestors} icon={Users} color="bg-blue-500" onClickTab="users" />
        <StatCard title="Total Investors" value={stats.totalInvestors} icon={Briefcase} color="bg-indigo-500" onClickTab="investors" />
        <StatCard title="Livestock Registry" value={stats.totalLivestock} icon={Cow} color="bg-brand-green" onClickTab="livestock" />
        <StatCard title="All Investments" value={stats.totalLivestock} icon={ClipboardList} color="bg-emerald-600" onClickTab="investments" />
        <StatCard title="Sourcing Requests" value={stats.pendingSourcingRequests} icon={ClipboardList} color="bg-indigo-600" onClickTab="sourcing" />
        <StatCard title="Invoice Manager" value={stats.pendingPaymentVerifications} icon={FileText} color="bg-amber-500" onClickTab="invoices" />
        <StatCard title="Payment Receipts" value={stats.pendingPaymentVerifications} icon={CreditCard} color="bg-yellow-600" onClickTab="payments" />
        
        <StatCard title="Opportunities" value={0} icon={Briefcase} color="bg-cyan-600" onClickTab="opportunities" />
        <StatCard title="Medical Records" value={0} icon={Stethoscope} color="bg-red-500" onClickTab="health-records" />
        <StatCard title="Platform Settings" value="Global" icon={Settings} color="bg-gray-500" onClickTab="settings" />
        <StatCard title="Activity Logs" value="Audit" icon={History} color="bg-slate-600" onClickTab="logs" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card 
          title="Latest CEO Announcements" 
          icon={Megaphone}
          className="lg:h-[380px] flex flex-col"
          bodyClassName="lg:flex-1 lg:flex lg:flex-col lg:justify-between lg:overflow-hidden"
        >
          <div className="lg:flex-1 lg:overflow-y-auto space-y-4 lg:pr-1 lg:mb-4">
            {announcements.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-sm">No announcements posted yet.</div>
            ) : (
              announcements.map((ann: any) => (
                <div key={ann.id} className="p-4 rounded-xl border border-brand-border bg-brand-muted/30">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-bold">{ann.title}</h4>
                    <span className="text-[10px] text-gray-500 font-bold uppercase">{formatDate(ann.createdAt)}</span>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2">{ann.content}</p>
                </div>
              ))
            )}
          </div>
          <Button variant="outline" size="sm" className="w-full shrink-0" onClick={() => onViewTab('announcements')}>
            Manage Announcements
          </Button>
        </Card>

        <Card title="Operational Alerts" icon={AlertCircle}>
          <div className="space-y-4">
            {stats.pendingPaymentVerifications > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs font-semibold">{stats.pendingPaymentVerifications} payments need verification</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onViewTab('payments')}>Resolve</Button>
              </div>
            )}
            {stats.pendingSourcingRequests > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-semibold">{stats.pendingSourcingRequests} sourcing requests awaiting review</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onViewTab('sourcing')}>Resolve</Button>
              </div>
            )}
            {stats.pendingDeliveries > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <div className="flex items-center gap-3">
                  <Truck className="w-4 h-4 text-cyan-500" />
                  <span className="text-xs font-semibold">{stats.pendingDeliveries} deliveries to be scheduled</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onViewTab('delivery')}>Resolve</Button>
              </div>
            )}
            {stats.totalInvestors === 0 && stats.totalLivestock === 0 && (
              <div className="py-8 text-center text-gray-500 text-sm">
                <ArrowRight className="w-8 h-8 mx-auto mb-2 opacity-20" />
                No operational alerts currently.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
