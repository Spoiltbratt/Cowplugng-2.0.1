import React, { useState, useEffect } from 'react';
import { 
  DatabaseBackup, RefreshCw, AlertTriangle, Trash2, 
  ShieldAlert, CheckCircle2, XCircle, Info, Users, 
  FileText, CreditCard, MessageSquare, Search, Lock, 
  ShieldCheck, Layers, Flame, UserX, AlertCircle,
  Eye, EyeOff, KeyRound, Key, X, Sparkles, Loader2,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { useAuth } from '../../lib/AuthContext';
import { Card, Button, Input, Badge } from '../UI';
import { cn } from '../../lib/utils';
import { UserRole } from '../../types';

interface TestUserItem {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  investorId: string;
  createdAt: number;
  classificationStatus?: string;
  reason?: string;
}

interface TestingStatus {
  enabled: boolean;
  projectId: string;
  protectedSuperAdmin: string;
  counts: {
    totalUsers: number;
    testUsers: number;
    ambiguousUsers: number;
    protectedAdmins: number;
    totalLivestock: number;
    assignedLivestock: number;
    invoices: number;
    paymentReceipts: number;
    consultationRequests: number;
    deliveryRequests: number;
    liquidationRequests: number;
    spendingLedger: number;
    notifications: number;
    activityLogs: number;
    healthRecords?: number;
    growthRecords?: number;
  };
  testUsersList: TestUserItem[];
  ambiguousUsersList?: TestUserItem[];
  protectedAdminsList?: TestUserItem[];
}

interface ResetResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: any;
  error: string | null;
  scope: string;
}

