import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { Invoice } from '../../types';
import { Card, Badge, Button } from '../UI';
import { FileText, Download, CreditCard, Clock, AlertCircle } from 'lucide-react';
import { cn, formatDate, formatCurrency } from '../../lib/utils';

export const MyInvoices: React.FC = () => {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'invoices'), where('investorId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Invoice));
      setLoading(false);
    });
    return unsubscribe;
  }, [profile]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold mb-1">My Invoices</h2>
        <p className="text-gray-400">View and download your billing statements.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading your invoices...</div>
        ) : invoices.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed border-2">
            <FileText className="w-12 h-12 text-gray-600 mb-4" />
            <h3 className="text-xl font-bold">No Invoices Found</h3>
            <p className="text-gray-500 max-w-xs mt-2">You don't have any invoices at the moment. Invoices will appear here when management processes your sourcing requests.</p>
          </Card>
        ) : (
          invoices.map(invoice => (
            <Card key={invoice.id} className="hover:border-brand-green/30 transition-all">
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-brand-muted rounded-xl border border-brand-border">
                      <FileText className="w-8 h-8 text-brand-green" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-bold">{invoice.invoiceNumber}</span>
                      <Badge variant={
                        invoice.status === 'PAID' ? 'success' : 
                        invoice.status === 'CANCELLED' ? 'error' : 'warning'
                      }>
                        {invoice.status}
                      </Badge>
                      </div>
                      <p className="text-xs text-gray-500">Issued on {formatDate(invoice.createdAt)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-1 gap-4 md:text-right">
                    <div>
                      <p className="text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-1">Total Amount</p>
                      <p className="text-lg font-bold text-brand-green">{formatCurrency(invoice.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-1">Due Date</p>
                      <p className={cn("text-xs font-bold", Date.now() > invoice.dueDate && invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' ? "text-red-500" : "text-white")}>
                        {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 md:flex-none">
                      <Download className="w-4 h-4 mr-2" /> Download
                    </Button>
                    {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                      <Button size="sm" className="flex-1 md:flex-none">
                        <CreditCard className="w-4 h-4 mr-2" /> Pay Now
                      </Button>
                    )}
                  </div>
                </div>

                {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                  <div className="pt-4 border-t border-brand-border/40">
                    <p className="text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-2">Attached Bank Account for Payment</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3.5 bg-brand-surface border border-brand-border rounded-xl font-mono text-xs">
                      <div>
                        <span className="text-gray-400 block mb-0.5">Bank Name:</span>
                        <span className="font-semibold text-white">{invoice.bankDetails?.bankName || invoice.bankName || 'CowPlug Bank'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Account Name:</span>
                        <span className="font-semibold text-white truncate block max-w-full" title={invoice.bankDetails?.accountName || invoice.accountName || 'CowPlugNG Operations'}>
                          {invoice.bankDetails?.accountName || invoice.accountName || 'CowPlugNG Operations'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Account Number:</span>
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

      <div className="p-6 rounded-2xl bg-brand-muted/30 border border-brand-border">
        <div className="flex gap-4 items-start">
          <div className="p-2 bg-brand-green/10 rounded-lg">
            <AlertCircle className="w-5 h-5 text-brand-green" />
          </div>
          <div>
            <h4 className="font-bold text-sm mb-1">Payment Instructions</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              CowPlugNG uses a manual bank transfer system. After making a payment to the bank details provided on your invoice, please head to the <b>Receipts</b> section to upload your proof of payment. Our team will verify and update your status within 24 hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
