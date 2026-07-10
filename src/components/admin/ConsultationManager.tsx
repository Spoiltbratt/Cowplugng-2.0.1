import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, Search, Filter, Plus, 
  CheckCircle, XCircle, Clock, FileText,
  User, Beef, ChevronRight, ArrowRight,
  TrendingUp, AlertCircle, Phone, MessageSquare, Mail, Edit3
} from 'lucide-react';
import { db, sendNotification } from '../../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, where, getDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { ConsultationRequest, ConsultationRequestStatus, UserProfile, UserRole, Invoice } from '../../types';
import { Card, Button, Badge, Input } from '../UI';
import { cn, formatDate, formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const ConsultationManager: React.FC = () => {
  const [requests, setRequests] = useState<ConsultationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ConsultationRequest | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [internalNote, setInternalNote] = useState('');
  
  // Invoice form state
  const [invoiceData, setInvoiceData] = useState({
    livestockDetails: '',
    quantity: 1,
    breed: '',
    expectedWeightAge: '',
    purchaseCost: 0,
    transportationCost: 0,
    veterinaryCost: 0,
    otherCharges: 0,
    bankName: '',
    accountName: '',
    accountNumber: '',
    paymentInstructions: 'Please perform a manual bank transfer to the details above and upload your receipt.'
  });

  useEffect(() => {
    const unsubReq = onSnapshot(query(collection(db, 'consultationRequests'), orderBy('createdAt', 'desc')), (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ConsultationRequest));
      setLoading(false);
    });

    return () => unsubReq();
  }, []);

  const handleUpdateStatus = async (id: string, status: ConsultationRequestStatus) => {
    await updateDoc(doc(db, 'consultationRequests', id), { status });
    
    // Notify user of status change
    if (selectedRequest) {
      let title = 'Consultation Status Updated';
      let message = `Your consultation request status has been updated to: ${status}.`;
      let category: any = 'Investment Updates';

      if (status === ConsultationRequestStatus.CONTACTED) {
        title = 'Investment Consultation: Contact Established';
        message = 'A CowPlugNG representative has contacted you regarding your livestock sourcing request. Check your email or phone for updates.';
      } else if (status === ConsultationRequestStatus.COMPLETED) {
        title = 'Sourcing Request Completed';
        message = 'Your livestock sourcing request has been successfully processed and completed.';
      }

      await sendNotification(
        selectedRequest.userId,
        title,
        message,
        category,
        'INFO'
      );
    }
  };

  const handleUpdateInternalNotes = async () => {
    if (!selectedRequest) return;
    await updateDoc(doc(db, 'consultationRequests', selectedRequest.id), { 
      internalNotes: internalNote 
    });
    alert('Internal notes updated');
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      const totalAmount = invoiceData.purchaseCost + invoiceData.transportationCost + invoiceData.veterinaryCost + invoiceData.otherCharges;
      
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
        bankDetails: {
          bankName: invoiceData.bankName,
          accountName: invoiceData.accountName,
          accountNumber: invoiceData.accountNumber
        },
        paymentInstructions: invoiceData.paymentInstructions,
        status: 'PENDING',
        createdAt: Date.now(),
        items: [
          { description: 'Livestock Purchase Cost', quantity: invoiceData.quantity, price: invoiceData.purchaseCost },
          { description: 'Transportation Cost', quantity: 1, price: invoiceData.transportationCost },
          { description: 'Veterinary Cost', quantity: 1, price: invoiceData.veterinaryCost },
          { description: 'Other Charges', quantity: 1, price: invoiceData.otherCharges }
        ]
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
      setShowInvoiceForm(false);
      setSelectedRequest(null);
      alert('Invoice generated successfully!');
    } catch (error) {
      console.error("Error generating invoice:", error);
      alert('Failed to generate invoice.');
    }
  };

  useEffect(() => {
    if (selectedRequest) {
      setInternalNote(selectedRequest.internalNotes || '');
    }
  }, [selectedRequest]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sourcing Requests</h2>
          <p className="text-sm text-gray-400">Manage livestock sourcing requests and generate invoices.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden">
            <div className="divide-y divide-brand-border">
              {requests.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No sourcing requests found.</p>
                </div>
              ) : (
                requests.map((req) => (
                  <div 
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className={cn(
                      "p-4 cursor-pointer hover:bg-brand-muted/50 transition-all flex items-center justify-between group",
                      selectedRequest?.id === req.id && "bg-brand-muted"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center">
                        <User className="w-5 h-5 text-brand-green" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{req.investorName}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">{req.livestockInterest} • {req.budgetRange}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-gray-500 font-mono">{formatDate(req.createdAt)}</p>
                        <div className="flex items-center justify-end gap-2 mt-1">
                          {req.preferredContactMethod === 'Phone' && <Phone className="w-3 h-3 text-blue-400" />}
                          {req.preferredContactMethod === 'WhatsApp' && <MessageSquare className="w-3 h-3 text-green-400" />}
                          {req.preferredContactMethod === 'Email' && <Mail className="w-3 h-3 text-purple-400" />}
                          <span className="text-[10px] text-gray-400 font-bold">{req.preferredContactMethod}</span>
                        </div>
                      </div>
                      <Badge variant={
                        req.status === ConsultationRequestStatus.COMPLETED ? 'success' : 
                        req.status === ConsultationRequestStatus.CANCELLED ? 'error' : 
                        req.status === ConsultationRequestStatus.PENDING_CONTACT ? 'warning' : 'info'
                      }>
                        {req.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div>
          <AnimatePresence mode="wait">
            {selectedRequest ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <Card title="Request Details" icon={User}>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="p-3 bg-brand-dark border border-brand-border rounded-lg">
                        <p className="text-[10px] uppercase text-gray-500 font-bold mb-2">Contact Info</p>
                        <div className="space-y-1">
                          <p className="text-xs text-white">Phone: {selectedRequest.phoneNumber}</p>
                          <p className="text-xs text-white">Email: {selectedRequest.email}</p>
                          <p className="text-xs text-brand-green">Preferred: {selectedRequest.preferredContactMethod} ({selectedRequest.preferredContactTime})</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Interest & Budget</p>
                        <p className="text-sm font-bold text-white">{selectedRequest.livestockInterest}</p>
                        <p className="text-xs text-brand-orange">{selectedRequest.budgetRange}</p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Notes</p>
                        <p className="text-xs text-gray-400 leading-relaxed italic">"{selectedRequest.notes || 'No notes provided'}"</p>
                      </div>

                      <div className="space-y-2 pt-4 border-t border-brand-border">
                        <p className="text-[10px] uppercase text-gray-500 font-bold">Internal Notes</p>
                        <textarea 
                          className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-xs text-white min-h-[80px] focus:outline-none focus:border-brand-green"
                          placeholder="Add internal notes about this consultation..."
                          value={internalNote}
                          onChange={(e) => setInternalNote(e.target.value)}
                        />
                        <Button variant="ghost" size="sm" className="w-full text-[10px]" onClick={handleUpdateInternalNotes}>
                          <Edit3 className="w-3 h-3 mr-2" /> Save Internal Notes
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4">
                      <p className="text-[10px] uppercase text-gray-500 font-bold mb-2">Update Status</p>
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
                        onClick={() => setShowInvoiceForm(true)}
                        disabled={selectedRequest.status === ConsultationRequestStatus.CANCELLED}
                      >
                        <Plus className="w-4 h-4 mr-2" /> Generate Sourcing Invoice
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-brand-border rounded-xl p-8 text-center text-gray-500">
                <div className="space-y-4">
                  <User className="w-12 h-12 mx-auto opacity-20" />
                  <p className="text-sm">Select a consultation request to manage and generate sourcing packages.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {showInvoiceForm && selectedRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <Card title={`Generate Sourcing Invoice for ${selectedRequest.investorName}`} icon={FileText}>
              <form onSubmit={handleGenerateInvoice} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Input 
                    label="Purchase Cost (₦)" 
                    type="number"
                    value={invoiceData.purchaseCost}
                    onChange={e => setInvoiceData({ ...invoiceData, purchaseCost: parseFloat(e.target.value) || 0 })}
                    required
                  />
                  <Input 
                    label="Transportation (₦)" 
                    type="number"
                    value={invoiceData.transportationCost}
                    onChange={e => setInvoiceData({ ...invoiceData, transportationCost: parseFloat(e.target.value) || 0 })}
                  />
                  <Input 
                    label="Veterinary (₦)" 
                    type="number"
                    value={invoiceData.veterinaryCost}
                    onChange={e => setInvoiceData({ ...invoiceData, veterinaryCost: parseFloat(e.target.value) || 0 })}
                  />
                  <Input 
                    label="Other Charges (₦)" 
                    type="number"
                    value={invoiceData.otherCharges}
                    onChange={e => setInvoiceData({ ...invoiceData, otherCharges: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="bg-brand-dark p-4 rounded-lg border border-brand-border">
                  <p className="text-sm font-bold text-brand-green flex justify-between">
                    <span>Total Amount:</span>
                    <span>{formatCurrency(invoiceData.purchaseCost + invoiceData.transportationCost + invoiceData.veterinaryCost + invoiceData.otherCharges)}</span>
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input 
                    label="Bank Name" 
                    value={invoiceData.bankName}
                    onChange={e => setInvoiceData({ ...invoiceData, bankName: e.target.value })}
                    required
                  />
                  <Input 
                    label="Account Name" 
                    value={invoiceData.accountName}
                    onChange={e => setInvoiceData({ ...invoiceData, accountName: e.target.value })}
                    required
                  />
                  <Input 
                    label="Account Number" 
                    value={invoiceData.accountNumber}
                    onChange={e => setInvoiceData({ ...invoiceData, accountNumber: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-300">Payment Instructions</label>
                  <textarea 
                    className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white min-h-[80px] focus:outline-none focus:border-brand-green"
                    value={invoiceData.paymentInstructions}
                    onChange={e => setInvoiceData({ ...invoiceData, paymentInstructions: e.target.value })}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowInvoiceForm(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1">Generate & Send Invoice</Button>
                </div>
              </form>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  );
};
