import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  where 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  UserProfile, 
  UserRole, 
  Invoice, 
  PaymentReceipt, 
  Livestock, 
  ChargeCategory,
  LivestockStatus,
  VerificationStatus,
  ActivityLog
} from '../../types';
import { 
  Card, 
  Badge, 
  Button, 
  Input, 
  PageHeader, 
  DashboardSkeleton,
  Modal
} from '../UI';
import { 
  Search, 
  Filter, 
  History, 
  TrendingUp, 
  CreditCard, 
  Download,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  FileText,
  User,
  Clock,
  ChevronRight,
  Calendar,
  Wallet,
  Receipt,
  BarChart3,
  SearchCheck
} from 'lucide-react';
import { CowIcon as Cow } from '../CowIcon';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { InvestorAuditModal } from './InvestorAuditModal';

export const InvestorAuditManager: React.FC = () => {
  const [investors, setInvestors] = useState<UserProfile[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentReceipt[]>([]);
  const [livestock, setLivestock] = useState<Livestock[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'active' | 'suspended' | 'pending'>('ALL');
  const [selectedInvestor, setSelectedInvestor] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), where('role', '==', UserRole.INVESTOR)),
      (snap) => {
        setInvestors(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const unsubInvoices = onSnapshot(
      collection(db, 'invoices'),
      (snap) => {
        setInvoices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'invoices')
    );

    const unsubPayments = onSnapshot(
      collection(db, 'paymentReceipts'),
      (snap) => {
        setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentReceipt)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'paymentReceipts')
    );

    const unsubLivestock = onSnapshot(
      collection(db, 'livestock'),
      (snap) => {
        setLivestock(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Livestock)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'livestock')
    );

    const unsubLogs = onSnapshot(
      query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc')),
      (snap) => {
        setActivityLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'activityLogs')
    );

    const timer = setTimeout(() => setLoading(false), 1500);

    return () => {
      unsubUsers();
      unsubInvoices();
      unsubPayments();
      unsubLivestock();
      unsubLogs();
      clearTimeout(timer);
    };
  }, []);

  // Financial Calculations
  const auditStats = useMemo(() => {
    const approvedPayments = payments.filter(p => p.status === 'VERIFIED');
    const totalPaymentsReceived = approvedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const pendingPayments = payments.filter(p => p.status === 'UNDER_REVIEW').reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const paidInvoices = invoices.filter(inv => inv.status === 'PAID');
    
    let totalLivestockPurchases = 0;
    let totalManagement = 0;
    let totalFeed = 0;
    let totalVet = 0;
    let totalLogistics = 0;
    let totalOther = 0;

    paidInvoices.forEach(inv => {
      if (inv.items) {
        inv.items.forEach(item => {
          const amt = item.amount || (item.unitPrice * item.quantity) || 0;
          switch (item.category) {
            case 'Livestock': totalLivestockPurchases += amt; break;
            case 'Farm Management': totalManagement += amt; break;
            case 'Feed':
            case 'Fattening': totalFeed += amt; break;
            case 'Healthcare': totalVet += amt; break;
            case 'Transport': totalLogistics += amt; break;
            default: totalOther += amt; break;
          }
        });
      } else if (inv.totalAmount) {
        totalLivestockPurchases += inv.totalAmount;
      }
    });

    const totalExpenses = totalManagement + totalFeed + totalVet + totalLogistics + totalOther;
    const totalSpending = totalLivestockPurchases + totalExpenses;

    const outstandingInvoices = invoices
      .filter(inv => inv.status === 'PENDING' || inv.status === 'OVERDUE')
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    return {
      totalInvestors: investors.length,
      totalSpending,
      totalLivestockPurchases,
      totalManagement,
      totalFeed,
      totalVet,
      totalLogistics,
      totalOther,
      totalExpenses,
      totalPaymentsReceived,
      pendingPayments,
      outstandingInvoices
    };
  }, [investors, invoices, payments]);

  const investorFinancials = useMemo(() => {
    return investors.map(user => {
      const userInvoices = invoices.filter(inv => inv.investorId === user.uid);
      const userPayments = payments.filter(p => p.investorId === user.uid && p.status === 'VERIFIED');
      const userLivestock = livestock.filter(l => l.ownerId === user.uid);

      const totalPaid = userPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      
      const totalBilled = userInvoices
        .filter(inv => inv.status !== 'CANCELLED')
        .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

      const outstanding = Math.max(0, totalBilled - totalPaid);

      let totalPurchases = 0;
      let totalManagement = 0;
      let totalFeed = 0;
      let totalVet = 0;
      let totalLogistics = 0;
      let totalOther = 0;

      userInvoices.filter(inv => inv.status === 'PAID').forEach(inv => {
        if (inv.items) {
          inv.items.forEach(item => {
            const amt = item.amount || (item.unitPrice * item.quantity) || 0;
            switch (item.category) {
              case 'Livestock': totalPurchases += amt; break;
              case 'Farm Management': totalManagement += amt; break;
              case 'Feed':
              case 'Fattening': totalFeed += amt; break;
              case 'Healthcare': totalVet += amt; break;
              case 'Transport': totalLogistics += amt; break;
              default: totalOther += amt; break;
            }
          });
        } else if (inv.totalAmount) {
          totalPurchases += inv.totalAmount;
        }
      });

      const totalExp = totalManagement + totalFeed + totalVet + totalLogistics + totalOther;
      const totalSpent = totalPurchases + totalExp;

      // Find last transaction date
      const lastInvoice = userInvoices.length > 0 ? Math.max(...userInvoices.map(i => i.createdAt)) : 0;
      const lastPayment = userPayments.length > 0 ? Math.max(...userPayments.map(p => p.createdAt)) : 0;
      const lastActivity = Math.max(lastInvoice, lastPayment, user.createdAt);

      return {
        ...user,
        livestockCount: userLivestock.length,
        totalPurchases,
        totalExp,
        totalPaid,
        outstanding,
        lastActivity,
        totalSpent
      };
    });
  }, [investors, invoices, payments, livestock]);

  const filteredInvestors = investorFinancials.filter(inv => {
    const matchesSearch = 
      inv.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.investorId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.uid.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'ALL' || inv.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  }).sort((a, b) => b.totalPurchases + b.totalExp - (a.totalPurchases + a.totalExp));

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader 
        title="Investor Accounts & Audit" 
        subtitle="Review investor spending, purchases, expenses and account activity."
        icon={History}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Total Investors</p>
              <p className="text-xl font-black text-slate-900">{auditStats.totalInvestors}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Total Spending</p>
              <p className="text-xl font-black text-emerald-600">{formatCurrency(auditStats.totalSpending)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Cow className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Livestock Purchases</p>
              <p className="text-xl font-black text-amber-600">{formatCurrency(auditStats.totalLivestockPurchases)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Payments Received</p>
              <p className="text-xl font-black text-blue-600">{formatCurrency(auditStats.totalPaymentsReceived)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Detailed Financial Categories */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-4 bg-white border-slate-200">
          <p className="text-[10px] font-black uppercase text-slate-400">Livestock Purchases</p>
          <p className="text-base font-black text-slate-900 mt-1">{formatCurrency(auditStats.totalLivestockPurchases)}</p>
        </Card>
        <Card className="p-4 bg-white border-slate-200">
          <p className="text-[10px] font-black uppercase text-slate-400">Farm Management</p>
          <p className="text-base font-black text-slate-900 mt-1">{formatCurrency(auditStats.totalManagement)}</p>
        </Card>
        <Card className="p-4 bg-white border-slate-200">
          <p className="text-[10px] font-black uppercase text-slate-400">Feed / Fattening</p>
          <p className="text-base font-black text-slate-900 mt-1">{formatCurrency(auditStats.totalFeed)}</p>
        </Card>
        <Card className="p-4 bg-white border-slate-200">
          <p className="text-[10px] font-black uppercase text-slate-400">Veterinary</p>
          <p className="text-base font-black text-slate-900 mt-1">{formatCurrency(auditStats.totalVet)}</p>
        </Card>
        <Card className="p-4 bg-white border-slate-200">
          <p className="text-[10px] font-black uppercase text-slate-400">Logistics</p>
          <p className="text-base font-black text-slate-900 mt-1">{formatCurrency(auditStats.totalLogistics)}</p>
        </Card>
        <Card className="p-4 bg-white border-slate-200">
          <p className="text-[10px] font-black uppercase text-slate-400">Other Expenses</p>
          <p className="text-base font-black text-slate-900 mt-1">{formatCurrency(auditStats.totalOther)}</p>
        </Card>
      </div>

      {/* Investor List Table */}
      <Card className="overflow-hidden border-slate-200">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by Name, Email or Investor ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            {['ALL', 'active', 'pending', 'suspended'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status as any)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  filterStatus === status 
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10" 
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">Investor</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 text-center">Assets</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">Purchases</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">Expenses</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">Total Paid</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">Outstanding</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">Last Active</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvestors.map((inv) => (
                <tr 
                  key={inv.uid} 
                  className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedInvestor(inv);
                    setIsModalOpen(true);
                  }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs uppercase">
                        {inv.displayName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 tracking-tight">{inv.displayName}</p>
                        <p className="text-[10px] font-medium text-slate-400">{inv.investorId || (inv.uid || '').slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge 
                      variant={inv.status === 'active' ? 'success' : inv.status === 'pending' ? 'warning' : 'danger'}
                      className="text-[9px] font-black uppercase"
                    >
                      {inv.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 rounded-md bg-slate-100 text-[10px] font-black text-slate-700">
                      {inv.livestockCount}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-slate-900">{formatCurrency(inv.totalPurchases)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-slate-600">{formatCurrency(inv.totalExp)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-emerald-600">{formatCurrency(inv.totalPaid)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-xs font-bold",
                      inv.outstanding > 0 ? "text-red-600" : "text-slate-400"
                    )}>
                      {formatCurrency(inv.outstanding)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-medium text-slate-500">{formatDate(inv.lastActivity)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-slate-200">
                      <Eye className="w-4 h-4 text-slate-400" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredInvestors.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <SearchCheck className="w-12 h-12 text-slate-200" />
                      <p className="text-sm font-medium text-slate-500">No investors matching your search criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <InvestorAuditModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        investor={selectedInvestor}
        allInvoices={invoices}
        allPayments={payments}
        allLivestock={livestock}
        allLogs={activityLogs}
      />
    </div>
  );
};
