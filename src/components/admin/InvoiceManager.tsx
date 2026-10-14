import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, Plus, Filter, Download, 
  Send, Trash2, CheckCircle, Clock, AlertCircle,
  Eye, FileCheck, ExternalLink, Printer, Trash, X
} from 'lucide-react';
import { db, sendNotification, notifyAdmins } from '../../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, getDocs, where, serverTimestamp } from 'firebase/firestore';
import { Invoice, ConsultationRequest, UserProfile, UserRole, ChargeCategory } from '../../types';
import { Card, Button, Badge, Input, Modal } from '../UI';
import { cn, formatDate, formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { CowPlugInvoice } from '../CowPlugInvoice';

export const InvoiceManager: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [requests, setRequests] = useState<ConsultationRequest[]>([]);
  const [investors, setInvestors] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  // Manual Creation States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [investorId, setInvestorId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [dueDateStr, setDueDateStr] = useState('');
  const [bankName, setBankName] = useState('CowPlug Bank');
  const [accountName, setAccountName] = useState('CowPlugNG Operations');
  const [accountNumber, setAccountNumber] = useState('0123456789');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ 
    description: string; 
    category: ChargeCategory; 
    quantity: number; 
    price: number;
    livestockTag?: string;
  }[]>([
    { description: 'Livestock Sourcing Service', category: 'Livestock Purchase', quantity: 1, price: 500000, livestockTag: '' }
  ]);

  useEffect(() => {
    const unsubInvoices = onSnapshot(query(collection(db, 'invoices')), (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Invoice));
      setLoading(false);
    });

    const unsubRequests = onSnapshot(query(collection(db, 'consultationRequests')), (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ConsultationRequest));
    });

    const unsubUsers = onSnapshot(query(collection(db, 'users'), where('role', '==', UserRole.INVESTOR)), (snapshot) => {
      setInvestors(snapshot.docs.map(doc => doc.data() as UserProfile));
    });

    return () => {
      unsubInvoices();
      unsubRequests();
      unsubUsers();
    };
  }, []);

  const handleUpdateStatus = async (id: string, status: 'PAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED') => {
    try {
      await updateDoc(doc(db, 'invoices', id), { status });
      
      const invoice = invoices.find(inv => inv.id === id);
      if (invoice) {
        if (status === 'PAID') {
          // Notify user of payment approval
          await sendNotification(
            invoice.investorId,
            'Payment Received & Approved',
            `Your payment for invoice ${invoice.invoiceNumber} has been received and approved. Your livestock will be assigned shortly.`,
            'Payment Confirmations',
            'INFO'
          );
        }
        await notifyAdmins(
          'Invoice Status Changed',
          `Invoice ${invoice.invoiceNumber} status was changed to ${status}.`,
          'Payment Confirmations',
          'INFO'
        );
      }

      if (selectedInvoice && selectedInvoice.id === id) {
        setSelectedInvoice(prev => prev ? { ...prev, status } : null);
      }
    } catch (err: any) {
      console.error("Failed to update status: ", err);
      alert("Failed to update status: " + err.message);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { description: '', category: 'Farm Management', quantity: 1, price: 0, livestockTag: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems(items.map((item, idx) => idx === index ? { ...item, [field]: value } : item));
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investorId) {
      alert("Please select an investor");
      return;
    }
    if (!items.length || items.some(it => !it.description.trim())) {
      alert("Please specify a description for all items.");
      return;
    }

    const formattedItems = items.map(item => ({
      description: item.description.trim(),
      category: item.category || 'Other',
      quantity: item.quantity,
      unitPrice: item.price,
      price: item.price,
      amount: item.price * item.quantity,
      livestockTag: item.livestockTag?.trim() || ''
    }));

    const totalAmount = formattedItems.reduce((sum, item) => sum + item.amount, 0);
    const calculatedInvNum = invoiceNumber.trim() || `INV-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      const invoiceData = {
        invoiceNumber: calculatedInvNum,
        requestId: 'MANUAL',
        investorId,
        dueDate: dueDateStr ? new Date(dueDateStr).getTime() : Date.now() + 7 * 24 * 60 * 60 * 1000,
        status: 'PENDING',
        notes: notes.trim(),
        createdAt: Date.now(),
        items: formattedItems,
        subtotal: totalAmount,
        totalAmount,
        bankDetails: {
          bankName: bankName.trim(),
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim()
        }
      };

      await addDoc(collection(db, 'invoices'), invoiceData);

      // Send push notifications
      await sendNotification(
        investorId,
        'New Invoice Issued',
        `Invoice ${calculatedInvNum} for ₦${totalAmount.toLocaleString()} has been generated for your account.`,
        'Payment Confirmations',
        'INFO'
      );
      await notifyAdmins(
        'New Invoice Created',
        `Invoice ${calculatedInvNum} for ₦${totalAmount.toLocaleString()} was issued to an investor.`,
        'Payment Confirmations',
        'INFO'
      );

      // Reset Form State
      setInvestorId('');
      setInvoiceNumber('');
      setDueDateStr('');
      setBankName('CowPlug Bank');
      setAccountName('CowPlugNG Operations');
      setAccountNumber('0123456789');
      setNotes('');
      setItems([{ description: 'Livestock Sourcing Service', quantity: 1, price: 500000 }]);
      setIsCreateOpen(false);
      alert("Invoice successfully created with attached bank account details!");
    } catch (err: any) {
      alert("Error creating manual invoice: " + err.message);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const investorName = investors.find(i => i.uid === inv.investorId)?.displayName || '';
    return (inv.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
           (investorName || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input 
            placeholder="Search invoice number or investor..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button onClick={() => setIsCreateOpen(true)} className="w-full md:w-auto bg-brand-green">
            <Plus className="w-4 h-4 mr-2" />
            Manual Invoice
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title="Invoice Management" icon={FileText}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-brand-border">
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Invoice</th>
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Investor</th>
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Amount</th>
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Status</th>
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Due Date</th>
                    <th className="pb-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {filteredInvoices.map((inv) => (
                    <tr 
                      key={inv.id} 
                      className={cn(
                        "group hover:bg-brand-muted/50 transition-colors cursor-pointer",
                        selectedInvoice?.id === inv.id && "bg-brand-muted"
                      )}
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setIsDetailModalOpen(true);
                        setShowConfirmCancel(false);
                      }}
                    >
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-brand-muted border border-brand-border flex items-center justify-center">
                            <FileText className="w-4 h-4 text-gray-500" />
                          </div>
                          <span className="text-sm font-semibold font-mono">{inv.invoiceNumber}</span>
                        </div>
                      </td>
                      <td className="py-4 text-xs text-slate-900">
                        {investors.find(i => i.uid === inv.investorId)?.displayName || '---'}
                      </td>
                      <td className="py-4 text-sm font-bold text-brand-green">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td className="py-4">
                        <Badge variant={
                          inv.status === 'PAID' ? 'success' : 
                          inv.status === 'CANCELLED' ? 'error' :
                          inv.status === 'OVERDUE' ? 'error' : 'warning'
                        }>
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="py-4 text-xs text-slate-600">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="py-4 text-right">
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div>
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title="Invoice Preview"
          subtitle="Review invoice details, download PDF, or manage payment status."
        >
          {selectedInvoice && (
            <div className="space-y-6">
              <CowPlugInvoice 
                invoice={selectedInvoice}
                investor={investors.find(i => i.uid === selectedInvoice.investorId) || null}
                onClose={() => setIsDetailModalOpen(false)}
                showActions={true}
              />

              <div className="pt-6 border-t border-brand-border space-y-3">
                <Button 
                  variant="primary" 
                  size="sm" 
                  className="w-full"
                  onClick={() => handleUpdateStatus(selectedInvoice.id, 'PAID')}
                  disabled={selectedInvoice.status === 'PAID' || selectedInvoice.status === 'CANCELLED'}
                >
                  <CheckCircle className="w-3 h-3 mr-2" />
                  Mark as Paid
                </Button>
                {selectedInvoice.status !== 'PAID' && selectedInvoice.status !== 'CANCELLED' && (
                  <>
                    {!showConfirmCancel ? (
                      <Button 
                        variant="danger" 
                        size="sm" 
                        className="w-full"
                        onClick={() => setShowConfirmCancel(true)}
                      >
                        <X className="w-3 h-3 mr-2" />
                        Cancel Invoice
                      </Button>
                    ) : (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2 mt-2">
                        <p className="text-xs text-red-400 font-medium text-center">
                          Are you sure you want to cancel this invoice?
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="danger"
                            size="xs"
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                            onClick={async () => {
                              await handleUpdateStatus(selectedInvoice.id, 'CANCELLED');
                              setShowConfirmCancel(false);
                            }}
                          >
                            Yes, Cancel
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            className="flex-1 border-brand-border hover:bg-brand-muted text-slate-700"
                            onClick={() => setShowConfirmCancel(false)}
                          >
                            No, Keep It
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </Modal>
        </div>
      </div>

      {/* Slide-over create form drawer */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-xl bg-brand-surface border-l border-brand-border h-full flex flex-col shadow-2xl z-10"
            >
              <div className="px-6 py-4 border-b border-brand-border flex items-center justify-between bg-brand-card">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-brand-green" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Create Manual Invoice</h3>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wider mt-0.5">Attach custom payment bank coordinates</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1 rounded-lg text-slate-600 hover:text-white hover:bg-brand-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateInvoice} className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Investor and Core Data */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Select Investor</label>
                    <select 
                      value={investorId}
                      onChange={(e) => setInvestorId(e.target.value)}
                      required
                      className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                    >
                      <option value="">-- Choose Investor --</option>
                      {investors.map(inv => (
                        <option key={inv.uid} value={inv.uid}>{inv.displayName || inv.email}</option>
                      ))}
                    </select>
                  </div>

                  <Input 
                    label="Invoice Number (Optional)" 
                    placeholder="Auto-generated if blank" 
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-medium text-slate-700">Due Date</label>
                    <input 
                      type="date"
                      value={dueDateStr}
                      onChange={(e) => setDueDateStr(e.target.value)}
                      required
                      className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Bank Account Details */}
                <div className="border-t border-brand-border pt-6 space-y-4">
                  <h4 className="text-xs font-bold text-brand-green uppercase tracking-wider">Bank Payment Instructions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input 
                      label="Bank Name" 
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      required
                    />
                    <Input 
                      label="Account Name" 
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      required
                    />
                    <Input 
                      label="Account Number" 
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Line Items List */}
                <div className="border-t border-brand-border pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-brand-green uppercase tracking-wider">Invoice Items</h4>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="flex items-center gap-1.5 font-bold">
                      <Plus className="w-4 h-4 text-emerald-700" />
                      <span>Add Item</span>
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl relative">
                        <div className="flex-1 w-full">
                          <Input 
                            label="Title / Description" 
                            placeholder="e.g. Balami Ram Purchase / Management Fee" 
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            required
                          />
                        </div>
                        <div className="w-full sm:w-48 space-y-1">
                          <label className="text-xs font-bold text-slate-700">Category</label>
                          <select
                            value={item.category || 'Other'}
                            onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                            className="w-full bg-white border border-brand-border rounded-lg px-2.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
                        <div className="w-full sm:w-48">
                          <Input 
                            label="Amount (₦)" 
                            type="number"
                            min="0"
                            placeholder="500000"
                            value={item.price || ''}
                            onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                            required
                          />
                        </div>
                        {items.length > 1 && (
                          <Button 
                            type="button" 
                            variant="danger" 
                            size="sm" 
                            onClick={() => handleRemoveItem(idx)}
                            className="p-2.5 h-10 w-10 flex items-center justify-center text-red-500 hover:bg-red-500/10 border-red-500/20 shrink-0"
                            title="Remove Item"
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-xl text-slate-600 hover:text-emerald-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors bg-white"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Custom Title & Amount Item</span>
                  </button>
                </div>

                {/* Additional notes */}
                <div className="space-y-1.5 border-t border-brand-border pt-6">
                  <label className="text-sm font-medium text-slate-700">Notes / Remarks</label>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add terms, references, or instructions..."
                    rows={3}
                    className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 text-sm focus:outline-none"
                  />
                </div>

                {/* Total dynamic calculation block */}
                <div className="bg-brand-muted/30 border border-brand-border rounded-xl p-4 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-600">Calculated Invoice Total:</span>
                  <span className="text-lg font-extrabold text-brand-green">
                    {formatCurrency(items.reduce((sum, item) => sum + (item.price * item.quantity), 0))}
                  </span>
                </div>

              </form>

              <div className="p-4 border-t border-brand-border bg-brand-card flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-brand-green" onClick={handleCreateInvoice}>
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Generate & Send Invoice
                </Button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
