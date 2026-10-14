import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { Invoice, PaymentReceipt, PaymentStatus } from '../../types';
import { Card, Badge, Button } from '../UI';
import { ReceiptText, Eye, ArrowLeftRight, Clock, TriangleAlert, CircleCheck, Download, FileText, CreditCard, FileCheck, AlertCircle } from 'lucide-react';
import { cn, formatDate, formatCurrency } from '../../lib/utils';
import { Modal } from '../UI';
import { CowPlugInvoice } from '../CowPlugInvoice';

interface MyInvoicesProps {
  onViewTab?: (tab: string, invoiceId?: string) => void;
}

export const MyInvoices: React.FC<MyInvoicesProps> = ({ onViewTab }) => {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    
    const qInvoices = query(collection(db, 'invoices'), where('investorId', '==', profile.uid));
    const unsubInvoices = onSnapshot(qInvoices, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Invoice));
      if (receipts.length > 0 || snapshot.empty) setLoading(false);
    });

    const qReceipts = query(collection(db, 'paymentReceipts'), where('investorId', '==', profile.uid));
    const unsubReceipts = onSnapshot(qReceipts, (snapshot) => {
      setReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PaymentReceipt));
      setLoading(false);
    });

    return () => {
      unsubInvoices();
      unsubReceipts();
    };
  }, [profile]);

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewModalOpen(true);
  };

  const getReceiptForInvoice = (invoiceId: string) => {
    return receipts.find(r => r.invoiceId === invoiceId);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">My Invoices</h2>
        <p className="text-sm text-gray-500">View and manage your billing statements.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading your invoices...</div>
        ) : invoices.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed border">
            <FileText className="w-12 h-12 text-slate-600 mb-4 opacity-40" />
            <h3 className="text-lg font-bold text-gray-900">No Invoices Found</h3>
            <p className="text-gray-500 max-w-sm mt-2 text-sm leading-relaxed">You don't have any invoices at the moment. Invoices will appear here when management processes your sourcing requests.</p>
          </Card>
        ) : (
          invoices.map(invoice => (
            <Card key={invoice.id} className="hover:border-brand-green/30 transition-all duration-300">
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-brand-muted border border-brand-border rounded-xl">
                      <FileText className="w-8 h-8 text-brand-green" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-bold text-gray-900">{invoice.invoiceNumber}</span>
                        <Badge variant={
                          invoice.status === 'PAID' ? 'success' : 
                          invoice.status === 'CANCELLED' ? 'error' : 'warning'
                        } className="px-2.5 py-0.5">
                          {invoice.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500">Issued on {formatDate(invoice.createdAt)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-1 gap-4 md:text-right">
                    <div>
                      <p className="text-[10px] uppercase text-slate-600 font-bold tracking-wider mb-0.5">Total Amount</p>
                      <p className="text-xl font-bold text-brand-green">{formatCurrency(invoice.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-600 font-bold tracking-wider mb-0.5">Due Date</p>
                      <p className={cn("text-xs font-bold", Date.now() > invoice.dueDate && invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' ? "text-red-500" : "text-gray-800")}>
                        {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 md:flex-none text-xs h-10 px-4 font-bold" onClick={() => handleViewInvoice(invoice)}>
                      <Eye className="w-4 h-4 mr-1.5" /> View
                    </Button>
                    {!getReceiptForInvoice(invoice.id) && invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                      <Button 
                        size="sm" 
                        className="flex-1 md:flex-none text-xs h-10 px-4 font-bold"
                        onClick={() => onViewTab?.('receipts', invoice.id)}
                      >
                        <CreditCard className="w-4 h-4 mr-1.5" /> Pay Now
                      </Button>
                    )}
                    {getReceiptForInvoice(invoice.id) && (
                      <Badge variant="success" className="h-10 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4" /> Proof Uploaded
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Receipt Preview if exists */}
                {getReceiptForInvoice(invoice.id) && (
                  <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg border border-emerald-200 flex items-center justify-center text-emerald-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Payment Proof</p>
                        <p className="text-xs font-bold text-slate-900">{getReceiptForInvoice(invoice.id)?.referenceNumber}</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-[10px] h-8 font-black uppercase tracking-widest border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                      onClick={() => window.open(getReceiptForInvoice(invoice.id)?.receiptUrl, '_blank')}
                    >
                      View Receipt
                    </Button>
                  </div>
                )}

                {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                  <div className="pt-4 border-t border-brand-border">
                    <p className="text-[10px] uppercase text-slate-600 font-bold tracking-wider mb-2.5">Attached Bank Account for Payment</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-100 border border-brand-border rounded-xl font-mono text-xs">
                      <div>
                        <span className="text-slate-600 block mb-1 font-bold text-[10px] uppercase tracking-wider">Bank Name</span>
                        <span className="font-semibold text-gray-900">{invoice.bankDetails?.bankName || invoice.bankName || 'CowPlug Bank'}</span>
                      </div>
                      <div>
                        <span className="text-slate-600 block mb-1 font-bold text-[10px] uppercase tracking-wider">Account Name</span>
                        <span className="font-semibold text-gray-900 truncate block max-w-full" title={invoice.bankDetails?.accountName || invoice.accountName || 'CowPlugNG Operations'}>
                          {invoice.bankDetails?.accountName || invoice.accountName || 'CowPlugNG Operations'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-600 block mb-1 font-bold text-[10px] uppercase tracking-wider">Account Number</span>
                        <span className="font-bold text-brand-green text-sm">{invoice.bankDetails?.accountNumber || invoice.accountNumber || '0123456789'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="p-5 sm:p-6 rounded-xl bg-brand-card border border-brand-border">
        <div className="flex gap-4 items-start">
          <div className="p-2.5 bg-brand-green/10 rounded-xl border border-brand-green/20 shrink-0">
            <AlertCircle className="w-5 h-5 text-brand-green" />
          </div>
          <div>
            <h4 className="font-bold text-sm mb-1 text-gray-900">Payment Instructions</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              CowPlugNG uses a manual bank transfer system. After making a payment to the bank details provided on your invoice, please head to the <b>Receipts</b> section to upload your proof of payment. Our team will verify and update your status within 24 hours.
            </p>
          </div>
        </div>
      </div>

      {/* Invoice Detail Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Invoice ${selectedInvoice?.invoiceNumber}`}
        subtitle="Official CowPlugNG Billing Statement & Payment Instructions"
      >
        {selectedInvoice && (
          <div className="space-y-6">
            <CowPlugInvoice 
              invoice={selectedInvoice} 
              investor={profile} 
              onClose={() => setIsViewModalOpen(false)}
              showActions={true}
            />

            {getReceiptForInvoice(selectedInvoice.id) && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Payment Verified Proof</span>
                  </div>
                  <Badge variant={
                    getReceiptForInvoice(selectedInvoice.id)?.status === PaymentStatus.VERIFIED ? 'success' : 
                    getReceiptForInvoice(selectedInvoice.id)?.status === PaymentStatus.REJECTED ? 'error' : 'warning'
                  }>
                    {getReceiptForInvoice(selectedInvoice.id)?.status?.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs">
                    <p className="text-slate-500">Ref: {getReceiptForInvoice(selectedInvoice.id)?.referenceNumber}</p>
                    <p className="text-slate-500">Date: {formatDate(getReceiptForInvoice(selectedInvoice.id)?.createdAt || 0)}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-[10px] font-black uppercase tracking-widest"
                    onClick={() => window.open(getReceiptForInvoice(selectedInvoice.id)?.receiptUrl, '_blank')}
                  >
                    View Document
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                Close
              </Button>
              {selectedInvoice.status !== 'PAID' && selectedInvoice.status !== 'CANCELLED' && (
                <Button variant="primary" onClick={() => {
                  setIsViewModalOpen(false);
                  onViewTab?.('receipts', selectedInvoice.id);
                }}>
                  Proceed to Payment
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
