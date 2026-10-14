import React, { useMemo, useState } from 'react';
import { 
  UserProfile, 
  Invoice, 
  PaymentReceipt, 
  Livestock, 
  ActivityLog, 
  LivestockStatus,
  ChargeCategory
} from '../../types';
import { 
  Modal, 
  Card, 
  Badge, 
  Button
} from '../UI';
import { 
  User, 
  Mail, 
  Phone, 
  ShieldCheck, 
  Calendar, 
  TrendingUp, 
  CreditCard, 
  Wallet, 
  Receipt, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  History,
  FileText,
  DollarSign,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  PieChart,
  Activity,
  Briefcase,
  Stethoscope,
  Truck
} from 'lucide-react';
import { CowIcon as Cow } from '../CowIcon';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface InvestorAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  investor: UserProfile | null;
  allInvoices: Invoice[];
  allPayments: PaymentReceipt[];
  allLivestock: Livestock[];
  allLogs: ActivityLog[];
}

export const InvestorAuditModal: React.FC<InvestorAuditModalProps> = ({
  isOpen,
  onClose,
  investor,
  allInvoices,
  allPayments,
  allLivestock,
  allLogs
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LEDGER' | 'ASSETS' | 'TIMELINE'>('OVERVIEW');

  const financials = useMemo(() => {
    if (!investor) return null;

    const userInvoices = allInvoices.filter(inv => inv.investorId === investor.uid);
    const userPayments = allPayments.filter(p => p.investorId === investor.uid && p.status === 'VERIFIED');
    const userLivestock = allLivestock.filter(l => l.ownerId === investor.uid);
    const userLogs = allLogs.filter(log => log.userId === investor.uid || log.targetId === investor.uid);

    const totalSpent = userInvoices
      .filter(inv => inv.status === 'PAID')
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    const totalPaid = userPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const totalBilled = userInvoices
      .filter(inv => inv.status !== 'CANCELLED')
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    const outstanding = Math.max(0, totalBilled - totalPaid);

    // Detailed Categories
    let totalLivestockPurchases = 0;
    let totalManagementFees = 0;
    let totalFeedExpenses = 0;
    let totalVetExpenses = 0;
    let totalLogisticsExpenses = 0;
    let totalOtherExpenses = 0;

    userInvoices.filter(inv => inv.status === 'PAID').forEach(inv => {
      inv.items?.forEach(item => {
        const amt = item.amount || 0;
        switch (item.category) {
          case 'Livestock': totalLivestockPurchases += amt; break;
          case 'Farm Management': totalManagementFees += amt; break;
          case 'Feed':
          case 'Fattening': totalFeedExpenses += amt; break;
          case 'Healthcare': totalVetExpenses += amt; break;
          case 'Transport': totalLogisticsExpenses += amt; break;
          default: totalOtherExpenses += amt; break;
        }
      });
    });

    const totalExpenses = totalManagementFees + totalFeedExpenses + totalVetExpenses + totalLogisticsExpenses + totalOtherExpenses;

    // Transaction Ledger (Invoices and Payments)
    const ledger = [
      ...userInvoices.filter(inv => inv.status !== 'CANCELLED').map(inv => ({
        id: inv.id,
        date: inv.createdAt,
        type: 'INVOICE',
        description: `Invoice ${inv.invoiceNumber}`,
        category: 'Billing',
        amount: inv.totalAmount,
        status: inv.status,
        relatedId: inv.id,
        items: inv.items
      })),
      ...userPayments.map(p => ({
        id: p.id,
        date: p.createdAt,
        type: 'PAYMENT',
        description: `Payment Receipt - ${p.referenceNumber}`,
        category: 'Payment',
        amount: p.amount,
        status: p.status,
        relatedId: p.invoiceId,
        ref: p.referenceNumber
      }))
    ].sort((a, b) => b.date - a.date);

    // Asset Breakdown
    const assetBreakdown = userLivestock.map(l => {
      // Find expenses for this specific livestock across all user invoices
      let livestockExpenses = {
        purchase: 0,
        management: 0,
        feed: 0,
        vet: 0,
        logistics: 0,
        other: 0
      };

      userInvoices.forEach(inv => {
        inv.items?.forEach(item => {
          if (item.livestockId === l.id || item.livestockTag === l.tagNumber) {
            const amt = item.amount || 0;
            switch (item.category) {
              case 'Livestock': livestockExpenses.purchase += amt; break;
              case 'Farm Management': livestockExpenses.management += amt; break;
              case 'Feed':
              case 'Fattening': livestockExpenses.feed += amt; break;
              case 'Healthcare': livestockExpenses.vet += amt; break;
              case 'Transport': livestockExpenses.logistics += amt; break;
              default: livestockExpenses.other += amt; break;
            }
          }
        });
      });

      const totalInvested = Object.values(livestockExpenses).reduce((a, b) => a + b, 0);
      const isSold = l.status === LivestockStatus.SOLD;
      const profitLoss = isSold ? (l.saleAmount || 0) - totalInvested : null;

      return {
        ...l,
        expenses: livestockExpenses,
        totalInvested,
        profitLoss
      };
    });

    return {
      stats: {
        totalSpent,
        totalPaid,
        outstanding,
        totalExpenses,
        totalLivestockPurchases,
        totalManagementFees,
        totalFeedExpenses,
        totalVetExpenses,
        totalLogisticsExpenses,
        totalOtherExpenses
      },
      ledger,
      assetBreakdown,
      logs: userLogs
    };
  }, [investor, allInvoices, allPayments, allLivestock, allLogs]);

  if (!investor || !financials) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Investor Account Audit"
      maxWidth="5xl"
    >
      <div className="flex flex-col gap-8 pb-8">
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 flex items-center justify-center text-white text-2xl font-black">
              {investor.displayName.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{investor.displayName}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                  <Mail className="w-3.5 h-3.5" /> {investor.email}
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                  <Phone className="w-3.5 h-3.5" /> {investor.phoneNumber || 'N/A'}
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                  <User className="w-3.5 h-3.5" /> {investor.investorId || 'NO_ID'}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <Badge variant={investor.status === 'active' ? 'success' : 'danger'} className="text-[10px] font-black uppercase">
                {investor.status}
              </Badge>
              <Badge variant={investor.verificationStatus === 'APPROVED' ? 'success' : 'warning'} className="text-[10px] font-black uppercase">
                {(investor.verificationStatus || 'PENDING').replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-[10px] font-medium text-slate-400">Created: {formatDate(investor.createdAt)}</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
          {[
            { id: 'OVERVIEW', label: 'Financial Overview', icon: PieChart },
            { id: 'LEDGER', label: 'Transaction Ledger', icon: History },
            { id: 'ASSETS', label: 'Asset Breakdown', icon: Cow },
            { id: 'TIMELINE', label: 'Audit Timeline', icon: Activity },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all",
                activeTab === tab.id 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="min-h-[400px]">
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Financial Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-6 bg-slate-900 text-white border-0 shadow-xl shadow-slate-900/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Spent (Paid)</p>
                  <p className="text-3xl font-black">{formatCurrency(financials.stats.totalSpent)}</p>
                  <div className="mt-4 flex items-center gap-2 text-emerald-400 text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3" /> All confirmed transactions
                  </div>
                </Card>

                <Card className="p-6 bg-emerald-50 border-emerald-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Total Paid</p>
                  <p className="text-3xl font-black text-emerald-900">{formatCurrency(financials.stats.totalPaid)}</p>
                  <div className="mt-4 flex items-center gap-2 text-emerald-600 text-[10px] font-bold">
                    <Wallet className="w-3 h-3" /> Verified payment receipts
                  </div>
                </Card>

                <Card className="p-6 bg-red-50 border-red-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-1">Outstanding</p>
                  <p className="text-3xl font-black text-red-900">{formatCurrency(financials.stats.outstanding)}</p>
                  <div className="mt-4 flex items-center gap-2 text-red-600 text-[10px] font-bold">
                    <AlertCircle className="w-3 h-3" /> Pending/Overdue invoices
                  </div>
                </Card>
              </div>

              {/* Categorized Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: 'Livestock', value: financials.stats.totalLivestockPurchases, icon: Cow, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Management', value: financials.stats.totalManagementFees, icon: Briefcase, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { label: 'Feed/Fattening', value: financials.stats.totalFeedExpenses, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Veterinary', value: financials.stats.totalVetExpenses, icon: Stethoscope, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Logistics', value: financials.stats.totalLogisticsExpenses, icon: Truck, color: 'text-purple-600', bg: 'bg-purple-50' },
                  { label: 'Other', value: financials.stats.totalOtherExpenses, icon: DollarSign, color: 'text-slate-600', bg: 'bg-slate-50' },
                ].map((cat) => (
                  <Card key={cat.label} className="p-4 border-slate-100 hover:border-slate-200 transition-colors">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", cat.bg, cat.color)}>
                      <cat.icon className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">{cat.label}</p>
                    <p className="text-sm font-black text-slate-900">{formatCurrency(cat.value)}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'LEDGER' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Date</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Type</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Description</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {financials.ledger.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-slate-700">{formatDate(tx.date)}</p>
                    <p className="text-[10px] text-slate-400 font-medium">ID: {(tx.id || '').slice(0, 8)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={tx.type === 'INVOICE' ? 'outline' : 'secondary'} className="text-[9px] font-black uppercase">
                      {tx.type}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-slate-900">{tx.description}</p>
                    <p className="text-[10px] text-slate-500">{tx.category}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className={cn(
                      "text-sm font-black",
                      tx.type === 'PAYMENT' ? "text-emerald-600" : "text-slate-900"
                    )}>
                      {tx.type === 'PAYMENT' ? '-' : ''}{formatCurrency(tx.amount)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge 
                      variant={tx.status === 'PAID' || tx.status === 'APPROVED' ? 'success' : tx.status === 'OVERDUE' ? 'danger' : 'warning'}
                      className="text-[9px] font-black uppercase"
                    >
                      {tx.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
            </div>
          )}

          {activeTab === 'ASSETS' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {financials.assetBreakdown.map((asset) => (
                  <Card key={asset.id} className="overflow-hidden border-slate-200">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-900">
                          <Cow className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 tracking-tight">{asset.breed} {asset.type || 'Livestock'}</p>
                          <p className="text-[10px] font-medium text-slate-500">TAG: {asset.tagNumber}</p>
                        </div>
                      </div>
                      <Badge variant={asset.status === LivestockStatus.ACTIVE ? 'success' : 'secondary'} className="text-[10px] font-black uppercase">
                        {asset.status}
                      </Badge>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-y-3">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-slate-400">Purchase Cost</p>
                          <p className="text-xs font-bold text-slate-900">{formatCurrency(asset.expenses.purchase)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-slate-400">Management</p>
                          <p className="text-xs font-bold text-slate-900">{formatCurrency(asset.expenses.management)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-slate-400">Feed & Fattening</p>
                          <p className="text-xs font-bold text-slate-900">{formatCurrency(asset.expenses.feed)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-slate-400">Vet & Medical</p>
                          <p className="text-xs font-bold text-slate-900">{formatCurrency(asset.expenses.vet)}</p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-400">Total Invested</p>
                          <p className="text-lg font-black text-slate-900">{formatCurrency(asset.totalInvested)}</p>
                        </div>
                        {asset.profitLoss !== null && (
                          <div className="text-right">
                            <p className="text-[10px] font-black uppercase text-slate-400">Net Realized</p>
                            <p className={cn(
                              "text-lg font-black",
                              asset.profitLoss >= 0 ? "text-emerald-600" : "text-red-600"
                            )}>
                              {asset.profitLoss >= 0 ? '+' : ''}{formatCurrency(asset.profitLoss)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
                {financials.assetBreakdown.length === 0 && (
                  <div className="col-span-full py-12 text-center">
                    <p className="text-sm font-medium text-slate-500">No livestock assets found for this investor.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'TIMELINE' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                {financials.logs.map((log) => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[29px] top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-300 z-10" />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase">{formatDate(log.timestamp)}</span>
                        <Badge variant="outline" className="text-[8px] font-bold h-4">
                          {log.targetType}
                        </Badge>
                      </div>
                      <p className="text-xs font-black text-slate-900">{log.action}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{log.details}</p>
                      {log.adminName && (
                        <p className="text-[9px] font-bold text-indigo-600 mt-1 uppercase tracking-tight">Admin: {log.adminName}</p>
                      )}
                    </div>
                  </div>
                ))}
                {financials.logs.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-sm font-medium text-slate-500">No activity logs found for this account.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
