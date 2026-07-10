import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Beef as Cow, 
  FileText, 
  CreditCard, 
  Users, 
  Briefcase, 
  Megaphone, 
  Settings, 
  LogOut,
  Menu,
  X,
  Stethoscope,
  Truck,
  Box,
  History,
  ClipboardList,
  Bell,
  CheckCircle,
  CheckSquare,
  Sparkles,
  Shield,
  MessageSquare,
  AlertTriangle,
  AlertOctagon,
  Info,
  ExternalLink,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { Badge, Button } from './UI';
import { UserRole } from '../types';
import type { Notification, NotificationCategory, NotificationPriority } from '../types';
import { cn, formatDate } from '../lib/utils';
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
        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group border text-left",
        active 
          ? "bg-brand-muted text-white border-[#333338]" 
          : "text-gray-400 border-transparent hover:text-white hover:bg-brand-muted"
      )}
    >
    <div className="flex items-center gap-3 overflow-hidden">
      <Icon className={cn("w-4 h-4 transition-colors shrink-0", active ? "text-brand-green" : "group-hover:text-brand-green")} />
      <span className="text-sm font-medium truncate">{label}</span>
    </div>
    {badge !== undefined && badge !== 0 && badge !== '0' && (
      <span className="px-2 py-0.5 bg-brand-green text-brand-dark text-[10px] font-black rounded-full leading-none shrink-0 font-sans">
        {badge}
      </span>
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
  const { profile, isAdmin, isInvestor, hasPermission } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Theme support
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.body.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.body.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Real-time notifications for investor
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownNotifications, setDropdownNotifications] = useState<Notification[]>([]);
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

  // Listen to user's unread notifications in real-time
  useEffect(() => {
    if (!profile || profile.role !== 'investor') return;

    const q = query(
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
    }, (error) => {
      console.warn("Error live syncing notifications in Layout:", error);
    });

    return unsubscribe;
  }, [profile]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'Announcements': return Megaphone;
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
      const unread = dropdownNotifications.filter(n => !n.read);
      if (unread.length === 0) return;
      const batch = writeBatch(db);
      unread.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    };

    return (
      <div className="relative" ref={dropdownRef}>
        {/* Bell Icon & Badge */}
        <motion.button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          animate={isShaking ? "shake" : "idle"}
          variants={bellVariants}
          onAnimationComplete={() => setIsShaking(false)}
          className="relative p-2 text-gray-400 hover:text-white hover:bg-brand-muted/50 rounded-xl transition-all cursor-pointer flex items-center justify-center"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white leading-none ring-2 ring-brand-surface">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </motion.button>

        {/* Dropdown panel */}
        <AnimatePresence>
          {isDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-3 w-80 sm:w-96 bg-[#16161a] border border-brand-border rounded-2xl shadow-2xl overflow-hidden z-50 divide-y divide-brand-border/60"
            >
              {/* Header */}
              <div className="p-4 flex items-center justify-between bg-[#1b1b22]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-white">Notifications</span>
                  {unreadCount > 0 && (
                    <Badge variant="success">{unreadCount} new</Badge>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllAsReadDropdown}
                    className="text-[10px] font-bold uppercase text-brand-green hover:text-white transition-colors"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto no-scrollbar divide-y divide-brand-border/40">
                {dropdownNotifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Bell className="w-8 h-8 text-gray-700 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No notifications yet.</p>
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
                          setActiveTab('notifications');
                        }}
                        className={cn(
                          "p-4 flex gap-3 hover:bg-brand-muted/30 transition-colors cursor-pointer text-left relative",
                          !n.read && "bg-brand-muted/10"
                        )}
                      >
                        {/* Priority Icon */}
                        <div className={cn(
                          "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0",
                          pColor
                        )}>
                          <CatIcon className="w-4 h-4" />
                        </div>

                        {/* Middle Text Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className={cn(
                              "text-xs text-white truncate block",
                              !n.read ? "font-bold text-brand-green" : "font-semibold"
                            )}>
                              {n.title}
                            </span>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-brand-green shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[9px] text-gray-500 font-mono">
                              {formatRelativeTime(n.createdAt)}
                            </span>
                            {n.actionLink && (
                              <span className="text-[9px] font-bold text-brand-green uppercase tracking-wider flex items-center gap-0.5">
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

              {/* Footer */}
              <div className="p-3 text-center bg-[#1b1b22]">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setActiveTab('notifications');
                  }}
                  className="text-xs font-bold text-gray-300 hover:text-white transition-colors w-full flex items-center justify-center gap-2"
                >
                  View All Notifications
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const adminMenu = [
    { id: 'dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'investors', label: 'Investors', icon: Briefcase },
    { id: 'livestock', label: 'Livestock Management', icon: Cow },
    { id: 'investments', label: 'Investments', icon: ClipboardList },
    { id: 'sourcing', label: 'Sourcing Requests', icon: MessageSquare },
    { id: 'invoices', label: 'Invoice Manager', icon: FileText },
    { id: 'payments', label: 'Payment Verification', icon: CreditCard },
    { id: 'opportunities', label: 'Opportunities', icon: Briefcase },
    { id: 'health-records', label: 'Medical Records', icon: Stethoscope },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'logs', label: 'Activity Logs', icon: History },
    { id: 'settings', label: 'Platform Settings', icon: Settings },
  ];

  const investorMenu = [
    { id: 'dashboard', label: 'Investor Dashboard', icon: LayoutDashboard },
    { id: 'portfolio', label: 'My Portfolio', icon: Briefcase },
    { id: 'my-livestock', label: 'Assigned Livestock', icon: Cow },
    { id: 'sourcing', label: 'Sourcing Request', icon: MessageSquare },
    { id: 'invoices', label: 'My Invoices', icon: FileText },
    { id: 'receipts', label: 'Payment Receipts', icon: CreditCard },
    { id: 'notifications', label: 'Notification Center', icon: Bell },
  ];

  const filterAdminItem = (item: any) => {
    switch (item.id) {
      case 'dashboard':
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
      case 'settings':
        return hasPermission('settings.view');
      default:
        return true;
    }
  };

  const filteredAdminMenu = adminMenu.filter(filterAdminItem);
  const menu = isAdmin ? filteredAdminMenu : investorMenu.map(item => {
    if (item.id === 'notifications') {
      return { ...item, badge: unreadCount > 0 ? unreadCount : undefined };
    }
    return item;
  });

  // Split menu items cleanly into Console and Operations sections based on identity
  const consoleSection = menu.filter(item => 
    ['dashboard', 'users', 'investors', 'livestock', 'investments', 'portfolio', 'my-livestock'].includes(item.id)
  );

  const operationsSection = menu.filter(item => 
    !['dashboard', 'users', 'investors', 'livestock', 'investments', 'portfolio', 'my-livestock'].includes(item.id)
  );

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-brand-border bg-brand-surface sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-green rounded-xl flex items-center justify-center shadow-sm shadow-brand-green/20">
            <Cow className="w-4 h-4 text-brand-dark" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">CowPlug<span className="text-brand-green">NG</span></span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors border border-transparent hover:border-brand-border flex items-center justify-center shrink-0"
            title={theme === 'dark' ? "Switch to High-Contrast Light Mode" : "Switch to Default Dark Mode"}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-blue-500" />}
          </button>
          {isInvestor && <NotificationBellComponent />}
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white">
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-0 z-40 bg-brand-surface border-r border-brand-border w-64 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-green rounded-xl flex items-center justify-center shadow-sm shadow-brand-green/20">
              <Cow className="w-4 h-4 text-brand-dark" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">CowPlug<span className="text-brand-green">NG</span></span>
          </div>

          <nav className="flex-1 px-4 space-y-4 overflow-y-auto no-scrollbar">
            <div>
              <div className="text-[10px] uppercase text-gray-500 font-bold px-2 mb-2 tracking-widest">Console</div>
              <div className="space-y-1">
                {consoleSection.map((item) => (
                  <SidebarItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    badge={(item as any).badge}
                    active={activeTab === item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase text-gray-500 font-bold px-2 mb-2 tracking-widest">Operations</div>
              <div className="space-y-1">
                {operationsSection.map((item) => (
                  <SidebarItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    badge={(item as any).badge}
                    active={activeTab === item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          </nav>

          <div className="p-4 border-t border-brand-border">
            <div className="flex items-center gap-3 p-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-brand-border flex items-center justify-center text-xs font-bold">
                {profile?.displayName?.[0] || 'U'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold text-white truncate">{profile?.displayName}</p>
                <div className="text-[10px] text-brand-green font-bold uppercase tracking-widest">ONLINE</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-2 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-[#0F0F11] overflow-hidden">
        {/* Desktop Header */}
        <header className="hidden md:flex h-16 bg-brand-surface border-b border-brand-border items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-bold text-white uppercase tracking-widest">
              {menu.find(m => m.id === activeTab)?.label || 'Overview'}
            </h1>
            <span className="px-2.5 py-0.5 bg-brand-green/10 text-brand-green text-[10px] font-bold rounded-full border border-brand-green/20 uppercase tracking-wider">
              v2.0 Stable
            </span>
          </div>
          
          <div className="flex items-center gap-6">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-gray-400 hover:text-white hover:bg-brand-muted rounded-lg transition-colors border border-transparent hover:border-brand-border flex items-center justify-center shrink-0"
              title={theme === 'dark' ? "Switch to High-Contrast Light Mode" : "Switch to Default Dark Mode"}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500 animate-spin-slow" /> : <Moon className="w-4 h-4 text-blue-500" />}
            </button>
            {isInvestor && <NotificationBellComponent />}
            <div className="text-right">
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">System Status</div>
              <div className="text-[10px] font-bold text-brand-green uppercase">All Nodes Healthy</div>
            </div>
          </div>
        </header>

        <main className="flex-1 relative overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
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
            className="fixed bottom-6 right-6 z-[100] max-w-sm w-full bg-[#16161a] border border-brand-border rounded-2xl shadow-2xl p-4 flex gap-3 text-left overflow-hidden cursor-pointer"
            onClick={() => {
              setActiveTab('notifications');
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
                <span className="text-xs font-bold uppercase tracking-wider text-brand-green">{activeToast.category}</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveToast(null);
                  }}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <h4 className="text-sm font-bold text-white mb-1 truncate">{activeToast.title}</h4>
              <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{activeToast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
