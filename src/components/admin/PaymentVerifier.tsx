import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, Search, ExternalLink, 
  ZoomIn, Download, User, FileText, Landmark,
  AlertCircle, History, Clock
} from 'lucide-react';
import { db, sendNotification } from '../../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { PaymentReceipt, PaymentStatus, UserProfile, UserRole, Invoice, LivestockStatus } from '../../types';
import { Card, Button, Badge, Input } from '../UI';
import { cn, formatDate, formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const PaymentVerifier: React.FC = () => {
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

  const handleApprove = async (receipt: PaymentReceipt) => {
    try {
      // 1. Update receipt status
      await updateDoc(doc(db, 'paymentReceipts', receipt.id), { 
        status: PaymentStatus.APPROVED,
        approvedAt: Date.now()
      });

      // 2. Update invoice status
      await updateDoc(doc(db, 'invoices', receipt.invoiceId), { status: 'PAID' });

      // 3. Notify user
      await sendNotification(
        receipt.investorId,
        'Payment Approved',
        `Your payment of ${formatCurrency(receipt.amount)} has been verified and approved.`,
        'Payment Confirmations',
        'INFO'
      );

      // 4. Log activity
      await addDoc(collection(db, 'activityLogs'), {
        action: 'PAYMENT_APPROVED',
        targetId: receipt.id,
        targetType: 'INVOICE',
        timestamp: Date.now(),
        adminName: 'Admin', // In real app, get from auth
        details: `Approved payment of ${formatCurrency(receipt.amount)} for invoice ${receipt.invoiceId}`
      });

      setSelectedReceipt(null);
    } catch (error) {
      console.error("Error approving payment:", error);
    }
  };

  const handleReject = async (receiptId: string, reason: string) => {
    await updateDoc(doc(db, 'paymentReceipts', receiptId), { 
      status: PaymentStatus.REJECTED,
      rejectionReason: reason
    });

    if (selectedReceipt) {
      await sendNotification(
        selectedReceipt.investorId,
        'Payment Rejected',
        `Your payment proof has been rejected. Reason: ${reason}. Please re-upload a valid proof.`,
        'System Alerts',
        'CRITICAL'
      );
    }

    setSelectedReceipt(null);
  };

  const pendingReceipts = receipts.filter(r => r.status === PaymentStatus.AWAITING_VERIFICATION);
  const historyReceipts = receipts.filter(r => r.status !== PaymentStatus.AWAITING_VERIFICATION);

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
                        <p className="text-sm font-bold text-white">
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
                    <div className="aspect-[3/4] bg-brand-muted rounded-xl border border-brand-border relative overflow-hidden group">
                      <img src={selectedReceipt.receiptUrl} alt="Payment Receipt" className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <Button variant="outline" size="sm" onClick={() => window.open(selectedReceipt.receiptUrl, '_blank')}>
                          <ZoomIn className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-brand-surface border border-brand-border">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Bank</p>
                            <p className="text-xs font-semibold">{selectedReceipt.senderBank}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Amount</p>
                            <p className="text-xs font-bold text-brand-green">{formatCurrency(selectedReceipt.amount)}</p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Reference</p>
                          <p className="text-xs font-mono">{selectedReceipt.referenceNumber}</p>
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
                          onClick={() => handleReject(selectedReceipt.id, 'Invalid receipt details')}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </div>
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
