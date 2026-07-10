import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Card, Badge, Button, Input } from './UI';
import { 
  Beef as Cow, 
  FileText, 
  CreditCard, 
  Truck, 
  Megaphone, 
  ArrowRight,
  TrendingUp,
  Plus,
  Eye,
  Bell
} from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import { Livestock, ConsultationRequest, Invoice, Announcement, ConsultationRequestStatus, LivestockStatus, Notification as AppNotification } from '../types';
import { motion } from 'motion/react';

export const InvestorDashboard: React.FC<{ onViewTab: (tab: string) => void }> = ({ onViewTab }) => {
  const { profile } = useAuth();
  const [myLivestock, setMyLivestock] = useState<Livestock[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState<AppNotification[]>([]);
  
  const [showConsultationForm, setShowConsultationForm] = useState(false);
  const [consultationData, setConsultationData] = useState({
    fullName: profile?.displayName || '',
    phoneNumber: profile?.phoneNumber || '',
    preferredContactMethod: 'Phone' as 'Phone' | 'WhatsApp' | 'Email',
    preferredContactTime: '',
    livestockInterest: 'Cattle' as 'Cattle' | 'Rams' | 'Goats' | 'Multiple',
    notes: ''
  });

  useEffect(() => {
    if (profile) {
      setConsultationData(prev => ({
        ...prev,
        fullName: profile.displayName || profile.name || '',
        phoneNumber: profile.phoneNumber || ''
      }));
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      // 1. Fetch Livestock
      try {
        const livestock = await getDocs(query(collection(db, 'livestock'), where('ownerId', '==', profile.uid)));
        setMyLivestock(livestock.docs.map(doc => ({ id: doc.id, ...doc.data() } as Livestock)));
      } catch (error) {
        console.error("Error fetching investor livestock data:", error);
      }

      // 2. Fetch Invoices
      try {
        const invoices = await getDocs(query(collection(db, 'invoices'), where('investorId', '==', profile.uid), where('status', '==', 'PENDING')));
        setPendingInvoices(invoices.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
      } catch (error) {
        console.error("Error fetching investor invoices:", error);
      }

      // 3. Fetch Notifications (without orderBy to avoid requiring a composite index)
      try {
        const notificationsSnap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', profile.uid)));
        const notificationsData = notificationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
        notificationsData.sort((a, b) => b.createdAt - a.createdAt);
        setUnreadNotifications(notificationsData.filter(n => !n.read));
      } catch (error) {
        console.error("Error fetching investor notifications:", error);
      }
    };

    fetchData();
  }, [profile]);

  const handleConsultationRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      await addDoc(collection(db, 'consultationRequests'), {
        userId: profile.uid,
        investorName: consultationData.fullName,
        email: profile.email,
        phoneNumber: consultationData.phoneNumber,
        preferredContactMethod: consultationData.preferredContactMethod,
        preferredContactTime: consultationData.preferredContactTime,
        livestockInterest: consultationData.livestockInterest,
        notes: consultationData.notes,
        status: ConsultationRequestStatus.PENDING_CONTACT,
        createdAt: serverTimestamp()
      });

      // Create a notification for the user
      await addDoc(collection(db, 'notifications'), {
        userId: profile.uid,
        title: 'Consultation Request Received',
        message: 'Thank you. Your consultation request has been received. A CowPlugNG representative will contact you to discuss your livestock sourcing requirements.',
        category: 'Investment Updates',
        priority: 'SUCCESS',
        read: false,
        createdAt: Date.now()
      });

      setShowConsultationForm(false);
      alert('Thank you. Your consultation request has been received. A CowPlugNG representative will contact you to discuss your livestock sourcing requirements.');
    } catch (error) {
      console.error("Error submitting consultation request:", error);
      alert('Failed to submit request. Please try again.');
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, onClickTab }: any) => (
    <Card className="hover:border-brand-green/30 transition-all group overflow-hidden relative">
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">{title}</p>
          <h3 className="text-xl font-bold text-white">{value}</h3>
        </div>
        <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
          <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-brand-border flex justify-between items-center relative z-10">
        <button 
          onClick={() => onViewTab(onClickTab)}
          className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-brand-green flex items-center gap-1 transition-colors"
        >
          <Eye className="w-3 h-3" />
          View Details
        </button>
      </div>
      <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full ${color} opacity-5 blur-2xl group-hover:opacity-10 transition-opacity`} />
    </Card>
  );

  const activeLivestock = myLivestock.filter(animal => 
    animal.status !== LivestockStatus.DELIVERED && 
    animal.status !== LivestockStatus.DECEASED &&
    animal.status !== LivestockStatus.ARCHIVED &&
    animal.status !== LivestockStatus.SOLD &&
    animal.status !== LivestockStatus.TRANSFERRED
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold mb-1">Welcome, {profile?.displayName}</h2>
          <p className="text-gray-400">Investor ID: <span className="text-brand-green font-mono">{profile?.investorId}</span></p>
        </div>
        <Button onClick={() => setShowConsultationForm(true)} className="shadow-lg shadow-brand-green/20">
          <Plus className="w-5 h-5 mr-2" /> Sourcing Request
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Livestock Assets" value={activeLivestock.length} icon={Cow} color="bg-brand-green" onClickTab="my-livestock" />
        <StatCard title="Pending Invoices" value={pendingInvoices.length} icon={FileText} color="bg-brand-orange" onClickTab="invoices" />
        <StatCard title="Portfolio Value" value="N/A" icon={TrendingUp} color="bg-blue-500" onClickTab="portfolio" />
        <StatCard title="Notifications" value={unreadNotifications.length} icon={Bell} color="bg-purple-500" onClickTab="notifications" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card title="My Livestock Portfolio" icon={Cow} bodyClassName="max-h-[350px] md:max-h-[400px] lg:max-h-[450px] xl:max-h-[550px] overflow-y-auto pr-2">
            <div className="space-y-4">
              {activeLivestock.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-brand-border rounded-xl">
                  <Cow className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No active livestock assigned yet.</p>
                  <Button variant="ghost" size="sm" onClick={() => setShowConsultationForm(true)} className="mt-4">
                    Sourcing Request
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeLivestock.map(cow => (
                    <div key={cow.id} className="p-4 rounded-xl bg-brand-dark border border-brand-border hover:border-brand-green/30 transition-all group">
                      <div className="flex justify-between items-start mb-3">
                        <Badge variant="success">{cow.tagNumber}</Badge>
                        <Badge>{cow.status}</Badge>
                      </div>
                      <h4 className="font-bold text-lg group-hover:text-brand-green transition-colors">{cow.breed}</h4>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                        <div>Weight: <span className="text-white">{cow.weight}</span></div>
                        <div>Health: <span className="text-brand-green">{cow.healthStatus}</span></div>
                        <div className="col-span-2 mt-1">Package: <span className="text-white">{cow.investmentPackage}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card title="Payment Instructions" icon={CreditCard}>
            <div className="p-6 rounded-xl bg-brand-green/5 border border-brand-green/20 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-brand-green/20 flex items-center justify-center shrink-0">
                  <span className="font-bold text-brand-green">1</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm">Download your Invoice</h4>
                  <p className="text-xs text-gray-400 mt-1">View the details of your livestock package and total amount.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-brand-green/20 flex items-center justify-center shrink-0">
                  <span className="font-bold text-brand-green">2</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm">Manual Bank Transfer</h4>
                  <p className="text-xs text-gray-400 mt-1">Perform a manual transfer to the bank details provided on the invoice.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-brand-green/20 flex items-center justify-center shrink-0">
                  <span className="font-bold text-brand-green">3</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm">Upload Receipt</h4>
                  <p className="text-xs text-gray-400 mt-1">Upload a screenshot or scan of your payment receipt for verification.</p>
                </div>
              </div>
              <Button className="w-full mt-4" variant="outline" onClick={() => onViewTab('receipts')}>
                Upload Payment Receipt
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Recent Notifications" icon={Bell}>
            <div className="space-y-4">
              {unreadNotifications.slice(0, 3).map(item => (
                <div key={item.id} className="space-y-2 pb-4 border-b border-brand-border last:border-0 cursor-pointer" onClick={() => onViewTab('notifications')}>
                  <h4 className="font-semibold text-sm">{item.title}</h4>
                  <p className="text-xs text-gray-400 line-clamp-2">{item.message}</p>
                  <span className="text-[10px] text-brand-green font-mono uppercase">{formatDate(item.createdAt)}</span>
                </div>
              ))}
              {unreadNotifications.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-gray-400 text-sm">No unread notifications.</p>
                </div>
              )}
              {/* View All Button */}
              <div className="pt-4 border-t border-brand-border">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => onViewTab('notifications')}
                >
                  <Bell className="w-4 h-4 mr-2" />
                  View All Notifications
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </Button>
              </div>
            </div>
          </Card>

          <Card title="Quick Actions" icon={TrendingUp}>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => onViewTab('receipts')} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-brand-dark border border-brand-border hover:bg-brand-surface transition-all">
                <CreditCard className="w-6 h-6 text-brand-green" />
                <span className="text-xs font-medium">Upload Receipt</span>
              </button>
              <button onClick={() => onViewTab('delivery')} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-brand-dark border border-brand-border hover:bg-brand-surface transition-all">
                <Truck className="w-6 h-6 text-brand-orange" />
                <span className="text-xs font-medium">Request Delivery</span>
              </button>
            </div>
          </Card>
        </div>
      </div>

      {showConsultationForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg"
          >
            <Card title="Request Sourcing" icon={Plus}>
              <form onSubmit={handleConsultationRequest} className="space-y-4">
                <Input 
                  label="Full Name" 
                  value={consultationData.fullName}
                  onChange={e => setConsultationData({ ...consultationData, fullName: e.target.value })}
                  required
                />
                <Input 
                  label="Phone Number" 
                  value={consultationData.phoneNumber}
                  onChange={e => setConsultationData({ ...consultationData, phoneNumber: e.target.value })}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-300">Preferred Contact Method</label>
                    <select 
                      className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                      value={consultationData.preferredContactMethod}
                      onChange={e => setConsultationData({ ...consultationData, preferredContactMethod: e.target.value as any })}
                    >
                      <option value="Phone">Phone</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Email">Email</option>
                    </select>
                  </div>
                  <Input 
                    label="Preferred Contact Time" 
                    placeholder="e.g. Morning, 2pm - 4pm"
                    value={consultationData.preferredContactTime}
                    onChange={e => setConsultationData({ ...consultationData, preferredContactTime: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-300">Livestock Interest</label>
                  <select 
                    className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                    value={consultationData.livestockInterest}
                    onChange={e => setConsultationData({ ...consultationData, livestockInterest: e.target.value as any })}
                  >
                    <option value="Cattle">Cattle</option>
                    <option value="Rams">Rams</option>
                    <option value="Goats">Goats</option>
                    <option value="Multiple">Multiple</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-300">Additional Notes (Optional)</label>
                  <textarea 
                    className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white min-h-[80px] focus:outline-none focus:border-brand-green"
                    placeholder="Tell us more about your sourcing needs..."
                    value={consultationData.notes}
                    onChange={e => setConsultationData({ ...consultationData, notes: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowConsultationForm(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1">Submit Sourcing Request</Button>
                </div>
              </form>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  );
};