const ResetResultModal: React.FC<ResetResultModalProps> = ({ isOpen, onClose, result, error, scope }) => {
  const [showSkippedDetails, setShowSkippedDetails] = useState(false);
  if (!isOpen) return null;

  const isPartial = result?.status === 'PARTIAL_SUCCESS';
  const isFailed = Boolean(error) || result?.status === 'FAILED';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {isFailed ? (
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
            ) : isPartial ? (
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isFailed ? 'Reset Operation Failed' : isPartial ? 'Reset Completed with Notices' : 'Reset Operation Complete'}
              </h3>
              <p className="text-xs text-slate-500 font-mono">Scope: {scope}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            aria-label="Close dialog"
            title="Close"
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error ? (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-2">
            <p className="text-xs font-bold text-rose-800">Error Details</p>
            <p className="text-xs text-rose-600 font-mono leading-relaxed">{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={cn(
              "p-3.5 border rounded-2xl text-xs font-medium leading-relaxed",
              isPartial ? "bg-amber-50/80 border-amber-200 text-amber-900" : "bg-emerald-50 border-emerald-100 text-emerald-800"
            )}>
              {result?.message || 'The test reset operation completed successfully.'}
            </div>

            {result?.superAdminPasswordVerified && (
              <div className="flex items-center gap-2 p-3 bg-emerald-100/80 border border-emerald-300/80 rounded-2xl text-xs text-emerald-900 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Verified with Super Admin Password (tugbobodare4@gmail.com)</span>
              </div>
            )}

            {result?.authNote && (
              <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-[11px] text-slate-600">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>Auth Notice: {result.authNote}</span>
              </div>
            )}

            {result?.deletionCounts && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Cleaned Records Summary
                </p>
                <div className="max-h-48 overflow-y-auto bg-slate-50 border border-slate-100 rounded-2xl p-3 divide-y divide-slate-100 text-xs font-mono">
                  {Object.entries(result.deletionCounts).map(([key, val]) => (
                    <div key={key} className="py-1.5 flex justify-between items-center">
                      <span className="text-slate-600 capitalize">{key.replace(/_/g, ' ')}:</span>
                      <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-100">
                        {String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skipped users reporting */}
            {result?.skippedUsers && result.skippedUsers.length > 0 && (
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-2">
                <div 
                  onClick={() => setShowSkippedDetails(!showSkippedDetails)}
                  className="flex items-center justify-between text-xs font-bold text-amber-900 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                    Skipped Accounts ({result.skippedUsers.length})
                  </span>
                  <span className="text-[10px] text-amber-700 flex items-center">
                    {showSkippedDetails ? 'Hide Details' : 'View List'}
                    {showSkippedDetails ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Accounts lacking explicit test markers were skipped to prevent deleting real users.
                </p>
                {showSkippedDetails && (
                  <div className="max-h-36 overflow-y-auto divide-y divide-amber-100 text-[10.5px] font-mono text-amber-800 pt-1">
                    {result.skippedUsers.map((su: any, idx: number) => (
                      <div key={idx} className="py-1">
                        <div className="font-bold">{su.email || su.uid}</div>
                        <div className="text-[10px] text-amber-600 italic">{su.reason}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Failures / Errors */}
            {result?.failures && result.failures.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-1.5 text-xs text-rose-800">
                <p className="font-bold">Warnings / Failures encountered:</p>
                <ul className="list-disc list-inside text-[11px] font-mono space-y-0.5">
                  {result.failures.map((f: string, idx: number) => (
                    <li key={idx}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>An immutable audit trail entry was recorded in system activity logs.</span>
            </div>
          </div>
        )}

        <div className="pt-2">
          <Button 
            onClick={onClose} 
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs"
          >
            Dismiss Report
          </Button>
        </div>
      </div>
    </div>
  );
};

export const TestingResetManager: React.FC = () => {
  const { profile } = useAuth();
  const [status, setStatus] = useState<TestingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [executingScope, setExecutingScope] = useState<string | null>(null);

  // Selected User Reset State
  const [selectedUserUid, setSelectedUserUid] = useState<string>('');
  const [userSearchTerm, setUserSearchTerm] = useState('');

  // Confirmation & Dry-run Preview State
  const [activeModalScope, setActiveModalScope] = useState<string | null>(null);
  const [typeConfirmationInput, setTypeConfirmationInput] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Super Admin Password Clearance State
  const [superAdminPassword, setSuperAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Result Reporting Modal
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastScope, setLastScope] = useState<string>('');

  // Recent Activity Logs
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  const isSuperAdmin = profile?.role === UserRole.SUPER_ADMIN || 
                       profile?.role === 'super_admin' || 
                       profile?.email?.toLowerCase() === 'tugbobodare4@gmail.com';

  const handleVerifyPassword = async () => {
    if (!superAdminPassword.trim()) {
      setPasswordFeedback({ type: 'error', message: 'Please enter the Super Admin password.' });
      return;
    }
    setVerifyingPassword(true);
    setPasswordFeedback(null);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("No active session found.");
      const idToken = await currentUser.getIdToken();

      const res = await fetch('/api/admin/testing/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ password: superAdminPassword.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Password verification failed.");
      }
      setIsPasswordVerified(true);
      setPasswordFeedback({
        type: 'success',
        message: 'Super Admin credentials authenticated and armed for reset operations!'
      });
    } catch (err: any) {
      setIsPasswordVerified(false);
      setPasswordFeedback({
        type: 'error',
        message: err.message || 'Incorrect Super Admin password.'
      });
    } finally {
      setVerifyingPassword(false);
    }
  };

  const fetchStatus = async () => {
    try {
      setRefreshing(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/admin/testing/status', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.testUsersList && data.testUsersList.length > 0 && !selectedUserUid) {
          setSelectedUserUid(data.testUsersList[0].uid);
        }
      }
    } catch (err) {
      console.error('Failed to fetch testing status:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRecentLogs = async () => {
    try {
      const logsRef = collection(db, 'activityLogs');
      const q = query(logsRef, orderBy('timestamp', 'desc'), limit(8));
      const snap = await getDocs(q);
      const items: any[] = [];
      snap.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setRecentLogs(items);
    } catch (e) {
      console.warn('Failed to fetch activity logs:', e);
    }
  };

  const fetchPreview = async (scope: string, uid?: string) => {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/admin/testing/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ scope, targetUid: uid || selectedUserUid })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate dry-run preview');
      setPreviewData(data);
    } catch (err: any) {
      setPreviewError(err.message || 'Error generating dry-run preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const openConfirmationModal = (scope: string) => {
    setTypeConfirmationInput('');
    setActiveModalScope(scope);
    fetchPreview(scope, selectedUserUid);
  };

  useEffect(() => {
    fetchStatus();
    fetchRecentLogs();
  }, []);

  const handleExecuteReset = async (scope: string) => {
    setActiveModalScope(null);
    setExecutingScope(scope);
    setLastError(null);
    setLastResult(null);
    setLastScope(scope);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Active admin session not found. Please log in again.");
      }

      const idToken = await currentUser.getIdToken(true);

      const payload: any = {
        scope,
        confirmationKeyword: typeConfirmationInput
      };

      if (superAdminPassword.trim()) {
        payload.superAdminPassword = superAdminPassword.trim();
      }

      if (scope === 'RESET_SELECTED_USER') {
        payload.targetUid = selectedUserUid;
      }

      const res = await fetch('/api/admin/testing/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || "Testing reset failed on server.");
      }

      setLastResult(data);
      setResultModalOpen(true);
      
      // Dispatch reset event for global application state refresh
      window.dispatchEvent(new CustomEvent('cowplug_reset_completed', { detail: { scope, data } }));

      await fetchStatus();
      await fetchRecentLogs();
    } catch (err: any) {
      console.error('Testing Reset Error:', err);
      setLastError(err.message || 'An unexpected error occurred during testing reset.');
      setResultModalOpen(true);
    } finally {
      setExecutingScope(null);
      setTypeConfirmationInput('');
    }
  };

  const filteredTestUsers = status?.testUsersList?.filter(u => {
    const term = userSearchTerm.toLowerCase();
    return u.displayName.toLowerCase().includes(term) || 
           u.email.toLowerCase().includes(term) ||
           u.investorId.toLowerCase().includes(term);
  }) || [];

  const selectedUserObj = status?.testUsersList?.find(u => u.uid === selectedUserUid);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Guard Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <DatabaseBackup className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Reset Manager</h2>
              <p className="text-xs text-slate-500">
                Safely wipe test accounts and transactional simulation data to perform clean-slate testing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] font-bold text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Super Admin Shielded: tugbobodare4@gmail.com</span>
          </div>

          <Button
            onClick={fetchStatus}
            isLoading={refreshing}
            variant="outline"
            className="text-xs font-bold px-3 py-1.5 border-slate-200 text-slate-700"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")} />
            Refresh Metrics
          </Button>
        </div>
      </div>

      {/* Safety Notice Banner */}
      {status?.enabled === false ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-bold text-rose-900">Testing Reset Operations Disabled (TESTING_RESET_ENABLED=false)</p>
            <p className="text-rose-800 leading-relaxed">
              Destructive reset actions are currently rejected by server policy because <code>TESTING_RESET_ENABLED</code> is not enabled. 
              Set <code>TESTING_RESET_ENABLED="true"</code> in the environment variables to activate execution.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-bold text-amber-900">Isolated to CowPlugNG Testing Environment</p>
            <p className="text-amber-800 leading-relaxed">
              This tool operates solely on the CowPlugNG project and will never affect the B2B application or external databases. 
              The Super Admin account (<code>tugbobodare4@gmail.com</code>), platform branding, and core global settings are permanently protected against deletion across all reset operations.
            </p>
          </div>
        </div>
      )}

      {/* Super Admin Password Clearance Card */}
      <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                Super Admin Password Clearance
                {isPasswordVerified && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified & Armed
                  </span>
                )}
              </h4>
              <p className="text-[11px] text-slate-500">
                Authorizes reset operations with credentials for <code className="text-slate-800 font-semibold">tugbobodare4@gmail.com</code>
              </p>
            </div>
          </div>
          {isPasswordVerified && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsPasswordVerified(false);
                setSuperAdminPassword('');
                setPasswordFeedback(null);
              }}
              className="text-[11px] py-1 px-2.5 h-auto border-slate-200 text-slate-500 hover:text-slate-800 self-start sm:self-auto"
            >
              Clear Authorization
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter Super Admin password to authorize resets..."
              value={superAdminPassword}
              onChange={(e) => {
                setSuperAdminPassword(e.target.value);
                setIsPasswordVerified(false);
                setPasswordFeedback(null);
              }}
              className="text-xs pr-9 bg-slate-50 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <Button
            type="button"
            onClick={handleVerifyPassword}
            isLoading={verifyingPassword}
            disabled={!superAdminPassword.trim() || isPasswordVerified}
            className={cn(
              "text-xs font-bold px-4 py-2 rounded-xl shrink-0 text-white",
              isPasswordVerified ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-900 hover:bg-slate-800"
            )}
          >
            <Key className="w-3.5 h-3.5 mr-1.5" />
            {isPasswordVerified ? 'Authorized' : 'Verify Password'}
          </Button>
        </div>

        {passwordFeedback && (
          <div className={cn(
            "p-2.5 rounded-xl text-xs flex items-center gap-2",
            passwordFeedback.type === 'success' ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-rose-50 text-rose-800 border border-rose-100"
          )}>
            {passwordFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span className="font-medium">{passwordFeedback.message}</span>
          </div>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Test Users</span>
            <Users className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-xl font-black text-slate-900">
            {loading ? '...' : (status?.counts?.testUsers ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Verified test accounts</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Ambiguous</span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-xl font-black text-slate-900">
            {loading ? '...' : (status?.counts?.ambiguousUsers ?? 0)}
          </p>
          <p className="text-[10px] text-amber-600 mt-0.5 font-bold">Skipped & protected</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Livestock</span>
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-xl font-black text-slate-900">
            {loading ? '...' : (status?.counts?.totalLivestock ?? 0)}
          </p>
          <p className="text-[10px] text-emerald-600 mt-0.5 font-bold">
            {status?.counts?.assignedLivestock ?? 0} assigned
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Invoices</span>
            <FileText className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="text-xl font-black text-slate-900">
            {loading ? '...' : (status?.counts?.invoices ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Billing records</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Payments</span>
            <CreditCard className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <p className="text-xl font-black text-slate-900">
            {loading ? '...' : (status?.counts?.paymentReceipts ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Receipts submitted</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Requests</span>
            <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-xl font-black text-slate-900">
            {loading ? '...' : ((status?.counts?.consultationRequests ?? 0) + (status?.counts?.deliveryRequests ?? 0))}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Sourcing & Delivery</p>
        </div>
      </div>

      {/* 4 Reset Scope Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SCOPE 1: Reset Selected Test User */}
        <Card 
          title="Scope 1: Reset Specific Test User" 
          icon={UserX}
          className="border-slate-200 shadow-sm bg-white"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Target a specific test user account. Permanently deletes their Firebase Authentication credentials, Firestore profile, sourcing requests, invoices, payment receipts, ledger records, notifications, and automatically releases any assigned livestock back to <strong>AVAILABLE</strong>.
            </p>

            <div className="space-y-2">
              <label className="text-[10px] uppercase text-slate-500 font-bold block">
                Select Test User to Reset ({filteredTestUsers.length} verified test accounts)
              </label>

              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search test user by name, email or ID..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                <select
                  value={selectedUserUid}
                  onChange={(e) => setSelectedUserUid(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-emerald-500 text-slate-800"
                >
                  {filteredTestUsers.length === 0 ? (
                    <option value="">No matching verified test users found</option>
                  ) : (
                    filteredTestUsers.map(u => (
                      <option key={u.uid} value={u.uid}>
                        {u.displayName} ({u.email}) - {u.role.toUpperCase()}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {selectedUserObj && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">UID:</span>
                    <span className="font-mono text-slate-700">{selectedUserObj.uid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Role:</span>
                    <span className="font-bold text-slate-800 capitalize">{selectedUserObj.role}</span>
                  </div>
                  {selectedUserObj.reason && (
                    <div className="flex justify-between text-[10px] pt-1 text-slate-500">
                      <span>Test Marker:</span>
                      <span className="font-mono text-emerald-700">{selectedUserObj.reason}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button
              type="button"
              disabled={!selectedUserUid || executingScope !== null || status?.enabled === false}
              isLoading={executingScope === 'RESET_SELECTED_USER'}
              onClick={() => openConfirmationModal('RESET_SELECTED_USER')}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer"
            >
              <UserX className="w-4 h-4 mr-2" />
              Preview & Reset Selected User
            </Button>
          </div>
        </Card>

        {/* SCOPE 2: Reset All Test Users */}
        <Card 
          title="Scope 2: Reset All Test Users" 
          icon={Users}
          className="border-slate-200 shadow-sm bg-white"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Deletes <strong>positively verified test user accounts</strong> ({status?.counts?.testUsers ?? 0} accounts) from Firebase Auth and Firestore. Clears all their associated invoices, payments, requests, spending ledger, and frees any assigned livestock. 
              <strong>Ambiguous accounts without test markers are skipped and preserved for safety.</strong>
            </p>

            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                Target & Safety Scope:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800 text-[10.5px]">
                <li>{status?.counts?.testUsers ?? 0} verified test profiles will be wiped.</li>
                <li>{status?.counts?.ambiguousUsers ?? 0} ambiguous accounts will be skipped and preserved.</li>
                <li>Assigned cattle unlinked and returned to available state.</li>
                <li>Super Admin & administrative staff credentials remain untouched.</li>
              </ul>
            </div>

            <Button
              type="button"
              disabled={executingScope !== null || (status?.counts?.testUsers ?? 0) === 0 || status?.enabled === false}
              isLoading={executingScope === 'RESET_ALL_TEST_USERS'}
              onClick={() => openConfirmationModal('RESET_ALL_TEST_USERS')}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer"
            >
              <Users className="w-4 h-4 mr-2" />
              Preview & Reset All Test Users ({status?.counts?.testUsers ?? 0})
            </Button>
          </div>
        </Card>

        {/* SCOPE 3: Clear Test Firestore Data (Operational Reset) */}
        <Card 
          title="Scope 3: Clear Test Firestore Data" 
          icon={Layers}
          className="border-slate-200 shadow-sm bg-white"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Clears operational and simulation test data across 14 collections: consultation requests, invoices, payment receipts, spending ledger, delivery requests, liquidations, applications, health and growth records, announcements, and notifications. 
              Resets livestock to <strong>AVAILABLE</strong>.
            </p>

            <div className="p-3 bg-blue-50/70 border border-blue-200/70 rounded-xl text-[11px] text-blue-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                Preserved Assets:
              </p>
              <p className="text-blue-800 text-[10.5px] leading-relaxed">
                All user accounts, staff profiles, platform global settings (branding, company contacts, escrow bank details), livestock definitions, and growth package templates remain untouched.
              </p>
            </div>

            <Button
              type="button"
              disabled={executingScope !== null || status?.enabled === false}
              isLoading={executingScope === 'CLEAR_TEST_DATA'}
              onClick={() => openConfirmationModal('CLEAR_TEST_DATA')}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer"
            >
              <Layers className="w-4 h-4 mr-2" />
              Preview & Clear Operational Data
            </Button>
          </div>
        </Card>

        {/* SCOPE 4: FULL TEST RESET (Nuclear Clean-Slate) */}
        <Card 
          title="Scope 4: FULL TEST RESET (Clean Slate)" 
          icon={Flame}
          className="border-rose-200 shadow-sm bg-rose-50/20"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-extrabold text-[10px] tracking-wider uppercase">
                Complete Factory Reset
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Requires Type-To-Confirm</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              The ultimate clean-slate tool for full cycle testing. Wipes test accounts and all operational transactional logs. 
              <strong>Preserves Super Admin (<code>tugbobodare4@gmail.com</code>), Admin roles, platform global settings, pricing, and livestock catalog definitions (animals reset to Available).</strong>
            </p>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-rose-900">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                Comprehensive Testing Reset
              </p>
              <p className="text-rose-800 text-[10.5px] leading-relaxed">
                Completely clears test records to test registration, onboarding, livestock sourcing, invoice generation, payment proof upload, and approval from day one.
              </p>
            </div>

            <Button
              type="button"
              disabled={executingScope !== null || status?.enabled === false}
              isLoading={executingScope === 'FULL_TEST_RESET'}
              onClick={() => openConfirmationModal('FULL_TEST_RESET')}
              className="w-full bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer"
            >
              <Flame className="w-4 h-4 mr-2" />
              Preview & Execute Full Test Reset
            </Button>
          </div>
        </Card>

      </div>

      {/* Confirmation Modal with Live Dry-Run Preview (Phase 3 Requirement) */}
      {activeModalScope && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Reset Operation</h3>
                <p className="text-xs text-slate-500 font-mono">Scope: {activeModalScope}</p>
              </div>
            </div>

            {/* Dry-Run Analysis Box */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Pre-Execution Dry Run Analysis
                </span>
                {previewLoading ? (
                  <span className="text-[10px] text-indigo-600 flex items-center gap-1 font-mono">
                    <Loader2 className="w-3 h-3 animate-spin" /> Analyzing database...
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Verified Ready
                  </span>
                )}
              </div>

              {previewError ? (
                <p className="text-[11px] text-rose-600 font-mono">{previewError}</p>
              ) : previewData ? (
                <div className="space-y-2 text-[11px]">
                  {previewData.blockReason && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
                      {previewData.blockReason}
                    </div>
                  )}

                  {/* Summary counts */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded-xl border border-slate-100 font-mono">
                    {previewData.targetUser && (
                      <div className="col-span-2">
                        <span className="text-slate-500">Target User: </span>
                        <span className="font-bold text-slate-900">{previewData.targetUser.displayName} ({previewData.targetUser.email})</span>
                      </div>
                    )}
                    {previewData.qualifiedUsersCount !== undefined && (
                      <div>
                        <span className="text-slate-500">Test Users to wipe: </span>
                        <span className="font-bold text-rose-600">{previewData.qualifiedUsersCount}</span>
                      </div>
                    )}
                    {previewData.skippedUsersCount !== undefined && (
                      <div>
                        <span className="text-slate-500">Ambiguous skipped: </span>
                        <span className="font-bold text-amber-600">{previewData.skippedUsersCount}</span>
                      </div>
                    )}
                    {previewData.livestockToUnassign !== undefined && (
                      <div>
                        <span className="text-slate-500">Cattle to restore: </span>
                        <span className="font-bold text-emerald-700">{previewData.livestockToUnassign}</span>
                      </div>
                    )}
                    {previewData.totalOperationalRecords !== undefined && (
                      <div>
                        <span className="text-slate-500">Operational docs: </span>
                        <span className="font-bold text-blue-700">{previewData.totalOperationalRecords}</span>
                      </div>
                    )}
                  </div>

                  {/* Preserved assets list */}
                  {previewData.preservedAssets && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Preserved System Assets</p>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[10.5px]">
                        {previewData.preservedAssets.map((pa: string, idx: number) => (
                          <li key={idx}>{pa}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">Loading estimated record impact...</p>
              )}
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              {activeModalScope === 'RESET_SELECTED_USER' && (
                <div className="space-y-3">
                  <p>
                    Are you sure you want to permanently reset test user <strong>{selectedUserObj?.displayName || selectedUserUid}</strong>? 
                    Their authentication credentials and all related transactional records will be removed.
                  </p>
                  <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                        <span>Super Admin Password (Optional)</span>
                      </label>
                      {isPasswordVerified && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter Super Admin password..."
                        value={superAdminPassword}
                        onChange={(e) => {
                          setSuperAdminPassword(e.target.value);
                          setIsPasswordVerified(false);
                        }}
                        className="text-xs pr-9 bg-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeModalScope === 'RESET_ALL_TEST_USERS' && (
                <div className="space-y-3">
                  <p>
                    Are you sure you want to wipe <strong>all {status?.counts?.testUsers ?? 0} verified test users</strong>? 
                    Their authentication accounts, profile documents, and transactional records will be deleted. Ambiguous accounts will be skipped.
                  </p>
                  <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                        <span>Super Admin Password (Optional)</span>
                      </label>
                      {isPasswordVerified && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter Super Admin password..."
                        value={superAdminPassword}
                        onChange={(e) => {
                          setSuperAdminPassword(e.target.value);
                          setIsPasswordVerified(false);
                        }}
                        className="text-xs pr-9 bg-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeModalScope === 'CLEAR_TEST_DATA' && (
                <div className="space-y-3">
                  <p>
                    Are you sure you want to clear <strong>all transactional records</strong> (invoices, requests, receipts, notifications)? 
                    User profiles and platform settings will be preserved.
                  </p>
                  <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                        <span>Super Admin Password (Optional)</span>
                      </label>
                      {isPasswordVerified && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter Super Admin password..."
                        value={superAdminPassword}
                        onChange={(e) => {
                          setSuperAdminPassword(e.target.value);
                          setIsPasswordVerified(false);
                        }}
                        className="text-xs pr-9 bg-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeModalScope === 'FULL_TEST_RESET' && (
                <div className="space-y-3">
                  <p className="text-rose-700 font-bold">
                    This will perform a COMPLETE CLEAN SLATE reset of all test users, operational logs, and restore livestock to Available. Super Admin and settings are shielded.
                  </p>

                  <div className="space-y-2.5 pt-1">
                    <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                          <span>Option 1: Super Admin Password</span>
                        </label>
                        {isPasswordVerified && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter Super Admin password..."
                          value={superAdminPassword}
                          onChange={(e) => {
                            setSuperAdminPassword(e.target.value);
                            setIsPasswordVerified(false);
                          }}
                          className="text-xs pr-9 bg-white font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="relative flex py-0.5 items-center">
                      <div className="flex-grow border-t border-slate-200"></div>
                      <span className="flex-shrink mx-2 text-[10px] font-bold uppercase text-slate-400">OR</span>
                      <div className="flex-grow border-t border-slate-200"></div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Option 2: Type <span className="font-mono text-rose-600 font-black">RESET</span> to confirm:
                      </label>
                      <Input
                        type="text"
                        placeholder="Type RESET"
                        value={typeConfirmationInput}
                        onChange={(e) => setTypeConfirmationInput(e.target.value)}
                        className="font-mono text-center font-bold tracking-widest text-slate-900 uppercase bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setActiveModalScope(null);
                  setTypeConfirmationInput('');
                }}
                className="flex-1 text-xs font-bold py-2.5 rounded-xl border-slate-200 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  (previewData && previewData.canExecute === false) ||
                  (activeModalScope === 'FULL_TEST_RESET' && 
                   typeConfirmationInput.trim() !== 'RESET' && 
                   superAdminPassword.trim().length === 0)
                }
                onClick={() => handleExecuteReset(activeModalScope)}
                className={cn(
                  "flex-1 text-xs font-bold py-2.5 rounded-xl text-white cursor-pointer",
                  activeModalScope === 'FULL_TEST_RESET' ? "bg-rose-700 hover:bg-rose-800" : "bg-slate-900 hover:bg-slate-800"
                )}
              >
                Confirm & Execute
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Result Report Modal */}
      <ResetResultModal
        isOpen={resultModalOpen}
        onClose={() => setResultModalOpen(false)}
        result={lastResult}
        error={lastError}
        scope={lastScope}
      />

      {/* Audit Logs Transparency Section */}
      <div className="space-y-3 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Recent System & Reset Activity Logs
            </h3>
          </div>
          <span className="text-[10px] text-slate-400">Live from Firestore activityLogs</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs divide-y divide-slate-50">
          {recentLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No recent activity logs found.
            </div>
          ) : (
            recentLogs.map((log) => (
              <div key={log.id} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60 transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded-md font-mono text-[10px] font-bold",
                      log.action?.startsWith('TESTING_RESET') ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                    )}>
                      {log.action || 'SYSTEM_ACTION'}
                    </span>
                    <span className="font-bold text-slate-800">{log.adminName || log.userName || 'Admin'}</span>
                  </div>
                  <p className="text-slate-500 text-[11px]">{log.details || log.targetType || 'Execution logged'}</p>
                </div>
                <div className="text-[10px] text-slate-400 font-mono shrink-0">
                  {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Recent'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
