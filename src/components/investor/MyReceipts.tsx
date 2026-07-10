import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { PaymentReceipt, PaymentStatus, Invoice } from '../../types';
import { Card, Badge, Button, Input } from '../UI';
import { CreditCard, Upload, History, AlertCircle, FileCheck, Landmark } from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const MyReceipts: React.FC = () => {
  const { profile } = useAuth();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    invoiceId: '',
    amount: '',
    referenceNumber: '',
    senderBank: '',
    receiptUrl: ''
  });

  useEffect(() => {
    if (!profile) return;

    const unsubReceipts = onSnapshot(
      query(collection(db, 'paymentReceipts'), where('investorId', '==', profile.uid)),
      (snapshot) => {
        setReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PaymentReceipt));
        setLoading(false);
      }
    );

    const unsubInvoices = onSnapshot(
      query(collection(db, 'invoices'), where('investorId', '==', profile.uid), where('status', '==', 'PENDING')),
      (snapshot) => {
        setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Invoice));
      }
    );

    return () => {
      unsubReceipts();
      unsubInvoices();
    };
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      await addDoc(collection(db, 'paymentReceipts'), {
        ...formData,
        investorId: profile.uid,
        amount: parseFloat(formData.amount),
        status: PaymentStatus.AWAITING_VERIFICATION,
        createdAt: Date.now(),
        receiptUrl: 'https://images.unsplash.com/photo-1554224155-169641357599?auto=format&fit=crop&q=80&w=400' // Placeholder
      });
      setIsUploading(false);
      setFormData({ invoiceId: '', amount: '', referenceNumber: '', senderBank: '', receiptUrl: '' });
      alert('Receipt uploaded successfully! Awaiting admin verification.');
    } catch (error) {
      console.error("Error uploading receipt:", error);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold mb-1">Payment Receipts</h2>
          <p className="text-gray-400">Upload and track your transaction proof.</p>
        </div>
        <Button onClick={() => setIsUploading(true)}>
          <Upload className="w-4 h-4 mr-2" /> Upload New Receipt
        </Button>
      </div>

      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card title="Upload Payment Proof" icon={CreditCard}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-300">Select Invoice</label>
                    <select 
                      className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                      required
                      value={formData.invoiceId}
                      onChange={e => setFormData({...formData, invoiceId: e.target.value})}
                    >
                      <option value="">Choose an invoice...</option>
                      {invoices.map(inv => (
                        <option key={inv.id} value={inv.id}>{inv.invoiceNumber} - {formatCurrency(inv.totalAmount)}</option>
                      ))}
                    </select>
                  </div>
                  <Input 
                    label="Amount Paid (₦)" 
                    type="number"
                    required
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input 
                    label="Transaction Reference / Session ID" 
                    required
                    value={formData.referenceNumber}
                    onChange={e => setFormData({...formData, referenceNumber: e.target.value})}
                  />
                  <Input 
                    label="Sender Bank Name" 
                    required
                    placeholder="e.g. Zenith Bank"
                    value={formData.senderBank}
                    onChange={e => setFormData({...formData, senderBank: e.target.value})}
                  />
                </div>
                <div className="p-8 border-2 border-dashed border-brand-border rounded-xl text-center bg-brand-muted/10">
                  <Upload className="w-8 h-8 mx-auto text-gray-500 mb-2" />
                  <p className="text-xs text-gray-500">Drag and drop your receipt image here, or click to browse</p>
                  <p className="text-[10px] text-gray-600 mt-1">Supports JPG, PNG (Max 2MB)</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsUploading(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1">Submit Proof</Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card title="Upload History" icon={History}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Reference</th>
                <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Amount</th>
                <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Bank</th>
                <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Status</th>
                <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {loading ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-500">Loading history...</td></tr>
              ) : receipts.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-500">No receipts uploaded yet.</td></tr>
              ) : (
                receipts.map(receipt => (
                  <tr key={receipt.id} className="text-sm">
                    <td className="py-4 font-mono text-xs">{receipt.referenceNumber}</td>
                    <td className="py-4 font-bold text-brand-green">{formatCurrency(receipt.amount)}</td>
                    <td className="py-4 text-gray-400">{receipt.senderBank}</td>
                    <td className="py-4">
                      <Badge variant={
                        receipt.status === PaymentStatus.APPROVED ? 'success' : 
                        receipt.status === PaymentStatus.REJECTED ? 'error' : 'warning'
                      }>
                        {receipt.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-4 text-xs text-gray-500">{formatDate(receipt.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
