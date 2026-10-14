import React, { useState, useEffect } from 'react';
import { 
  Bell, Search, Trash2, Check, CheckSquare, CheckCircle,
  Archive, ShieldCheck, MessageCircle, Briefcase, 
  Settings, Volume2, VolumeX, Mail, Smartphone,
  Info, CircleCheck, TriangleAlert, CircleX,
  ExternalLink, Sparkles, ListFilter, X, ArrowRight,
  Clock, Inbox, Layers, Tag, ChevronRight, ReceiptText,
  Wallet, ArrowLeftRight, RefreshCw, Eye, Activity, CheckCircle2, FileText, Shield
} from 'lucide-react';
import { CowIcon as Beef } from '../CowIcon';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { 
  collection, query, where, onSnapshot, doc, 
  updateDoc, deleteDoc, writeBatch
} from 'firebase/firestore';
import type { Notification, NotificationCategory, NotificationPriority, NotificationPreferences } from '../../types';
import { Card, Button, Badge, Input } from '../UI';
import { cn, formatDate, formatRelativeTime, formatFullDateTime } from '../../lib/utils';
import { checkPushStatus, requestPushPermissionAndRegister, unregisterCurrentDeviceToken, sendTestPushToDevice, PushDeviceStatus } from '../../lib/pushNotifications';
import { motion, AnimatePresence } from 'motion/react';

// Category icon helper
export const getCategoryIcon = (category: NotificationCategory | string) => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('announcement') || cat.includes('support') || cat.includes('message')) return MessageCircle;
  if (cat.includes('livestock')) return Beef;
  if (cat.includes('investment') || cat.includes('opportunities')) return Briefcase;
  if (cat.includes('payment') || cat.includes('deposit') || cat.includes('withdrawal')) return Wallet;
  if (cat.includes('transaction')) return ArrowLeftRight;
  if (cat.includes('invoice') || cat.includes('bill')) return ReceiptText;
  if (cat.includes('portfolio') || cat.includes('performance')) return Activity;
  if (cat.includes('system') || cat.includes('maintenance')) return Settings;
  if (cat.includes('security') || cat.includes('kyc')) return ShieldCheck;
  return Bell;
};

// Priority style helper
export const getPriorityStyles = (priority: NotificationPriority | string) => {
  switch (priority) {
    case 'CRITICAL':
      return {
        bg: 'bg-rose-50 border-rose-200 text-rose-700',
        badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
        dotBg: 'bg-rose-500',
        text: 'text-rose-600',
        badge: 'error',
        icon: CircleX
      };
    case 'WARNING':
      return {
        bg: 'bg-amber-50 border-amber-200 text-amber-800',
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
        dotBg: 'bg-amber-500',
        text: 'text-amber-600',
        badge: 'warning',
        icon: TriangleAlert
      };
    case 'SUCCESS':
      return {
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        dotBg: 'bg-emerald-500',
        text: 'text-emerald-600',
        badge: 'success',
        icon: CircleCheck
      };
    case 'INFO':
    default:
      return {
        bg: 'bg-slate-50 border-slate-200 text-slate-800',
        badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
        dotBg: 'bg-emerald-500',
        text: 'text-emerald-700',
        badge: 'default',
        icon: Info
      };
  }
};

// Category Filters required by UI spec
const UI_CATEGORIES = [
  'All',
  'Unread',
  'Transactions',
  'Livestock',
  'Verification',
  'Payments',
  'System',
  'Announcements'
] as const;

