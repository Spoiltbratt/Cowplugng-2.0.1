import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db, sendNotification, notifyAdmins, logActivity } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { Card, Badge, Button, Input, Modal } from '../UI';
import { LoadingButton } from '../LoadingButton';
import { 
  MessageCircle, Plus, X, CalendarDays, Clock, Phone, Mail, 
  CircleHelp, Eye, TriangleAlert, CircleCheck, ChevronRight, ReceiptText, RefreshCw
} from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { ConsultationRequest, ConsultationRequestStatus, Invoice } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

interface InvestorSourcingManagerProps {
  onViewTab: (tab: string, invoiceId?: string) => void;
}

const getTimestampMs = (val: any): number => {
  if (!val) return Date.now();
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && 'seconds' in val) return val.seconds * 1000;
  if (typeof val === 'object' && typeof val.toMillis === 'function') return val.toMillis();
  return Date.now();
};

export const InvestorSourcingManager: React.FC<InvestorSourcingManagerProps> = ({ onViewTab }) => {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<ConsultationRequest[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate short refresh check / snapshot sync validation
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  };
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ConsultationRequest | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    preferredContactMethod: 'Phone' as 'Phone' | 'WhatsApp' | 'Email',
    preferredContactTime: '',
    livestockInterest: 'Cattle' as 'Cattle' | 'Rams' | 'Goats' | 'Multiple',
    notes: '',
    budgetRange: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        fullName: profile.displayName || profile.name || '',
        phoneNumber: profile.phoneNumber || ''
      }));
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    // Listen to consultation requests for the current user
    const qRequests = query(
      collection(db, 'consultationRequests'),
      where('userId', '==', profile.uid)
    );

    const unsubscribeRequests = onSnapshot(qRequests, (snapshot) => {
      const fetchedRequests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ConsultationRequest));

      // Sort in-memory to avoid requiring composite indexes
      fetchedRequests.sort((a, b) => {
        return getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt);
      });

      setRequests(fetchedRequests);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to consultation requests:", error);
      setLoading(false);
    });

    // Listen to invoices to link them
    const qInvoices = query(
      collection(db, 'invoices'),
      where('investorId', '==', profile.uid)
    );

    const unsubscribeInvoices = onSnapshot(qInvoices, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Invoice)));
    });

    return () => {
      unsubscribeRequests();
      unsubscribeInvoices();
    };
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || isSubmitting) return;

    setIsSubmitting(true);
    const now = Date.now();
    const newReqData = {
      userId: profile.uid,
      investorName: formData.fullName,
      email: profile.email,
      phoneNumber: formData.phoneNumber,
      preferredContactMethod: formData.preferredContactMethod,
      preferredContactTime: formData.preferredContactTime,
      livestockInterest: formData.livestockInterest,
      notes: formData.notes,
      budgetRange: formData.budgetRange,
      status: ConsultationRequestStatus.PENDING_CONTACT,
      createdAt: now
    };

    try {
      const docRef = await addDoc(collection(db, 'consultationRequests'), {
        ...newReqData,
        createdAt: serverTimestamp()
      });

      // Optimistically add to state
      setRequests(prev => [{ id: docRef.id, ...newReqData }, ...prev]);

      // Send self-notification
      await sendNotification(
        profile.uid,
        'Consultation Request Received',
        `Thank you. Your consultation request for ${formData.livestockInterest} sourcing has been received. A CowPlugNG representative will contact you soon.`,
        'Investment Updates',
        'SUCCESS'
      );

      // Notify admins
      await notifyAdmins(
        'New Sourcing Request',
        `Investor ${profile.displayName} has submitted a new sourcing request for ${formData.livestockInterest}.`,
        'Investment Updates',
        'INFO'
      );

      // Log activity
      await logActivity(
        profile.uid,
        profile.displayName || profile.email,
        'CONSULTATION_REQUEST_SUBMITTED',
        'CONSULTATION',
        'new',
        `Submitted a new sourcing request for ${formData.livestockInterest}`
      );

      setShowFormModal(false);
      // Reset parts of form
      setFormData(prev => ({
        ...prev,
        notes: '',
        budgetRange: '',
        preferredContactTime: ''
      }));

      alert('Thank you! Your sourcing request has been successfully submitted. We will contact you soon.');
    } catch (error) {
      console.error("Error creating sourcing request:", error);
      alert('Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeVariant = (status: ConsultationRequestStatus) => {
    switch (status) {
      case ConsultationRequestStatus.COMPLETED:
        return 'success';
      case ConsultationRequestStatus.CANCELLED:
        return 'danger';
      case ConsultationRequestStatus.CONTACTED:
      case ConsultationRequestStatus.QUOTATION_PREPARED:
      case ConsultationRequestStatus.INVOICE_SENT:
        return 'warning';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 font-sans">Livestock Sourcing Requests</h2>
          <p className="text-sm text-gray-500">Submit requests for custom livestock sourcing and track consultation progress.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleRefresh} 
            disabled={refreshing}
            className="text-xs font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button onClick={() => setShowFormModal(true)} className="shadow-lg shadow-brand-green/10">
            <Plus className="w-4 h-4 mr-1.5" /> New Sourcing Request
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sourcing Requests List */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Active Sourcing Requests" icon={MessageCircle} bodyClassName="space-y-4">
            {loading ? (
              <div className="py-12 text-center text-gray-500">Loading your sourcing requests...</div>
            ) : requests.filter(r => r.status !== ConsultationRequestStatus.COMPLETED && r.status !== ConsultationRequestStatus.CANCELLED).length === 0 ? (
              <div className="text-center py-16 border border-brand-border rounded-xl bg-brand-card/50">
                <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-40" />
                <h3 className="text-lg font-bold text-gray-900 mb-1">No Active Sourcing Requests</h3>
                <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed">
                  Have specific animal species or breed preferences? Submit a sourcing request to start.
                </p>
                <Button variant="outline" size="sm" onClick={() => setShowFormModal(true)} className="mt-4 text-xs">
                  Create Request Now
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-brand-border">
                {requests.filter(r => r.status !== ConsultationRequestStatus.COMPLETED && r.status !== ConsultationRequestStatus.CANCELLED).map((req) => {
                  const attachedInvoice = invoices.find(inv => inv.requestId === req.id);
                  return (
                    <div 
                      key={req.id} 
                      className={`py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0 cursor-pointer hover:bg-slate-50/50 px-2 rounded-xl transition-all ${selectedRequest?.id === req.id ? 'bg-slate-50 border border-brand-border' : ''}`}
                      onClick={() => {
                        setSelectedRequest(req);
                        setIsDetailModalOpen(true);
                      }}
                    >
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">{req.livestockInterest} Sourcing</span>
                          <Badge variant={getStatusBadgeVariant(req.status)} className="capitalize">
                            {req.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5 text-brand-green" />
                            {req.createdAt ? formatDate(req.createdAt) : 'Just now'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-brand-green" />
                            {req.preferredContactMethod} ({req.preferredContactTime || 'Anytime'})
                          </span>
                        </div>

                        {req.notes && (
                          <p className="text-xs text-slate-600 line-clamp-1 italic">
                            "{req.notes}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {attachedInvoice && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewTab('invoices');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 hover:bg-indigo-100/70 text-indigo-700 text-xs font-semibold transition-all"
                            title="An invoice has been generated for this request. Click to view."
                          >
                            <ReceiptText className="w-3.5 h-3.5" />
                            <span>View Invoice</span>
                          </button>
                        )}
                        <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform ${selectedRequest?.id === req.id ? 'rotate-90' : ''}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {requests.filter(r => r.status === ConsultationRequestStatus.COMPLETED || r.status === ConsultationRequestStatus.CANCELLED).length > 0 && (
            <Card title="Sourcing History (Completed & Past)" icon={CircleCheck} bodyClassName="space-y-4">
              <div className="divide-y divide-brand-border">
                {requests.filter(r => r.status === ConsultationRequestStatus.COMPLETED || r.status === ConsultationRequestStatus.CANCELLED).map((req) => {
                  const attachedInvoice = invoices.find(inv => inv.requestId === req.id);
                  return (
                    <div 
                      key={req.id} 
                      className={`py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0 last:pb-0 cursor-pointer hover:bg-slate-50/50 px-2 rounded-xl transition-all ${selectedRequest?.id === req.id ? 'bg-slate-50 border border-brand-border' : ''}`}
                      onClick={() => {
                        setSelectedRequest(req);
                        setIsDetailModalOpen(true);
                      }}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm">{req.livestockInterest} Sourcing</span>
                          <Badge variant={getStatusBadgeVariant(req.status)} className="capitalize">
                            {req.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{req.createdAt ? formatDate(req.createdAt) : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {attachedInvoice && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewTab('invoices');
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
                          >
                            <ReceiptText className="w-3.5 h-3.5" />
                            <span>Invoice</span>
                          </button>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Informational sidebar */}
        <div className="space-y-6">
          <Card title="Sourcing Protocol" icon={CircleHelp}>
            <div className="space-y-4 text-xs leading-relaxed text-slate-600">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-green/10 flex items-center justify-center text-brand-green font-bold shrink-0">1</div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-0.5">Submit Requirements</h4>
                  <p>Specify the animal type, breed interests, and optional remarks or preferences.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-green/10 flex items-center justify-center text-brand-green font-bold shrink-0">2</div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-0.5">Consultation Call</h4>
                  <p>A specialist will reach out via your preferred method to refine parameters and timelines.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-green/10 flex items-center justify-center text-brand-green font-bold shrink-0">3</div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-0.5">Invoice Generation</h4>
                  <p>A transparent pricing proposal is sent. Check your "My Invoices" tab to execute payment.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-green/10 flex items-center justify-center text-brand-green font-bold shrink-0">4</div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-0.5">Asset Onboarding</h4>
                  <p>After verifying payment, animals are sourced, tagged, and registered directly inside your active portfolio.</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Creation Modal Form */}
      {showFormModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm" onClick={() => setShowFormModal(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg relative z-10"
          >
            <Card 
              title="Request Sourcing Consultation" 
              icon={Plus}
              bodyClassName="p-6 sm:p-8 max-h-[80vh] overflow-y-auto pr-2"
              className="shadow-2xl relative"
            >
              <button 
                onClick={() => setShowFormModal(false)}
                className="absolute top-5 right-5 text-slate-600 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input 
                  label="Full Name" 
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
                
                <Input 
                  label="Phone Number" 
                  value={formData.phoneNumber}
                  onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block">Preferred Contact Method</label>
                    <select 
                      className="w-full h-11 bg-transparent border border-brand-border rounded-xl px-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all"
                      value={formData.preferredContactMethod}
                      onChange={e => setFormData({ ...formData, preferredContactMethod: e.target.value as any })}
                    >
                      <option value="Phone" className="text-gray-900 bg-brand-card">Phone</option>
                      <option value="WhatsApp" className="text-gray-900 bg-brand-card">WhatsApp</option>
                      <option value="Email" className="text-gray-900 bg-brand-card">Email</option>
                    </select>
                  </div>
                  
                  <Input 
                    label="Preferred Time to Contact" 
                    placeholder="e.g. Morning, 2pm - 5pm"
                    value={formData.preferredContactTime}
                    onChange={e => setFormData({ ...formData, preferredContactTime: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block">Livestock of Interest</label>
                    <select 
                      className="w-full h-11 bg-transparent border border-brand-border rounded-xl px-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all"
                      value={formData.livestockInterest}
                      onChange={e => setFormData({ ...formData, livestockInterest: e.target.value as any })}
                    >
                      <option value="Cattle" className="text-gray-900 bg-brand-card">Cattle (Cow/Bull)</option>
                      <option value="Rams" className="text-gray-900 bg-brand-card">Rams</option>
                      <option value="Goats" className="text-gray-900 bg-brand-card">Goats</option>
                      <option value="Multiple" className="text-gray-900 bg-brand-card">Multiple / Mix</option>
                    </select>
                  </div>

                  <Input 
                    label="Estimated Budget (Optional)" 
                    placeholder="e.g. ₦1,500,000"
                    value={formData.budgetRange}
                    onChange={e => setFormData({ ...formData, budgetRange: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block">Sourcing Specifications / Notes</label>
                  <textarea 
                    className="w-full bg-transparent border border-brand-border rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all min-h-[100px] resize-none"
                    placeholder="Describe breed interests, quantities, weight age requests, or farm target delivery notes..."
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1 h-11 text-xs" onClick={() => setShowFormModal(false)}>Cancel</Button>
                  <LoadingButton type="submit" className="flex-1 h-11 text-xs" isLoading={isSubmitting} loadingText="Submitting...">Submit Request</LoadingButton>
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
        title="Request Details"
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Investor:</span>
              <span className="font-semibold text-gray-900">{selectedRequest.investorName}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Status:</span>
              <Badge variant={getStatusBadgeVariant(selectedRequest.status)} className="capitalize">
                {selectedRequest.status}
              </Badge>
            </div>
            <div className="space-y-1">
              <span className="text-gray-500 text-sm">Notes:</span>
              <p className="text-sm bg-slate-50 p-3 rounded-xl border border-brand-border">{selectedRequest.notes || 'No notes provided.'}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
