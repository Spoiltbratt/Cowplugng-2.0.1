import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, Search, ExternalLink, 
  ZoomIn, Download, User, FileText, Landmark,
  AlertCircle, History, Clock, ShieldCheck
} from 'lucide-react';
import { db, sendNotification, logActivity } from '../../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { PaymentReceipt, PaymentStatus, UserProfile, UserRole, Invoice, LivestockStatus } from '../../types';
import { Card, Button, Badge, Input } from '../UI';
import { cn, formatDate, formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../lib/AuthContext';

export const PaymentVerifier: React.FC = () => {
  const { profile } = useAuth();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [investors, setInvestors] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);

  useEffect(() => {
    const unsubReceipts = onSnapshot(query(collection(db, 'paymentReceipts')), (snapshot) => {
      setReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PaymentReceipt));
      setLoading(false);
    });

    const unsubUsers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      setInvestors(snapshot.docs.map(doc => doc.data() as UserProfile).filter(u => u.role === UserRole.INVESTOR));
    });

    return () => {
      unsubReceipts();
      unsubUsers();
    };
  }, []);

  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleApprove = async (receipt: PaymentReceipt) => {
    try {
      // 1. Update receipt status
      await updateDoc(doc(db, 'paymentReceipts', receipt.id), { 
        status: PaymentStatus.VERIFIED,
        verifiedAt: Date.now(),
        verifiedBy: profile?.uid || 'admin',
        verifiedByName: profile?.displayName || 'Administrator'
      });

      // 2. Update invoice status
      await updateDoc(doc(db, 'invoices', receipt.invoiceId), { status: 'PAID' });

      // 2b. Automatically record spending ledger entries
      try {
        const invSnap = await getDoc(doc(db, 'invoices', receipt.invoiceId));
        if (invSnap.exists()) {
          const invData = invSnap.data() as Invoice;
          if (invData.items && Array.isArray(invData.items) && invData.items.length > 0) {
            for (const item of invData.items) {
              const itemAmt = item.amount || (item.quantity * (item.unitPrice || item.price || 0)) || invData.totalAmount || receipt.amount;
              await addDoc(collection(db, 'spendingLedger'), {
                userId: receipt.investorId,
                invoiceId: receipt.invoiceId,
                invoiceNumber: invData.invoiceNumber || receipt.invoiceId,
                paymentId: receipt.id,
                livestockId: item.livestockId || '',
                livestockTag: item.livestockTag || '',
                category: item.category || 'Other',
                description: item.description || item.item || 'Livestock & Management',
                quantity: item.quantity || 1,
                unitPrice: item.unitPrice || item.price || itemAmt,
                amount: itemAmt,
                currency: 'NGN',
                status: 'CONFIRMED',
                date: Date.now(),
                createdAt: serverTimestamp()
              });
            }
          } else {
            await addDoc(collection(db, 'spendingLedger'), {
              userId: receipt.investorId,
              invoiceId: receipt.invoiceId,
              invoiceNumber: invData.invoiceNumber || receipt.invoiceId,
              paymentId: receipt.id,
              category: 'Livestock',
              description: invData.notes || 'Livestock Purchase',
              quantity: 1,
              unitPrice: receipt.amount,
              amount: receipt.amount,
              currency: 'NGN',
              status: 'CONFIRMED',
              date: Date.now(),
              createdAt: serverTimestamp()
            });
          }
        }
      } catch (ledgerErr) {
        console.error("Error creating spending ledger entry:", ledgerErr);
      }

      // 3. Notify user
      await sendNotification(
        receipt.investorId,
        'Payment Approved',
        `Your payment of ${formatCurrency(receipt.amount)} has been verified and approved.`,
        'Payment Confirmations',
        'INFO'
      );

      // 4. Log activity
      await logActivity(
        profile?.uid || 'unknown',
        profile?.displayName || 'Admin',
        'PAYMENT_APPROVED',
        'PAYMENT',
        receipt.id,
        `Approved payment of ${formatCurrency(receipt.amount)} for invoice ${receipt.invoiceId}`
      );

      setSelectedReceipt(null);
    } catch (error) {
      console.error("Error approving payment:", error);
    }
  };

  const handleReject = async () => {
    if (!selectedReceipt || !rejectionReason.trim()) return;

    try {
      await updateDoc(doc(db, 'paymentReceipts', selectedReceipt.id), { 
        status: PaymentStatus.REJECTED,
        rejectedAt: Date.now(),
        rejectedBy: profile?.uid || 'admin',
        rejectedByName: profile?.displayName || 'Administrator',
        rejectionReason: rejectionReason
      });

      if (profile) {
        await logActivity(
          profile.uid,
          profile.displayName || profile.email,
          'PAYMENT_REJECTED',
          'PAYMENT',
          selectedReceipt.id,
          `Rejected payment receipt with reason: ${rejectionReason}`
        );
      }

      await sendNotification(
        selectedReceipt.investorId,
        'Payment Requires Attention',
        `Your payment receipt could not be verified. Reason: ${rejectionReason}`,
        'System Alerts',
        'CRITICAL'
      );

      setIsRejecting(false);
      setRejectionReason('');
      setSelectedReceipt(null);
    } catch (error) {
      console.error("Error rejecting payment:", error);
    }
  };

  const pendingReceipts = receipts.filter(r => r.status === PaymentStatus.UNDER_REVIEW);
  const historyReceipts = receipts.filter(r => r.status !== PaymentStatus.UNDER_REVIEW);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Pending Verifications" icon={Landmark} subtitle={`${pendingReceipts.length} Awaiting`}>
            <div className="space-y-4">
              {pendingReceipts.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No pending payments for verification.</p>
                </div>
              ) : (
                pendingReceipts.map((receipt) => (
                  <div 
                    key={receipt.id}
                    onClick={() => setSelectedReceipt(receipt)}
                    className={cn(
                      "p-4 rounded-xl border border-brand-border bg-brand-muted/30 cursor-pointer transition-all hover:bg-brand-muted/50 flex items-center justify-between group",
                      selectedReceipt?.id === receipt.id && "border-brand-green bg-brand-muted"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-brand-surface border border-brand-border flex items-center justify-center">
                        <Landmark className="w-6 h-6 text-brand-green" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          {investors.find(i => i.uid === receipt.investorId)?.displayName}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono tracking-widest">{receipt.referenceNumber}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-brand-green">{formatCurrency(receipt.amount)}</p>
                      <p className="text-[10px] text-gray-500">{formatDate(receipt.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card title="Verification History" icon={History}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-brand-border">
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Investor</th>
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Amount</th>
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Status</th>
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {historyReceipts.map((receipt) => (
                    <tr key={receipt.id} className="text-xs">
                      <td className="py-3">
                        {investors.find(i => i.uid === receipt.investorId)?.displayName}
                      </td>
                      <td className="py-3 font-bold text-brand-green">
                        {formatCurrency(receipt.amount)}
                      </td>
                      <td className="py-3">
                        <Badge variant={receipt.status === PaymentStatus.APPROVED ? 'success' : 'error'}>
                          {receipt.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-gray-500">
                        {formatDate(receipt.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div>
          <AnimatePresence mode="wait">
            {selectedReceipt ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Card title="Verification Review" icon={CheckCircle}>
                  <div className="space-y-6">
                    <div className="aspect-[3/4] bg-slate-100 rounded-xl border border-brand-border relative overflow-hidden group flex items-center justify-center">
                      {selectedReceipt.receiptUrl?.toLowerCase().endsWith('.pdf') ? (
                        <div className="text-center p-8">
                          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">PDF Document</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-4"
                            onClick={() => window.open(selectedReceipt.receiptUrl, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Open PDF
                          </Button>
                        </div>
                      ) : (
                        <img src={selectedReceipt.receiptUrl} alt="Payment Receipt" className="w-full h-full object-contain" />
                      )}
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <Button variant="outline" size="sm" className="bg-white" onClick={() => window.open(selectedReceipt.receiptUrl, '_blank')}>
                          <ZoomIn className="w-4 h-4" />
                        </Button>
                        <a 
                          href={selectedReceipt.receiptUrl} 
                          download={`receipt-${selectedReceipt.referenceNumber}`}
                          className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </div>

                    {isRejecting ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4 p-4 bg-rose-50 rounded-xl border border-rose-100"
                      >
                        <div className="flex items-center gap-2 text-rose-700">
                          <XCircle className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Reject Payment</span>
                        </div>
                        <Input 
                          label="Reason for rejection"
                          placeholder="e.g., Image not clear, wrong amount, etc."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button 
                            variant="primary" 
                            className="flex-1 bg-rose-600 hover:bg-rose-700" 
                            onClick={handleReject}
                            disabled={!rejectionReason.trim()}
                          >
                            Confirm Rejection
                          </Button>
                          <Button variant="outline" className="flex-1" onClick={() => setIsRejecting(false)}>Cancel</Button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-brand-surface border border-brand-border">
                          <div className="mb-4 pb-4 border-b border-brand-border">
                            <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Investor Verified Name</p>
                            <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              {investors.find(i => i.uid === selectedReceipt.investorId)?.verifiedName || investors.find(i => i.uid === selectedReceipt.investorId)?.displayName}
                              {investors.find(i => i.uid === selectedReceipt.investorId)?.isVerified && <ShieldCheck className="w-4 h-4 text-emerald-600" />}
                            </p>
                            <p className="text-[10px] text-slate-500 italic mt-1">* Ensure bank transfer account holder matches this name.</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Bank</p>
                              <p className="text-xs font-semibold">{selectedReceipt.senderBank || selectedReceipt.bankUsed}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Amount</p>
                              <p className="text-xs font-bold text-brand-green">{formatCurrency(selectedReceipt.amount || selectedReceipt.reportedAmount || 0)}</p>
                            </div>
                          </div>
                          <div className="mt-4">
                            <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Reference</p>
                            <p className="text-xs font-mono">{selectedReceipt.referenceNumber || selectedReceipt.transactionRef}</p>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <Button 
                            variant="primary" 
                            className="flex-1"
                            onClick={() => handleApprove(selectedReceipt)}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                          <Button 
                            variant="outline" 
                            className="flex-1 text-red-500 border-red-500/20 hover:bg-red-500/10"
                            onClick={() => setIsRejecting(true)}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-brand-border rounded-xl p-8 text-center text-gray-500">
                <div className="space-y-2">
                  <AlertCircle className="w-8 h-8 mx-auto opacity-20" />
                  <p className="text-sm">Select a pending receipt to perform visual verification and approve the transaction.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