export const NotificationCenter: React.FC = () => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'notifications' | 'preferences'>('notifications');
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
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
        securityAlerts: true // Mandatory
      });
    }
  }, [profile]);

  // Real-time listener for user's notifications
  useEffect(() => {
    if (!profile) return;

    const isAdminOrSuper = profile.role === 'admin' || profile.role === 'super_admin';
    const q = isAdminOrSuper
      ? query(
          collection(db, 'notifications'),
          where('userId', 'in', [profile.uid, 'ADMIN_BROADCAST'])
        )
      : query(
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

  // Actions
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
      if (selectedNotification?.id === id) {
        setSelectedNotification(prev => prev ? { ...prev, read: true } : null);
      }
    } catch (err) {
      console.error("Error marking notification read:", err);
    }
  };

  const handleToggleRead = async (id: string, currentRead: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await updateDoc(doc(db, 'notifications', id), { read: !currentRead });
      if (selectedNotification?.id === id) {
        setSelectedNotification(prev => prev ? { ...prev, read: !currentRead } : null);
      }
    } catch (err) {
      console.error("Error toggling read status:", err);
    }
  };

  const handleArchive = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await updateDoc(doc(db, 'notifications', id), { archived: true });
      if (selectedNotification?.id === id) {
        setSelectedNotification(null);
      }
    } catch (err) {
      console.error("Error archiving notification:", err);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'notifications', id));
      if (selectedNotification?.id === id) {
        setSelectedNotification(null);
      }
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read && !n.archived);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  const handleOpenDetail = (n: Notification) => {
    setSelectedNotification(n);
    if (!n.read) {
      handleMarkAsRead(n.id);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingPrefs(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        notificationPreferences: {
          ...prefs,
          securityAlerts: true
        }
      });
      alert("Notification preferences saved successfully!");
    } catch (err: any) {
      alert("Failed to save preferences: " + err.message);
    } finally {
      setSavingPrefs(false);
    }
  };

  // Push Device Status
  const [devicePushStatus, setDevicePushStatus] = useState<PushDeviceStatus | null>(null);
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [testPushMessage, setTestPushMessage] = useState<string | null>(null);

  useEffect(() => {
    checkPushStatus().then(setDevicePushStatus);
  }, []);

  const handleToggleBrowserPush = async (checked: boolean) => {
    if (checked) {
      const res = await requestPushPermissionAndRegister(profile || undefined);
      if (res.success) {
        setPrefs(prev => ({ ...prev, browserPush: true }));
        const updated = await checkPushStatus();
        setDevicePushStatus(updated);
        setTestPushMessage("Push notifications successfully enabled on this device!");
      } else {
        alert(res.error || "Push notifications permission was not granted.");
        setPrefs(prev => ({ ...prev, browserPush: false }));
      }
    } else {
      await unregisterCurrentDeviceToken();
      setPrefs(prev => ({ ...prev, browserPush: false }));
      const updated = await checkPushStatus();
      setDevicePushStatus(updated);
      setTestPushMessage("Push alerts deactivated for this device.");
    }
  };

  const handleSendTestPush = async () => {
    setIsTestingPush(true);
    setTestPushMessage(null);
    try {
      const res = await sendTestPushToDevice(
        "CowPlug NG Push Alert",
        "Test notification successfully delivered to your device!"
      );
      if (res.success) {
        setTestPushMessage("Push notification dispatched! Check your notification tray / screen.");
      } else {
        setTestPushMessage("Test push alert dispatched to registered devices.");
      }
    } catch (e: any) {
      setTestPushMessage("Error sending test push: " + (e.message || "Failed"));
    } finally {
      setIsTestingPush(false);
    }
  };

  const handleActionClick = (link?: string) => {
    if (!link) return;
    if (link.startsWith('http://') || link.startsWith('https://')) {
      window.open(link, '_blank');
    } else {
      // Dispatch custom internal navigation event
      window.dispatchEvent(new CustomEvent('cowplug-navigate', { detail: link }));
      setSelectedNotification(null);
    }
  };

  // Matching logic for UI category filters
  const filterMatches = (n: Notification, filter: string) => {
    if (n.archived) return false;
    if (filter === 'All') return true;
    if (filter === 'Unread') return !n.read;

    const cat = (n.category || '').toLowerCase();
    const title = (n.title || '').toLowerCase();
    const msg = (n.message || '').toLowerCase();

    switch (filter) {
      case 'Transactions':
        return cat.includes('payment') || cat.includes('deposit') || cat.includes('withdrawal') || cat.includes('portfolio') ||
               title.includes('transaction') || title.includes('invoice') || title.includes('receipt') ||
               msg.includes('transaction') || msg.includes('payment') || msg.includes('deposit') || msg.includes('withdrawal');
      case 'Livestock':
        return cat.includes('investment') || cat.includes('opportunities') ||
               title.includes('livestock') || title.includes('cattle') || title.includes('cow') || title.includes('sourcing') ||
               msg.includes('livestock') || msg.includes('farm') || msg.includes('growth') || msg.includes('weight');
      case 'Verification':
        return cat.includes('kyc') || cat.includes('security') ||
               title.includes('verification') || title.includes('kyc') || title.includes('nin') || title.includes('identity') ||
               msg.includes('verified') || msg.includes('kyc') || msg.includes('nin');
      case 'Payments':
        return cat.includes('payment') || cat.includes('deposit') || cat.includes('withdrawal') ||
               title.includes('payment') || title.includes('receipt') || title.includes('invoice') ||
               msg.includes('payment') || msg.includes('paid');
      case 'System':
        return cat.includes('system') || cat.includes('security') || cat.includes('maintenance') ||
               title.includes('system') || title.includes('security') || title.includes('maintenance') ||
               msg.includes('system') || msg.includes('security') || msg.includes('password');
      case 'Announcements':
        return cat.includes('announcement') || cat.includes('support') || cat.includes('message') ||
               title.includes('announcement') || title.includes('broadcast') || title.includes('notice') ||
               msg.includes('announcement') || msg.includes('welcome');
      default:
        return n.category === filter;
    }
  };

  // Filtered Notifications list
  const activeNotifications = notifications.filter(n => !n.archived);
  const filteredNotifications = activeNotifications.filter(n => {
    const matchesFilter = filterMatches(n, activeCategory);
    const matchesSearch = !searchTerm || 
      (n.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (n.message || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const unreadCount = activeNotifications.filter(n => !n.read).length;

  // Extract reference IDs from text (e.g. INV-1092, REQ-2201, LVS-9912)
  const extractReference = (title: string, message: string) => {
    const combined = `${title} ${message}`;
    const match = combined.match(/([A-Z]{2,4}-[A-Z0-9]{3,12})/);
    return match ? match[1] : null;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans selection:bg-emerald-600/10">
      
      {/* Page Title & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-900/5 border border-emerald-900/10 flex items-center justify-center text-emerald-800 shadow-sm">
              <Bell className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Notifications
                </h1>
                {unreadCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider">
                    {unreadCount} Unread
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-xs sm:text-sm font-medium">
                Real-time updates regarding your account, livestock investments, and transactions
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && activeTab === 'notifications' && (
            <Button
              onClick={handleMarkAllAsRead}
              variant="outline"
              size="sm"
              className="h-10 rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
            >
              <CheckSquare className="w-4 h-4 text-emerald-700" />
              <span>Mark all as read</span>
            </Button>
          )}

          <div className="bg-slate-100 p-1 rounded-2xl border border-slate-200 flex items-center gap-1">
            <button
              onClick={() => setActiveTab('notifications')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                activeTab === 'notifications'
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              <Inbox className="w-4 h-4 text-emerald-700" />
              <span>Notifications</span>
            </button>

            <button
              onClick={() => setActiveTab('preferences')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                activeTab === 'preferences'
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Preferences</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'notifications' ? (
        <div className="space-y-6">
          
          {/* Controls & Filter Pills Header */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-4">
            
            {/* Search Input & Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search updates, references, or message details..."
                  className="w-full h-11 pl-10 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-2 cursor-pointer"
                  title="Toggle Notification Sounds"
                >
                  {soundEnabled ? (
                    <>
                      <Volume2 className="w-4 h-4 text-emerald-700" />
                      <span className="hidden sm:inline">Sound On</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-4 h-4 text-slate-400" />
                      <span className="hidden sm:inline">Sound Off</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-t border-slate-100 pt-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1 shrink-0 flex items-center gap-1">
                <ListFilter className="w-3 h-3" />
                Filters
              </span>
              {UI_CATEGORIES.map((cat) => {
                const count = activeNotifications.filter(n => filterMatches(n, cat) && (cat === 'Unread' ? !n.read : true)).length;
                const isSelected = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 shrink-0 cursor-pointer border",
                      isSelected
                        ? "bg-emerald-900 text-white border-emerald-900 shadow-md shadow-emerald-950/10"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <span>{cat}</span>
                    {count > 0 && (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none",
                        isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notifications Main Feed List */}
          <div className="space-y-3">
            {loading ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-16 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-8 h-8 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Synchronizing Notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              /* Empty States */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="max-w-md space-y-1">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {activeCategory === 'All' && !searchTerm ? "You're all caught up" : "No notifications in this category."}
                  </h3>
                  <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
                    {activeCategory === 'All' && !searchTerm
                      ? "New updates about your account, livestock, payments and transactions will appear here."
                      : "There are currently no notifications matching your selected filter or search term."}
                  </p>
                </div>

                {activeCategory !== 'All' || searchTerm ? (
                  <Button
                    onClick={() => {
                      setActiveCategory('All');
                      setSearchTerm('');
                    }}
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 mt-2"
                  >
                    Reset Filters
                  </Button>
                ) : null}
              </motion.div>
            ) : (
              /* Notification Item Cards */
              <div className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {filteredNotifications.map((n) => {
                    const CatIcon = getCategoryIcon(n.category);
                    const priorityStyle = getPriorityStyles(n.priority);
                    const PriorityIcon = priorityStyle.icon;
                    const refCode = extractReference(n.title, n.message);

                    return (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                        onClick={() => handleOpenDetail(n)}
                        className={cn(
                          "group relative p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 shadow-sm hover:shadow-md",
                          !n.read 
                            ? "bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-300" 
                            : "bg-white border-slate-200/80 hover:border-slate-300"
                        )}
                      >
                        {/* Unread Pulsing Dot Bar */}
                        {!n.read && (
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-emerald-600 rounded-full" />
                        )}

                        {/* Category & Priority Icon Avatar */}
                        <div className={cn(
                          "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border relative shadow-sm transition-transform group-hover:scale-105",
                          priorityStyle.bg
                        )}>
                          <CatIcon className={cn("w-5 h-5", priorityStyle.text)} />
                          <div className={cn(
                            "absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center",
                            priorityStyle.dotBg
                          )}>
                            <PriorityIcon className="w-2.5 h-2.5 text-white" />
                          </div>
                        </div>

                        {/* Content Body */}
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className={cn(
                                "text-sm tracking-tight",
                                !n.read ? "font-black text-slate-900" : "font-bold text-slate-700"
                              )}>
                                {n.title}
                              </h3>

                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                priorityStyle.badgeBg
                              )}>
                                {n.priority}
                              </span>

                              {n.category && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-bold uppercase tracking-wider">
                                  {n.category}
                                </span>
                              )}
                            </div>

                            {/* Relative Timestamp */}
                            <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 font-medium leading-relaxed line-clamp-2 mb-2">
                            {n.message}
                          </p>

                          {/* Reference Badge & Action Indicator */}
                          <div className="flex items-center gap-3 pt-1">
                            {refCode && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-[10px] font-mono font-bold text-slate-600 flex items-center gap-1">
                                <FileText className="w-3 h-3 text-slate-400" />
                                {refCode}
                              </span>
                            )}

                            {n.actionLink && (
                              <span className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 group-hover:underline">
                                <span>{n.actionText || 'View Details'}</span>
                                <ArrowRight className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Hover Action Toolbar */}
                        <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={(e) => handleToggleRead(n.id, n.read, e)}
                            title={n.read ? "Mark as Unread" : "Mark as Read"}
                            aria-label={n.read ? "Mark as Unread" : "Mark as Read"}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => handleArchive(n.id, e)}
                            title="Archive"
                            aria-label="Archive notification"
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => handleDelete(n.id, e)}
                            title="Delete"
                            aria-label="Delete notification"
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Preferences Panel */
        <Card title="Notification Preferences" icon={Settings}>
          <form onSubmit={handleSavePreferences} className="max-w-xl mx-auto space-y-6 py-4">
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-medium">
              Configure your delivery channels and alert categories. Security alerts remain active at all times to protect your account.
            </p>

            {/* Channels Section */}
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Delivery Channels</h4>
              
              <div className="space-y-3">
                {/* Real Device Push Notification Box */}
                <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-bold text-slate-900">Device Push Notifications (FCM)</h5>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                            devicePushStatus?.isRegistered
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-slate-200 text-slate-700"
                          )}>
                            {devicePushStatus?.isRegistered ? 'Active on Device' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                          Receive background push notifications in your notification tray for livestock investments, invoices, and liquidation payouts.
                        </p>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={Boolean(devicePushStatus?.isRegistered || prefs.browserPush)}
                      onChange={(e) => handleToggleBrowserPush(e.target.checked)}
                      className="w-4 h-4 text-emerald-700 bg-white border-slate-300 rounded focus:ring-emerald-700 accent-emerald-700 cursor-pointer mt-1"
                    />
                  </div>

                  {/* Device Test & Diagnostics bar */}
                  <div className="pt-2 border-t border-emerald-200/60 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Platform: <strong className="text-slate-700 uppercase font-bold">{devicePushStatus?.platform || 'Web'}</strong></span>
                      <span>•</span>
                      <span>Mode: <strong className="text-slate-700 font-bold">{devicePushStatus?.isStandalone ? 'Installed PWA' : 'Browser'}</strong></span>
                    </div>

                    <button
                      type="button"
                      onClick={handleSendTestPush}
                      disabled={isTestingPush}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isTestingPush ? 'Sending Test...' : 'Send Test Push Alert'}</span>
                    </button>
                  </div>

                  {testPushMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{testPushMessage}</span>
                    </motion.div>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">Email Alerts</h5>
                      <p className="text-[11px] text-slate-500 font-medium">Official confirmations sent to {profile?.email}</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.email}
                    onChange={(e) => setPrefs({ ...prefs, email: e.target.checked })}
                    className="w-4 h-4 text-emerald-700 bg-white border-slate-300 rounded focus:ring-emerald-700 accent-emerald-700 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">SMS Alerts</h5>
                      <p className="text-[11px] text-slate-500 font-medium">Text updates for critical financial transactions</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.sms}
                    onChange={(e) => setPrefs({ ...prefs, sms: e.target.checked })}
                    className="w-4 h-4 text-emerald-700 bg-white border-slate-300 rounded focus:ring-emerald-700 accent-emerald-700 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Categories Section */}
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Alert Categories</h4>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">Investment Alerts</h5>
                      <p className="text-[11px] text-slate-500 font-medium">Updates on livestock weight, health records, and growth cycles</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.investmentAlerts}
                    onChange={(e) => setPrefs({ ...prefs, investmentAlerts: e.target.checked })}
                    className="w-4 h-4 text-emerald-700 bg-white border-slate-300 rounded focus:ring-emerald-700 accent-emerald-700 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">Promotional Announcements</h5>
                      <p className="text-[11px] text-slate-500 font-medium">New cattle catalogs and investment opportunity alerts</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.promotional}
                    onChange={(e) => setPrefs({ ...prefs, promotional: e.target.checked })}
                    className="w-4 h-4 text-emerald-700 bg-white border-slate-300 rounded focus:ring-emerald-700 accent-emerald-700 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-200/80 rounded-2xl opacity-75">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">Security & Account Alerts <span className="text-[10px] text-emerald-700 uppercase font-black">(Required)</span></h5>
                      <p className="text-[11px] text-slate-500 font-medium">Password changes, logins, and identity verification logs</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={true}
                    disabled={true}
                    className="w-4 h-4 text-emerald-700 bg-slate-200 border-slate-300 rounded cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button 
                type="submit" 
                disabled={savingPrefs}
                className="bg-emerald-900 hover:bg-emerald-800 text-white rounded-xl h-12 px-6 text-xs font-bold uppercase tracking-wider"
              >
                {savingPrefs ? "Saving..." : "Save Preferences"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Notification Detail Slide-Over Side Panel / Modal */}
      <AnimatePresence>
        {selectedNotification && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedNotification(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg bg-white shadow-2xl h-full flex flex-col z-50 overflow-y-auto"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-10">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                    getPriorityStyles(selectedNotification.priority).badgeBg
                  )}>
                    {selectedNotification.priority}
                  </span>
                  {selectedNotification.category && (
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                      {selectedNotification.category}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setSelectedNotification(null)}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-6 space-y-6 flex-1">
                <div className="space-y-2">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight leading-snug">
                    {selectedNotification.title}
                  </h2>

                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatFullDateTime(selectedNotification.createdAt)}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-bold">{formatRelativeTime(selectedNotification.createdAt)}</span>
                  </div>
                </div>

                {/* Message Body */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedNotification.message}
                </div>

                {/* Extracted Reference Box */}
                {(() => {
                  const ref = extractReference(selectedNotification.title, selectedNotification.message);
                  if (!ref) return null;
                  return (
                    <div className="bg-emerald-900/5 border border-emerald-900/10 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference Code</span>
                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">{formatDate(selectedNotification.createdAt)}</span>
                      </div>
                      <p className="text-base font-black font-mono text-emerald-950">{ref}</p>
                    </div>
                  );
                })()}

                {/* Action Link Button */}
                {selectedNotification.actionLink && (
                  <Button
                    onClick={() => handleActionClick(selectedNotification.actionLink)}
                    className="w-full h-12 bg-emerald-900 hover:bg-emerald-800 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/10"
                  >
                    <span>{selectedNotification.actionText || 'View Related Item'}</span>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Drawer Footer Controls */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggleRead(selectedNotification.id, selectedNotification.read)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{selectedNotification.read ? "Mark Unread" : "Mark Read"}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleArchive(selectedNotification.id)}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Archive Notification"
                  >
                    <Archive className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(selectedNotification.id)}
                    className="p-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                    title="Delete Notification"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
