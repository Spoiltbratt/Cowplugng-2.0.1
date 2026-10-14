import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db, sendNotification, notifyAdmins } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Card, Badge, Button, Input, CompactStatCard, Modal, DashboardSkeleton } from './UI';
import { 
  ReceiptText, 
  ArrowLeftRight, 
  Bell, 
  CircleCheck, 
  Plus, 
  Eye, 
  MapPin, 
  ShoppingBag, 
  MessageCircle, 
  CircleHelp,
  Clock,
  ShieldCheck,
  TrendingUp,
  Tag,
  Weight,
  HeartPulse,
  Wallet,
  Star,
  CheckCircle2
} from 'lucide-react';
import { CowIcon as Beef } from './CowIcon';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { Livestock, Invoice, ConsultationRequestStatus, LivestockStatus, Notification as AppNotification, ConsultationRequest, PaymentReceipt, VerificationStatus, SpendingTransaction } from '../types';
import { SourcingProgressSection } from './investor/SourcingProgressSection';
import { PwaInstallButton } from './pwa/PwaInstallButton';
import { useFavorites } from '../lib/useFavorites';

export const InvestorDashboard: React.FC<{ onViewTab: (tab: string, invoiceId?: string) => void }> = ({ onViewTab }) => {
  const { profile } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [myLivestock, setMyLivestock] = useState<Livestock[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [consultationRequests, setConsultationRequests] = useState<ConsultationRequest[]>([]);
  const [paymentReceipts, setPaymentReceipts] = useState<PaymentReceipt[]>([]);
  const [ledgerTransactions, setLedgerTransactions] = useState<SpendingTransaction[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState<AppNotification[]>([]);
  const [activeRequestsCount, setActiveRequestsCount] = useState<number>(0);
  const [selectedLivestock, setSelectedLivestock] = useState<Livestock | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [showConsultationForm, setShowConsultationForm] = useState(false);
  const [consultationData, setConsultationData] = useState({
    fullName: profile?.displayName || profile?.name || '',
    phoneNumber: profile?.phoneNumber || '',
    preferredContactMethod: 'Phone' as 'Phone' | 'WhatsApp' | 'Email',
    preferredContactTime: '',
    livestockInterest: 'Cattle' as 'Cattle' | 'Rams' | 'Goats' | 'Multiple',
    notes: ''
  });

  useEffect(() => {
    if (profile) {
      setConsultationData(prev => ({
        ...prev,
        fullName: profile.displayName || profile.name || '',
        phoneNumber: profile.phoneNumber || ''
      }));
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    // Listen to livestock
    const qLivestock = query(collection(db, 'livestock'), where('ownerId', '==', profile.uid));
    const unsubLivestock = onSnapshot(qLivestock, (snap) => {
      setMyLivestock(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Livestock)));
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching livestock:", err);
      setIsLoading(false);
    });

    // Listen to invoices
    const qInvoices = query(collection(db, 'invoices'), where('investorId', '==', profile.uid));
    const unsubInvoices = onSnapshot(qInvoices, (snap) => {
      const allInvs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
      setAllInvoices(allInvs);
      setPendingInvoices(allInvs.filter(i => i.status === 'PENDING'));
    }, (err) => console.error("Error fetching invoices:", err));

    // Listen to consultation requests
    const qRequests = query(collection(db, 'consultationRequests'), where('userId', '==', profile.uid));
    const unsubRequests = onSnapshot(qRequests, (snap) => {
      const reqs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConsultationRequest));
      setConsultationRequests(reqs);
      
      const activeRequests = reqs.filter(r => {
        const status = (r.status || '').toString();
        return (
          status !== ConsultationRequestStatus.COMPLETED && 
          status !== ConsultationRequestStatus.CANCELLED &&
          status !== 'Completed' &&
          status !== 'Cancelled'
        );
      });
      setActiveRequestsCount(activeRequests.length);
    }, (err) => console.error("Error fetching requests:", err));

    // Listen to payment receipts
    const qReceipts = query(collection(db, 'paymentReceipts'), where('investorId', '==', profile.uid));
    const unsubReceipts = onSnapshot(qReceipts, (snap) => {
      setPaymentReceipts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentReceipt)));
    }, (err) => console.error("Error fetching receipts:", err));

    // Listen to spending ledger
    const qLedger = query(collection(db, 'spendingLedger'), where('userId', '==', profile.uid));
    const unsubLedger = onSnapshot(qLedger, (snap) => {
      setLedgerTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SpendingTransaction)));
    }, (err) => console.error("Error fetching ledger:", err));

    // Listen to notifications
    const qNotifications = query(collection(db, 'notifications'), where('userId', '==', profile.uid));
    const unsubNotifications = onSnapshot(qNotifications, (snap) => {
      const notificationsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      notificationsData.sort((a, b) => b.createdAt - a.createdAt);
      setUnreadNotifications(notificationsData.filter(n => !n.read));
    }, (err) => console.error("Error fetching notifications:", err));

    return () => {
      unsubLivestock();
      unsubInvoices();
      unsubRequests();
      unsubReceipts();
      unsubLedger();
      unsubNotifications();
    };
  }, [profile]);

  const handleConsultationRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      await addDoc(collection(db, 'consultationRequests'), {
        userId: profile.uid,
        investorName: consultationData.fullName,
        email: profile.email,
        phoneNumber: consultationData.phoneNumber,
        preferredContactMethod: consultationData.preferredContactMethod,
        preferredContactTime: consultationData.preferredContactTime,
        livestockInterest: consultationData.livestockInterest,
        notes: consultationData.notes,
        status: ConsultationRequestStatus.PENDING_CONTACT,
        createdAt: serverTimestamp()
      });

      await sendNotification(
        profile.uid,
        'Request Received',
        'Thank you. Your livestock request has been received. A CowPlugNG team member will contact you shortly.',
        'System Maintenance',
        'SUCCESS'
      );

      await notifyAdmins(
        'New Livestock Request',
        `User ${profile.displayName || profile.name} has submitted a new livestock sourcing request.`,
        'System Maintenance',
        'INFO'
      );

      setShowConsultationForm(false);
      setActiveRequestsCount(prev => prev + 1);
      alert('Thank you. Your livestock request has been received. A CowPlugNG representative will contact you shortly.');
      onViewTab('sourcing');
    } catch (error) {
      console.error("Error submitting request:", error);
      alert('Failed to submit request. Please try again.');
    }
  };

  const activeLivestock = myLivestock.filter(animal => 
    animal.status !== LivestockStatus.DELIVERED && 
    animal.status !== LivestockStatus.DECEASED &&
    animal.status !== LivestockStatus.ARCHIVED &&
    animal.status !== LivestockStatus.SOLD &&
    animal.status !== LivestockStatus.TRANSFERRED
  );

  const paidInvs = allInvoices.filter(i => i.status === 'PAID');
  
  // Create allTransactions array similar to MySpending.tsx
  const allTransactions: SpendingTransaction[] = [];
  const ledgerMap = new Set(ledgerTransactions.map(t => `${t.invoiceId}-${t.description}`));
  
  ledgerTransactions.forEach(tx => allTransactions.push(tx));
  
  paidInvs.forEach(inv => {
    if (inv.items && Array.isArray(inv.items)) {
      inv.items.forEach((item, idx) => {
        const key = `${inv.id}-${item.description || item.item}`;
        if (!ledgerMap.has(key)) {
          const itemAmt = item.amount || (item.quantity * (item.unitPrice || item.price || 0)) || inv.totalAmount || 0;
          allTransactions.push({
            id: `${inv.id}-${idx}`,
            userId: inv.investorId,
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            category: (item.category as any) || 'Other',
            description: item.description || item.item || 'Livestock & Management',
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
      });
    } else if (inv.totalAmount && !ledgerMap.has(`${inv.id}-total`)) {
      allTransactions.push({
        id: `${inv.id}-total`,
        userId: inv.investorId,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        category: 'Livestock',
        description: inv.notes || 'Livestock Purchase & Management',
        quantity: 1,
        unitPrice: inv.totalAmount,
        amount: inv.totalAmount,
        currency: 'NGN',
        status: 'CONFIRMED',
        date: inv.createdAt || Date.now()
      });
    }
  });

  const coveredLivestockKeys = new Set<string>();
  const coveredInvoiceIds = new Set<string>();
  const coveredRequestIds = new Set<string>();

  allTransactions.forEach(tx => {
    if (tx.livestockId) coveredLivestockKeys.add(tx.livestockId);
    if (tx.livestockTag) coveredLivestockKeys.add(tx.livestockTag);
    if (tx.invoiceId) coveredInvoiceIds.add(tx.invoiceId);
  });

  paidInvs.forEach(inv => {
    if (inv.id) coveredInvoiceIds.add(inv.id);
    if (inv.requestId) coveredRequestIds.add(inv.requestId);
  });

  let calculatedTotalSpent = allTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  myLivestock.forEach(animal => {
    if (coveredLivestockKeys.has(animal.id) || coveredLivestockKeys.has(animal.tagNumber)) return;
    const isCoveredByInvoiceId = animal.invoiceId ? coveredInvoiceIds.has(animal.invoiceId) : false;
    const isCoveredByRequestId = animal.sourcingRequestId ? coveredRequestIds.has(animal.sourcingRequestId) : false;
    const isCoveredByNote = paidInvs.some(inv => 
      (inv.notes || '').toLowerCase().includes((animal.tagNumber || '').toLowerCase()) ||
      (inv.livestockDetails || '').toLowerCase().includes((animal.tagNumber || '').toLowerCase())
    );
    if (!isCoveredByInvoiceId && !isCoveredByRequestId && !isCoveredByNote) {
       calculatedTotalSpent += (animal.purchasePrice || 0);
    }
  });

  const totalLivestockValue = activeLivestock.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
  const firstName = (profile?.displayName || profile?.name || 'User').split(' ')[0];

  const isVerified = profile?.verificationStatus === VerificationStatus.APPROVED || !!profile?.isVerified;
  const isPendingVerification = profile?.verificationStatus === VerificationStatus.UNDER_REVIEW || profile?.verificationStatus === VerificationStatus.SUBMITTED;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* VERIFICATION PENDING BANNER */}
      {isPendingVerification && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-900">Account Verification in Progress</h4>
              <p className="text-xs text-amber-800 font-medium mt-0.5">
                Our team is currently reviewing your identity documents. Some platform features may be limited until approval.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-white border-amber-200 text-amber-700 font-black h-auto py-1 px-3">
            ETA: 24-48 Hours
          </Badge>
        </div>
      )}

      {/* 1. WELCOME AREA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Welcome, {firstName}
            </h1>
            {isVerified ? (
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Verified Account
              </span>
            ) : (
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600" />
                Verification Pending
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Buy livestock. We manage it until you're ready.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PwaInstallButton variant="header" label="Install Mobile App" />
        </div>
      </div>

      {/* 2. KEY METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CompactStatCard
          title="My Spending"
          value={formatCurrency(calculatedTotalSpent)}
          subtext="Total spent so far"
          icon={Wallet}
          onClick={() => onViewTab('spending')}
        />
        <CompactStatCard
          title="My Livestock"
          value={activeLivestock.length}
          subtext="Currently under management"
          icon={Beef}
          onClick={() => onViewTab('my-livestock')}
        />
        <CompactStatCard
          title="My Requests"
          value={activeRequestsCount}
          subtext="Active requests"
          icon={MessageCircle}
          onClick={() => onViewTab('sourcing')}
        />
        <CompactStatCard
          title="Payments"
          value={pendingInvoices.length}
          subtext="Pending payments"
          icon={ArrowLeftRight}
          onClick={() => onViewTab('invoices')}
        />
      </div>

      {/* Optional Livestock Value metric if available */}
      {totalLivestockValue > 0 && (
        <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Livestock Value</p>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">{formatCurrency(totalLivestockValue)}</h3>
          </div>
          <p className="text-xs text-slate-500 font-medium">Current estimated value</p>
        </div>
      )}

      {/* SOURCING & ACQUISITIONS PROGRESS SECTION */}
      <SourcingProgressSection
        requests={consultationRequests}
        invoices={allInvoices}
        receipts={paymentReceipts}
        livestock={myLivestock}
        onViewTab={onViewTab}
        onRequestLivestock={() => onViewTab('sourcing')}
      />

      {/* 3. MY LIVESTOCK SECTION */}
      <Card 
        title="My Livestock" 
        icon={Beef} 
        action={
          activeLivestock.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => onViewTab('my-livestock')}>
              View All
            </Button>
          ) : undefined
        }
      >
        {activeLivestock.length === 0 ? (
          <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-700">
              <Beef className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">No livestock yet</h3>
              <p className="text-slate-500 text-xs mt-1 max-w-sm font-medium">
                You haven't purchased any livestock yet.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button variant="primary" size="sm" onClick={() => onViewTab('sourcing')} className="bg-emerald-700 hover:bg-emerald-800">
                <ShoppingBag className="w-4 h-4 mr-1.5" /> Source Livestock
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeLivestock.map(animal => (
              <div 
                key={animal.id} 
                className="p-5 rounded-2xl bg-white border border-slate-100 hover:border-emerald-500/50 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="relative mb-3">
                    {animal.photos && animal.photos.length > 0 ? (
                      <img 
                        src={animal.photos[0]} 
                        alt={animal.breed} 
                        className="w-full h-36 object-cover rounded-xl border border-slate-100"
                      />
                    ) : (
                      <div className="w-full h-28 bg-emerald-50/50 rounded-xl border border-slate-100 flex items-center justify-center text-emerald-700">
                        <Beef className="w-10 h-10 opacity-60" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(animal.id, e)}
                      aria-label={isFavorite(animal.id) ? "Remove from saved favorites" : "Save to favorites"}
                      title={isFavorite(animal.id) ? "Saved in favorites" : "Save to favorites"}
                      className="absolute top-2 right-2 p-2 rounded-xl bg-white/95 backdrop-blur-xs shadow-sm border border-slate-200/80 hover:bg-white text-slate-400 hover:text-amber-500 transition-all cursor-pointer z-10"
                    >
                      <Star className={cn("w-4 h-4 transition-transform active:scale-125", isFavorite(animal.id) ? "fill-amber-400 text-amber-500" : "text-slate-400")} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-800 text-[10px] font-black rounded-lg">
                      {animal.tagNumber}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded-lg">
                      {animal.status}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-base">
                    {animal.type || 'Cattle'} - {animal.breed}
                  </h4>

                  <div className="mt-3 text-xs space-y-1 text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{animal.farm || 'CowPlugNG Ranch'}</span>
                    </div>
                    {animal.purchasePrice ? (
                      <div className="text-slate-900 font-bold">
                        Value: {formatCurrency(animal.purchasePrice)}
                      </div>
                    ) : null}
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedLivestock(animal)}
                  className="w-full justify-center font-bold text-xs rounded-xl"
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" /> View Details
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 4. PAYMENT & INVOICING GUIDE */}
      <Card title="How to Pay" icon={ReceiptText}>
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0 font-bold text-xs">
              1
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">View your invoice</h4>
              <p className="text-xs text-slate-600 mt-0.5">Open Invoices to see the amount and payment details.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0 font-bold text-xs">
              2
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">Make your payment</h4>
              <p className="text-xs text-slate-600 mt-0.5">Pay using the bank details shown on your invoice.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0 font-bold text-xs">
              3
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">Upload your receipt</h4>
              <p className="text-xs text-slate-600 mt-0.5">Upload your payment receipt so CowPlugNG can verify your payment.</p>
            </div>
          </div>

          <p className="pt-2 text-xs text-slate-500 font-medium italic border-t border-slate-200/60">
            Our team will review your receipt and update your payment status.
          </p>
        </div>
      </Card>

      {/* 5. NEED HELP? */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Need Help?</h3>
          <p className="text-slate-500 text-xs font-medium mt-1">
            Have a question about your livestock, payment or request?
          </p>
        </div>
        <Button 
          variant="primary" 
          onClick={() => onViewTab('notifications')}
          className="bg-emerald-700 hover:bg-emerald-800 font-bold shrink-0"
        >
          <CircleHelp className="w-4 h-4 mr-2" /> Contact CowPlugNG
        </Button>
      </div>

      {/* GLOBAL MODAL POPUP FOR LIVESTOCK DETAILS */}
      {selectedLivestock && (
        <Modal
          isOpen={!!selectedLivestock}
          onClose={() => setSelectedLivestock(null)}
          title={`Livestock Details: ${selectedLivestock.tagNumber}`}
          subtitle={`${selectedLivestock.type || 'Cattle'} - ${selectedLivestock.breed}`}
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <HeartPulse className="w-4 h-4 text-emerald-600" />
                <span>Vitality & Growth Status</span>
              </div>
              <button
                type="button"
                onClick={() => toggleFavorite(selectedLivestock.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:text-amber-600 hover:border-amber-300 transition-colors cursor-pointer"
                aria-label={isFavorite(selectedLivestock.id) ? "Remove from favorites" : "Save to favorites"}
              >
                <Star className={cn("w-3.5 h-3.5", isFavorite(selectedLivestock.id) ? "fill-amber-400 text-amber-500" : "text-slate-400")} />
                <span>{isFavorite(selectedLivestock.id) ? "Saved in Favorites" : "Save to Favorites"}</span>
              </button>
            </div>

            {selectedLivestock.photos && selectedLivestock.photos.length > 0 && (
              <img 
                src={selectedLivestock.photos[0]} 
                alt={selectedLivestock.breed} 
                className="w-full h-48 object-cover rounded-xl border border-slate-100"
              />
            )}

            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Tag Number</span>
                <span className="font-black text-slate-900">{selectedLivestock.tagNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Status</span>
                <span className="font-bold text-emerald-700">{selectedLivestock.status}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Breed</span>
                <span className="font-bold text-slate-900">{selectedLivestock.breed}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Weight</span>
                <span className="font-bold text-slate-900">{selectedLivestock.weight || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Health</span>
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <HeartPulse className="w-3.5 h-3.5 text-emerald-600 inline" />
                  {selectedLivestock.healthStatus || 'Good'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Location</span>
                <span className="font-bold text-slate-900">{selectedLivestock.farm || 'CowPlugNG Ranch'}</span>
              </div>
              {selectedLivestock.purchasePrice && (
                <div className="col-span-2 pt-2 border-t border-slate-200/60">
                  <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Purchase Price</span>
                  <span className="font-black text-slate-900 text-sm">{formatCurrency(selectedLivestock.purchasePrice)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setSelectedLivestock(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* REQUEST LIVESTOCK MODAL */}
      <Modal
        isOpen={showConsultationForm}
        onClose={() => setShowConsultationForm(false)}
        title="Request Livestock"
        subtitle="Specify what livestock you are looking to purchase and manage with CowPlugNG."
      >
        <form onSubmit={handleConsultationRequest} className="space-y-4">
          <Input
            label="Full Name"
            value={consultationData.fullName}
            onChange={(e) => setConsultationData({ ...consultationData, fullName: e.target.value })}
            required
          />
          <Input
            label="Phone Number"
            value={consultationData.phoneNumber}
            onChange={(e) => setConsultationData({ ...consultationData, phoneNumber: e.target.value })}
            required
          />
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Preferred Contact Method</label>
            <select
              value={consultationData.preferredContactMethod}
              onChange={(e) => setConsultationData({ ...consultationData, preferredContactMethod: e.target.value as any })}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            >
              <option value="Phone">Phone Call</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Email">Email</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Livestock Category</label>
            <select
              value={consultationData.livestockInterest}
              onChange={(e) => setConsultationData({ ...consultationData, livestockInterest: e.target.value as any })}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            >
              <option value="Cattle">Cattle / Cows</option>
              <option value="Rams">Rams</option>
              <option value="Goats">Goats</option>
              <option value="Multiple">Multiple Livestock Types</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Notes & Requirements</label>
            <textarea
              rows={3}
              value={consultationData.notes}
              onChange={(e) => setConsultationData({ ...consultationData, notes: e.target.value })}
              placeholder="Detail quantity, specific breeds, or requirements..."
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={() => setShowConsultationForm(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="bg-emerald-700 hover:bg-emerald-800">
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
