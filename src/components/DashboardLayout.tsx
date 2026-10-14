import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  ReceiptText, 
  ArrowLeftRight, 
  Users, 
  Briefcase, 
  Megaphone, 
  Settings, 
  LogOut,
  Menu,
  X,
  TriangleAlert,
  HeartPulse,
  Truck,
  Box,
  History,
  ClipboardList,
  Bell,
  CircleCheck,
  CheckSquare,
  Sparkles,
  ShieldCheck,
  MessageCircle,
  Info,
  ExternalLink,
  UserRound,
  ArrowLeft,
  Wallet,
  Globe,
  RefreshCw,
  Palette,
  DatabaseBackup,
  Store,
  ShoppingBag,
  CircleHelp
} from 'lucide-react';
import { CowIcon as Beef } from './CowIcon';
import { useAuth } from '../lib/AuthContext';
import { Badge, Button } from './UI';
import { BrandLogo } from './BrandLogo';
import { PwaInstallButton } from './pwa/PwaInstallButton';
import { PushNotificationPrompt } from './pwa/PushNotificationPrompt';
import { setupForegroundMessageListener } from '../lib/pushNotifications';
import { UserRole, VerificationStatus } from '../types';
import type { Notification, NotificationCategory, NotificationPriority } from '../types';
import { cn, formatDate, formatRelativeTime as formatRelTime } from '../lib/utils';
import { auth, db } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, orderBy, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarItemProps {
  icon: any;
  label: string;
  active?: boolean;
  badge?: number | string;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, active, badge, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group text-left relative cursor-pointer",
        active
          ? "bg-emerald-50/80 text-emerald-800 font-bold shadow-xs border border-emerald-200/60"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent font-medium"
      )}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <Icon
          className={cn(
            "w-4 h-4 transition-colors shrink-0",
            active
              ? "text-emerald-700"
              : "text-slate-500 group-hover:text-emerald-700"
          )}
        />
        <span className="text-xs tracking-tight truncate">{label}</span>
      </div>
      {badge !== undefined && badge !== 0 && badge !== '0' && (
        <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-extrabold rounded-full leading-none shrink-0 font-sans shadow-xs">
          {badge}
        </span>
      )}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-700 rounded-r-full" />
      )}
    </button>
  );
};

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { profile, isAdmin, isSuperAdmin, isInvestor, hasPermission } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  
  const touchRef = useRef({ startX: 0, startY: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.tagName === 'SELECT' || 
      target.tagName === 'BUTTON' ||
      target.closest('.carousel')
    ) {
      return;
    }
    touchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    
    const deltaX = endX - start.startX;
    const deltaY = Math.abs(endY - start.startY);
    
    if (Math.abs(deltaX) > 75 && deltaY < 50) {
      if (deltaX > 0 && !isMobileMenuOpen) {
        setIsMobileMenuOpen(true);
      } else if (deltaX < 0 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    }
  };

  const handleNavigate = (tabId: string) => {
    if (tabId !== activeTab) {
      setHistory(prev => [...prev, activeTab]);
      setActiveTab(tabId);
    }
  };

  const handleBack = () => {
    if (history.length > 0) {
      const prevTab = history[history.length - 1];
      setHistory(prev => prev.slice(0, prev.length - 1));
      setActiveTab(prevTab);
    } else {
      setActiveTab('dashboard');
    }
  };

  // Theme support (Permanently light mode)

  useEffect(() => {
    document.documentElement.classList.add('light');
    document.body.classList.add('light');
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  // Real-time notifications for investor
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownNotifications, setDropdownNotifications] = useState<Notification[]>([]);
  const [allUnreadIds, setAllUnreadIds] = useState<string[]>([]);
  const [isShaking, setIsShaking] = useState(false);
  const [activeToast, setActiveToast] = useState<Notification | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const prevNotificationsRef = useRef<Record<string, boolean>>({});
  const initialLoadRef = useRef(true);

  // playChime
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.16); // G5
      osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.24); // C6
      
      gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (err) {
      console.warn("AudioContext block or unsupported: ", err);
    }
  };

  // triggerNativeNotification
  const triggerNativeNotification = (title: string, body: string) => {
    if ('Notification' in window && window.Notification.permission === 'granted') {
      new window.Notification(title, {
        body,
        icon: '/favicon.ico'
      });
    }
  };

  // Close dropdown when tab changes
  useEffect(() => {
    setIsDropdownOpen(false);
  }, [activeTab]);

  // Listen to user's unread notifications in real-time
  useEffect(() => {
    if (!profile) return;

    const q = (isAdmin || isSuperAdmin)
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
      
      // Filter out archived notifications on the client to avoid composite index requirement
      const activeList = list.filter(n => !n.archived);
      
      setDropdownNotifications(activeList.slice(0, 5));
      
      const unread = activeList.filter(n => !n.read);
      setAllUnreadIds(unread.map(n => n.id));
      const newUnreadCount = unread.length;
      
      let hasNewUnread = false;
      let newNotification: Notification | null = null;
      
      unread.forEach(n => {
        if (!prevNotificationsRef.current[n.id]) {
          hasNewUnread = true;
          newNotification = n;
        }
        prevNotificationsRef.current[n.id] = true;
      });

      list.forEach(n => {
        prevNotificationsRef.current[n.id] = true;
      });

      setUnreadCount(newUnreadCount);

      if (hasNewUnread && !initialLoadRef.current) {
        setIsShaking(true);
        playChime();
        navigator.vibrate?.([100, 50, 100]);
        
        if (newNotification) {
          setActiveToast(newNotification);
          setTimeout(() => {
            setActiveToast(null);
          }, 5000);
          
          triggerNativeNotification((newNotification as Notification).title, (newNotification as Notification).message);
        }
      }

      initialLoadRef.current = false;
    });

    return unsubscribe;
  }, [profile, isAdmin, isSuperAdmin]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleCustomNav = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        handleNavigate(customEvent.detail);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('cowplug-navigate', handleCustomNav);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('cowplug-navigate', handleCustomNav);
    };
  }, []);

  const formatRelativeTime = (timestamp: number) => {
    return formatRelTime(timestamp);
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'Announcements': return Megaphone;
      case 'Investment Updates': return Briefcase;
      case 'Payment Confirmations': return CircleCheck;
      case 'Deposit Confirmations': return CircleCheck;
      case 'Withdrawal Updates': return ArrowLeftRight;
      case 'Portfolio Performance': return Sparkles;
      case 'New Investment Opportunities': return Store;
      case 'System Maintenance': return Settings;
      case 'Security Alerts': return ShieldCheck;
      case 'KYC Requests': return ShieldCheck;
      case 'Messages from Support': return MessageCircle;
      default: return Bell;
    }
  };

  const getPriorityColor = (priority: NotificationPriority) => {
    switch (priority) {
      case 'CRITICAL': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'WARNING': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'SUCCESS': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'INFO':
      default: return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    }
  };

  const NotificationBellComponent = () => {
    const [activeInternalTab, setActiveInternalTab] = useState<'alerts' | 'modules'>('alerts');
    const bellVariants = {
      shake: {
        rotate: [0, -15, 15, -15, 15, -10, 10, -5, 5, 0],
        transition: { duration: 0.6 }
      },
      idle: { rotate: 0 }
    };

    const handleMarkSingleAsRead = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      await updateDoc(doc(db, 'notifications', id), { read: true });
    };

    const handleMarkAllAsReadDropdown = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (allUnreadIds.length === 0) return;
      const batch = writeBatch(db);
      allUnreadIds.forEach(id => {
        batch.update(doc(db, 'notifications', id), { read: true });
      });
      await batch.commit();
    };

    return (
      <div className="relative" ref={dropdownRef}>
        {/* Bell Icon & Badge */}
        <motion.button
          onClick={() => {
            handleNavigate('notifications');
            setIsDropdownOpen(false);
          }}
          animate={isShaking ? "shake" : "idle"}
          variants={bellVariants}
          onAnimationComplete={() => setIsShaking(false)}
          className={cn(
            "relative p-2.5 rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-center border group z-50",
            activeTab === 'notifications' 
              ? "bg-emerald-700 text-white border-emerald-700 shadow-lg shadow-emerald-700/20" 
              : "bg-white text-slate-600 border-slate-200 hover:border-emerald-700 hover:text-emerald-700 shadow-sm"
          )}
        >
          <Bell className={cn("w-5 h-5 transition-transform duration-300", activeTab === 'notifications' && "scale-110")} />
          {unreadCount > 0 && (
            <span className={cn(
              "absolute -top-1 -right-1 flex h-4.5 min-w-[18px] px-1 items-center justify-center rounded-full text-[10px] font-black leading-none ring-2 transition-colors",
              activeTab === 'notifications' ? "bg-white text-emerald-700 ring-emerald-700" : "bg-emerald-700 text-white ring-white"
            )}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </motion.button>

        {/* Dropdown panel */}
        <AnimatePresence>
          {isDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="absolute right-0 mt-3 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[85vh]"
            >
              {/* Custom Tab Switcher */}
              <div className="p-2 bg-slate-50 border-b border-slate-100 flex gap-1">
                <button
                  onClick={() => setActiveInternalTab('alerts')}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                    activeInternalTab === 'alerts' 
                      ? "bg-white text-brand-green shadow-sm border border-slate-200" 
                      : "text-slate-500 hover:bg-slate-100"
                  )}
                >
                  <Bell className="w-3.5 h-3.5" />
                  Activity Alerts
                  {unreadCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
                  )}
                </button>
              </div>

              {/* Header for Alerts */}
              <div className="px-4 py-3 flex items-center justify-between border-b border-slate-50">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Recent Portfolio Updates</span>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllAsReadDropdown}
                    className="text-[10px] font-bold text-brand-green hover:underline underline-offset-2"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Notifications List */}
              <div className="overflow-y-auto no-scrollbar divide-y divide-slate-50 bg-white">
                {dropdownNotifications.length === 0 ? (
                  <div className="p-10 text-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Bell className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-xs font-medium text-slate-400">All caught up!</p>
                  </div>
                ) : (
                  dropdownNotifications.map((n) => {
                    const CatIcon = getCategoryIcon(n.category);
                    const pColor = getPriorityColor(n.priority);
                    return (
                      <div
                        key={n.id}
                        onClick={async () => {
                          if (!n.read) {
                            await updateDoc(doc(db, 'notifications', n.id), { read: true });
                          }
                          setIsDropdownOpen(false);
                          handleNavigate('notifications');
                        }}
                        className={cn(
                          "p-4 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer text-left group relative",
                          !n.read && "bg-brand-green/[0.02]"
                        )}
                      >
                        <div className={cn(
                          "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105",
                          pColor
                        )}>
                          <CatIcon className="w-4.5 h-4.5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className={cn(
                              "text-xs truncate block",
                              !n.read ? "font-bold text-slate-900" : "font-medium text-slate-600"
                            )}>
                              {n.title}
                            </span>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                              {formatRelativeTime(n.createdAt)}
                            </span>
                            {n.actionLink && (
                              <span className="text-[9px] font-bold text-brand-green flex items-center gap-0.5">
                                {n.actionText || 'View'}
                                <ExternalLink className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    handleNavigate('notifications');
                  }}
                  className="text-[10px] font-extrabold text-slate-600 hover:text-brand-green transition-colors uppercase tracking-widest flex items-center justify-center gap-2 w-full h-full py-2 cursor-pointer"
                >
                  Open Full Notification Center
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const adminMenu = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'kyc', label: 'KYC Verification', icon: ShieldCheck },
    { id: 'users', label: 'Investors', icon: UserRound },
    { id: 'investors', label: 'Partners', icon: Briefcase },
    { id: 'livestock', label: 'Livestock', icon: Beef },
    { id: 'liquidations', label: 'Liquidations', icon: RefreshCw },
    { id: 'investments', label: 'Analytics', icon: ClipboardList },
    { id: 'sourcing', label: 'Sourcing Requests', icon: MessageCircle },
    { id: 'invoices', label: 'Invoices', icon: ReceiptText },
    { id: 'payments', label: 'Payments', icon: ArrowLeftRight },
    { id: 'opportunities', label: 'Growth Packages', icon: Store },
    { id: 'health-records', label: 'Health Records', icon: HeartPulse },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'audit', label: 'Account Audit', icon: History },
    { id: 'logs', label: 'Audit Logs', icon: History },
    { id: 'landing-settings', label: 'Land Settings', icon: Globe },
    { id: 'branding', label: 'App Branding', icon: Palette },
    { id: 'account', label: 'Profile', icon: UserRound },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'testing-reset', label: 'Reset Manager', icon: DatabaseBackup },
  ];

  const investorMenu = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'spending', label: 'My Spending', icon: Wallet },
    { id: 'my-livestock', label: 'My Livestock', icon: Beef },
    { id: 'sourcing', label: 'Source Livestock', icon: Store },
    { id: 'requests', label: 'My Requests', icon: MessageCircle },
    { id: 'invoices', label: 'Invoices', icon: ReceiptText },
    { id: 'receipts', label: 'Payments', icon: ArrowLeftRight },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'account', label: 'Profile', icon: UserRound },
  ];

  const hasVerificationIssue = !isAdmin && profile?.verificationStatus === VerificationStatus.VERIFICATION_ISSUE;

  const filterAdminItem = (item: any) => {
    switch (item.id) {
      case 'dashboard':
      case 'kyc':
        return true;
      case 'users':
        return hasPermission('users.view');
      case 'investors':
      case 'investments':
      case 'sourcing':
        return hasPermission('investors.view');
      case 'livestock':
      case 'health-records':
        return hasPermission('livestock.view');
      case 'invoices':
        return hasPermission('finance.invoices_manage') || hasPermission('finance.payments_view');
      case 'payments':
        return hasPermission('finance.payments_view');
      case 'opportunities':
        return hasPermission('custodians.view');
      case 'announcements':
      case 'logs':
      case 'landing-settings':
      case 'branding':
      case 'settings':
      case 'testing-reset':
        return isSuperAdmin || hasPermission('settings.view');
      default:
        return true;
    }
  };

  const filteredAdminMenu = adminMenu.filter(filterAdminItem);
  
  const filteredInvestorMenu = hasVerificationIssue 
    ? [
        { id: 'verification-issue', label: 'Account Issue', icon: TriangleAlert },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'account', label: 'Profile', icon: UserRound },
      ]
    : investorMenu;

  const menu = isAdmin ? filteredAdminMenu : filteredInvestorMenu.map(item => {
    if (item.id === 'notifications') {
      return { ...item, badge: unreadCount > 0 ? unreadCount : undefined };
    }
    return item;
  });

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = '/';
  };

  return (
    <div 
      className="min-h-screen bg-slate-50 flex flex-col lg:flex-row transition-colors duration-300" 
      style={{ fontFamily: "'Manrope', sans-serif" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Mobile Header (Only visible on small screens) */}
      <div className="lg:hidden h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 sticky top-0 z-[50]">
        <div className="flex items-center gap-2">
          {(activeTab !== 'dashboard' || history.length > 0) && (
            <button 
              onClick={handleBack}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              title="Go Back"
              aria-label="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <BrandLogo variant="compact" onClick={() => setActiveTab('dashboard')} />
        </div>
        <div className="flex items-center gap-2">
          <PwaInstallButton variant="pill" label="Install" />
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            title="Open Navigation Menu"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          {(isInvestor || isAdmin) && <NotificationBellComponent />}
        </div>
      </div>

      {/* Blurred Backdrop for Mobile Sidebar Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-[55] bg-slate-900/40 backdrop-blur-md lg:hidden cursor-pointer"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Matching Screenshot Design */}
      <aside 
        className={cn(
          "fixed inset-0 z-[60] bg-white border-r border-slate-100 w-72 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static shadow-sm",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          {/* Sidebar Header */}
          <div className="h-20 px-6 flex items-center justify-between border-b border-slate-50">
            <BrandLogo variant="sidebar" onClick={() => setActiveTab('dashboard')} />
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer"
              title="Close Navigation Menu"
              aria-label="Close Navigation Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto no-scrollbar">
            {menu.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    handleNavigate(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 group relative",
                    isActive 
                      ? "bg-emerald-900 text-white shadow-none font-semibold" 
                      : "text-slate-500 hover:text-emerald-800 hover:bg-emerald-50 font-semibold"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 transition-all duration-500",
                    isActive ? "text-white scale-110" : "text-slate-400 group-hover:text-emerald-600 group-hover:scale-110 group-hover:rotate-6"
                  )} />
                  <span className={cn(
                    "text-[11px] uppercase tracking-widest leading-none",
                    isActive ? "opacity-100" : "opacity-80 group-hover:opacity-100"
                  )}>
                    {item.label}
                  </span>

                  {isActive && (
                    <motion.div 
                      layoutId="activeIndicator"
                      className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white shadow-sm" 
                    />
                  )}
                  
                  {(item as any).badge && (
                    <span className={cn(
                      "ml-auto px-2 py-0.5 rounded-full text-[9px] font-semibold",
                      isActive ? "bg-emerald-800 text-white" : "bg-slate-100 text-slate-500"
                    )}>
                      {(item as any).badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-slate-50 bg-slate-50/50 space-y-2">
            <PwaInstallButton variant="sidebar" />
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all font-semibold text-sm"
            >
              <LogOut className="w-5 h-5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Desktop Header */}
        <header className="hidden lg:flex h-20 bg-white border-b border-slate-100 items-center justify-between px-10 shrink-0 sticky top-0 z-50">
          <div className="flex items-center gap-4">
            {(activeTab !== 'dashboard' || history.length > 0) && (
              <button 
                onClick={handleBack}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-xl font-semibold text-xs transition-colors border border-slate-200/60 shadow-xs cursor-pointer group"
                title="Go Back"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                <span>Back</span>
              </button>
            )}
            <div className="flex items-center gap-3 h-10 px-4 bg-slate-50 rounded-2xl border border-slate-100">
              <h1 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest whitespace-nowrap">
                {menu.find(m => m.id === activeTab)?.label || 'Overview'}
              </h1>
              <div className="w-1 h-1 rounded-full bg-slate-300" />
              <Badge variant="success" className="px-2 py-0.5 text-[8px] font-semibold tracking-tighter">
                FARM ONLINE
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <PwaInstallButton variant="header" label="Install App" />
            {(isInvestor || isAdmin) && <NotificationBellComponent />}
            
            <div 
              onClick={() => handleNavigate('account')}
              className="flex items-center gap-4 pl-6 border-l border-slate-100 cursor-pointer group"
            >
              <div className="text-right">
                <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors tracking-tighter leading-tight">{profile?.displayName}</p>
                <div className="flex items-center gap-1.5 justify-end mt-0.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] text-emerald-600 font-medium uppercase tracking-[0.2em]">Active Portfolio</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-sm font-bold text-slate-900 shadow-sm overflow-hidden group-hover:border-emerald-600 transition-all duration-500 group-hover:scale-105 group-hover:rotate-3">
                 {profile?.displayName?.[0] || 'U'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 relative overflow-y-auto p-6 lg:p-12">
          <div className="max-w-7xl mx-auto">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>

      {/* Live toast notification panel */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[100] max-w-sm w-full bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 flex gap-3 text-left overflow-hidden cursor-pointer"
            onClick={() => {
              handleNavigate('notifications');
              setActiveToast(null);
            }}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl border flex items-center justify-center shrink-0",
              getPriorityColor(activeToast.priority)
              )}>
              {React.createElement(getCategoryIcon(activeToast.category), { className: "w-5 h-5" })}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#059669]">{activeToast.category}</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveToast(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <h4 className="text-sm font-bold text-slate-900 mb-1 truncate">{activeToast.title}</h4>
              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{activeToast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Device Push Notification Permission Prompt */}
      <PushNotificationPrompt />
    </div>
  );
};
