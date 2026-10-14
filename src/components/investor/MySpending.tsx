import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { 
  Invoice, 
  Livestock, 
  SpendingTransaction, 
  ChargeCategory, 
  LiquidationRequest, 
  LiquidationStatus, 
  LivestockStatus 
} from '../../types';
import { Card, Badge, Button, Modal } from '../UI';
import { CowIcon as Beef } from '../CowIcon';
import { 
  Wallet, 
  Tag, 
  Calendar, 
  ArrowUpRight, 
  FileText, 
  CircleCheck, 
  TrendingUp, 
  TrendingDown,
  ChevronRight,
  ChevronLeft,
  Info,
  RefreshCw,
  Clock,
  TriangleAlert,
  Eye,
  Check,
  X,
  DollarSign,
  ShieldCheck,
  Building2,
  ExternalLink,
  Layers,
  Activity,
  ArrowDownLeft,
  ListFilter
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '../../lib/utils';

interface MySpendingProps {
  onViewTab?: (tab: string, invoiceId?: string) => void;
}

export const MySpending: React.FC<MySpendingProps> = ({ onViewTab }) => {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [myLivestock, setMyLivestock] = useState<Livestock[]>([]);
  const [ledgerTransactions, setLedgerTransactions] = useState<SpendingTransaction[]>([]);
  const [liquidationRequests, setLiquidationRequests] = useState<LiquidationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<(SpendingTransaction & { isRecovery?: boolean; liquidationReqId?: string }) | null>(null);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [historyTab, setHistoryTab] = useState<'spending' | 'liquidation'>('spending');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showMethodologyInfo, setShowMethodologyInfo] = useState<boolean>(false);

  // Liquidation Request Modal state
  const [isLiquidateModalOpen, setIsLiquidateModalOpen] = useState(false);
  const [selectedAnimalToLiquidate, setSelectedAnimalToLiquidate] = useState<Livestock | null>(null);
  const [liquidateReason, setLiquidateReason] = useState('');
  const [isSubmittingLiquidation, setIsSubmittingLiquidation] = useState(false);
  const [liquidationError, setLiquidationError] = useState<string | null>(null);
  const [liquidationSuccess, setLiquidationSuccess] = useState<string | null>(null);
  const [isSubmissionSuccessful, setIsSubmissionSuccessful] = useState(false);

  // Liquidation Details & Confirmation Modal state
  const [selectedLiquidationReq, setSelectedLiquidationReq] = useState<LiquidationRequest | null>(null);
  const [isConfirmingReceipt, setIsConfirmingReceipt] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    // Listen to invoices for user
    const qInvoices = query(
      collection(db, 'invoices'), 
      where('investorId', '==', profile.uid)
    );

    const unsubInvoices = onSnapshot(qInvoices, (snapshot) => {
      const invs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Invoice);
      setInvoices(invs);
    }, (error) => {
      console.error("Error fetching invoices:", error);
    });

    // Listen to livestock owned by user
    const qLivestock = query(
      collection(db, 'livestock'), 
      where('ownerId', '==', profile.uid)
    );

    const unsubLivestock = onSnapshot(qLivestock, (snapshot) => {
      setMyLivestock(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Livestock));
    }, (error) => {
      console.error("Error fetching livestock:", error);
    });

    // Listen to spendingLedger
    const qLedger = query(
      collection(db, 'spendingLedger'),
      where('userId', '==', profile.uid)
    );

    const unsubLedger = onSnapshot(qLedger, (snapshot) => {
      const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as SpendingTransaction);
      setLedgerTransactions(txs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching spending ledger:", error);
      setLoading(false);
    });

    // Listen to liquidation requests
    const qLiquidations = query(
      collection(db, 'liquidationRequests'),
      where('userId', '==', profile.uid)
    );

    const unsubLiquidations = onSnapshot(qLiquidations, (snapshot) => {
      const reqs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as LiquidationRequest);
      // Sort newest requested first
      reqs.sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
      setLiquidationRequests(reqs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching liquidation requests:", error);
      setLoading(false);
    });

    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    return () => {
      clearTimeout(timer);
      unsubInvoices();
      unsubLivestock();
      unsubLedger();
      unsubLiquidations();
    };
  }, [profile]);

  // Derived financial transactions
  const { 
    allTransactions, 
    totalCapitalInvested, 
    totalFeesPaid, 
    feeBreakdown,
    totalLiquidationRecovery, 
    netCapitalExposure, 
    realizedGainLoss,
    completedLiquidationsList,
    eligibleLivestock
  } = useMemo(() => {
    const paidInvoices = invoices.filter(inv => inv.status === 'PAID');
    const txList: (SpendingTransaction & { isRecovery?: boolean; liquidationReqId?: string })[] = [];
    const ledgerKeySet = new Set(ledgerTransactions.map(t => `${t.invoiceId}-${t.description}`));

    // Add direct ledger transactions
    ledgerTransactions.forEach(tx => {
      // Exclude recovery placeholder ledger entries here since we calculate confirmed recoveries deterministically from completed liquidation requests
      if (!tx.isRecovery && !(tx.amount < 0)) {
        txList.push(tx);
      }
    });

    // Process paid invoices
    paidInvoices.forEach(inv => {
      if (inv.items && Array.isArray(inv.items) && inv.items.length > 0) {
        inv.items.forEach((item, idx) => {
          const key = `${inv.id}-${item.description || item.item}`;
          if (!ledgerKeySet.has(key)) {
            const itemAmt = item.amount || (item.quantity * (item.unitPrice || item.price || 0)) || 0;
            if (itemAmt > 0) {
              txList.push({
                id: `${inv.id}-${idx}`,
                userId: inv.investorId,
                invoiceId: inv.id,
                invoiceNumber: inv.invoiceNumber,
                category: (item.category as ChargeCategory) || 'Livestock',
                description: item.description || item.item || 'Livestock Investment & Management',
                quantity: item.quantity || 1,
                unitPrice: item.unitPrice || item.price || itemAmt,
                amount: itemAmt,
                currency: 'NGN',
                status: 'CONFIRMED',
                date: inv.createdAt || Date.now(),
                livestockId: item.livestockId,
                livestockTag: item.livestockTag
              });
            }
          }
        });
      } else if (inv.totalAmount && !ledgerKeySet.has(`${inv.id}-total`)) {
        txList.push({
          id: `${inv.id}-total`,
          userId: inv.investorId,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          category: 'Livestock',
          description: inv.notes || inv.livestockDetails || 'Livestock Package Investment',
          quantity: 1,
          unitPrice: inv.totalAmount,
          amount: inv.totalAmount,
          currency: 'NGN',
          status: 'CONFIRMED',
          date: inv.createdAt || Date.now()
        });
      }
    });

    // Cross-check livestock in portfolio not already accounted in invoice items
    const coveredLivestockKeys = new Set<string>();
    const coveredInvoiceIds = new Set<string>();
    const coveredRequestIds = new Set<string>();

    txList.forEach(tx => {
      if (tx.livestockId) coveredLivestockKeys.add(tx.livestockId);
      if (tx.livestockTag) coveredLivestockKeys.add(tx.livestockTag);
      if (tx.invoiceId) coveredInvoiceIds.add(tx.invoiceId);
    });

    paidInvoices.forEach(inv => {
      if (inv.id) coveredInvoiceIds.add(inv.id);
      if (inv.requestId) coveredRequestIds.add(inv.requestId);
    });

    myLivestock.forEach(animal => {
      const isCoveredById = coveredLivestockKeys.has(animal.id);
      const isCoveredByTag = animal.tagNumber ? coveredLivestockKeys.has(animal.tagNumber) : false;
      const isCoveredByInvoiceId = animal.invoiceId ? coveredInvoiceIds.has(animal.invoiceId) : false;
      const isCoveredByRequestId = animal.sourcingRequestId ? coveredRequestIds.has(animal.sourcingRequestId) : false;
      const isCoveredByNote = paidInvoices.some(inv => 
        (inv.notes || '').toLowerCase().includes((animal.tagNumber || '').toLowerCase()) ||
        (inv.livestockDetails || '').toLowerCase().includes((animal.tagNumber || '').toLowerCase())
      );

      if (!isCoveredById && !isCoveredByTag && !isCoveredByInvoiceId && !isCoveredByRequestId && !isCoveredByNote) {
        const price = animal.purchasePrice || 0;
        if (price > 0) {
          txList.push({
            id: `animal-acq-${animal.id}`,
            userId: animal.ownerId || (profile?.uid || ''),
            invoiceId: animal.invoiceId || 'DIRECT-ALLOCATION',
            invoiceNumber: animal.invoiceId ? 'INVOICE-LINKED' : 'PORTFOLIO-ALLOCATION',
            category: 'Livestock',
            description: `Livestock Purchase: ${animal.breed || 'Cattle'} (${animal.type || 'Livestock'}) - Tag #${animal.tagNumber || animal.id.slice(0, 6)}`,
            quantity: 1,
            unitPrice: price,
            amount: price,
            currency: 'NGN',
            status: 'CONFIRMED',
            date: animal.purchaseDate || Date.now(),
            livestockId: animal.id,
            livestockTag: animal.tagNumber
          });
        }
      }
    });

    // 1. Calculate Total Capital Invested (Livestock purchases & package costs)
    let capitalInvested = 0;
    let feesPaid = 0;

    const fees: Record<string, number> = {
      'Farm Management': 0,
      'Feed & Supplement': 0,
      'Medication & Healthcare': 0,
      'Transportation & Logistics': 0,
      'Other Charges': 0
    };

    txList.forEach(tx => {
      const amt = tx.amount || 0;
      const cat = String(tx.category || '');
      if (cat === 'Livestock' || cat === 'Livestock Purchase') {
        capitalInvested += amt;
      } else {
        feesPaid += amt;
        if (cat === 'Farm Management') {
          fees['Farm Management'] += amt;
        } else if (cat.includes('Feed') || cat.includes('Supplement') || cat.includes('Nutrition') || cat === 'Fattening') {
          fees['Feed & Supplement'] += amt;
        } else if (cat.includes('Health') || cat.includes('Medication') || cat.includes('Veterinary') || cat === 'Healthcare') {
          fees['Medication & Healthcare'] += amt;
        } else if (cat.includes('Transport') || cat.includes('Logistics')) {
          fees['Transportation & Logistics'] += amt;
        } else {
          fees['Other Charges'] += amt;
        }
      }
    });

    // 2. Liquidation Recovery & Realized Gain/Loss from COMPLETED liquidations
    const completedReqs = liquidationRequests.filter(req => req.status === 'COMPLETED');
    let totalRecovery = 0;
    let netGainLoss = 0;

    completedReqs.forEach(req => {
      const recAmt = req.creditedAmount || req.salePrice || 0;
      const originalCost = req.originalPurchaseAmount || 0;
      totalRecovery += recAmt;
      netGainLoss += (recAmt - originalCost);

      // Add to transactions as a distinct recovery line item
      txList.push({
        id: `liq-recovery-${req.id}`,
        userId: req.userId,
        invoiceId: `LIQ-${req.id.slice(0, 8)}`,
        invoiceNumber: req.paymentRef || 'LIQUIDATION-RECOVERY',
        category: 'Livestock' as ChargeCategory,
        description: `Liquidation Recovery: ${req.livestockBreed} (#${req.livestockTag})`,
        quantity: 1,
        unitPrice: recAmt,
        amount: -recAmt, // Visual negative for net subtraction
        currency: 'NGN',
        status: 'CONFIRMED',
        date: req.userConfirmedAt || req.creditDate || req.updatedAt || Date.now(),
        livestockId: req.livestockId,
        livestockTag: req.livestockTag,
        isRecovery: true,
        liquidationReqId: req.id
      });
    });

    // Net Capital Exposure = Total Capital Invested + Total Fees Paid - Liquidation Recovery
    const exposure = Math.max(0, (capitalInvested + feesPaid) - totalRecovery);

    // Eligible livestock for new liquidation request
    const eligible = myLivestock.filter(animal => {
      if (animal.status === LivestockStatus.DECEASED || animal.status === LivestockStatus.ARCHIVED || animal.status === LivestockStatus.SOLD) {
        return false;
      }
      if (animal.isLiquidated) return false;
      const existingReq = liquidationRequests.find(r => r.livestockId === animal.id);
      if (existingReq && ['PENDING', 'APPROVED', 'SOLD', 'AWAITING_BANK_CREDIT', 'AWAITING_USER_CONFIRMATION', 'COMPLETED'].includes(existingReq.status)) {
        return false;
      }
      return true;
    });

    return {
      allTransactions: txList,
      totalCapitalInvested: capitalInvested,
      totalFeesPaid: feesPaid,
      feeBreakdown: fees,
      totalLiquidationRecovery: totalRecovery,
      netCapitalExposure: exposure,
      realizedGainLoss: netGainLoss,
      completedLiquidationsList: completedReqs,
      eligibleLivestock: eligible
    };
  }, [invoices, ledgerTransactions, myLivestock, liquidationRequests, profile]);

  // Group transactions by month for Month-by-Month breakdown
  const { groupedByMonth, monthKeys } = useMemo(() => {
    const groups: { 
      [key: string]: { 
        txs: typeof allTransactions; 
        totalSpent: number; 
        totalRecovered: number; 
        netMovement: number 
      } 
    } = {};

    // Sort newest first
    const sorted = [...allTransactions].sort((a, b) => (b.date || 0) - (a.date || 0));

    sorted.forEach(tx => {
      const dateObj = new Date(tx.date || Date.now());
      const monthKey = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[monthKey]) {
        groups[monthKey] = { txs: [], totalSpent: 0, totalRecovered: 0, netMovement: 0 };
      }
      groups[monthKey].txs.push(tx);
      if (tx.isRecovery || tx.amount < 0) {
        const rec = Math.abs(tx.amount || 0);
        groups[monthKey].totalRecovered += rec;
        groups[monthKey].netMovement -= rec;
      } else {
        const spent = tx.amount || 0;
        groups[monthKey].totalSpent += spent;
        groups[monthKey].netMovement += spent;
      }
    });

    const keys = Object.keys(groups);
    return { groupedByMonth: groups, monthKeys: keys };
  }, [allTransactions]);

  // Filter current month transactions by category if requested
  const currentMonthData = useMemo(() => {
    if (monthKeys.length === 0) return null;
    const activeKey = monthKeys[Math.min(currentMonthIndex, monthKeys.length - 1)];
    if (!activeKey || !groupedByMonth[activeKey]) return null;

    const group = groupedByMonth[activeKey];
    const filteredTxs = group.txs.filter(tx => {
      if (categoryFilter === 'ALL') return true;
      if (categoryFilter === 'RECOVERY') return tx.isRecovery || tx.amount < 0;
      if (categoryFilter === 'LIVESTOCK') return tx.category === 'Livestock' && !tx.isRecovery && tx.amount > 0;
      if (categoryFilter === 'FEES') return tx.category !== 'Livestock';
      return true;
    });

    return {
      monthName: activeKey,
      ...group,
      filteredTxs
    };
  }, [groupedByMonth, monthKeys, currentMonthIndex, categoryFilter]);

  // Handle Submitting Liquidation Request
  const handleSubmitLiquidation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimalToLiquidate || !profile) return;
    if (!liquidateReason.trim()) {
      setLiquidationError("Please provide a reason for liquidating this livestock.");
      return;
    }

    setIsSubmittingLiquidation(true);
    setLiquidationError(null);

    try {
      const now = Date.now();
      const reqData: Omit<LiquidationRequest, 'id'> = {
        userId: profile.uid,
        userName: profile.displayName || profile.name || 'Investor',
        userEmail: profile.email || '',
        livestockId: selectedAnimalToLiquidate.id,
        livestockTag: selectedAnimalToLiquidate.tagNumber,
        livestockBreed: selectedAnimalToLiquidate.breed,
        originalPurchaseAmount: selectedAnimalToLiquidate.purchasePrice || 0,
        purchaseDate: selectedAnimalToLiquidate.purchaseDate || now,
        reason: liquidateReason.trim(),
        requestedAt: now,
        status: 'PENDING',
        updatedAt: now
      };

      const docRef = await addDoc(collection(db, 'liquidationRequests'), reqData);

      // Update animal liquidation status
      const animalRef = doc(db, 'livestock', selectedAnimalToLiquidate.id);
      await updateDoc(animalRef, {
        liquidationStatus: 'PENDING',
        lastUpdated: now
      });

      // User notification
      await addDoc(collection(db, 'notifications'), {
        userId: profile.uid,
        title: "Liquidation Request Submitted",
        message: `Your liquidation request for ${selectedAnimalToLiquidate.breed} (#${selectedAnimalToLiquidate.tagNumber}) has been submitted for farm administrator review.`,
        category: 'Investment Updates',
        priority: 'INFO',
        read: false,
        createdAt: now
      });

      // Activity log
      await addDoc(collection(db, 'activityLogs'), {
        userId: profile.uid,
        userName: profile.displayName || profile.name || 'Investor',
        adminName: 'System',
        action: "Liquidation Requested",
        targetId: docRef.id,
        targetType: "LiquidationRequest",
        details: `Requested liquidation for livestock #${selectedAnimalToLiquidate.tagNumber}. Reason: ${liquidateReason.trim()}`,
        timestamp: now
      });

      setIsSubmissionSuccessful(true);
      setLiquidationSuccess("Your liquidation request has been submitted successfully!");
      setTimeout(() => {
        setIsLiquidateModalOpen(false);
        setSelectedAnimalToLiquidate(null);
        setLiquidateReason('');
        setLiquidationSuccess(null);
      }, 1500);
    } catch (err: any) {
      console.error("Submit liquidation error:", err);
      if (!isSubmissionSuccessful) {
        setLiquidationError(err.message || "Failed to submit liquidation request.");
      }
    } finally {
      setIsSubmittingLiquidation(false);
    }
  };

  // Handle User Confirming Receipt of Funds
  const handleConfirmReceipt = async () => {
    if (!selectedLiquidationReq || !profile) return;
    if (selectedLiquidationReq.status !== 'AWAITING_USER_CONFIRMATION') {
      setConfirmError("This request is not currently awaiting investor confirmation.");
      return;
    }

    setIsConfirmingReceipt(true);
    setConfirmError(null);

    try {
      const now = Date.now();
      const reqRef = doc(db, 'liquidationRequests', selectedLiquidationReq.id);
      
      await updateDoc(reqRef, {
        status: 'COMPLETED',
        userConfirmedAt: now,
        updatedAt: now
      });

      if (selectedLiquidationReq.livestockId) {
        const animalRef = doc(db, 'livestock', selectedLiquidationReq.livestockId);
        await updateDoc(animalRef, {
          status: LivestockStatus.SOLD,
          isLiquidated: true,
          liquidationStatus: 'COMPLETED',
          lastUpdated: now
        });
      }

      const credited = selectedLiquidationReq.creditedAmount || selectedLiquidationReq.salePrice || 0;
      
      // Record recovery in spendingLedger
      await addDoc(collection(db, 'spendingLedger'), {
        userId: profile.uid,
        userName: profile.displayName || profile.name || 'Investor',
        invoiceId: `LIQ-${selectedLiquidationReq.id.slice(0, 8)}`,
        invoiceNumber: selectedLiquidationReq.paymentRef || 'LIQUIDATION-RECOVERY',
        category: 'Livestock',
        description: `Livestock Liquidation Recovery: ${selectedLiquidationReq.livestockBreed} (#${selectedLiquidationReq.livestockTag})`,
        quantity: 1,
        unitPrice: credited,
        amount: -credited,
        currency: 'NGN',
        status: 'CONFIRMED',
        date: now,
        createdAt: now,
        isRecovery: true,
        liquidationRequestId: selectedLiquidationReq.id,
        livestockId: selectedLiquidationReq.livestockId,
        livestockTag: selectedLiquidationReq.livestockTag
      });

      // Notification
      await addDoc(collection(db, 'notifications'), {
        userId: profile.uid,
        title: "Liquidation Payout Confirmed",
        message: `You confirmed receipt of ${formatCurrency(credited)} for livestock #${selectedLiquidationReq.livestockTag}. Your financial summary is now updated.`,
        category: 'Investment Updates',
        priority: 'SUCCESS',
        read: false,
        createdAt: now
      });

      // Activity log
      await addDoc(collection(db, 'activityLogs'), {
        userId: profile.uid,
        userName: profile.displayName || profile.name || 'Investor',
        adminName: 'Investor Confirmation',
        action: "Liquidation Payment Confirmed",
        targetId: selectedLiquidationReq.id,
        targetType: "LiquidationRequest",
        details: `Investor confirmed receipt of ${formatCurrency(credited)} for livestock #${selectedLiquidationReq.livestockTag}`,
        timestamp: now
      });

      setConfirmSuccess("Funds confirmed! Liquidation completed and financial totals recalculated.");
      setTimeout(() => {
        setSelectedLiquidationReq(null);
        setConfirmSuccess(null);
      }, 1500);
    } catch (err: any) {
      console.error("Confirm receipt error:", err);
      setConfirmError(err.message || "Failed to confirm payment receipt.");
    } finally {
      setIsConfirmingReceipt(false);
    }
  };

  const getStatusBadge = (status: LiquidationStatus) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning" className="gap-1 font-bold text-[11px]"><Clock className="w-3 h-3" /> Submitted</Badge>;
      case 'APPROVED':
        return <Badge variant="info" className="gap-1 font-bold text-[11px]"><CircleCheck className="w-3 h-3" /> Approved for Sale</Badge>;
      case 'REJECTED':
        return <Badge variant="danger" className="gap-1 font-bold text-[11px]"><X className="w-3 h-3" /> Rejected</Badge>;
      case 'SOLD':
        return <Badge variant="accent" className="gap-1 font-bold text-[11px]"><Beef className="w-3 h-3" /> Sold (Processing)</Badge>;
      case 'AWAITING_BANK_CREDIT':
        return <Badge variant="warning" className="gap-1 font-bold text-[11px]"><Clock className="w-3 h-3" /> Transfer Processing</Badge>;
      case 'AWAITING_USER_CONFIRMATION':
        return <Badge variant="warning" className="gap-1 font-bold text-[11px] bg-amber-500 text-white border-amber-600 animate-pulse"><TriangleAlert className="w-3 h-3 text-white" /> Action: Confirm Payment</Badge>;
      case 'COMPLETED':
        return <Badge variant="success" className="gap-1 font-bold text-[11px]"><CircleCheck className="w-3 h-3" /> Completed</Badge>;
      default:
        return <Badge variant="neutral" className="font-bold text-[11px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-7 animate-in fade-in duration-300">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-700 shrink-0" />
            My Spending & Financial Summary
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5 sm:mt-1">
            Dedicated financial control center for capital commitments, fees, liquidation proceeds, and net exposure.
          </p>
        </div>

        {/* Primary Action Button */}
        {eligibleLivestock.length > 0 && (
          <Button
            onClick={() => {
              setSelectedAnimalToLiquidate(eligibleLivestock[0]);
              setIsLiquidateModalOpen(true);
              setIsSubmissionSuccessful(false);
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl shadow-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-all w-full sm:w-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Request Livestock Liquidation
          </Button>
        )}
      </div>

      {/* 1. HIGH-LEVEL FINANCIAL KPI CARDS (2-COL MOBILE GRID, 5-COL DESKTOP) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3.5 lg:gap-4">
        {/* Card 1: Total Capital Invested (Row 1, Col 1 on mobile) */}
        <div className="p-3.5 sm:p-4 lg:p-5 bg-slate-900 text-white rounded-2xl sm:rounded-3xl shadow-2xs space-y-1.5 sm:space-y-2 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
              Total Capital
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 shrink-0">
              <Beef className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div>
            <h2 className="text-base sm:text-xl lg:text-2xl font-black text-white tracking-tight">
              {formatCurrency(totalCapitalInvested)}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5 truncate">
              Livestock & packages
            </p>
          </div>
        </div>

        {/* Card 2: Total Fees Paid (Row 1, Col 2 on mobile) */}
        <div className="p-3.5 sm:p-4 lg:p-5 bg-white text-slate-900 rounded-2xl sm:rounded-3xl shadow-2xs space-y-1.5 sm:space-y-2 border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 truncate">
              Total Fees Paid
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <h2 className="text-base sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
              {formatCurrency(totalFeesPaid)}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 truncate">
              Care, feed & logistics
            </p>
          </div>
        </div>

        {/* Card 3: Liquidation Recovery (Row 2, Col 1 on mobile) */}
        <div className="p-3.5 sm:p-4 lg:p-5 bg-emerald-50/70 text-emerald-950 rounded-2xl sm:rounded-3xl shadow-2xs space-y-1.5 sm:space-y-2 border border-emerald-200/90 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-emerald-800 truncate">
              Liquidation Recovery
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-emerald-100/80 flex items-center justify-center text-emerald-800 shrink-0">
              <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div>
            <h2 className="text-base sm:text-xl lg:text-2xl font-black text-emerald-800 tracking-tight">
              {formatCurrency(totalLiquidationRecovery)}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-emerald-700/90 font-medium mt-0.5 truncate">
              Verified proceeds
            </p>
          </div>
        </div>

        {/* Card 4: Net Capital Exposure (Row 2, Col 2 on mobile) */}
        <div className="p-3.5 sm:p-4 lg:p-5 bg-white text-slate-900 rounded-2xl sm:rounded-3xl shadow-2xs space-y-1.5 sm:space-y-2 border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500 truncate">
              Net Exposure
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div>
            <h2 className="text-base sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
              {formatCurrency(netCapitalExposure)}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 truncate">
              Invested + Fees − Recovery
            </p>
          </div>
        </div>

        {/* Card 5: Realized Gain/Loss (Row 3, Full Width on mobile, 1 Col on Desktop) */}
        <div className={cn(
          "col-span-2 lg:col-span-1 p-3.5 sm:p-4 lg:p-5 rounded-2xl sm:rounded-3xl shadow-2xs space-y-1.5 sm:space-y-2 border flex flex-col justify-between",
          realizedGainLoss > 0 
            ? "bg-emerald-50/80 border-emerald-200 text-emerald-950" 
            : realizedGainLoss < 0 
              ? "bg-rose-50/80 border-rose-200 text-rose-950" 
              : "bg-slate-50 border-slate-200 text-slate-800"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-slate-500">
              Realized Gain / Loss
            </span>
            <div className={cn(
              "w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0",
              realizedGainLoss > 0 ? "bg-emerald-200 text-emerald-800" : realizedGainLoss < 0 ? "bg-rose-200 text-rose-800" : "bg-slate-200 text-slate-600"
            )}>
              {realizedGainLoss >= 0 ? <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
            </div>
          </div>
          <div>
            <h2 className={cn(
              "text-base sm:text-xl lg:text-2xl font-black tracking-tight",
              realizedGainLoss > 0 ? "text-emerald-700" : realizedGainLoss < 0 ? "text-rose-700" : "text-slate-800"
            )}>
              {realizedGainLoss > 0 ? `+${formatCurrency(realizedGainLoss)}` : realizedGainLoss < 0 ? `-${formatCurrency(Math.abs(realizedGainLoss))}` : formatCurrency(0)}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5">
              {completedLiquidationsList.length} completed liquidation{completedLiquidationsList.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* FEE BREAKDOWN STRIP */}
      {totalFeesPaid > 0 && (
        <div className="p-3 sm:p-4 bg-white border border-slate-100 rounded-2xl shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-500">
              Itemized Fee Breakdown
            </span>
            <span className="text-[11px] sm:text-xs font-bold text-slate-600">
              Cumulative: {formatCurrency(totalFeesPaid)}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2 pt-0.5">
            {Object.entries(feeBreakdown).map(([feeName, feeAmt]) => (
              <div key={feeName} className="p-2 sm:p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[9.5px] sm:text-[10px] font-bold text-slate-400 block truncate">{feeName}</span>
                <span className="text-[11px] sm:text-xs font-black text-slate-900 block mt-0.5">{formatCurrency(Number(feeAmt) || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. UNIFIED FINANCIAL HISTORY CONTAINER */}
      <Card title="Financial History & Lifecycle" icon={Calendar}>
        {/* TAB SELECTOR */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 sm:pb-3 mb-4 sm:mb-5 gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setHistoryTab('spending')}
              className={cn(
                "px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer",
                historyTab === 'spending'
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              Spending & Recovery
            </button>
            <button
              type="button"
              onClick={() => setHistoryTab('liquidation')}
              className={cn(
                "px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer",
                historyTab === 'liquidation'
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Liquidation History {liquidationRequests.length > 0 && `(${liquidationRequests.length})`}
            </button>
          </div>

          {/* Quick Filters for Spending Tab */}
          {historyTab === 'spending' && monthKeys.length > 0 && (
            <div className="flex items-center gap-1 text-xs overflow-x-auto py-0.5">
              <span className="text-slate-400 font-bold text-[10px] uppercase mr-0.5 shrink-0 flex items-center gap-1">
                <ListFilter className="w-3 h-3" />
                Filter:
              </span>
              {(['ALL', 'LIVESTOCK', 'FEES', 'RECOVERY'] as const).map(flt => (
                <button
                  key={flt}
                  type="button"
                  onClick={() => setCategoryFilter(flt)}
                  className={cn(
                    "px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap",
                    categoryFilter === flt
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {flt === 'ALL' ? 'All' : flt === 'LIVESTOCK' ? 'Livestock' : flt === 'FEES' ? 'Fees' : 'Recoveries'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TAB 1: SPENDING & RECOVERY */}
        {historyTab === 'spending' && (
          !currentMonthData ? (
            <div className="py-10 sm:py-14 px-4 sm:px-6 text-center space-y-2.5 sm:space-y-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <Wallet className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">No financial activity yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Spending and recovery transactions will appear here once you begin making livestock investments, paying farm management fees, or receiving liquidation proceeds.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5 sm:space-y-4">
              {/* Month Navigation & Summary Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-slate-50 rounded-2xl border border-slate-100 gap-2.5 sm:gap-3">
                <div className="flex items-center justify-between sm:justify-start gap-2">
                  <div className="flex items-center gap-1.5">
                    <Button 
                      variant="outline" 
                      onClick={() => setCurrentMonthIndex(prev => Math.min(prev + 1, monthKeys.length - 1))}
                      disabled={currentMonthIndex === monthKeys.length - 1}
                      className="p-1 h-8 w-8 !min-w-[2rem] rounded-xl cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <h4 className="font-black text-xs sm:text-sm text-slate-900 tracking-tight">
                      {currentMonthData.monthName}
                    </h4>
                    <Button 
                      variant="outline" 
                      onClick={() => setCurrentMonthIndex(prev => Math.max(prev - 1, 0))}
                      disabled={currentMonthIndex === 0}
                      className="p-1 h-8 w-8 !min-w-[2rem] rounded-xl cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 sm:gap-4 text-[11px] sm:text-xs font-bold pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                  <div className="text-slate-600">
                    <span className="block text-[9.5px] font-bold text-slate-400 uppercase sm:inline sm:mr-1">Spent:</span>
                    <span className="font-black text-slate-900">{formatCurrency(currentMonthData.totalSpent)}</span>
                  </div>
                  <div className="text-emerald-700">
                    <span className="block text-[9.5px] font-bold text-emerald-600/70 uppercase sm:inline sm:mr-1">Recovered:</span>
                    <span className="font-black text-emerald-700">{formatCurrency(currentMonthData.totalRecovered)}</span>
                  </div>
                  <div className="sm:pl-3 sm:border-l border-slate-200 text-slate-800">
                    <span className="block text-[9.5px] font-bold text-slate-400 uppercase sm:inline sm:mr-1">Net:</span>
                    <span className={cn("font-black", currentMonthData.netMovement > 0 ? "text-slate-900" : "text-emerald-700")}>
                      {currentMonthData.netMovement > 0 ? `+${formatCurrency(currentMonthData.netMovement)}` : `-${formatCurrency(Math.abs(currentMonthData.netMovement))}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              <div className="space-y-2">
                {currentMonthData.filteredTxs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500 font-medium">
                    No transactions match the selected filter for this month.
                  </div>
                ) : (
                  currentMonthData.filteredTxs.map(tx => {
                    const isRecovery = tx.isRecovery || tx.amount < 0;
                    const timeStr = new Date(tx.date || Date.now()).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                    
                    return (
                      <div 
                        key={tx.id}
                        onClick={() => setSelectedTx(tx)}
                        className={cn(
                          "p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 group",
                          isRecovery
                            ? "bg-emerald-50/70 border-emerald-200/80 hover:bg-emerald-50 hover:border-emerald-300"
                            : "bg-white border-slate-200/70 hover:border-emerald-500/50 hover:bg-slate-50/50"
                        )}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className={cn(
                              "px-2 py-0.5 font-black text-[9.5px] sm:text-[10px] rounded-md sm:rounded-lg uppercase tracking-wider",
                              isRecovery
                                ? "bg-emerald-700 text-white"
                                : tx.category === 'Livestock'
                                  ? "bg-slate-900 text-white"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                            )}>
                              {isRecovery ? 'Recovery' : tx.category === 'Livestock' ? 'Livestock' : tx.category}
                            </span>
                            {tx.livestockTag && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-800 font-bold text-[9.5px] sm:text-[10px] rounded-md border border-slate-200">
                                #{tx.livestockTag}
                              </span>
                            )}
                            <span className="text-[11px] sm:text-xs text-slate-400 font-medium">
                              {formatDate(tx.date)} at {timeStr}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-emerald-700 transition-colors">
                            {tx.description}
                          </p>
                          <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate">
                            Ref: {tx.invoiceNumber || tx.invoiceId}
                          </p>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <span className={cn(
                            "font-black text-sm sm:text-base block tracking-tight",
                            isRecovery ? "text-emerald-700" : "text-slate-900"
                          )}>
                            {isRecovery ? `-${formatCurrency(Math.abs(tx.amount))}` : `+${formatCurrency(tx.amount)}`}
                          </span>
                          <span className="text-[9.5px] sm:text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1 mt-0.5">
                            <CircleCheck className="w-3 h-3 text-emerald-600" /> Confirmed
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )
        )}

        {/* TAB 2: LIQUIDATION HISTORY */}
        {historyTab === 'liquidation' && (
          liquidationRequests.length === 0 ? (
            <div className="py-10 sm:py-14 px-4 sm:px-6 text-center space-y-2.5 sm:space-y-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <RefreshCw className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">No liquidation requests</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                You have not submitted any livestock liquidation requests yet. When you wish to liquidate an asset from your portfolio, you can submit a request below.
              </p>
              {eligibleLivestock.length > 0 && (
                <div className="pt-2">
                  <Button
                    onClick={() => {
                      setSelectedAnimalToLiquidate(eligibleLivestock[0]);
                      setIsLiquidateModalOpen(true);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 sm:py-2.5 rounded-xl cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Request Livestock Liquidation
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {liquidationRequests.map(req => {
                const isAwaitingAction = req.status === 'AWAITING_USER_CONFIRMATION';
                return (
                  <div 
                    key={req.id}
                    onClick={() => setSelectedLiquidationReq(req)}
                    className={cn(
                      "p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 group",
                      isAwaitingAction
                        ? "bg-amber-50/90 border-amber-300 hover:border-amber-400 shadow-xs"
                        : "bg-white border-slate-200/80 hover:border-emerald-500/50 hover:bg-slate-50/50"
                    )}
                  >
                    <div className="space-y-1 sm:space-y-1.5">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-black text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {req.livestockBreed} (#{req.livestockTag})
                        </span>
                        {getStatusBadge(req.status)}
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-slate-500 flex-wrap">
                        <span>Requested: <strong>{formatDate(req.requestedAt)}</strong></span>
                        <span>•</span>
                        <span>Cost: <strong className="text-slate-800">{formatCurrency(req.originalPurchaseAmount || 0)}</strong></span>
                        {req.paymentRef && (
                          <>
                            <span>•</span>
                            <span className="font-mono">Ref: {req.paymentRef}</span>
                          </>
                        )}
                      </div>

                      <p className="text-[11px] sm:text-xs text-slate-600 italic line-clamp-1">
                        Reason: "{req.reason}"
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {req.creditedAmount ? (
                        <div className="text-left sm:text-right">
                          <span className="text-[9.5px] sm:text-[10px] font-black uppercase text-slate-400 block">Approved Recovery</span>
                          <span className="font-black text-emerald-700 text-sm sm:text-base">{formatCurrency(req.creditedAmount)}</span>
                        </div>
                      ) : req.salePrice ? (
                        <div className="text-left sm:text-right">
                          <span className="text-[9.5px] sm:text-[10px] font-black uppercase text-slate-400 block">Sale Price</span>
                          <span className="font-black text-purple-700 text-sm sm:text-base">{formatCurrency(req.salePrice)}</span>
                        </div>
                      ) : null}

                      <Button 
                        variant={isAwaitingAction ? "default" : "outline"} 
                        className={cn(
                          "text-xs font-bold gap-1 py-1.5 px-3 sm:py-2 sm:px-3.5 rounded-xl cursor-pointer",
                          isAwaitingAction ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
                        )}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {isAwaitingAction ? "Confirm Payout" : "View"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </Card>

      {/* 3. PEDAGOGICAL FINANCIAL METHODOLOGY & INTEGRITY EXPLAINER (COMPACT EXPANDABLE CARD PLACED BELOW) */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight truncate">
                How we calculate your financial summary
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium hidden sm:block">
                Transparent accounting ensuring strict separation of capital assets, operating fees, and duplicate prevention.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowMethodologyInfo(!showMethodologyInfo)}
            className="text-[11px] sm:text-xs font-bold text-slate-700 hover:text-slate-950 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-slate-200/70 hover:bg-slate-300/70 transition-all cursor-pointer shrink-0"
          >
            {showMethodologyInfo ? 'Hide Guide' : 'View Calculation Guide →'}
          </button>
        </div>

        {showMethodologyInfo && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-200/70 animate-in fade-in duration-300">
            {/* 1. Original Livestock Purchase */}
            <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-slate-900 font-black text-[11px] uppercase tracking-wider">
                <Beef className="w-3.5 h-3.5 text-slate-700" />
                Original Livestock Purchase
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Direct capital investments in physical livestock or animal packages. Classified strictly as <strong>capital asset commitments</strong> rather than operating overhead.
              </p>
            </div>

            {/* 2. Operating Expenses & Fees */}
            <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-slate-900 font-black text-[11px] uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5 text-slate-700" />
                Operating Expenses & Fees
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Ongoing farm management, feed formulations, healthcare, and transport. Separated from purchase costs to provide clear visibility into ongoing husbandry.
              </p>
            </div>

            {/* 3. Deduplication & Ledger Integrity */}
            <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-slate-900 font-black text-[11px] uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                Non-Duplicated Ledger Integrity
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Total platform spending aggregates <strong>distinct, non-duplicated ledger entries</strong>. Hashed item keys and asset allocation IDs guarantee zero double-counting.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 4. MODAL: REQUEST LIVESTOCK LIQUIDATION */}
      {isLiquidateModalOpen && (
        <Modal
          isOpen={isLiquidateModalOpen}
          onClose={() => {
            setIsLiquidateModalOpen(false);
            setLiquidationError(null);
            setLiquidationSuccess(null);
          }}
          title="Request Livestock Liquidation"
          subtitle="Submit an active livestock asset from your portfolio for farm sale & capital recovery."
        >
          <form onSubmit={handleSubmitLiquidation} className="space-y-4 text-xs">
            {liquidationError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                <TriangleAlert className="w-4 h-4 shrink-0" />
                <span>{liquidationError}</span>
              </div>
            )}

            {liquidationSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
                <CircleCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{liquidationSuccess}</span>
              </div>
            )}

            {/* Livestock Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Select Livestock to Liquidate <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedAnimalToLiquidate?.id || ''}
                onChange={(e) => {
                  const found = eligibleLivestock.find(a => a.id === e.target.value);
                  setSelectedAnimalToLiquidate(found || null);
                }}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {eligibleLivestock.map(animal => (
                  <option key={animal.id} value={animal.id}>
                    {animal.breed} (#{animal.tagNumber}) — Cost: {formatCurrency(animal.purchasePrice || 0)}
                  </option>
                ))}
              </select>
            </div>

            {selectedAnimalToLiquidate && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-bold">Animal Tag & Type</span>
                  <span className="font-black text-slate-900">#{selectedAnimalToLiquidate.tagNumber} ({selectedAnimalToLiquidate.type || 'Livestock'})</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-bold">Breed</span>
                  <span className="font-bold text-slate-800">{selectedAnimalToLiquidate.breed}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-bold">Original Purchase Cost</span>
                  <span className="font-black text-slate-900">{formatCurrency(selectedAnimalToLiquidate.purchasePrice || 0)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-bold">Purchase Date</span>
                  <span className="font-medium text-slate-700">{formatDate(selectedAnimalToLiquidate.purchaseDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Current Health & Weight</span>
                  <span className="font-medium text-slate-700">{selectedAnimalToLiquidate.healthStatus || 'Good'} • {selectedAnimalToLiquidate.weight || 'N/A'}</span>
                </div>
              </div>
            )}

            {/* Advisory Notice */}
            <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span className="leading-relaxed">
                <strong>Liquidation Advisory:</strong> Submitting a liquidation request initiates the farm sale review. Payout amounts depend on prevailing market valuation, animal weight, and final verified buyer bids. Submitting does not guarantee a predetermined recovery amount.
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Reason for Liquidation <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="State your reason (e.g. Portfolio rebalancing, planned capital withdrawal, emergency liquidation...)"
                value={liquidateReason}
                onChange={(e) => setLiquidateReason(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsLiquidateModalOpen(false)}
                className="text-xs font-bold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingLiquidation || !selectedAnimalToLiquidate}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                {isSubmittingLiquidation ? "Submitting..." : "Submit Liquidation Request"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 5. MODAL: LIQUIDATION DETAILS & INVESTOR PAYMENT CONFIRMATION */}
      {selectedLiquidationReq && (
        <Modal
          isOpen={!!selectedLiquidationReq}
          onClose={() => {
            setSelectedLiquidationReq(null);
            setConfirmError(null);
            setConfirmSuccess(null);
          }}
          title="Liquidation Request Details"
          subtitle={`Livestock: ${selectedLiquidationReq.livestockBreed} (#${selectedLiquidationReq.livestockTag})`}
        >
          <div className="space-y-4 text-xs">
            {confirmError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-2">
                <TriangleAlert className="w-4 h-4 shrink-0" />
                <span>{confirmError}</span>
              </div>
            )}

            {confirmSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2">
                <CircleCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{confirmSuccess}</span>
              </div>
            )}

            {/* Status & Lifecycle Timeline */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Current Status</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedLiquidationReq.status.replace(/_/g, ' ')}</span>
                </div>
                {getStatusBadge(selectedLiquidationReq.status)}
              </div>

              {/* Visual lifecycle tracker */}
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span className={cn(selectedLiquidationReq.requestedAt ? "text-emerald-700" : "")}>1. Submitted</span>
                <span>→</span>
                <span className={cn(selectedLiquidationReq.status !== 'PENDING' ? "text-emerald-700" : "")}>2. Approved</span>
                <span>→</span>
                <span className={cn(selectedLiquidationReq.creditedAmount || selectedLiquidationReq.status === 'AWAITING_USER_CONFIRMATION' || selectedLiquidationReq.status === 'COMPLETED' ? "text-emerald-700" : "")}>3. Payment Sent</span>
                <span>→</span>
                <span className={cn(selectedLiquidationReq.status === 'COMPLETED' ? "text-emerald-700" : "")}>4. Confirmed</span>
              </div>
            </div>

            {/* Financial Summary Breakdown */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Original Purchase Cost</span>
                <span className="font-black text-slate-900 text-sm">{formatCurrency(selectedLiquidationReq.originalPurchaseAmount || 0)}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Request Date</span>
                <span className="font-medium text-slate-800">{formatDate(selectedLiquidationReq.requestedAt)}</span>
              </div>
              {selectedLiquidationReq.salePrice && (
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Livestock Sale Price</span>
                  <span className="font-black text-purple-700 text-sm">{formatCurrency(selectedLiquidationReq.salePrice)}</span>
                </div>
              )}
              {selectedLiquidationReq.creditedAmount && (
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Approved Recovery Payout</span>
                  <span className="font-black text-emerald-700 text-sm">{formatCurrency(selectedLiquidationReq.creditedAmount)}</span>
                </div>
              )}
            </div>

            {/* Payment & Receipt Preview */}
            {(selectedLiquidationReq.receiptUrl || selectedLiquidationReq.paymentRef) && (
              <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                  Bank Transfer & Payment Proof
                </span>
                
                {selectedLiquidationReq.receiptUrl && (
                  <div className="space-y-1.5">
                    <img 
                      src={selectedLiquidationReq.receiptUrl} 
                      alt="Bank Transfer Receipt" 
                      className="max-h-52 mx-auto rounded-xl border border-slate-200 object-contain bg-white p-1"
                    />
                    <a 
                      href={selectedLiquidationReq.receiptUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Open Full Receipt
                    </a>
                  </div>
                )}

                <div className="text-slate-600 text-xs space-y-1 bg-white p-3 rounded-xl border border-slate-100">
                  <p><strong>Payment Reference:</strong> <span className="font-mono">{selectedLiquidationReq.paymentRef || 'N/A'}</span></p>
                  <p><strong>Payment Method:</strong> {selectedLiquidationReq.paymentMethod || 'Direct Bank Transfer'}</p>
                  {selectedLiquidationReq.creditDate && (
                    <p><strong>Transfer Date:</strong> {formatDate(selectedLiquidationReq.creditDate)}</p>
                  )}
                  {selectedLiquidationReq.adjustmentNote && (
                    <p className="text-amber-800 bg-amber-50 p-2 rounded-lg mt-1.5">
                      <strong>Note:</strong> {selectedLiquidationReq.adjustmentNote}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ACTION REQUIRED: Confirm Receipt of Funds */}
            {selectedLiquidationReq.status === 'AWAITING_USER_CONFIRMATION' && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 space-y-3">
                <div className="flex items-start gap-2.5">
                  <TriangleAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-black text-amber-900 text-sm">Action Required: Confirm Receipt of Funds</h4>
                    <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                      Please check your bank account to ensure that <strong>{formatCurrency(selectedLiquidationReq.creditedAmount || 0)}</strong> has been received. Once confirmed, this transaction will close and update your net financial summary.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleConfirmReceipt}
                  disabled={isConfirmingReceipt}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-3 rounded-xl cursor-pointer"
                >
                  <CircleCheck className="w-4 h-4 mr-1.5" />
                  {isConfirmingReceipt ? "Updating..." : "Confirm Receipt of Funds"}
                </Button>
              </div>
            )}

            {/* Rejection Details */}
            {selectedLiquidationReq.status === 'REJECTED' && selectedLiquidationReq.rejectionReason && (
              <div className="p-4 bg-red-50 text-red-800 rounded-2xl border border-red-100 space-y-1">
                <span className="font-bold block text-xs text-red-700">Administrator Rejection Reason:</span>
                <p className="italic">"{selectedLiquidationReq.rejectionReason}"</p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button 
                variant="ghost" 
                onClick={() => setSelectedLiquidationReq(null)} 
                className="text-xs font-bold cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. MODAL: TRANSACTION DETAILS */}
      {selectedTx && (
        <Modal
          isOpen={!!selectedTx}
          onClose={() => setSelectedTx(null)}
          title="Transaction Details"
          subtitle={`Ref: ${selectedTx.invoiceNumber || selectedTx.invoiceId}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Description</span>
                <span className="font-bold text-slate-900 text-sm text-right">{selectedTx.description}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Category</span>
                <span className={cn(
                  "font-bold px-2 py-0.5 rounded-md text-[11px]",
                  selectedTx.isRecovery || selectedTx.amount < 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-800"
                )}>
                  {selectedTx.isRecovery || selectedTx.amount < 0 ? "Liquidation Recovery" : selectedTx.category}
                </span>
              </div>
              {selectedTx.livestockTag && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Livestock Tag</span>
                  <span className="font-mono font-bold text-slate-800">#{selectedTx.livestockTag}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/60">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Net Movement</span>
                <span className={cn(
                  "font-black text-base",
                  selectedTx.isRecovery || selectedTx.amount < 0 ? "text-emerald-700" : "text-slate-900"
                )}>
                  {selectedTx.isRecovery || selectedTx.amount < 0 ? `-${formatCurrency(Math.abs(selectedTx.amount))}` : `+${formatCurrency(selectedTx.amount)}`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Date & Time</span>
                <span className="font-bold text-slate-900">{formatDate(selectedTx.date)} at {new Date(selectedTx.date || Date.now()).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Status</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <CircleCheck className="w-3.5 h-3.5" /> Confirmed
                </span>
              </div>
            </div>

            <div className="flex justify-between gap-3 pt-2">
              {selectedTx.invoiceId && onViewTab && !selectedTx.isRecovery && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    const invId = selectedTx.invoiceId;
                    setSelectedTx(null);
                    onViewTab('invoices', invId);
                  }}
                  className="text-xs font-bold gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" /> View Invoice
                </Button>
              )}
              <Button 
                variant="ghost" 
                onClick={() => setSelectedTx(null)} 
                className="ml-auto text-xs font-bold cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

