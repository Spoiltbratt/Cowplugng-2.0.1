import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  getDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { 
  LiquidationRequest, 
  LiquidationStatus, 
  Livestock, 
  LivestockStatus 
} from '../../types';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { 
  Card, 
  Badge, 
  Button, 
  PageHeader, 
  DashboardSkeleton 
} from '../UI';
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  DollarSign, 
  FileText, 
  Upload, 
  User, 
  Search, 
  Filter, 
  Eye, 
  AlertTriangle, 
  Check, 
  Calendar, 
  ArrowRight,
  ShieldCheck,
  Building,
  Image as ImageIcon
} from 'lucide-react';
import { CowIcon as Cow } from '../CowIcon';

export const LiquidationManager: React.FC = () => {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<LiquidationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<LiquidationRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Sale details state
  const [salePrice, setSalePrice] = useState<string>('');
  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [buyerRef, setBuyerRef] = useState<string>('');
  const [saleNotes, setSaleNotes] = useState<string>('');

  // Bank Credit details state
  const [creditedAmount, setCreditedAmount] = useState<string>('');
  const [creditDate, setCreditDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank Transfer');
  const [adjustmentNote, setAdjustmentNote] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'liquidationRequests'), 
      orderBy('requestedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as LiquidationRequest));
      setRequests(list);
      setIsLoading(false);
    }, (error) => {
      console.error("Error loading liquidation requests:", error);
      handleFirestoreError(error, OperationType.LIST, 'liquidationRequests');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const prevRequestIdRef = useRef<string | null>(null);

  // When selectedRequest changes, initialize form defaults if a new request is selected
  useEffect(() => {
    if (selectedRequest) {
      if (prevRequestIdRef.current !== selectedRequest.id) {
        prevRequestIdRef.current = selectedRequest.id;
        setRejectionReason(selectedRequest.rejectionReason || '');
        setSalePrice(selectedRequest.salePrice ? String(selectedRequest.salePrice) : String(selectedRequest.originalPurchaseAmount || ''));
        setSaleDate(selectedRequest.saleDate ? new Date(selectedRequest.saleDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        setBuyerRef(selectedRequest.buyerRef || '');
        setSaleNotes(selectedRequest.saleNotes || '');

        const initialCredit = selectedRequest.creditedAmount 
          ? String(selectedRequest.creditedAmount) 
          : (selectedRequest.salePrice ? String(selectedRequest.salePrice) : String(selectedRequest.originalPurchaseAmount || ''));
        
        setCreditedAmount(initialCredit);
        setCreditDate(selectedRequest.creditDate ? new Date(selectedRequest.creditDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        setPaymentRef(selectedRequest.paymentRef || '');
        setPaymentMethod(selectedRequest.paymentMethod || 'Bank Transfer');
        setAdjustmentNote(selectedRequest.adjustmentNote || '');
        setReceiptPreview(selectedRequest.receiptUrl || null);
        setReceiptFile(null);
        setActionError(null);
        setActionSuccess(null);
      }
    } else {
      prevRequestIdRef.current = null;
    }
  }, [selectedRequest]);

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper to log admin activity
  const logActivity = async (action: string, targetId: string, details: string) => {
    try {
      await addDoc(collection(db, 'activityLogs'), {
        userId: profile?.uid || 'ADMIN',
        userName: profile?.displayName || profile?.name || 'Admin',
        adminName: profile?.displayName || profile?.name || 'Admin',
        action,
        targetId,
        targetType: 'LiquidationRequest',
        details,
        timestamp: Date.now()
      });
    } catch (err) {
      console.warn("Failed to create activity log:", err);
    }
  };

  // Helper to notify user
  const notifyUser = async (userId: string, title: string, message: string, category: any, priority: any) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        title,
        message,
        category,
        priority,
        read: false,
        createdAt: Date.now()
      });
    } catch (err) {
      console.warn("Failed to notify user:", err);
    }
  };

  // Action: Approve Liquidation Request
  const handleApprove = async () => {
    if (!selectedRequest || !profile) return;
    setIsSubmitting(true);
    setActionError(null);

    try {
      const now = Date.now();
      const reqRef = doc(db, 'liquidationRequests', selectedRequest.id);
      await updateDoc(reqRef, {
        status: 'APPROVED',
        adminId: profile.uid,
        adminName: profile.displayName || profile.name || 'Admin',
        adminDecisionAt: now,
        updatedAt: now
      });

      if (selectedRequest.livestockId) {
        const animalRef = doc(db, 'livestock', selectedRequest.livestockId);
        await updateDoc(animalRef, {
          liquidationStatus: 'APPROVED',
          lastUpdated: now
        });
      }

      await notifyUser(
        selectedRequest.userId,
        "Liquidation Approved",
        `Your request to liquidate ${selectedRequest.livestockBreed} (${selectedRequest.livestockTag}) has been approved. The livestock can now proceed to the sale process.`,
        'Investment Updates',
        'SUCCESS'
      );

      await logActivity(
        "Liquidation Approved",
        selectedRequest.id,
        `Approved liquidation request for livestock ${selectedRequest.livestockTag} owned by ${selectedRequest.userName}`
      );

      setActionSuccess("Liquidation request approved successfully.");
      setSelectedRequest(prev => prev ? ({ ...prev, status: 'APPROVED' }) : null);
    } catch (err: any) {
      console.error("Approve liquidation error:", err);
      setActionError(err.message || "Failed to approve request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Reject Liquidation Request
  const handleReject = async () => {
    if (!selectedRequest || !profile) return;
    if (!rejectionReason.trim()) {
      setActionError("Please enter a reason for rejecting this request.");
      return;
    }
    setIsSubmitting(true);
    setActionError(null);

    try {
      const now = Date.now();
      const reqRef = doc(db, 'liquidationRequests', selectedRequest.id);
      await updateDoc(reqRef, {
        status: 'REJECTED',
        rejectionReason: rejectionReason.trim(),
        adminId: profile.uid,
        adminName: profile.displayName || profile.name || 'Admin',
        adminDecisionAt: now,
        updatedAt: now
      });

      if (selectedRequest.livestockId) {
        const animalRef = doc(db, 'livestock', selectedRequest.livestockId);
        await updateDoc(animalRef, {
          liquidationStatus: 'REJECTED',
          lastUpdated: now
        });
      }

      await notifyUser(
        selectedRequest.userId,
        "Liquidation Request Rejected",
        `Your request for ${selectedRequest.livestockTag} was not approved. Reason: ${rejectionReason.trim()}`,
        'Investment Updates',
        'WARNING'
      );

      await logActivity(
        "Liquidation Rejected",
        selectedRequest.id,
        `Rejected liquidation request for livestock ${selectedRequest.livestockTag}. Reason: ${rejectionReason.trim()}`
      );

      setActionSuccess("Liquidation request rejected.");
      setSelectedRequest(prev => prev ? ({ ...prev, status: 'REJECTED', rejectionReason: rejectionReason.trim() }) : null);
    } catch (err: any) {
      console.error("Reject liquidation error:", err);
      setActionError(err.message || "Failed to reject request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Record Sale
  const handleRecordSale = async () => {
    if (!selectedRequest || !profile) return;
    const parsedSalePrice = parseFloat(salePrice);
    if (isNaN(parsedSalePrice) || parsedSalePrice <= 0) {
      setActionError("Please enter a valid sale price.");
      return;
    }
    setIsSubmitting(true);
    setActionError(null);

    try {
      const now = Date.now();
      const saleTimestamp = new Date(saleDate).getTime() || now;
      const reqRef = doc(db, 'liquidationRequests', selectedRequest.id);
      
      const reqUpdatePayload: Record<string, any> = {
        status: 'SOLD',
        salePrice: parsedSalePrice,
        saleDate: saleTimestamp,
        updatedAt: now
      };

      if (buyerRef.trim()) {
        reqUpdatePayload.buyerRef = buyerRef.trim();
      }
      if (saleNotes.trim()) {
        reqUpdatePayload.saleNotes = saleNotes.trim();
      }

      await updateDoc(reqRef, reqUpdatePayload);

      if (selectedRequest.livestockId) {
        const animalRef = doc(db, 'livestock', selectedRequest.livestockId);
        const animalUpdatePayload: Record<string, any> = {
          status: LivestockStatus.SOLD,
          liquidationStatus: 'SOLD',
          saleAmount: parsedSalePrice,
          saleDate: saleTimestamp,
          lastUpdated: now
        };
        if (saleNotes.trim()) {
          animalUpdatePayload.saleNotes = saleNotes.trim();
        }
        await updateDoc(animalRef, animalUpdatePayload);
      }

      await notifyUser(
        selectedRequest.userId,
        "Livestock Sold",
        `Your livestock ${selectedRequest.livestockTag} has been sold for ${formatCurrency(parsedSalePrice)}. Payment processing will begin shortly.`,
        'Investment Updates',
        'SUCCESS'
      );

      await logActivity(
        "Livestock Sold Recorded",
        selectedRequest.id,
        `Recorded sale of livestock ${selectedRequest.livestockTag} for ${formatCurrency(parsedSalePrice)}`
      );

      setActionSuccess("Sale details recorded successfully.");
      setSelectedRequest(prev => prev ? ({
        ...prev,
        status: 'SOLD',
        salePrice: parsedSalePrice,
        saleDate: saleTimestamp,
        ...(buyerRef.trim() ? { buyerRef: buyerRef.trim() } : {}),
        ...(saleNotes.trim() ? { saleNotes: saleNotes.trim() } : {})
      }) : null);
    } catch (err: any) {
      console.error("Record sale error:", err);
      setActionError(err.message || "Failed to record sale");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Record Bank Credit & Upload Receipt
  const handleRecordBankCredit = async () => {
    if (!selectedRequest || !profile) return;
    const parsedCreditAmount = parseFloat(creditedAmount);
    if (isNaN(parsedCreditAmount) || parsedCreditAmount <= 0) {
      setActionError("Please enter a valid credited amount.");
      return;
    }

    const officialSalePrice = selectedRequest.salePrice || parsedCreditAmount;
    if (parsedCreditAmount !== officialSalePrice && !adjustmentNote.trim()) {
      setActionError("Credited amount differs from sale price. Please enter an adjustment note explaining the difference.");
      return;
    }

    if (!receiptPreview) {
      setActionError("Please upload a bank payment receipt image.");
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      const now = Date.now();
      const creditTimestamp = new Date(creditDate).getTime() || now;
      const reqRef = doc(db, 'liquidationRequests', selectedRequest.id);

      const updatePayload: Record<string, any> = {
        status: 'AWAITING_USER_CONFIRMATION',
        creditedAmount: parsedCreditAmount,
        creditDate: creditTimestamp,
        paymentRef: paymentRef.trim() || 'BANK-TRANSFER-' + Date.now().toString().slice(-6),
        paymentMethod: paymentMethod.trim() || 'Bank Transfer',
        receiptUrl: receiptPreview,
        updatedAt: now
      };

      if (adjustmentNote.trim()) {
        updatePayload.adjustmentNote = adjustmentNote.trim();
      }

      await updateDoc(reqRef, updatePayload);

      if (selectedRequest.livestockId) {
        const animalRef = doc(db, 'livestock', selectedRequest.livestockId);
        await updateDoc(animalRef, {
          liquidationStatus: 'AWAITING_USER_CONFIRMATION',
          lastUpdated: now
        });
      }

      await notifyUser(
        selectedRequest.userId,
        "Liquidation Payment Ready for Confirmation",
        `Your livestock (${selectedRequest.livestockTag}) has been sold for ${formatCurrency(officialSalePrice)} and your account has been credited ${formatCurrency(parsedCreditAmount)}. Please review the payment receipt and confirm that you received the funds.`,
        'Payment Confirmations',
        'SUCCESS'
      );

      await logActivity(
        "Bank Credit Recorded",
        selectedRequest.id,
        `Recorded bank credit of ${formatCurrency(parsedCreditAmount)} for livestock ${selectedRequest.livestockTag} and sent receipt to user.`
      );

      setActionSuccess("Bank credit recorded and sent to user for confirmation.");
      setSelectedRequest(prev => prev ? ({
        ...prev,
        status: 'AWAITING_USER_CONFIRMATION',
        creditedAmount: parsedCreditAmount,
        creditDate: creditTimestamp,
        paymentRef: paymentRef.trim() || 'BANK-TRANSFER',
        paymentMethod: paymentMethod.trim() || 'Bank Transfer',
        receiptUrl: receiptPreview,
        ...(adjustmentNote.trim() ? { adjustmentNote: adjustmentNote.trim() } : {})
      }) : null);
    } catch (err: any) {
      console.error("Record bank credit error:", err);
      setActionError(err.message || "Failed to record bank credit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: LiquidationStatus) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning" className="gap-1"><Clock className="w-3 h-3" /> Pending Review</Badge>;
      case 'APPROVED':
        return <Badge variant="info" className="gap-1"><CheckCircle2 className="w-3 h-3" /> Approved for Sale</Badge>;
      case 'REJECTED':
        return <Badge variant="danger" className="gap-1"><XCircle className="w-3 h-3" /> Rejected</Badge>;
      case 'SOLD':
        return <Badge variant="accent" className="gap-1"><Cow className="w-3 h-3" /> Sold</Badge>;
      case 'AWAITING_BANK_CREDIT':
        return <Badge variant="warning" className="gap-1"><DollarSign className="w-3 h-3" /> Awaiting Credit</Badge>;
      case 'AWAITING_USER_CONFIRMATION':
        return <Badge variant="warning" className="gap-1"><Clock className="w-3 h-3" /> Awaiting User Confirmation</Badge>;
      case 'COMPLETED':
        return <Badge variant="success" className="gap-1"><CheckCircle2 className="w-3 h-3" /> Completed</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Filter requests
  const filteredRequests = requests.filter(req => {
    if (filterStatus !== 'ALL' && req.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        req.userName?.toLowerCase().includes(q) ||
        req.userEmail?.toLowerCase().includes(q) ||
        req.livestockTag?.toLowerCase().includes(q) ||
        req.livestockBreed?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const countByStatus = {
    ALL: requests.length,
    PENDING: requests.filter(r => r.status === 'PENDING').length,
    APPROVED: requests.filter(r => r.status === 'APPROVED').length,
    SOLD: requests.filter(r => r.status === 'SOLD').length,
    AWAITING_USER_CONFIRMATION: requests.filter(r => r.status === 'AWAITING_USER_CONFIRMATION').length,
    COMPLETED: requests.filter(r => r.status === 'COMPLETED').length,
    REJECTED: requests.filter(r => r.status === 'REJECTED').length,
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Livestock Liquidations"
        description="Review, approve, process sales, record bank credits, and track asset liquidations."
      />

      {/* Stats Quick Overview Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div 
          onClick={() => setFilterStatus('ALL')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer",
            filterStatus === 'ALL' ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white border-slate-100 hover:border-slate-200"
          )}
        >
          <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">Total Requests</span>
          <span className="text-2xl font-black mt-1 block">{countByStatus.ALL}</span>
        </div>
        <div 
          onClick={() => setFilterStatus('PENDING')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer",
            filterStatus === 'PENDING' ? "bg-amber-600 text-white border-amber-600 shadow-md" : "bg-amber-50/50 border-amber-100/60 hover:bg-amber-50"
          )}
        >
          <span className="text-[10px] font-black uppercase tracking-wider block opacity-80 text-amber-800">Pending Review</span>
          <span className="text-2xl font-black mt-1 block text-amber-900">{countByStatus.PENDING}</span>
        </div>
        <div 
          onClick={() => setFilterStatus('APPROVED')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer",
            filterStatus === 'APPROVED' ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-blue-50/50 border-blue-100/60 hover:bg-blue-50"
          )}
        >
          <span className="text-[10px] font-black uppercase tracking-wider block opacity-80 text-blue-800">Approved for Sale</span>
          <span className="text-2xl font-black mt-1 block text-blue-900">{countByStatus.APPROVED}</span>
        </div>
        <div 
          onClick={() => setFilterStatus('SOLD')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer",
            filterStatus === 'SOLD' ? "bg-purple-600 text-white border-purple-600 shadow-md" : "bg-purple-50/50 border-purple-100/60 hover:bg-purple-50"
          )}
        >
          <span className="text-[10px] font-black uppercase tracking-wider block opacity-80 text-purple-800">Sold (Need Credit)</span>
          <span className="text-2xl font-black mt-1 block text-purple-900">{countByStatus.SOLD}</span>
        </div>
        <div 
          onClick={() => setFilterStatus('AWAITING_USER_CONFIRMATION')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer",
            filterStatus === 'AWAITING_USER_CONFIRMATION' ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-indigo-50/50 border-indigo-100/60 hover:bg-indigo-50"
          )}
        >
          <span className="text-[10px] font-black uppercase tracking-wider block opacity-80 text-indigo-800">Awaiting Confirmation</span>
          <span className="text-2xl font-black mt-1 block text-indigo-900">{countByStatus.AWAITING_USER_CONFIRMATION}</span>
        </div>
        <div 
          onClick={() => setFilterStatus('COMPLETED')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer",
            filterStatus === 'COMPLETED' ? "bg-emerald-600 text-white border-emerald-600 shadow-md" : "bg-emerald-50/50 border-emerald-100/60 hover:bg-emerald-50"
          )}
        >
          <span className="text-[10px] font-black uppercase tracking-wider block opacity-80 text-emerald-800">Completed</span>
          <span className="text-2xl font-black mt-1 block text-emerald-900">{countByStatus.COMPLETED}</span>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          {['ALL', 'PENDING', 'APPROVED', 'SOLD', 'AWAITING_USER_CONFIRMATION', 'COMPLETED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                filterStatus === st
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              {st === 'ALL' ? 'All Requests' : st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search investor, tag or breed..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Request Cards / Table */}
      {filteredRequests.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <RefreshCw className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No liquidation requests found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {filterStatus !== 'ALL' ? `No requests matching "${filterStatus.replace(/_/g, ' ')}" status.` : 'There are no asset liquidation requests submitted yet.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map((req) => (
            <Card key={req.id} className="p-5 hover:shadow-md transition-all flex flex-col justify-between border-slate-100">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2 border-b border-slate-50 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Livestock Asset</span>
                    <h4 className="text-sm font-black text-slate-900">{req.livestockBreed} (#{req.livestockTag})</h4>
                  </div>
                  {getStatusBadge(req.status)}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-400 font-bold">Investor</span>
                    <span className="font-bold text-slate-800">{req.userName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-400 font-bold">Original Purchase</span>
                    <span className="font-bold text-slate-900">{formatCurrency(req.originalPurchaseAmount || 0)}</span>
                  </div>
                  {req.salePrice && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-slate-400 font-bold">Official Sale Proceeds</span>
                      <span className="font-bold text-purple-700">{formatCurrency(req.salePrice)}</span>
                    </div>
                  )}
                  {req.creditedAmount && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-50">
                      <span className="text-slate-400 font-bold">Bank Credited</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(req.creditedAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400 font-bold">Requested Date</span>
                    <span className="font-medium text-slate-600">{formatDate(req.requestedAt)}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Reason for Liquidation</span>
                  <p className="text-xs text-slate-700 italic line-clamp-2">"{req.reason}"</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4">
                <Button 
                  onClick={() => setSelectedRequest(req)}
                  variant="outline"
                  className="w-full text-xs font-bold justify-center"
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  Manage Request
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Admin Action / Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl border border-slate-100 my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                  Liquidation Management
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {selectedRequest.livestockBreed} (#{selectedRequest.livestockTag})
                </h3>
              </div>
              <button 
                onClick={() => setSelectedRequest(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{actionError}</span>
              </div>
            )}

            {actionSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{actionSuccess}</span>
              </div>
            )}

            {/* Request Summary Info */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl text-xs">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block">Investor</span>
                <span className="font-bold text-slate-900">{selectedRequest.userName}</span>
                <span className="text-[11px] text-slate-500 block">{selectedRequest.userEmail}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block">Original Purchase</span>
                <span className="font-black text-slate-900 text-sm">{formatCurrency(selectedRequest.originalPurchaseAmount || 0)}</span>
                <span className="text-[11px] text-slate-500 block">Purchased: {formatDate(selectedRequest.purchaseDate)}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl text-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Reason for Liquidation</span>
              <p className="text-slate-700 italic">"{selectedRequest.reason}"</p>
            </div>

            {/* Workflow Step 1: PENDING -> Approve or Reject */}
            {selectedRequest.status === 'PENDING' && (
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">1. Admin Decision</h4>
                <p className="text-xs text-slate-500">
                  Review the investor's request. Approving will mark this asset for liquidation sale.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Rejection Reason (Required if rejecting)</label>
                    <textarea
                      rows={2}
                      placeholder="Specify why this request cannot be approved..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={handleReject}
                      disabled={isSubmitting}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                    >
                      <XCircle className="w-4 h-4 mr-1.5" /> Reject Request
                    </Button>
                    <Button
                      onClick={handleApprove}
                      disabled={isSubmitting}
                      className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve Liquidation
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Workflow Step 2: APPROVED -> Record Sale Price */}
            {selectedRequest.status === 'APPROVED' && (
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-purple-700">2. Record Livestock Sale Proceeds</h4>
                  <Badge variant="info">Status: Approved</Badge>
                </div>
                <p className="text-xs text-slate-500">
                  Enter the actual sale amount received when the livestock is sold. This becomes the official liquidation proceeds.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Actual Sale Price (₦)</label>
                    <input
                      type="number"
                      placeholder="e.g. 350000"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Sale Date</label>
                    <input
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Buyer / Reference (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Kano Cattle Market Buyer / Ref #089"
                      value={buyerRef}
                      onChange={(e) => setBuyerRef(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Sale Notes (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Direct abattoir sale"
                      value={saleNotes}
                      onChange={(e) => setSaleNotes(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleRecordSale}
                  disabled={isSubmitting}
                  className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs py-3 rounded-2xl"
                >
                  <Cow className="w-4 h-4 mr-1.5" /> Confirm Livestock Sold
                </Button>
              </div>
            )}

            {/* Workflow Step 3: SOLD -> Record Bank Credit & Upload Receipt */}
            {(selectedRequest.status === 'SOLD' || selectedRequest.status === 'AWAITING_BANK_CREDIT') && (
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800">3. Record Bank Credit & Upload Receipt</h4>
                  <Badge variant="accent">Official Sale Price: {formatCurrency(selectedRequest.salePrice || 0)}</Badge>
                </div>
                <p className="text-xs text-slate-500">
                  Enter the amount credited to the user's local bank account and attach the payment transfer receipt.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Credited Amount (₦)</label>
                    <input
                      type="number"
                      placeholder="e.g. 350000"
                      value={creditedAmount}
                      onChange={(e) => setCreditedAmount(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Credit Date</label>
                    <input
                      type="date"
                      value={creditDate}
                      onChange={(e) => setCreditDate(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Payment Reference</label>
                    <input
                      type="text"
                      placeholder="e.g. NIP/20260812/TRX-901"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Payment Method</label>
                    <input
                      type="text"
                      placeholder="e.g. Bank Transfer / Wire"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {parseFloat(creditedAmount) !== (selectedRequest.salePrice || 0) && (
                  <div>
                    <label className="text-xs font-bold text-amber-800 block mb-1">Adjustment Note (Required if credit differs from sale price)</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Deducted bank processing fee / transport allowance..."
                      value={adjustmentNote}
                      onChange={(e) => setAdjustmentNote(e.target.value)}
                      className="w-full p-3 bg-amber-50/50 border border-amber-200 rounded-2xl text-xs text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}

                {/* Upload Receipt */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Upload Payment Receipt</label>
                  <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-4 text-center transition-colors bg-slate-50/50">
                    {receiptPreview ? (
                      <div className="space-y-3">
                        <img 
                          src={receiptPreview} 
                          alt="Receipt Preview" 
                          className="max-h-48 mx-auto rounded-xl shadow-xs border border-slate-200 object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
                          className="text-xs text-red-600 font-bold hover:underline"
                        >
                          Remove Image & Select Another
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer space-y-2 block">
                        <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                        <span className="text-xs font-bold text-emerald-700 block">Click to upload bank transfer proof</span>
                        <span className="text-[10px] text-slate-400 block">PNG, JPG, or JPEG</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptFileChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleRecordBankCredit}
                  disabled={isSubmitting}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-3 rounded-2xl"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Record Bank Credit & Send Receipt to Investor
                </Button>
              </div>
            )}

            {/* Workflow Step 4: AWAITING_USER_CONFIRMATION -> Audit View */}
            {selectedRequest.status === 'AWAITING_USER_CONFIRMATION' && (
              <div className="space-y-4 border-t border-slate-100 pt-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900">Awaiting Investor Confirmation</h4>
                  <Badge variant="warning">In Progress</Badge>
                </div>
                <p className="text-xs text-indigo-700">
                  Payment receipt has been uploaded and sent to the investor. The transaction will automatically close once the investor reviews the receipt and confirms funds received in their bank account.
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block">Amount Credited</span>
                    <span className="font-black text-emerald-700 text-sm">{formatCurrency(selectedRequest.creditedAmount || 0)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">Payment Ref</span>
                    <span className="font-bold text-slate-800">{selectedRequest.paymentRef || 'N/A'}</span>
                  </div>
                </div>

                {selectedRequest.receiptUrl && (
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Payment Receipt</span>
                    <img 
                      src={selectedRequest.receiptUrl} 
                      alt="Uploaded Receipt" 
                      className="max-h-40 rounded-xl border border-slate-200 object-contain bg-white p-1"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Workflow Step 5: COMPLETED -> Audit History */}
            {selectedRequest.status === 'COMPLETED' && (
              <div className="space-y-4 border-t border-slate-100 pt-4 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900">Liquidation Completed</h4>
                  <Badge variant="success">Completed</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 font-bold block">Official Sale Price</span>
                    <span className="font-black text-slate-900 text-sm">{formatCurrency(selectedRequest.salePrice || 0)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">Credited to Investor</span>
                    <span className="font-black text-emerald-700 text-sm">{formatCurrency(selectedRequest.creditedAmount || 0)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">Confirmed By Investor</span>
                    <span className="font-medium text-slate-800">{formatDate(selectedRequest.userConfirmedAt || Date.now())}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">Payment Ref</span>
                    <span className="font-medium text-slate-800">{selectedRequest.paymentRef || 'N/A'}</span>
                  </div>
                </div>

                {selectedRequest.receiptUrl && (
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Attached Payment Proof</span>
                    <img 
                      src={selectedRequest.receiptUrl} 
                      alt="Receipt" 
                      className="max-h-40 rounded-xl border border-slate-200 object-contain bg-white p-1"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Rejection Details */}
            {selectedRequest.status === 'REJECTED' && (
              <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100 text-xs text-red-800 space-y-1">
                <span className="font-black uppercase text-[10px] text-red-500 block">Rejection Details</span>
                <p className="italic">"{selectedRequest.rejectionReason}"</p>
                <span className="text-[10px] text-slate-400 block pt-1">
                  Processed by: {selectedRequest.adminName || 'Admin'} on {formatDate(selectedRequest.adminDecisionAt || Date.now())}
                </span>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setSelectedRequest(null)}
                className="text-xs font-bold"
              >
                Close Window
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
