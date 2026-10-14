import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ClipboardList, Search, Filter, Plus, Trash, X,
  CheckCircle2, XCircle, Clock, FileText,
  User, ChevronRight, ArrowRight,
  TrendingUp, AlertCircle, Phone, MessageSquare, Mail, Edit3,
  CreditCard, ShieldCheck, ExternalLink, Sparkles
} from 'lucide-react';
import { CowIcon as Beef } from '../CowIcon';
import { db, sendNotification, logActivity } from '../../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, where, getDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { ConsultationRequest, ConsultationRequestStatus, UserProfile, UserRole, Invoice, PaymentReceipt, ChargeCategory, Livestock, LivestockStatus } from '../../types';
import { LoadingButton } from '../LoadingButton';
import { Card, Button, Badge, Input, Modal } from '../UI';
import { cn, formatDate, formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../lib/AuthContext';

export interface AdminStageInfo {
  stepIndex: number;
  stageName: string;
  badgeLabel: string;
  badgeVariant: 'default' | 'success' | 'warning' | 'info';
  description: string;
  nextAdminActionText: string;
}

export const ConsultationManager: React.FC = () => {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<ConsultationRequest[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ConsultationRequest | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [internalNote, setInternalNote] = useState('');
  
  // New Sourcing Workflow states
  const [isEditingRequest, setIsEditingRequest] = useState(false);
  const [editRequestData, setEditRequestData] = useState<Partial<ConsultationRequest>>({});
  const [requestLivestock, setRequestLivestock] = useState<Livestock[]>([]);
  const [isCreatingSlot, setIsCreatingSlot] = useState(false);
  
  // Search & filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  
  // Invoice form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invoiceData, setInvoiceData] = useState({
    livestockDetails: '',
    quantity: 1,
    breed: '',
    expectedWeightAge: '',
    bankName: 'CowPlugNG Escrow Bank',
    accountName: 'CowPlugNG Operations',
    accountNumber: '0123456789',
    paymentInstructions: 'Please perform a manual bank transfer to the details above and upload your receipt.'
  });

  const [customItems, setCustomItems] = useState<{ description: string; category: ChargeCategory; amount: number }[]>([
    { description: 'Livestock Purchase Cost', category: 'Livestock Purchase', amount: 500000 },
    { description: 'Transportation Cost', category: 'Transportation / Logistics', amount: 50000 },
    { description: 'Veterinary & Health Check', category: 'Veterinary / Health', amount: 20000 }
  ]);

  const handleAddCustomItem = () => {
    setCustomItems(prev => [...prev, { description: '', category: 'Farm Management', amount: 0 }]);
  };

  const handleRemoveCustomItem = (index: number) => {
    setCustomItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCustomItemChange = (index: number, field: string, value: any) => {
    setCustomItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  useEffect(() => {
    // Listen to consultation requests
    const unsubReq = onSnapshot(query(collection(db, 'consultationRequests'), orderBy('createdAt', 'desc')), (snapshot) => {
      const fetchedRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ConsultationRequest);
      setRequests(fetchedRequests);
      setLoading(false);
    });

    // Listen to invoices
    const unsubInv = onSnapshot(query(collection(db, 'invoices'), orderBy('createdAt', 'desc')), (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Invoice));
    });

    // Listen to payment receipts
    const unsubRec = onSnapshot(query(collection(db, 'paymentReceipts'), orderBy('createdAt', 'desc')), (snapshot) => {
      setReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PaymentReceipt));
    });

    return () => {
      unsubReq();
      unsubInv();
      unsubRec();
    };
  }, []);

  // Set default selected request
  useEffect(() => {
    if (requests.length > 0 && !selectedRequest) {
      setSelectedRequest(requests[0]);
    }
  }, [requests]);

  const handleUpdateStatus = async (id: string, status: ConsultationRequestStatus) => {
    try {
      await updateDoc(doc(db, 'consultationRequests', id), { status });
      
      if (profile) {
        await logActivity(
          profile.uid,
          profile.displayName || profile.email,
          'CONSULTATION_STATUS_UPDATE',
          'CONSULTATION',
          id,
          `Changed status of consultation request to ${status}`
        );
      }

      // Notify user of status change
      if (selectedRequest) {
        let title = 'Portfolio Sourcing Update';
        let message = `Your livestock acquisition request status has been updated to: ${status}.`;
        let category: any = 'Investment Updates';

        if (status === ConsultationRequestStatus.CONTACTED) {
          title = 'Investment Consultation: Contact Established';
          message = 'A CowPlugNG portfolio manager has contacted you regarding your asset sourcing request. Check your email or phone for updates.';
        } else if (status === ConsultationRequestStatus.COMPLETED) {
          title = 'Sourcing Phase Completed';
          message = 'Your livestock acquisition request has been successfully processed and the assets are now being onboarded to your portfolio.';
        }

        await sendNotification(
          selectedRequest.userId,
          title,
          message,
          category,
          'INFO'
        );
      }
    } catch (error) {
      console.error("Error updating consultation request status:", error);
    }
  };

  const handleUpdateInternalNotes = async () => {
    if (!selectedRequest) return;
    await updateDoc(doc(db, 'consultationRequests', selectedRequest.id), { 
      internalNotes: internalNote 
    });
    alert('Internal notes updated');
  };

  const handleEditRequest = async () => {
    if (!selectedRequest || !editRequestData) return;
    try {
      await updateDoc(doc(db, 'consultationRequests', selectedRequest.id), editRequestData);
      setSelectedRequest({ ...selectedRequest, ...editRequestData } as ConsultationRequest);
      setIsEditingRequest(false);
      alert('Request information updated!');
    } catch (error) {
      console.error("Error updating request:", error);
      alert('Failed to update request.');
    }
  };

  const handleCreateLivestockSlot = async () => {
    if (!selectedRequest) return;
    
    setIsCreatingSlot(true);
    try {
      // Find a paid invoice for this request to link to
      const reqInvoices = invoices.filter(inv => inv.requestId === selectedRequest.id && inv.status === 'PAID');
      const invoice = reqInvoices[0];
      
      const quantity = editRequestData.quantity || 1;
      const slotsToCreate = quantity;

      for (let i = 0; i < slotsToCreate; i++) {
        const livestockData = {
          tagNumber: `PENDING-${Date.now().toString().slice(-4)}-${i+1}`,
          breed: editRequestData.livestockInterest || 'Pending Verification',
          gender: 'M',
          age: 'Pending',
          weight: 'Pending',
          purchaseDate: Date.now(),
          purchasePrice: invoice ? (invoice.totalAmount / slotsToCreate) : 0,
          investmentPackage: selectedRequest.livestockInterest,
          ownerId: selectedRequest.userId,
          custodianId: 'CowPlug Farm HQ',
          feedSchedule: 'Awaiting Arrival',
          growthProgress: 'Onboarding',
          photos: [],
          status: LivestockStatus.AWAITING_ARRIVAL,
          healthStatus: 'GOOD',
          lastUpdated: Date.now(),
          type: selectedRequest.livestockInterest,
          sourcingRequestId: selectedRequest.id,
          invoiceId: invoice?.id || null,
          farm: 'Awaiting Arrival'
        };

        const docRef = await addDoc(collection(db, 'livestock'), livestockData);
        
        if (profile) {
          await logActivity(
            profile.uid,
            profile.displayName || profile.email,
            'LIVESTOCK_SLOT_CREATED',
            'LIVESTOCK',
            docRef.id,
            `Created livestock slot ${i+1}/${slotsToCreate} for ${selectedRequest.investorName}`
          );
        }
      }

      // Notify user
      await sendNotification(
        selectedRequest.userId,
        'Livestock Slots Created',
        `Your ${selectedRequest.livestockInterest} (${slotsToCreate} units) have been reserved and are awaiting arrival at the farm.`,
        'Investment Updates',
        'SUCCESS'
      );

      alert(`${slotsToCreate} livestock slot(s) created successfully!`);
    } catch (error) {
      console.error("Error creating livestock slot:", error);
      alert("Failed to create livestock slot.");
    } finally {
      setIsCreatingSlot(false);
    }
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const formattedItems = customItems.map(ci => ({
        description: ci.description.trim() || 'Custom Fee',
        category: ci.category || 'Other',
        quantity: 1,
        unitPrice: ci.amount,
        price: ci.amount,
        amount: ci.amount
      }));

      const totalAmount = formattedItems.reduce((sum, item) => sum + item.amount, 0);
      
      const invoiceRef = await addDoc(collection(db, 'invoices'), {
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        requestId: selectedRequest.id,
        investorId: selectedRequest.userId,
        investorName: selectedRequest.investorName,
        sourcingDetails: {
          animalType: selectedRequest.livestockInterest,
          breed: invoiceData.breed,
          quantity: invoiceData.quantity,
          weightAge: invoiceData.expectedWeightAge
        },
        totalAmount,
        subtotal: totalAmount,
        bankDetails: {
          bankName: invoiceData.bankName,
          accountName: invoiceData.accountName,
          accountNumber: invoiceData.accountNumber
        },
        paymentInstructions: invoiceData.paymentInstructions,
        status: 'PENDING',
        createdAt: Date.now(),
        items: formattedItems
      });

      // Notify user
      await sendNotification(
        selectedRequest.userId,
        'New Invoice Generated',
        `A sourcing package invoice has been generated for your consultation. Total Amount: ${formatCurrency(totalAmount)}`,
        'Payment Confirmations',
        'WARNING'
      );

      await handleUpdateStatus(selectedRequest.id, ConsultationRequestStatus.INVOICE_SENT);
      
      if (profile) {
        await logActivity(
          profile.uid,
          profile.displayName || profile.email,
          'INVOICE_GENERATED',
          'INVOICE',
          invoiceRef.id,
          `Generated acquisition invoice for ${selectedRequest.investorName} - Amount: ${formatCurrency(totalAmount)}`
        );
      }

      setShowInvoiceForm(false);
      setSelectedRequest(null);
      alert('Invoice generated successfully!');
    } catch (error) {
      console.error("Error generating invoice:", error);
      alert('Failed to generate invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (selectedRequest) {
      setInternalNote(selectedRequest.internalNotes || '');
      setEditRequestData(selectedRequest);
      
      // Fetch associated livestock
      const q = query(
        collection(db, 'livestock'), 
        where('sourcingRequestId', '==', selectedRequest.id)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setRequestLivestock(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Livestock)));
      });
      return () => unsubscribe();
    }
  }, [selectedRequest]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sourcing & Acquisitions</h2>
          <p className="text-sm text-slate-600">Manage investor sourcing requests and generate acquisition invoices.</p>
        </div>
      </div>

      {/* REQUESTS LIST WITH FILTERS & SEARCH */}
      <Card className="overflow-hidden">
        {/* Search & Filter Controls */}
        <div className="p-4 border-b border-brand-border bg-slate-50/50 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search investor, livestock, budget..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'ALL', label: 'All Requests' },
              { id: ConsultationRequestStatus.PENDING_CONTACT, label: 'Pending' },
              { id: ConsultationRequestStatus.IN_PROGRESS, label: 'Sourcing' },
              { id: ConsultationRequestStatus.INVOICE_SENT, label: 'Invoice Sent' },
              { id: ConsultationRequestStatus.COMPLETED, label: 'Completed' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-all",
                  filterStatus === tab.id
                    ? "bg-brand-green text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Requests List */}
        <div className="divide-y divide-brand-border max-h-[600px] overflow-y-auto">
          {(() => {
            const filtered = requests.filter(req => {
              const matchesSearch = 
                (req.investorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (req.livestockInterest || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (req.budgetRange || '').toLowerCase().includes(searchTerm.toLowerCase());
              
              const matchesFilter = filterStatus === 'ALL' || req.status === filterStatus;
              return matchesSearch && matchesFilter;
            });

            if (filtered.length === 0) {
              return (
                <div className="p-10 text-center text-gray-500">
                  <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-20 text-slate-400" />
                  <p className="text-xs font-bold text-slate-600">No requests match criteria.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Try resetting search or filter tabs.</p>
                </div>
              );
            }

            return filtered.map((req) => {
              const reqInvoices = invoices.filter(inv => inv.consultationRequestId === req.id || inv.investorId === req.userId);
              const isPaid = reqInvoices.some(inv => inv.status === 'PAID') || req.status === ConsultationRequestStatus.COMPLETED;
              const isInvoiceSent = reqInvoices.length > 0 || req.status === ConsultationRequestStatus.INVOICE_SENT;
              
              let stageNum = 1;
              if (req.status === ConsultationRequestStatus.COMPLETED || isPaid) stageNum = 5;
              else if (reqInvoices.some(inv => inv.status === 'PENDING')) stageNum = 4;
              else if (isInvoiceSent) stageNum = 3;
              else if (req.status === ConsultationRequestStatus.IN_PROGRESS || req.status === ConsultationRequestStatus.CONTACTED) stageNum = 2;

              return (
                <div 
                  key={req.id}
                  onClick={() => setSelectedRequest(req)}
                  className={cn(
                    "p-4 cursor-pointer hover:bg-emerald-50/40 transition-all flex items-start justify-between border-l-4",
                    selectedRequest?.id === req.id 
                      ? "bg-emerald-50/80 border-emerald-600" 
                      : "bg-white border-transparent"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5",
                      stageNum === 5 ? "bg-emerald-100 text-emerald-800 border border-emerald-300" :
                      stageNum >= 3 ? "bg-amber-100 text-amber-800 border border-amber-300" :
                      "bg-slate-100 text-slate-700 border border-slate-200"
                    )}>
                      {stageNum}/5
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-900 leading-tight">{req.investorName}</p>
                      <p className="text-[11px] font-semibold text-emerald-800">{req.livestockInterest}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{req.budgetRange} • {formatDate(req.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Badge variant={
                      req.status === ConsultationRequestStatus.COMPLETED ? 'success' : 
                      req.status === ConsultationRequestStatus.CANCELLED ? 'error' : 
                      req.status === ConsultationRequestStatus.PENDING_CONTACT ? 'warning' : 'info'
                    }>
                      {req.status}
                    </Badge>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {req.preferredContactMethod}
                    </span>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </Card>

      {/* SOURCING REQUEST DETAIL MODAL POPUP OVERLAY */}
      {selectedRequest && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setSelectedRequest(null)}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col border border-slate-200"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white sticky top-0 z-20">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/50">
                  Sourcing Request Details
                </span>
                <h3 className="text-lg font-extrabold text-white mt-1">Request ID: #{(selectedRequest.id || '').slice(0, 8)}</h3>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-4 sm:p-6 space-y-6">
              {/* Header Info Card / Edit Form */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-5 rounded-xl shadow-md">
                {!isEditingRequest ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                      <div>
                        <h3 className="text-xl font-extrabold text-white">{selectedRequest.investorName}</h3>
                        <p className="text-xs text-slate-300 mt-0.5">{selectedRequest.email} • {selectedRequest.phoneNumber}</p>
                      </div>

                      <div className="flex flex-col sm:items-end">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Target Budget</span>
                        <span className="text-lg font-black text-emerald-400 font-mono">{selectedRequest.budgetRange}</span>
                        <span className="text-[11px] text-slate-300 font-medium">Interest: {selectedRequest.livestockInterest} (Qty: {selectedRequest.quantity || 1})</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-white/5 border border-white/10 p-2.5 rounded-lg">
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Contact Preferences</span>
                        <span className="text-white font-semibold">{selectedRequest.preferredContactMethod}</span>
                        <span className="text-slate-300 text-[11px] block">Time: {selectedRequest.preferredContactTime}</span>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-2.5 rounded-lg">
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Investor Request Notes</span>
                        <p className="text-slate-300 text-[11px] italic">"{selectedRequest.notes || 'No custom notes provided'}"</p>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10"
                        onClick={() => setIsEditingRequest(true)}
                      >
                        <Edit3 className="w-3 h-3 mr-1.5" /> Edit Request Information
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Edit Request Details</h4>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditingRequest(false)} className="h-6 w-6 p-0 text-white hover:bg-white/10">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Livestock Interest</label>
                        <select 
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          value={editRequestData.livestockInterest}
                          onChange={(e) => setEditRequestData({ ...editRequestData, livestockInterest: e.target.value as any })}
                        >
                          <option value="Cattle">Cattle</option>
                          <option value="Rams">Rams</option>
                          <option value="Goats">Goats</option>
                          <option value="Multiple">Multiple</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Quantity</label>
                        <input 
                          type="number"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          value={editRequestData.quantity || 1}
                          onChange={(e) => setEditRequestData({ ...editRequestData, quantity: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Budget Range</label>
                        <input 
                          type="text"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          value={editRequestData.budgetRange}
                          onChange={(e) => setEditRequestData({ ...editRequestData, budgetRange: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Contact Method</label>
                        <select 
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          value={editRequestData.preferredContactMethod}
                          onChange={(e) => setEditRequestData({ ...editRequestData, preferredContactMethod: e.target.value as any })}
                        >
                          <option value="Phone">Phone</option>
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="Email">Email</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Request Notes</label>
                      <textarea 
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[60px]"
                        value={editRequestData.notes || ''}
                        onChange={(e) => setEditRequestData({ ...editRequestData, notes: e.target.value })}
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="primary" className="flex-1 bg-emerald-600 hover:bg-emerald-500" onClick={handleEditRequest}>
                        Save Changes
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10" onClick={() => setIsEditingRequest(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* 5-STAGE PROGRESS TRACKER */}
              {(() => {
                const reqInvoices = invoices.filter(inv => inv.consultationRequestId === selectedRequest.id || inv.investorId === selectedRequest.userId);
                const reqReceipts = receipts.filter(r => r.investorId === selectedRequest.userId || reqInvoices.some(inv => inv.id === r.invoiceId));
                
                const hasPaidInvoice = reqInvoices.some(inv => inv.status === 'PAID') || selectedRequest.status === ConsultationRequestStatus.COMPLETED;
                const hasPendingInvoice = reqInvoices.some(inv => inv.status === 'PENDING');
                const hasInvoice = reqInvoices.length > 0 || selectedRequest.status === ConsultationRequestStatus.INVOICE_SENT;
                const isSourcing = selectedRequest.status === ConsultationRequestStatus.IN_PROGRESS || selectedRequest.status === ConsultationRequestStatus.CONTACTED;

                let currentStageIndex = 0;
                if (hasPaidInvoice) currentStageIndex = 4;
                else if (reqReceipts.length > 0 || hasPendingInvoice) currentStageIndex = 3;
                else if (hasInvoice) currentStageIndex = 2;
                else if (isSourcing) currentStageIndex = 1;

                const STAGES = [
                  { num: 1, title: 'Request Submitted', desc: 'Investor submitted livestock specifications & budget', icon: ClipboardList },
                  { num: 2, title: 'Sourcing & Costing', desc: 'Admin identifying verified farms, breeds & logistics costs', icon: Search },
                  { num: 3, title: 'Invoice Issued', desc: 'Itemized acquisition invoice generated for investor review', icon: FileText },
                  { num: 4, title: 'Payment Verification', desc: 'Investor bank transfer receipt received / under review', icon: CreditCard },
                  { num: 5, title: 'Confirmed & Allocated', desc: 'Payment verified, livestock added to investor portfolio', icon: ShieldCheck },
                ];

                return (
                  <Card title="Sourcing & Acquisition Stage Progress" icon={TrendingUp}>
                    <div className="space-y-6">
                      <div className="relative pt-2">
                        <div className="absolute top-7 left-6 right-6 h-1 bg-slate-200 rounded-full -z-0 hidden md:block">
                          <div 
                            className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                            style={{ width: `${(currentStageIndex / (STAGES.length - 1)) * 100}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative z-10">
                          {STAGES.map((stg, idx) => {
                            const isCompleted = idx < currentStageIndex;
                            const isCurrent = idx === currentStageIndex;

                            return (
                              <div 
                                key={stg.num}
                                className={cn(
                                  "p-3 rounded-xl border text-center flex md:flex-col items-center gap-3 transition-all",
                                  isCurrent
                                    ? "bg-emerald-50 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20"
                                    : isCompleted
                                    ? "bg-slate-50 border-slate-200 text-slate-700"
                                    : "bg-white border-slate-200 opacity-60"
                                )}
                              >
                                <div className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all",
                                  isCurrent 
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-4 ring-emerald-100" 
                                    : isCompleted 
                                    ? "bg-emerald-700 text-white" 
                                    : "bg-slate-200 text-slate-600"
                                )}>
                                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : stg.num}
                                </div>

                                <div className="text-left md:text-center space-y-0.5">
                                  <p className={cn(
                                    "text-xs font-bold leading-tight",
                                    isCurrent ? "text-emerald-900" : isCompleted ? "text-slate-800" : "text-slate-500"
                                  )}>
                                    {stg.title}
                                  </p>
                                  <p className="text-[10px] text-slate-500 leading-tight hidden md:block">
                                    {stg.desc}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* STAGE ACTION TOOLBAR & QUICK UPDATE */}
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-emerald-600" />
                            <span>Current Pipeline Status: <strong className="text-emerald-700">{selectedRequest.status}</strong></span>
                          </span>

                          <span className="text-[11px] text-slate-500">
                            Stage {currentStageIndex + 1} of 5
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant={selectedRequest.status === ConsultationRequestStatus.IN_PROGRESS ? 'outline' : 'primary'}
                            onClick={() => handleUpdateStatus(selectedRequest.id, ConsultationRequestStatus.IN_PROGRESS)}
                            className="text-xs h-9 font-semibold"
                          >
                            <Clock className="w-3.5 h-3.5 mr-1.5" />
                            <span>Mark Sourcing in Progress</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setInvoiceData(prev => ({
                                ...prev,
                                livestockDetails: selectedRequest.livestockInterest,
                                breed: selectedRequest.livestockInterest.split(' ')[0] || 'Cattle',
                                quantity: editRequestData.quantity || 1,
                              }));
                              setShowInvoiceForm(true);
                            }}
                            className="text-xs h-9 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                            <span>Generate Acquisition Invoice</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(selectedRequest.id, ConsultationRequestStatus.COMPLETED)}
                            className="text-xs h-9 font-semibold text-emerald-800 border-emerald-300 hover:bg-emerald-100/50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                            <span>Mark Completed</span>
                          </Button>

                          {/* CREATE LIVESTOCK SLOT ACTION */}
                          {(currentStageIndex >= 3 || hasPaidInvoice) && (
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={isCreatingSlot || requestLivestock.length >= (editRequestData.quantity || 1)}
                              onClick={handleCreateLivestockSlot}
                              className="text-xs h-9 font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20"
                            >
                              {isCreatingSlot ? (
                                <Clock className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <Plus className="w-3.5 h-3.5 mr-1.5" />
                              )}
                              <span>Create Livestock Slot</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* ASSOCIATED LIVESTOCK SLOTS */}
                      {requestLivestock.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                            <Beef className="w-4 h-4 text-emerald-600" />
                            <span>Allocated Livestock Slots ({requestLivestock.length})</span>
                          </h4>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {requestLivestock.map(livestock => (
                              <div key={livestock.id} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                                    <Beef className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-900">{livestock.type} ({livestock.breed})</p>
                                    <p className="text-[10px] text-slate-500 font-mono">{livestock.tagNumber}</p>
                                  </div>
                                </div>
                                <Badge variant={livestock.status === LivestockStatus.AWAITING_ARRIVAL ? 'warning' : 'success'}>
                                  {livestock.status === LivestockStatus.AWAITING_ARRIVAL ? 'Awaiting Arrival' : 'Active'}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CONNECTED INVOICES & PAYMENTS SUMMARY */}
                      <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-emerald-600" />
                          <span>Generated Acquisition Invoices ({reqInvoices.length})</span>
                        </h4>

                        {reqInvoices.length === 0 ? (
                          <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                            <span>No invoice generated for this request yet. Click "Generate Acquisition Invoice" to send itemized costing to the investor.</span>
                            <Button size="sm" onClick={() => setShowInvoiceForm(true)} className="shrink-0 ml-3 text-xs">
                              Generate Now
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {reqInvoices.map((inv) => (
                              <div key={inv.id} className="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900">{inv.livestockDetails}</span>
                                    <Badge variant={inv.status === 'PAID' ? 'success' : 'warning'}>
                                      {inv.status}
                                    </Badge>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    Quantity: {inv.quantity} • Breed: {inv.breed} • Date: {formatDate(inv.createdAt)}
                                  </p>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <span className="text-xs text-slate-500 block">Total Amount</span>
                                    <span className="text-sm font-extrabold text-emerald-700 font-mono">
                                      {formatCurrency(inv.totalAmount || inv.amount || 0)}
                                    </span>
                                  </div>

                                  {inv.status === 'PENDING' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        if (confirm("Confirm payment received for this invoice?")) {
                                          try {
                                            await updateDoc(doc(db, 'invoices', inv.id), { status: 'PAID' });
                                            
                                            // Automatically record spending ledger entries
                                            if (inv.items && Array.isArray(inv.items) && inv.items.length > 0) {
                                              for (const item of inv.items) {
                                                await addDoc(collection(db, 'spendingLedger'), {
                                                  userId: inv.investorId,
                                                  invoiceId: inv.id,
                                                  invoiceNumber: inv.invoiceNumber || inv.id,
                                                  category: item.category || 'Other',
                                                  description: item.description || 'Consultation Service',
                                                  quantity: item.quantity || 1,
                                                  unitPrice: item.unitPrice,
                                                  amount: item.amount,
                                                  currency: 'NGN',
                                                  status: 'CONFIRMED',
                                                  date: Date.now(),
                                                  createdAt: serverTimestamp()
                                                });
                                              }
                                            } else {
                                              // Fallback if no items
                                              await addDoc(collection(db, 'spendingLedger'), {
                                                userId: inv.investorId,
                                                invoiceId: inv.id,
                                                invoiceNumber: inv.invoiceNumber || inv.id,
                                                category: 'Other',
                                                description: inv.livestockDetails || 'Livestock Purchase',
                                                quantity: 1,
                                                unitPrice: inv.totalAmount || 0,
                                                amount: inv.totalAmount || 0,
                                                currency: 'NGN',
                                                status: 'CONFIRMED',
                                                date: Date.now(),
                                                createdAt: serverTimestamp()
                                              });
                                            }

                                            await handleUpdateStatus(selectedRequest.id, ConsultationRequestStatus.COMPLETED);
                                            alert("Invoice marked as PAID and request completed!");
                                          } catch (err) {
                                            console.error("Error processing payment:", err);
                                            alert("Failed to process payment and update ledger.");
                                          }
                                        }
                                      }}
                                      className="text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                                    >
                                      Verify & Mark Paid
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* CONNECTED PAYMENT RECEIPTS */}
                      {reqReceipts.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-emerald-600" />
                            <span>Investor Payment Proof Receipts ({reqReceipts.length})</span>
                          </h4>

                          <div className="space-y-2">
                            {reqReceipts.map((rec) => (
                              <div key={rec.id} className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                  <span className="text-xs font-bold text-slate-900 block">Bank Transfer Reference: {rec.paymentReference || 'N/A'}</span>
                                  <span className="text-[11px] text-slate-600">
                                    Bank: {rec.bankName || 'N/A'} • Uploaded: {formatDate(rec.createdAt)}
                                  </span>
                                  {rec.notes && <p className="text-[11px] text-slate-500 italic mt-1 font-serif">"{rec.notes}"</p>}
                                </div>

                                <div className="text-right">
                                  <span className="text-xs text-slate-500 block">Reported Amount</span>
                                  <span className="text-sm font-extrabold text-slate-900 font-mono">{formatCurrency(rec.amountPaid || 0)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* INTERNAL PORTFOLIO NOTES */}
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                          Internal Portfolio Admin Notes
                        </label>
                        <textarea 
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-900 min-h-[70px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          placeholder="Add notes on sourcing farms, vendor contacts, transport arrangements..."
                          value={internalNote}
                          onChange={(e) => setInternalNote(e.target.value)}
                        />
                        <div className="flex justify-end">
                          <Button size="sm" variant="outline" className="text-xs font-semibold" onClick={handleUpdateInternalNotes}>
                            <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Save Notes
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })()}
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {showInvoiceForm && selectedRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg relative z-10"
          >
            <Card 
              title={`Generate Sourcing Invoice for ${selectedRequest.investorName}`}
              icon={FileText}
              bodyClassName="p-6 sm:p-8 max-h-[80vh] overflow-y-auto pr-2"
              className="shadow-2xl relative"
            >
              <button 
                onClick={() => setShowInvoiceForm(false)}
                className="absolute top-5 right-5 text-slate-600 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <form onSubmit={handleGenerateInvoice} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input 
                    label="Livestock Details" 
                    placeholder="e.g. White Fulani Cows"
                    value={invoiceData.livestockDetails}
                    onChange={e => setInvoiceData({ ...invoiceData, livestockDetails: e.target.value })}
                    required
                  />
                  <Input 
                    label="Breed" 
                    placeholder="e.g. White Fulani"
                    value={invoiceData.breed}
                    onChange={e => setInvoiceData({ ...invoiceData, breed: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input 
                    label="Quantity" 
                    type="number"
                    value={invoiceData.quantity}
                    onChange={e => setInvoiceData({ ...invoiceData, quantity: parseInt(e.target.value) || 0 })}
                    required
                  />
                  <Input 
                    label="Expected Weight/Age" 
                    placeholder="e.g. 250kg / 2 years"
                    value={invoiceData.expectedWeightAge}
                    onChange={e => setInvoiceData({ ...invoiceData, expectedWeightAge: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-4 border-t border-brand-border pt-4 mt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-brand-green uppercase tracking-wider">Invoice Cost Items</h4>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddCustomItem} className="flex items-center gap-1.5 font-bold text-xs h-8">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Item</span>
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {customItems.map((item, idx) => (
                      <div key={idx} className="flex flex-col gap-3 bg-slate-50 border border-slate-200/80 p-3 rounded-xl relative">
                        <Input 
                          label="Title / Description" 
                          placeholder="e.g. Livestock Purchase Cost" 
                          value={item.description}
                          onChange={(e) => handleCustomItemChange(idx, 'description', e.target.value)}
                          required
                          className="text-xs"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-700 uppercase">Category</label>
                            <select
                              value={item.category || 'Other'}
                              onChange={(e) => handleCustomItemChange(idx, 'category', e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            >
                              <option value="Livestock Purchase">Livestock Purchase</option>
                              <option value="Feed & Supplement">Feed & Supplement</option>
                              <option value="Farm Management">Farm Management</option>
                              <option value="Veterinary / Health">Veterinary / Health</option>
                              <option value="Medication & Drugs">Medication & Drugs</option>
                              <option value="Transportation / Logistics">Transportation / Logistics</option>
                              <option value="Infrastructure / Farm Construction">Infrastructure / Farm Construction</option>
                              <option value="Equipment">Equipment</option>
                              <option value="Land / Farm Operations">Land / Farm Operations</option>
                              <option value="Insurance">Insurance</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <Input 
                            label="Amount (₦)" 
                            type="number"
                            min="0"
                            placeholder="500000"
                            value={item.amount || ''}
                            onChange={(e) => handleCustomItemChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                            required
                            className="text-xs"
                          />
                        </div>
                        {customItems.length > 1 && (
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleRemoveCustomItem(idx)}
                            className="absolute -top-2 -right-2 p-1.5 h-7 w-7 flex items-center justify-center text-red-500 hover:bg-red-500/10 border-red-500/20 rounded-full"
                            title="Remove Item"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-brand-border">
                  <p className="text-sm font-bold text-brand-green flex justify-between">
                    <span>Total Amount:</span>
                    <span>{formatCurrency(customItems.reduce((sum, item) => sum + (item.amount || 0), 0))}</span>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input 
                    label="Bank Name" 
                    value={invoiceData.bankName}
                    onChange={e => setInvoiceData({ ...invoiceData, bankName: e.target.value })}
                    required
                  />
                  <Input 
                    label="Account Number" 
                    value={invoiceData.accountNumber}
                    onChange={e => setInvoiceData({ ...invoiceData, accountNumber: e.target.value })}
                    required
                  />
                </div>
                <Input 
                  label="Account Name" 
                  value={invoiceData.accountName}
                  onChange={e => setInvoiceData({ ...invoiceData, accountName: e.target.value })}
                  required
                />

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block">Payment Instructions</label>
                  <textarea 
                    className="w-full bg-transparent border border-brand-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all min-h-[80px] resize-none"
                    value={invoiceData.paymentInstructions}
                    onChange={e => setInvoiceData({ ...invoiceData, paymentInstructions: e.target.value })}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1 h-11 text-xs" onClick={() => setShowInvoiceForm(false)}>Cancel</Button>
                  <LoadingButton type="submit" className="flex-1 h-11 text-xs" isLoading={isSubmitting} loadingText="Generating...">Generate & Send Invoice</LoadingButton>
                </div>
              </form>
            </Card>
          </motion.div>
        </div>
      )}
      
      {/* Details Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Sourcing Request Details"
        subtitle="Investor Consultation & Portfolio Management"
      >
        {selectedRequest && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 border border-brand-border rounded-lg">
                <p className="text-[10px] uppercase text-gray-500 font-bold mb-2">Investor Contact Info</p>
                <div className="space-y-1">
                  <p className="text-xs text-slate-800">Phone: {selectedRequest.phoneNumber}</p>
                  <p className="text-xs text-slate-800">Email: {selectedRequest.email}</p>
                  <p className="text-xs text-brand-green">Preferred: {selectedRequest.preferredContactMethod} ({selectedRequest.preferredContactTime})</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Asset Interest & Budget</p>
                <p className="text-sm font-bold text-slate-800">{selectedRequest.livestockInterest}</p>
                <p className="text-xs text-brand-orange">{selectedRequest.budgetRange}</p>
              </div>

              <div>
                <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Investor Notes</p>
                <p className="text-xs text-slate-600 leading-relaxed italic">"{selectedRequest.notes || 'No notes provided'}"</p>
              </div>

              <div className="space-y-2 pt-4 border-t border-brand-border">
                <p className="text-[10px] uppercase text-gray-500 font-bold">Internal Portfolio Notes</p>
                <textarea 
                  className="w-full bg-white border border-brand-border rounded-lg px-3 py-2 text-xs text-slate-900 min-h-[80px] focus:outline-none focus:border-brand-green"
                  placeholder="Add internal notes about this sourcing consultation..."
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                />
                <Button variant="ghost" size="sm" className="w-full text-[10px]" onClick={handleUpdateInternalNotes}>
                  <Edit3 className="w-3 h-3 mr-2" /> Save Portfolio Notes
                </Button>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <p className="text-[10px] uppercase text-gray-500 font-bold mb-2">Update Sourcing Status</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(ConsultationRequestStatus).map(status => (
                  <Button 
                    key={status}
                    variant={selectedRequest.status === status ? 'primary' : 'outline'}
                    size="sm"
                    className="text-[10px] h-8"
                    onClick={() => handleUpdateStatus(selectedRequest.id, status)}
                  >
                    {status}
                  </Button>
                ))}
              </div>

              <Button 
                className="w-full mt-4" 
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setShowInvoiceForm(true);
                }}
                disabled={selectedRequest.status === ConsultationRequestStatus.CANCELLED}
              >
                <Plus className="w-4 h-4 mr-2" /> Generate Acquisition Invoice
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
