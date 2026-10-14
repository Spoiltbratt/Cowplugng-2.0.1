import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { db, notifyAdmins, logActivity } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { PaymentReceipt, PaymentStatus, Invoice } from '../../types';
import { Card, Badge, Button, Input } from '../UI';
import { CreditCard, Upload, History, AlertCircle, FileCheck, Landmark, Camera, RefreshCw, Trash2, FileText } from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { uploadToCloudinary } from '../../lib/cloudinary';
import { cn } from '../../lib/utils';

interface MyReceiptsProps {
  initialInvoiceId?: string | null;
  onClearInvoice?: () => void;
}

export const MyReceipts: React.FC<MyReceiptsProps> = ({ initialInvoiceId, onClearInvoice }) => {
  const { profile } = useAuth();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Upload state
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    invoiceId: '',
    amount: '',
    referenceNumber: '',
    senderBank: '',
    receiptUrl: '',
    receiptPublicId: '',
    receiptFileName: ''
  });

  useEffect(() => {
    if (initialInvoiceId && invoices.length > 0) {
      const inv = invoices.find(i => i.id === initialInvoiceId);
      if (inv) {
        setFormData(prev => ({
          ...prev,
          invoiceId: inv.id,
          amount: (inv.totalAmount || 0).toString()
        }));
        setIsUploading(true);
        onClearInvoice?.();
      }
    }
  }, [initialInvoiceId, invoices, onClearInvoice]);

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
      query(collection(db, 'invoices'), where('investorId', '==', profile.uid)),
      (snapshot) => {
        setInvoices(snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }) as Invoice)
          .filter(inv => inv.status !== 'PAID' && inv.status !== 'CANCELLED')
        );
      }
    );

    return () => {
      unsubReceipts();
      unsubInvoices();
    };
  }, [profile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Please upload a JPG, PNG, or PDF receipt.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Max size is 5MB.');
      return;
    }

    setReceiptFile(file);
    setUploadError(null);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview(null);
    }
  };

  const removeFile = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setFormData(prev => ({ ...prev, receiptUrl: '', receiptPublicId: '', receiptFileName: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!receiptFile && !formData.receiptUrl) {
      alert('Please upload a payment receipt.');
      return;
    }

    setIsProcessing(true);
    setUploadProgress(10);

    try {
      let finalReceiptUrl = formData.receiptUrl;
      let finalPublicId = formData.receiptPublicId;
      let finalFileName = formData.receiptFileName;

      if (receiptFile) {
        setUploadProgress(20);
        const uploadResult = await uploadToCloudinary(receiptFile, profile.uid, 'payment-receipts');
        finalReceiptUrl = uploadResult.url;
        finalPublicId = uploadResult.publicId;
        finalFileName = receiptFile.name;
        setUploadProgress(80);
      }

      await addDoc(collection(db, 'paymentReceipts'), {
        ...formData,
        receiptUrl: finalReceiptUrl,
        receiptPublicId: finalPublicId,
        receiptFileName: finalFileName,
        receiptUploadedAt: Date.now(),
        investorId: profile.uid,
        amount: parseFloat(formData.amount),
        status: PaymentStatus.AWAITING_VERIFICATION,
        createdAt: Date.now()
      });

      setUploadProgress(100);

      // Notify admins
      await notifyAdmins(
        'New Payment Receipt Uploaded',
        `Investor ${profile.displayName} has uploaded a payment receipt for ₦${parseFloat(formData.amount).toLocaleString()} (Ref: ${formData.referenceNumber}).`,
        'Payment Confirmations',
        'INFO'
      );

      // Log activity
      await logActivity(
        profile.uid,
        profile.displayName || profile.email,
        'PAYMENT_RECEIPT_UPLOADED',
        'PAYMENT',
        'new',
        `Uploaded payment receipt of ${formatCurrency(parseFloat(formData.amount))} for invoice ${formData.invoiceId}`
      );

      setIsUploading(false);
      setFormData({ 
        invoiceId: '', 
        amount: '', 
        referenceNumber: '', 
        senderBank: '', 
        receiptUrl: '',
        receiptPublicId: '',
        receiptFileName: ''
      });
      setReceiptFile(null);
      setReceiptPreview(null);
      alert('Receipt uploaded successfully! Awaiting admin verification.');
    } catch (error: any) {
      console.error("Error uploading receipt:", error);
      setUploadError(error.message);
      alert('Upload failed: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Payment Receipts</h2>
          <p className="text-sm text-gray-500">Upload and track your transaction proof.</p>
        </div>
        <Button onClick={() => setIsUploading(true)} className="h-10 text-xs">
          <Upload className="w-4 h-4 mr-1.5" /> Upload New Receipt
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
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block">Select Invoice</label>
                    <select 
                      className="w-full h-11 bg-transparent border border-brand-border rounded-xl px-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all"
                      required
                      value={formData.invoiceId}
                      onChange={e => setFormData({...formData, invoiceId: e.target.value})}
                    >
                      <option value="" className="text-gray-900 bg-brand-card">Choose an invoice...</option>
                      {invoices.map(inv => (
                        <option key={inv.id} value={inv.id} className="text-gray-900 bg-brand-card">{inv.invoiceNumber} - {formatCurrency(inv.totalAmount)}</option>
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
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-amber-900">Important: Bank Transfer Name Requirement</p>
                    <p className="text-[10px] text-amber-800 leading-relaxed">
                      Bank transfers must be made from an account containing the CowPlugNG user's verified name: 
                      <span className="font-black"> {profile?.verifiedName || profile?.displayName}</span>. 
                      Payments from third-party accounts will be flagged for manual review.
                    </p>
                  </div>
                </div>
                <div 
                  className={cn(
                    "p-8 border border-dashed rounded-xl text-center transition-all relative overflow-hidden",
                    receiptFile || formData.receiptUrl 
                      ? "border-emerald-500 bg-emerald-50/30" 
                      : "border-brand-border bg-brand-muted/25 hover:border-emerald-400 hover:bg-emerald-50/30"
                  )}
                >
                  <input 
                    type="file" 
                    className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    disabled={isProcessing}
                  />

                  {isProcessing ? (
                    <div className="space-y-3">
                      <RefreshCw className="w-8 h-8 mx-auto text-emerald-600 animate-spin" />
                      <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Uploading Document...</p>
                      <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden mx-auto">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-300" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : receiptFile || formData.receiptUrl ? (
                    <div className="space-y-4">
                      {receiptPreview ? (
                        <div className="relative w-32 h-32 mx-auto rounded-xl overflow-hidden border border-emerald-200 shadow-sm">
                          <img src={receiptPreview} alt="Receipt preview" className="w-full h-full object-cover" />
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeFile(); }}
                            className="absolute top-1 right-1 p-1.5 bg-rose-500 text-white rounded-full shadow-lg hover:bg-rose-600 transition-colors z-20"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-emerald-600 border border-emerald-100">
                            {receiptFile?.type === 'application/pdf' ? <FileText className="w-8 h-8" /> : <FileCheck className="w-8 h-8" />}
                          </div>
                          <p className="text-xs font-bold text-emerald-900">{receiptFile?.name || 'Document Selected'}</p>
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm"
                            className="text-rose-500 border-rose-100 hover:bg-rose-50"
                            onClick={(e) => { e.stopPropagation(); removeFile(); }}
                          >
                            Remove File
                          </Button>
                        </div>
                      )}
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Click or drag to replace document</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-brand-green mb-2.5 opacity-80" />
                      <p className="text-xs font-bold text-gray-900 tracking-tight">Click to select Receipt Document</p>
                      <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-black">JPG, PNG, or PDF (Max 5MB)</p>
                    </>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1 h-11 text-[10px] uppercase font-black tracking-widest" onClick={() => setIsUploading(false)} disabled={isProcessing}>Cancel</Button>
                  <Button type="submit" className="flex-1 h-11 text-[10px] uppercase font-black tracking-widest" disabled={isProcessing || (!receiptFile && !formData.receiptUrl)}>
                    {isProcessing ? 'Processing...' : 'Submit Payment Proof'}
                  </Button>
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
              <tr className="border-b border-brand-border/65">
                <th className="pb-4 text-[10px] uppercase text-slate-600 font-bold tracking-wider">Reference</th>
                <th className="pb-4 text-[10px] uppercase text-slate-600 font-bold tracking-wider">Amount</th>
                <th className="pb-4 text-[10px] uppercase text-slate-600 font-bold tracking-wider">Bank</th>
                <th className="pb-4 text-[10px] uppercase text-slate-600 font-bold tracking-wider">Status</th>
                <th className="pb-4 text-[10px] uppercase text-slate-600 font-bold tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/60">
              {loading ? (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-gray-500">Loading history...</td></tr>
              ) : receipts.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-gray-500">No receipts uploaded yet.</td></tr>
              ) : (
                receipts.map(receipt => (
                  <tr key={receipt.id} className="text-sm hover:bg-brand-muted/10 transition-colors">
                    <td className="py-4">
                      <p className="font-mono text-xs text-gray-900 font-bold">{receipt.referenceNumber || receipt.transactionRef}</p>
                      <button 
                        onClick={() => window.open(receipt.receiptUrl, '_blank')}
                        className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 mt-1 flex items-center gap-1"
                      >
                        <FileCheck className="w-3 h-3" /> View Receipt
                      </button>
                    </td>
                    <td className="py-4 font-bold text-brand-green">{formatCurrency(receipt.amount || receipt.reportedAmount || 0)}</td>
                    <td className="py-4 text-gray-700 font-medium">{receipt.senderBank || receipt.bankUsed}</td>
                    <td className="py-4">
                      <div className="space-y-1">
                        <Badge variant={
                          receipt.status === PaymentStatus.VERIFIED || receipt.status === 'APPROVED' ? 'success' : 
                          receipt.status === PaymentStatus.REJECTED ? 'error' : 'warning'
                        } className="px-2.5 py-0.5">
                          {(receipt.status || '').replace('_', ' ')}
                        </Badge>
                        {receipt.status === PaymentStatus.REJECTED && receipt.rejectionReason && (
                          <p className="text-[10px] text-rose-600 font-bold max-w-[150px] leading-tight">
                            Reason: {receipt.rejectionReason}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 text-xs text-gray-500 font-medium">{formatDate(receipt.createdAt)}</td>
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
