import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Search, Plus, Trash2, Edit, 
  Calendar, Users, Target, Send, Clock,
  Eye, Globe, User, MessageSquare, AlertTriangle, Shield, Settings, Info, CheckCircle
} from 'lucide-react';
import { db, logActivity } from '../../lib/firebase';
import { 
  collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, orderBy, getDocs, where, writeBatch 
} from 'firebase/firestore';
import { Announcement, UserRole, NotificationCategory, NotificationPriority, UserProfile } from '../../types';
import { Card, Button, Badge, Input } from '../UI';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../lib/AuthContext';

export const AnnouncementManager: React.FC = () => {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [investors, setInvestors] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  // Advanced Targeted announcement states
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    category: 'Announcements' as NotificationCategory,
    priority: 'INFO' as NotificationPriority,
    audienceType: 'ALL' as 'ALL' | 'PLAN' | 'REGION' | 'STATUS' | 'SPECIFIC',
    targetValue: '', // e.g. "Premium", "Lagos", "Verified", or userId
    actionText: '',
    actionLink: ''
  });

  const categories: NotificationCategory[] = [
    'Announcements',
    'Investment Updates',
    'Payment Confirmations',
    'Deposit Confirmations',
    'Withdrawal Updates',
    'Portfolio Performance',
    'New Investment Opportunities',
    'System Maintenance',
    'Security Alerts',
    'KYC Requests',
    'Messages from Support'
  ];

  const priorities: NotificationPriority[] = ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'];

  useEffect(() => {
    // Listen to announcements
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Announcement));
      setLoading(false);
    });

    // Fetch investors list for specific selection
    const fetchInvestors = async () => {
      try {
        const userQuery = query(collection(db, 'users'), where('role', '==', 'investor'));
        const snap = await getDocs(userQuery);
        const list = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        setInvestors(list);
      } catch (err) {
        console.error("Error loading investors list:", err);
      }
    };
    fetchInvestors();

    return unsubscribe;
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const timestamp = Date.now();

      // 1. Save general Announcement to announcements collection
      const annRef = await addDoc(collection(db, 'announcements'), {
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        targetRoles: [UserRole.INVESTOR],
        audienceType: newAnnouncement.audienceType,
        targetValue: newAnnouncement.targetValue,
        category: newAnnouncement.category,
        priority: newAnnouncement.priority,
        authorId: 'Admin', 
        createdAt: timestamp
      });

      // 2. Query target users in users collection to publish individual notifications
      let targetUsers: UserProfile[] = [];

      if (newAnnouncement.audienceType === 'ALL') {
        // Query all investors
        const q = query(collection(db, 'users'), where('role', '==', 'investor'));
        const snap = await getDocs(q);
        targetUsers = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      } else if (newAnnouncement.audienceType === 'PLAN') {
        const q = query(
          collection(db, 'users'), 
          where('role', '==', 'investor'),
          where('investmentPlan', '==', newAnnouncement.targetValue)
        );
        const snap = await getDocs(q);
        targetUsers = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      } else if (newAnnouncement.audienceType === 'REGION') {
        const q = query(
          collection(db, 'users'), 
          where('role', '==', 'investor'),
          where('region', '==', newAnnouncement.targetValue)
        );
        const snap = await getDocs(q);
        targetUsers = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      } else if (newAnnouncement.audienceType === 'STATUS') {
        const q = query(collection(db, 'users'), where('role', '==', 'investor'));
        const snap = await getDocs(q);
        const allInvestors = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));

        if (newAnnouncement.targetValue === 'Verified') {
          targetUsers = allInvestors.filter(u => u.isVerified);
        } else if (newAnnouncement.targetValue === 'Unverified') {
          targetUsers = allInvestors.filter(u => !u.isVerified);
        } else {
          // Status active, suspended, pending
          targetUsers = allInvestors.filter(u => (u.status === newAnnouncement.targetValue || u.accountStatus === newAnnouncement.targetValue));
        }
      } else if (newAnnouncement.audienceType === 'SPECIFIC') {
        const specificUser = investors.find(u => u.uid === newAnnouncement.targetValue);
        if (specificUser) {
          targetUsers = [specificUser];
        }
      }

      // 3. Write individual Notification documents using batch writes
      if (targetUsers.length > 0) {
        const batch = writeBatch(db);
        targetUsers.forEach(user => {
          const notificationRef = doc(collection(db, 'notifications'));
          targetUsers.forEach(user => {
  const notificationRef = doc(collection(db, 'notifications'));

  const notificationData: any = {
    userId: user.uid,
    title: newAnnouncement.title,
    message: newAnnouncement.content,
    category: newAnnouncement.category,
    priority: newAnnouncement.priority,
    read: false,
    archived: false,
    createdAt: timestamp,
  };

  if (newAnnouncement.actionText.trim()) {
    notificationData.actionText = newAnnouncement.actionText.trim();
  }

  if (newAnnouncement.actionLink.trim()) {
    notificationData.actionLink = newAnnouncement.actionLink.trim();
  }

  batch.set(notificationRef, notificationData);
});
        });
        await batch.commit();
      }
      
      if (profile) {
        await logActivity(
          profile.uid,
          profile.displayName || profile.email,
          'ANNOUNCEMENT_PUBLISH',
          'ANNOUNCEMENT',
          annRef.id,
          `Published broadcast: ${newAnnouncement.title}. Targeted: ${newAnnouncement.audienceType}`
        );
      }

      setIsAdding(false);
      setNewAnnouncement({
        title: '',
        content: '',
        category: 'Announcements',
        priority: 'INFO',
        audienceType: 'ALL',
        targetValue: '',
        actionText: '',
        actionLink: ''
      });
      setLoading(false);
    } catch (error) {
      console.error("Error publishing targeted announcement:", error);
      setLoading(false);
    }
  };

 const handleDelete = async (id: string) => {
  console.log("Deleting announcement:", id);

  try {
    await deleteDoc(doc(db, "announcements", id));
    
    if (profile) {
      await logActivity(
        profile.uid,
        profile.displayName || profile.email,
        'ANNOUNCEMENT_DELETE',
        'ANNOUNCEMENT',
        id,
        `Deleted broadcast announcement (ID: ${id})`
      );
    }
    console.log("Announcement deleted successfully");
  } catch (error) {
    console.error("Delete failed:", error);
  }
};

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-brand-green" />
            Investor Notifications & Announcements
          </h2>
          <p className="text-xs text-gray-500 mt-1">Broadcast system alerts, KYC requests, updates, and more with smart audience targeting.</p>
        </div>
        <Button onClick={() => setIsAdding(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Compose Notification
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card title="Published Broadcasts" icon={Globe}>
            <div className="space-y-4">
              {announcements.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Megaphone className="w-8 h-8 text-gray-700 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No announcements broadcasted yet.</p>
                </div>
              ) : (
                announcements.map((ann) => (
                  <div key={ann.id} className="p-4 rounded-xl border border-brand-border bg-brand-muted/30 group relative">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{formatDate(ann.createdAt)}</span>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="success">{(ann as any).category || 'Announcement'}</Badge>
                        <Badge variant="default">{(ann as any).priority || 'INFO'}</Badge>
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mb-2">{ann.title}</h3>
                    <p className="text-xs text-slate-600 mb-4 leading-relaxed">{ann.content}</p>
                    
                    <div className="flex items-center justify-between border-t border-brand-border/40 pt-3 text-[10px] text-gray-500">
                      <div>
                        Target: <span className="font-bold text-brand-green">{(ann as any).audienceType || 'ALL'}</span> 
                        {((ann as any).targetValue) && (
                          <span className="ml-1 text-slate-900">({(ann as any).targetValue})</span>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(ann.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div>
          <AnimatePresence>
            {isAdding ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card title="Compose Real-Time Notification" icon={Send}>
                  <form onSubmit={handlePublish} className="space-y-4">
                    {/* Title */}
                    <div>
                      <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Title</label>
                      <Input 
                        placeholder="Investment plan updates..." 
                        value={newAnnouncement.title}
                        onChange={(e) => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                        required
                      />
                    </div>

                    {/* Category & Priority */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Category</label>
                        <select
                          className="w-full bg-brand-muted border border-brand-border rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-brand-green"
                          value={newAnnouncement.category}
                          onChange={(e) => setNewAnnouncement({...newAnnouncement, category: e.target.value as NotificationCategory})}
                        >
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Priority</label>
                        <select
                          className="w-full bg-brand-muted border border-brand-border rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-brand-green"
                          value={newAnnouncement.priority}
                          onChange={(e) => setNewAnnouncement({...newAnnouncement, priority: e.target.value as NotificationPriority})}
                        >
                          {priorities.map(prio => (
                            <option key={prio} value={prio}>{prio}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Target Audience Type */}
                    <div>
                      <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Target Audience</label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          { key: 'ALL', label: 'All' },
                          { key: 'PLAN', label: 'Plan' },
                          { key: 'REGION', label: 'Region' },
                          { key: 'STATUS', label: 'Status' },
                          { key: 'SPECIFIC', label: 'Specific' }
                        ].map(aud => (
                          <button
                            key={aud.key}
                            type="button"
                            onClick={() => setNewAnnouncement({...newAnnouncement, audienceType: aud.key as any, targetValue: ''})}
                            className={cn(
                              "py-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-wider text-center transition-all",
                              newAnnouncement.audienceType === aud.key
                                ? "bg-brand-green/10 border-brand-green text-brand-green"
                                : "border-brand-border text-gray-500 hover:text-white"
                            )}
                          >
                            {aud.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Conditional Target Field Inputs */}
                    <AnimatePresence mode="wait">
                      {newAnnouncement.audienceType === 'PLAN' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-1"
                        >
                          <label className="text-[10px] uppercase text-gray-500 font-bold block">Select Target Plan</label>
                          <select
                            className="w-full bg-brand-muted border border-brand-border rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-brand-green"
                            value={newAnnouncement.targetValue}
                            onChange={(e) => setNewAnnouncement({...newAnnouncement, targetValue: e.target.value})}
                            required
                          >
                            <option value="">-- Choose Plan --</option>
                            <option value="Premium">Premium Plan</option>
                            <option value="Standard">Standard Plan</option>
                            <option value="Basic">Basic Plan</option>
                            <option value="Elite">Elite Plan</option>
                          </select>
                        </motion.div>
                      )}

                      {newAnnouncement.audienceType === 'REGION' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-1"
                        >
                          <label className="text-[10px] uppercase text-gray-500 font-bold block">Select Target Region</label>
                          <select
                            className="w-full bg-brand-muted border border-brand-border rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-brand-green"
                            value={newAnnouncement.targetValue}
                            onChange={(e) => setNewAnnouncement({...newAnnouncement, targetValue: e.target.value})}
                            required
                          >
                            <option value="">-- Choose Region --</option>
                            <option value="Lagos">Lagos (South West)</option>
                            <option value="Abuja">Abuja (North Central)</option>
                            <option value="Rivers">Rivers (South South)</option>
                            <option value="Oyo">Oyo State</option>
                            <option value="Kano">Kano (North West)</option>
                            <option value="Kaduna">Kaduna State</option>
                          </select>
                        </motion.div>
                      )}

                      {newAnnouncement.audienceType === 'STATUS' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-1"
                        >
                          <label className="text-[10px] uppercase text-gray-500 font-bold block">Select User / Verification Status</label>
                          <select
                            className="w-full bg-brand-muted border border-brand-border rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-brand-green"
                            value={newAnnouncement.targetValue}
                            onChange={(e) => setNewAnnouncement({...newAnnouncement, targetValue: e.target.value})}
                            required
                          >
                            <option value="">-- Choose Status --</option>
                            <option value="Verified">Verified Investors</option>
                            <option value="Unverified">Unverified Investors</option>
                            <option value="active">Active Accounts</option>
                            <option value="suspended">Suspended Accounts</option>
                            <option value="pending">Pending Registration</option>
                          </select>
                        </motion.div>
                      )}

                      {newAnnouncement.audienceType === 'SPECIFIC' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-1"
                        >
                          <label className="text-[10px] uppercase text-gray-500 font-bold block">Select Individual Investor</label>
                          <select
                            className="w-full bg-brand-muted border border-brand-border rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-brand-green"
                            value={newAnnouncement.targetValue}
                            onChange={(e) => setNewAnnouncement({...newAnnouncement, targetValue: e.target.value})}
                            required
                          >
                            <option value="">-- Choose Investor --</option>
                            {investors.map(u => (
                              <option key={u.uid} value={u.uid}>
                                {u.displayName || u.email} ({u.email})
                              </option>
                            ))}
                          </select>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Action Link (Optional) */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Action Text (Optional)</label>
                        <Input 
                          placeholder="e.g. View Portfolio" 
                          value={newAnnouncement.actionText}
                          onChange={(e) => setNewAnnouncement({...newAnnouncement, actionText: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Action Link (Optional)</label>
                        <Input 
                          placeholder="e.g. portfolio" 
                          value={newAnnouncement.actionLink}
                          onChange={(e) => setNewAnnouncement({...newAnnouncement, actionLink: e.target.value})}
                        />
                      </div>
                    </div>

                    {/* Content */}
                    <div>
                      <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Message Content</label>
                      <textarea 
                        className="w-full bg-brand-muted border border-brand-border rounded-lg p-3 text-sm text-white focus:outline-none focus:border-brand-green min-h-[120px]"
                        placeholder="Write your push notification message details here..."
                        value={newAnnouncement.content}
                        onChange={(e) => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                        required
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAdding(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" variant="primary" className="flex-1" disabled={loading}>
                        {loading ? 'Publishing...' : 'Publish Notification'}
                      </Button>
                    </div>
                  </form>
                </Card>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-brand-border rounded-xl p-8 text-center text-gray-500">
                <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm max-w-xs mx-auto">Create and publish targeted notifications to keep your investors real-time informed.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
