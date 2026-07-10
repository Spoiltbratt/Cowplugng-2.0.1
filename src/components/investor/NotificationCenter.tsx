import React, { useState, useEffect } from 'react';
import { 
  Bell, Search, Trash2, Check, CheckSquare, 
  Archive, Shield, MessageSquare, Briefcase, 
  Settings, Volume2, VolumeX, Mail, Smartphone,
  Info, CheckCircle, AlertTriangle, AlertOctagon,
  ExternalLink, Sparkles, Filter, X
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { 
  collection, query, where, onSnapshot, doc, 
  updateDoc, deleteDoc, writeBatch, getDocs, orderBy
} from 'firebase/firestore';
import type { Notification, NotificationCategory, NotificationPriority, NotificationPreferences } from '../../types';
import { Card, Button, Badge, Input } from '../UI';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// Help helper for category icons
export const getCategoryIcon = (category: NotificationCategory) => {
  switch (category) {
    case 'Announcements': return Bell;
    case 'Investment Updates': return Briefcase;
    case 'Payment Confirmations': return CheckCircle;
    case 'Deposit Confirmations': return CheckSquare;
    case 'Withdrawal Updates': return CheckSquare;
    case 'Portfolio Performance': return Sparkles;
    case 'New Investment Opportunities': return Sparkles;
    case 'System Maintenance': return Settings;
    case 'Security Alerts': return Shield;
    case 'KYC Requests': return Shield;
    case 'Messages from Support': return MessageSquare;
    default: return Bell;
  }
};

// Priority style helper
export const getPriorityStyles = (priority: NotificationPriority) => {
  switch (priority) {
    case 'CRITICAL':
      return {
        bg: 'bg-red-500/10 border-red-500/30',
        text: 'text-red-500',
        badge: 'error',
        icon: AlertOctagon
      };
    case 'WARNING':
      return {
        bg: 'bg-amber-500/10 border-amber-500/30',
        text: 'text-amber-500',
        badge: 'warning',
        icon: AlertTriangle
      };
    case 'SUCCESS':
      return {
        bg: 'bg-green-500/10 border-green-500/30',
        text: 'text-green-500',
        badge: 'success',
        icon: CheckCircle
      };
    case 'INFO':
    default:
      return {
        bg: 'bg-blue-500/10 border-blue-500/30',
        text: 'text-blue-500',
        badge: 'default',
        icon: Info
      };
  }
};

export const NotificationCenter: React.FC = () => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'all' | 'preferences'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Preference states
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    browserPush: true,
    email: true,
    sms: false,
    investmentAlerts: true,
    promotional: true,
    securityAlerts: true
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Load preferences from profile
  useEffect(() => {
    if (profile?.notificationPreferences) {
      setPrefs({
        ...profile.notificationPreferences,
        securityAlerts: true // Force true
      });
    }
  }, [profile]);

  // Listen to user's notifications
  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setNotifications(list);
      setLoading(false);
    }, (error) => {
      console.error("Error reading notifications:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [profile]);

  const handleMarkAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  const handleToggleRead = async (id: string, currentRead: boolean) => {
    await updateDoc(doc(db, 'notifications', id), { read: !currentRead });
  };

  const handleArchive = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { archived: true });
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'notifications', id));
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure you want to delete all notifications?")) return;
    const batch = writeBatch(db);
    notifications.forEach(n => {
      batch.delete(doc(db, 'notifications', n.id));
    });
    await batch.commit();
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingPrefs(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        notificationPreferences: {
          ...prefs,
          securityAlerts: true // Security alerts cannot be disabled
        }
      });
      alert("Notification preferences saved successfully!");
    } catch (err: any) {
      alert("Failed to save preferences: " + err.message);
    } finally {
      setSavingPrefs(false);
    }
  };

  // Browser Push requests
  const handleToggleBrowserPush = async (checked: boolean) => {
    if (checked && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPrefs(prev => ({ ...prev, browserPush: true }));
      } else {
        alert("Push notifications were blocked or not granted.");
        setPrefs(prev => ({ ...prev, browserPush: false }));
      }
    } else {
      setPrefs(prev => ({ ...prev, browserPush: checked }));
    }
  };

  // Filtered Notifications list
  const filteredNotifications = notifications.filter(n => {
    // Hide archived
    if (n.archived) return false;

    const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          n.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'All' || n.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  const unreadCount = notifications.filter(n => !n.read && !n.archived).length;

  const categories: string[] = [
    'All',
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Bell className="w-8 h-8 text-brand-green" />
            Notification Center
          </h2>
          <p className="text-gray-400 text-sm mt-1">Manage your platform alerts, announcements, and preferences</p>
        </div>

        <div className="flex gap-2">
          <Button 
            variant={activeTab === 'all' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('all')}
            size="sm"
          >
            All Notifications
            {unreadCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-brand-green text-brand-dark text-[10px] font-black rounded-full leading-none">
                {unreadCount}
              </span>
            )}
          </Button>
          <Button 
            variant={activeTab === 'preferences' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('preferences')}
            size="sm"
          >
            <Settings className="w-4 h-4 mr-2" />
            Preferences
          </Button>
        </div>
      </div>

      {activeTab === 'all' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* Categories Sidebar */}
          <div className="lg:col-span-1 space-y-3">
            <Card title="Categories" icon={Filter}>
              <div className="flex flex-row lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
                {categories.map((cat) => {
                  const Icon = getCategoryIcon(cat as any);
                  const count = notifications.filter(n => !n.read && !n.archived && (cat === 'All' || n.category === cat)).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all w-full text-left",
                        activeCategory === cat 
                          ? "bg-brand-green/10 text-brand-green border border-brand-green/20" 
                          : "text-gray-400 hover:text-white hover:bg-brand-muted border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5" />
                        <span>{cat}</span>
                      </div>
                      {count > 0 && (
                        <span className="px-1.5 py-0.5 bg-brand-green/20 text-brand-green text-[9px] rounded-full font-bold">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card title="Controls" icon={Settings}>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  size="xs" 
                  className="w-full text-left justify-start"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                >
                  {soundEnabled ? (
                    <>
                      <Volume2 className="w-3.5 h-3.5 mr-2 text-brand-green" />
                      Sound Notification: On
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-3.5 h-3.5 mr-2 text-gray-500" />
                      Sound Notification: Off
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  size="xs" 
                  className="w-full text-left justify-start"
                  onClick={handleMarkAllAsRead}
                  disabled={unreadCount === 0}
                >
                  <CheckSquare className="w-3.5 h-3.5 mr-2" />
                  Mark All as Read
                </Button>
                <Button 
                  variant="outline" 
                  size="xs" 
                  className="w-full text-left justify-start text-red-400 hover:text-red-300 border-red-500/10 hover:bg-red-500/10"
                  onClick={handleDeleteAll}
                  disabled={notifications.length === 0}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Delete All Notifications
                </Button>
              </div>
            </Card>
          </div>

          {/* Notifications Main List */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* Search header */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search alerts or announcements..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* List */}
            <Card title={`${activeCategory} Alerts`} icon={Bell}>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-500 text-xs font-mono uppercase">Synchronizing Alerts...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-brand-border rounded-xl">
                  <Bell className="w-12 h-12 text-gray-700 mx-auto mb-4 opacity-30" />
                  <p className="text-gray-400 font-medium">No notifications found.</p>
                  <p className="text-gray-500 text-xs mt-1">
                    {searchTerm ? "Try broadening your search query." : "You are completely up to date!"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-brand-border/60">
                  <AnimatePresence initial={false}>
                    {filteredNotifications.map((n) => {
                      const CatIcon = getCategoryIcon(n.category);
                      const priorityStyle = getPriorityStyles(n.priority);
                      const PriorityIcon = priorityStyle.icon;

                      return (
                        <motion.div
                          key={n.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0, padding: 0 }}
                          className={cn(
                            "py-4 flex gap-4 items-start group transition-all rounded-lg px-2 hover:bg-brand-muted/25",
                            !n.read && "bg-brand-muted/10 font-medium"
                          )}
                        >
                          {/* Priority and Category Indicator Icons */}
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border relative",
                            priorityStyle.bg
                          )}>
                            <CatIcon className={cn("w-5 h-5", priorityStyle.text)} />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center">
                              <PriorityIcon className={cn("w-2.5 h-2.5", priorityStyle.text)} />
                            </div>
                          </div>

                          {/* Text Body */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h4 className={cn(
                                "text-sm text-white",
                                !n.read ? "font-bold text-brand-green" : "font-semibold"
                              )}>
                                {n.title}
                              </h4>
                              <Badge variant={priorityStyle.badge as any}>{n.priority}</Badge>
                              <Badge variant="outline">{n.category}</Badge>
                            </div>

                            <p className="text-xs text-gray-400 leading-relaxed mb-3">
                              {n.message}
                            </p>

                            <div className="flex items-center gap-4 text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                              <span>{formatDate(n.createdAt)}</span>
                              <span>•</span>
                              <button 
                                onClick={() => handleToggleRead(n.id, n.read)}
                                className="hover:text-brand-green transition-colors font-bold"
                              >
                                {n.read ? "Mark as Unread" : "Mark as Read"}
                              </button>
                            </div>
                          </div>

                          {/* Actions Panel */}
                          <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleArchive(n.id)}
                                title="Archive Notification"
                                className="p-1.5 rounded bg-brand-muted border border-brand-border text-gray-400 hover:text-white transition-colors"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(n.id)}
                                title="Delete Notification"
                                className="p-1.5 rounded bg-brand-muted border border-brand-border text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Optional Action Button */}
                            {n.actionLink && (
                              <Button
                                size="xs"
                                variant="outline"
                                className="mt-2 text-[10px] uppercase font-bold tracking-widest border-brand-green/20 hover:border-brand-green text-brand-green hover:bg-brand-green/10"
                                onClick={() => {
                                  if (n.actionLink?.startsWith('http')) {
                                    window.open(n.actionLink, '_blank');
                                  } else {
                                    // Internal action or handle via custom event or state
                                    console.log("Internal route triggered: ", n.actionLink);
                                  }
                                }}
                              >
                                {n.actionText || 'View'}
                                <ExternalLink className="w-3 h-3 ml-1" />
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </Card>

          </div>
        </div>
      ) : (
        /* Preferences UI Panel */
        <Card title="Manage Preferences" icon={Settings}>
          <form onSubmit={handleSavePreferences} className="max-w-xl mx-auto space-y-6 py-4">
            <p className="text-gray-400 text-sm">
              Select your preferred notification delivery channels and categories. Security alerts cannot be disabled to protect your account.
            </p>

            {/* Channels Section */}
            <div className="space-y-4 border-t border-brand-border/40 pt-4">
              <h3 className="text-xs font-bold text-brand-green uppercase tracking-wider">Delivery Channels</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-brand-dark border border-brand-border rounded-xl">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-brand-green" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Browser Push Notifications</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">Receive instant banners on your desktop or mobile browser</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.browserPush}
                    onChange={(e) => handleToggleBrowserPush(e.target.checked)}
                    className="w-4 h-4 text-brand-green bg-brand-muted border-brand-border rounded focus:ring-brand-green focus:ring-opacity-20 accent-brand-green cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-brand-dark border border-brand-border rounded-xl">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-brand-green" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Email Notifications</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">Receive digests and transaction logs to {profile?.email}</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.email}
                    onChange={(e) => setPrefs({ ...prefs, email: e.target.checked })}
                    className="w-4 h-4 text-brand-green bg-brand-muted border-brand-border rounded focus:ring-brand-green focus:ring-opacity-20 accent-brand-green cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-brand-dark border border-brand-border rounded-xl">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-brand-green" />
                    <div>
                      <h4 className="text-xs font-bold text-white">SMS Notifications</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">Receive premium carrier SMS text updates for critical actions</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.sms}
                    onChange={(e) => setPrefs({ ...prefs, sms: e.target.checked })}
                    className="w-4 h-4 text-brand-green bg-brand-muted border-brand-border rounded focus:ring-brand-green focus:ring-opacity-20 accent-brand-green cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Categories Section */}
            <div className="space-y-4 border-t border-brand-border/40 pt-4">
              <h3 className="text-xs font-bold text-brand-green uppercase tracking-wider">Alert Categories</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-brand-dark border border-brand-border rounded-xl">
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-5 h-5 text-white" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Investment Alerts</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">Updates regarding your livestock weight, medical status, or growth metrics</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.investmentAlerts}
                    onChange={(e) => setPrefs({ ...prefs, investmentAlerts: e.target.checked })}
                    className="w-4 h-4 text-brand-green bg-brand-muted border-brand-border rounded focus:ring-brand-green focus:ring-opacity-20 accent-brand-green cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-brand-dark border border-brand-border rounded-xl">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-white" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Promotional Announcements</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">New livestock listing catalogs, early-bird investments, or campaigns</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.promotional}
                    onChange={(e) => setPrefs({ ...prefs, promotional: e.target.checked })}
                    className="w-4 h-4 text-brand-green bg-brand-muted border-brand-border rounded focus:ring-brand-green focus:ring-opacity-20 accent-brand-green cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-brand-dark/50 border border-brand-border rounded-xl opacity-80">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-brand-green" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Security & Audit Alerts <span className="text-[10px] text-brand-green font-bold uppercase">(Mandatory)</span></h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">Password resets, sign-in details, device authorizations, and core safety logs</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={true}
                    disabled={true}
                    className="w-4 h-4 text-brand-green bg-brand-muted border-brand-border rounded focus:ring-brand-green accent-brand-green cursor-not-allowed opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-4 border-t border-brand-border/40">
              <Button type="submit" className="bg-brand-green" disabled={savingPrefs}>
                {savingPrefs ? "Saving Preferences..." : "Save Preferences"}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
};
