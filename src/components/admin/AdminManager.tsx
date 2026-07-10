import React, { useState, useEffect } from 'react';
import { 
  Shield, Search, Plus, Trash2, 
  ShieldAlert, ShieldCheck, Mail, Key,
  MoreVertical, UserMinus, CheckCircle, XCircle,
  Users, ChevronDown, ChevronUp, Lock, RefreshCw, X
} from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc, addDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '../../types';
import { Card, Button, Badge, Input } from '../UI';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../lib/AuthContext';
import { ALL_PERMISSIONS, ROLE_TEMPLATES, getDefaultPermissionsForRole } from '../../lib/permissions';

export const AdminManager: React.FC = () => {
  const { profile, hasPermission } = useAuth();
  
  // User lists states
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Form states (Creating / Editing)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [roleNameInput, setRoleNameInput] = useState('');
  const [standardRole, setStandardRole] = useState<UserRole>(UserRole.INVESTOR);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [statusInput, setStatusInput] = useState<'active' | 'suspended' | 'pending'>('active');

  // Interactive checklist states
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [permissionSearch, setPermissionSearch] = useState('');
  const [activeTemplate, setActiveTemplate] = useState<string>('');

  // Secure User Deletion States
  const [deleteTargetUser, setDeleteTargetUser] = useState<UserProfile | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState<'idle' | 'auth_check' | 'auth_delete' | 'cascade_delete' | 'audit_log' | 'complete'>('idle');
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const [deletionReport, setDeletionReport] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Filter users based on query
  const filteredUsers = users.filter(u => 
    (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.roleName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Permission validation helper
  const canModify = (targetUser: UserProfile): { allowed: boolean; message?: string } => {
    if (!profile) return { allowed: false, message: "Authentication required." };

    // 1. Original Super Admin cannot be edited, removed, suspended, or demoted by anyone else
    if (targetUser.email === 'Tugbobodare4@gmail.com') {
      if (profile.email !== 'Tugbobodare4@gmail.com') {
        return { allowed: false, message: "Only the Super Admin can modify administrator accounts." };
      }
    }

    // 2. No Admin can remove another Admin's privileges unless they are the Super Admin
    const isTargetAdmin = targetUser.role === UserRole.SUPER_ADMIN || targetUser.role === UserRole.ADMIN;
    if (isTargetAdmin) {
      if (profile.role !== UserRole.SUPER_ADMIN) {
        return { allowed: false, message: "Only the Super Admin can modify administrator accounts." };
      }
    }

    return { allowed: true };
  };

  // Open form for editing
  const handleEditClick = (u: UserProfile) => {
    setSelectedUser(u);
    setIsEditing(true);
    setNameInput(u.displayName || u.name || '');
    setEmailInput(u.email || '');
    setPhoneInput(u.phoneNumber || '');
    setRoleNameInput(u.roleName || '');
    setStandardRole(u.role || UserRole.INVESTOR);
    setStatusInput(u.status || 'active');
    
    const existingPermissions = u.permissions || getDefaultPermissionsForRole(u.role);
    setSelectedPermissions(existingPermissions);
    
    // Auto-detect template if exact match exists
    const match = ROLE_TEMPLATES.find(t => 
      t.permissions.length === existingPermissions.length &&
      t.permissions.every(p => existingPermissions.includes(p))
    );
    setActiveTemplate(match ? match.name : 'Custom');
    
    setIsFormOpen(true);
  };

  // Open form for creating
  const handleCreateClick = () => {
    setSelectedUser(null);
    setIsEditing(false);
    setNameInput('');
    setEmailInput('');
    setPhoneInput('');
    setRoleNameInput('');
    setStandardRole(UserRole.ADMIN);
    setSelectedPermissions(ROLE_TEMPLATES.find(t => t.name === 'Administrator')?.permissions || []);
    setActiveTemplate('Administrator');
    setStatusInput('active');
    setIsFormOpen(true);
  };

  // Handle template selection change
  const handleTemplateSelect = (templateName: string) => {
    setActiveTemplate(templateName);
    if (templateName === 'Custom') return;

    const template = ROLE_TEMPLATES.find(t => t.name === templateName);
    if (template) {
      setRoleNameInput(template.name);
      setStandardRole(template.role);
      setSelectedPermissions(template.permissions);
    }
  };

  // Toggle category collapsible state
  const toggleCategory = (catId: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  // Category select all / clear all helpers
  const handleCategorySelectAll = (permissions: string[]) => {
    setSelectedPermissions(prev => {
      const rest = prev.filter(p => !permissions.includes(p));
      return [...rest, ...permissions];
    });
    setActiveTemplate('Custom');
  };

  const handleCategoryClearAll = (permissions: string[]) => {
    setSelectedPermissions(prev => prev.filter(p => !permissions.includes(p)));
    setActiveTemplate('Custom');
  };

  // Individual checkbox toggle
  const handlePermissionToggle = (permId: string) => {
    setSelectedPermissions(prev => {
      if (prev.includes(permId)) {
        return prev.filter(p => p !== permId);
      } else {
        return [...prev, permId];
      }
    });
    setActiveTemplate('Custom');
  };

  // Suspend/Reactivate toggle directly from table controls
  const handleToggleStatus = async (userToToggle: UserProfile) => {
    const val = canModify(userToToggle);
    if (!val.allowed) {
      alert(val.message);
      return;
    }

    const nextStatus = userToToggle.status === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, 'users', userToToggle.uid), { 
        status: nextStatus,
        accountStatus: nextStatus
      });

      await addDoc(collection(db, 'activityLogs'), {
        adminId: profile?.uid || 'unknown',
        adminName: profile?.displayName || profile?.email || 'Admin',
        action: 'USER_STATUS_CHANGE',
        targetId: userToToggle.uid,
        targetType: 'USER',
        newValue: { status: nextStatus },
        timestamp: Date.now()
      });

      alert(`Account status updated to ${nextStatus}.`);
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  // Delete account click
  const handleDeleteUser = async (userToDelete: UserProfile) => {
    const val = canModify(userToDelete);
    if (!val.allowed) {
      alert(val.message);
      return;
    }

    // Role verification
    const isSuperAdmin = profile?.role === UserRole.SUPER_ADMIN || profile?.email === 'Tugbobodare4@gmail.com';
    if (!isSuperAdmin) {
      alert("Unauthorized: Only Super Admins may permanently delete user accounts.");
      return;
    }

    setDeleteTargetUser(userToDelete);
    setDeletionProgress('idle');
    setDeletionError(null);
    setDeletionReport(null);
    setShowDeleteModal(true);
  };

  // Securely request the server-side deletion endpoint
  const executeSecureUserDeletion = async () => {
    if (!deleteTargetUser) return;
    setIsDeletingUser(true);
    setDeletionError(null);

    try {
      // Step 1: Checking Authentication
      setDeletionProgress('auth_check');
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Active session not found. Please log in again.");
      }
      
      const idToken = await currentUser.getIdToken(true);

      // Step 2: Delete Firebase Authentication Account
      setDeletionProgress('auth_delete');
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ targetUid: deleteTargetUser.uid })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Cascading user deletion failed on the backend.");
      }

      // Step 3: Cascading deletions on Firestore
      setDeletionProgress('cascade_delete');
      setDeletionReport(result.cascadingDeletions || null);

      // Step 4: Audit Logging and finalization
      setDeletionProgress('audit_log');
      await new Promise(resolve => setTimeout(resolve, 850));

      setDeletionProgress('complete');
      setIsFormOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      console.error("Secure User Deletion Error:", err);
      setDeletionError(err?.message || "An unexpected error occurred during permanent user deletion.");
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Trigger Password Reset Email
  const handleTriggerResetPassword = async (email: string) => {
    if (!hasPermission('users.password_reset')) {
      alert("You do not have permission to trigger password resets.");
      return;
    }

    if (window.confirm(`Send password reset link to ${email}?`)) {
      try {
        await sendPasswordResetEmail(auth, email);
        alert(`Password reset link successfully sent to ${email}.`);
      } catch (err: any) {
        alert(`Error sending password reset link: ${err.message}`);
      }
    }
  };

  // Form submit (create or update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!nameInput.trim()) {
      alert("Name is required.");
      return;
    }
    if (!emailInput.trim()) {
      alert("Email is required.");
      return;
    }

    // Protection validation
    if (isEditing && selectedUser) {
      const check = canModify(selectedUser);
      if (!check.allowed) {
        alert(check.message);
        return;
      }
    }

    // Privilege escalation check
    const isSuper = profile.role === UserRole.SUPER_ADMIN;
    if (!isSuper) {
      const myPermissions = profile.permissions || getDefaultPermissionsForRole(profile.role);
      const hasEscalated = selectedPermissions.some(p => !myPermissions.includes(p));
      if (hasEscalated) {
        alert("Privilege Escalation Warning: You cannot grant permissions that you do not possess yourself.");
        return;
      }
    }

    try {
      const payload: Partial<UserProfile> = {
        displayName: nameInput.trim(),
        name: nameInput.trim(),
        email: emailInput.trim().toLowerCase(),
        phoneNumber: phoneInput.trim(),
        role: standardRole,
        roleName: roleNameInput.trim() || 'Custom Role',
        permissions: selectedPermissions,
        status: statusInput,
        accountStatus: statusInput,
        isVerified: true
      };

      const targetUid = isEditing && selectedUser ? selectedUser.uid : `temp-${Math.random().toString(36).substring(2, 11)}`;
      const userRef = doc(db, 'users', targetUid);

      if (isEditing && selectedUser) {
        await updateDoc(userRef, payload);

        // Audit Trail Log
        await addDoc(collection(db, 'activityLogs'), {
          adminId: profile.uid,
          adminName: profile.displayName || profile.email,
          action: 'USER_PERMISSION_UPDATE',
          targetId: targetUid,
          targetType: 'USER',
          previousValue: {
            displayName: selectedUser.displayName,
            role: selectedUser.role,
            roleName: selectedUser.roleName || '',
            permissions: selectedUser.permissions || [],
            status: selectedUser.status
          },
          newValue: {
            displayName: payload.displayName,
            role: payload.role,
            roleName: payload.roleName,
            permissions: payload.permissions,
            status: payload.status
          },
          timestamp: Date.now()
        });

        alert("User account updated successfully.");
      } else {
        const createPayload: UserProfile = {
          uid: targetUid,
          email: payload.email!,
          displayName: payload.displayName!,
          name: payload.name,
          role: payload.role!,
          roleName: payload.roleName,
          permissions: payload.permissions,
          isVerified: true,
          status: payload.status!,
          accountStatus: payload.status,
          phoneNumber: payload.phoneNumber,
          createdAt: Date.now()
        };

        await setDoc(userRef, createPayload);

        // Audit Trail Log
        await addDoc(collection(db, 'activityLogs'), {
          adminId: profile.uid,
          adminName: profile.displayName || profile.email,
          action: 'USER_CREATED',
          targetId: targetUid,
          targetType: 'USER',
          newValue: createPayload,
          timestamp: Date.now()
        });

        alert(`Pre-registered user profile created under email ${payload.email}. Role and permissions will load automatically when they sign up!`);
      }

      setIsFormOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      alert(`Error saving user account: ${err.message}`);
    }
  };

  // Filter permission groups based on permissionSearch
  const filteredPermissions = ALL_PERMISSIONS.map(group => {
    const matched = group.permissions.filter(p => 
      p.name.toLowerCase().includes(permissionSearch.toLowerCase()) ||
      p.description.toLowerCase().includes(permissionSearch.toLowerCase())
    );
    return { ...group, permissions: matched };
  }).filter(group => group.permissions.length > 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input 
            placeholder="Search users by name, email, or role..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {hasPermission('users.create') && (
          <Button onClick={handleCreateClick} className="w-full md:w-auto bg-brand-green">
            <Plus className="w-4 h-4 mr-1" />
            Create Custom Role/User
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Directory List */}
        <div className="lg:col-span-2">
          <Card title="User Directory" icon={Users}>
            {loading ? (
              <div className="py-12 flex justify-center items-center">
                <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">No matching user accounts found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-brand-border">
                      <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">User Profile</th>
                      <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">System Role</th>
                      <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Assigned Title</th>
                      <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Status</th>
                      <th className="pb-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {filteredUsers.map((u) => (
                      <tr 
                        key={u.uid} 
                        className={cn(
                          "group hover:bg-brand-muted/50 transition-colors cursor-pointer",
                          selectedUser?.uid === u.uid && "bg-brand-muted"
                        )}
                        onClick={() => handleEditClick(u)}
                      >
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-brand-muted border border-brand-border flex items-center justify-center text-xs font-bold text-brand-green">
                              {(u.displayName || u.email || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white">{u.displayName || 'Unnamed User'}</p>
                              <p className="text-[10px] text-gray-500">{u.email || 'No email'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          <Badge variant={u.role === UserRole.SUPER_ADMIN ? 'primary' : 'default'}>
                            {(u.role || '').replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-4 text-sm text-gray-300 font-medium">
                          {u.roleName || '—'}
                        </td>
                        <td className="py-4">
                          <Badge variant={u.status === 'active' ? 'success' : u.status === 'suspended' ? 'error' : 'warning'}>
                            {u.status || 'pending'}
                          </Badge>
                        </td>
                        <td className="py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {hasPermission('users.suspend') && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-1 h-auto text-gray-400 hover:text-white"
                                onClick={() => handleToggleStatus(u)}
                                title={u.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}
                              >
                                {u.status === 'active' ? <UserMinus className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5 text-brand-green" />}
                              </Button>
                            )}
                            {hasPermission('users.password_reset') && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-1 h-auto text-gray-400 hover:text-white"
                                onClick={() => handleTriggerResetPassword(u.email)}
                                title="Send Reset Password Email"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {hasPermission('users.delete') && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-1 h-auto text-red-500 hover:bg-red-500/10"
                                onClick={() => handleDeleteUser(u)}
                                title="Delete Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Selected User Details Sidebar Display */}
        <div>
          <AnimatePresence mode="wait">
            {selectedUser && !isFormOpen ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Card title="User Control & Details" icon={ShieldAlert}>
                  <div className="space-y-6">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-brand-border flex items-center justify-center text-xl font-bold mb-4 text-brand-green shadow-xl shadow-brand-green/5">
                        {(selectedUser.displayName || selectedUser.email || '?')[0].toUpperCase()}
                      </div>
                      <h3 className="text-lg font-bold text-white">{selectedUser.displayName || 'Unnamed User'}</h3>
                      <p className="text-xs text-gray-400 mt-1">{selectedUser.email || 'No email'}</p>
                      {selectedUser.phoneNumber && (
                        <p className="text-[10px] text-gray-500 mt-1 font-mono">{selectedUser.phoneNumber}</p>
                      )}
                    </div>

                    <div className="space-y-3 bg-brand-dark/40 border border-brand-border rounded-xl p-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 font-medium">Assigned Custom Role</span>
                        <span className="text-white font-semibold">{selectedUser.roleName || 'No custom role name'}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 font-medium">Core System Access</span>
                        <Badge variant={selectedUser.role === UserRole.SUPER_ADMIN ? 'primary' : 'default'}>
                          {(selectedUser.role || '').replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 font-medium">Account Status</span>
                        <Badge variant={selectedUser.status === 'active' ? 'success' : selectedUser.status === 'suspended' ? 'error' : 'warning'}>
                          {selectedUser.status || 'pending'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 font-medium">Member Since</span>
                        <span className="text-gray-400 font-mono font-bold text-[10px]">
                          {selectedUser.createdAt ? formatDate(selectedUser.createdAt) : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button 
                        variant="primary" 
                        size="sm"
                        className="w-full bg-brand-green"
                        onClick={() => handleEditClick(selectedUser)}
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Edit Permissions & Role
                      </Button>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {hasPermission('users.suspend') && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className={cn(selectedUser.status === 'active' ? 'text-orange-500' : 'text-green-500')}
                            onClick={() => handleToggleStatus(selectedUser)}
                          >
                            {selectedUser.status === 'active' ? (
                              <>
                                <UserMinus className="w-3 h-3 mr-2" />
                                Suspend Account
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3 mr-2" />
                                Activate Account
                              </>
                            )}
                          </Button>
                        )}

                        {hasPermission('users.password_reset') && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleTriggerResetPassword(selectedUser.email)}
                          >
                            <Lock className="w-3 h-3 mr-2" />
                            Reset Password
                          </Button>
                        )}
                      </div>

                      {hasPermission('users.delete') && (
                        <div className="pt-4 border-t border-brand-border">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-red-500 border-red-500/20 hover:bg-red-500/10"
                            onClick={() => handleDeleteUser(selectedUser)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete Account
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : !isFormOpen ? (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-brand-border rounded-xl p-8 text-center text-gray-500">
                <div className="space-y-2">
                  <Users className="w-8 h-8 mx-auto opacity-20 text-brand-green animate-pulse" />
                  <p className="text-sm">Select a user to configure custom RBAC permissions or manage their credentials.</p>
                </div>
              </div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* Full-Screen Backdrop / Form Panel Drawer */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            {/* Dark blur backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Slide-in drawer container */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl bg-brand-surface border-l border-brand-border h-full flex flex-col shadow-2xl z-10"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-brand-border flex items-center justify-between bg-brand-card">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-brand-green" />
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {isEditing ? `Edit Security Permissions: ${nameInput}` : 'Create New Custom Role / Profile'}
                    </h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Role-Based Access Control Setup</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-brand-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Scroll Body */}
              <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Profile Core Data Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input 
                    label="Full Name / Display Name" 
                    placeholder="e.g. Kolawole Segun" 
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    required
                  />
                  <Input 
                    label="Email Address" 
                    type="email"
                    placeholder="e.g. kolasegun@company.com" 
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    disabled={isEditing} // Email is critical and unique
                    required
                  />
                  <Input 
                    label="Phone Number" 
                    type="tel"
                    placeholder="e.g. +234 803 123 4567" 
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                  />
                  
                  {/* Status selection */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-300">Account Status</label>
                    <select 
                      value={statusInput}
                      onChange={(e) => setStatusInput(e.target.value as any)}
                      className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>

                {/* Templates and Roles Configurations */}
                <div className="border-t border-brand-border pt-6 space-y-4">
                  <h4 className="text-xs font-bold text-brand-green uppercase tracking-wider">Role Designation & Templates</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Role Template Selector */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-400">Pre-defined Template</label>
                      <select 
                        value={activeTemplate}
                        onChange={(e) => handleTemplateSelect(e.target.value)}
                        className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                      >
                        <option value="Custom">Custom Permissions</option>
                        {ROLE_TEMPLATES.map(t => (
                          <option key={t.name} value={t.name}>{t.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Role Name (Custom Text) */}
                    <Input 
                      label="Assigned Role Title (Display)" 
                      placeholder="e.g. Senior Logistics Lead" 
                      value={roleNameInput}
                      onChange={(e) => {
                        setRoleNameInput(e.target.value);
                        setActiveTemplate('Custom');
                      }}
                      className="py-1 px-3 text-xs"
                    />

                    {/* Standard Role Mapping */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-400">System Platform Role</label>
                      <select 
                        value={standardRole}
                        onChange={(e) => {
                          setStandardRole(e.target.value as UserRole);
                          setActiveTemplate('Custom');
                        }}
                        className="w-full bg-brand-dark border border-brand-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        {Object.values(UserRole).map(roleOption => (
                          <option key={roleOption} value={roleOption}>{roleOption.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Permissions Matrix */}
                <div className="border-t border-brand-border pt-6 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-brand-green uppercase tracking-wider">Permissions Matrix</h4>
                      <p className="text-[10px] text-gray-500">Configure granular controls for each feature module</p>
                    </div>
                    
                    {/* Permissions Search */}
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                      <input 
                        type="text"
                        placeholder="Search permissions..." 
                        value={permissionSearch}
                        onChange={(e) => setPermissionSearch(e.target.value)}
                        className="w-full bg-brand-dark border border-brand-border rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-gray-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Collapsible checklist */}
                  <div className="space-y-3">
                    {filteredPermissions.map(group => {
                      const groupPermissionIds = group.permissions.map(p => p.id);
                      const selectedInGroup = groupPermissionIds.filter(id => selectedPermissions.includes(id));
                      const isCollapsed = !!collapsedCategories[group.id];

                      return (
                        <div key={group.id} className="border border-brand-border rounded-xl overflow-hidden bg-brand-card/50">
                          {/* Accordion Header */}
                          <div 
                            onClick={() => toggleCategory(group.id)}
                            className="px-4 py-3 bg-brand-muted/30 flex items-center justify-between cursor-pointer hover:bg-brand-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{group.name}</span>
                              <span className="text-[10px] bg-brand-muted text-gray-400 px-1.5 py-0.5 rounded-full font-bold">
                                {selectedInGroup.length} / {groupPermissionIds.length} selected
                              </span>
                            </div>

                            <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                              <button 
                                type="button"
                                onClick={() => handleCategorySelectAll(groupPermissionIds)}
                                className="text-[9px] font-black uppercase text-brand-green hover:underline tracking-widest"
                              >
                                Select All
                              </button>
                              <span className="text-gray-700">|</span>
                              <button 
                                type="button"
                                onClick={() => handleCategoryClearAll(groupPermissionIds)}
                                className="text-[9px] font-black uppercase text-red-500 hover:underline tracking-widest"
                              >
                                Clear All
                              </button>
                              <div className="text-gray-400 hover:text-white" onClick={() => toggleCategory(group.id)}>
                                {isCollapsed ? <ChevronDown className="w-4 h-4 ml-2" /> : <ChevronUp className="w-4 h-4 ml-2" />}
                              </div>
                            </div>
                          </div>

                          {/* Accordion Items List */}
                          <AnimatePresence initial={false}>
                            {!isCollapsed && (
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: 'auto' }}
                                exit={{ height: 0 }}
                                className="overflow-hidden border-t border-brand-border"
                              >
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-brand-dark/20">
                                  {group.permissions.map(perm => {
                                    const isChecked = selectedPermissions.includes(perm.id);
                                    return (
                                      <label 
                                        key={perm.id} 
                                        className={cn(
                                          "flex items-start gap-3 p-2.5 rounded-lg border border-brand-border bg-brand-card hover:bg-brand-muted/30 transition-all cursor-pointer group/item",
                                          isChecked && "border-brand-green/20 bg-brand-green/5"
                                        )}
                                      >
                                        <input 
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handlePermissionToggle(perm.id)}
                                          className="mt-0.5 accent-brand-green rounded w-3.5 h-3.5"
                                        />
                                        <div className="space-y-0.5">
                                          <p className="text-xs font-semibold text-white group-hover/item:text-brand-green transition-colors">{perm.name}</p>
                                          <p className="text-[9px] text-gray-500 font-medium leading-normal">{perm.description}</p>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Visual Summary Box */}
                <div className="bg-brand-muted/30 border border-brand-border rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <h5 className="text-xs font-bold text-gray-400">Assigned Permissions Summary</h5>
                    <Badge variant="success">{selectedPermissions.length} Enabled</Badge>
                  </div>
                  {selectedPermissions.length === 0 ? (
                    <p className="text-[10px] text-gray-500 italic">No permissions are currently selected for this user.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1 no-scrollbar">
                      {selectedPermissions.map(pId => (
                        <span key={pId} className="text-[9px] bg-brand-muted text-gray-400 px-2 py-0.5 rounded font-mono font-bold tracking-tight">
                          {pId}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

              </form>

              {/* Action footer */}
              <div className="p-4 border-t border-brand-border bg-brand-card flex items-center justify-between">
                <div>
                  {isEditing && selectedUser && hasPermission('users.delete') && (
                    <Button 
                      type="button" 
                      variant="danger" 
                      size="sm"
                      onClick={() => handleDeleteUser(selectedUser)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Delete Profile
                    </Button>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsFormOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    size="sm"
                    className="bg-brand-green"
                    onClick={handleSubmitForm}
                  >
                    <ShieldCheck className="w-4 h-4 mr-1" />
                    {isEditing ? 'Save Security Changes' : 'Create Custom Account'}
                  </Button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Secure User Deletion Confirmation & Progress Modal */}
      <AnimatePresence>
        {showDeleteModal && deleteTargetUser && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
            {/* Dark blur backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isDeletingUser && deletionProgress !== 'complete') {
                  setShowDeleteModal(false);
                }
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-brand-surface border border-brand-border rounded-2xl overflow-hidden shadow-2xl z-10"
            >
              {/* Header */}
              <div className="p-6 pb-4 border-b border-brand-border flex items-start gap-4">
                <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 text-red-500">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-white truncate">
                    Confirm Permanent Deletion
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-bold text-red-500">
                    Warning: Irreversible Action
                  </p>
                </div>
                {!isDeletingUser && deletionProgress !== 'complete' && (
                  <button 
                    onClick={() => setShowDeleteModal(false)}
                    className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-brand-muted transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Body Content */}
              <div className="p-6 space-y-4 text-left">
                {deletionProgress === 'idle' && (
                  <>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      You are initiating a secure, cascading deletion for user <span className="font-bold text-white">{deleteTargetUser.displayName || 'Unnamed User'}</span> (<span className="text-brand-green font-medium">{deleteTargetUser.email}</span>).
                    </p>

                    <div className="bg-brand-dark/40 border border-brand-border rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Retention Policy & Cascading Targets
                      </h4>
                      <p className="text-[11px] text-gray-400 leading-normal">
                        To comply with privacy laws and our platform's data retention policy, the following processes will run sequentially:
                      </p>
                      <ul className="space-y-2 text-xs text-gray-300">
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          <span>Revoke & permanently delete Firebase Auth Credentials</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          <span>Delete Firestore User Profile document</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>Cascade-delete associated user logs (Notifications, Invoices, Sourcing/Payment Receipts)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          <span>Compile permanent audit log in Platform Security trails</span>
                        </li>
                      </ul>
                    </div>

                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5">
                      <Lock className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-red-400 font-medium leading-relaxed">
                        This action permanently deletes all associated data records. It is non-reversible and cannot be undone under any circumstances.
                      </p>
                    </div>
                  </>
                )}

                {/* Progress States during execution */}
                {deletionProgress !== 'idle' && deletionProgress !== 'complete' && !deletionError && (
                  <div className="space-y-6 py-4">
                    <div className="flex flex-col items-center justify-center text-center space-y-3">
                      <RefreshCw className="w-8 h-8 text-brand-green animate-spin" />
                      <h4 className="text-sm font-bold text-white">Permanently deleting user data...</h4>
                      <p className="text-xs text-gray-400 max-w-xs">
                        Executing secure server commands. Please do not close this browser tab.
                      </p>
                    </div>

                    {/* Progress Checklist */}
                    <div className="border border-brand-border bg-brand-dark/20 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 font-medium">Progress Status</span>
                        <span className="text-brand-green font-bold uppercase tracking-wider text-[10px]">Active</span>
                      </div>
                      
                      <div className="space-y-2.5 pt-1">
                        {/* Step 1 */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-300">1. Authenticating request context</span>
                          {deletionProgress === 'auth_check' ? (
                            <RefreshCw className="w-3.5 h-3.5 text-brand-green animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 text-brand-green" />
                          )}
                        </div>

                        {/* Step 2 */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-300">2. Revoking Firebase Auth Credentials</span>
                          {deletionProgress === 'auth_check' ? (
                            <span className="text-[10px] text-gray-500 font-bold uppercase">Pending</span>
                          ) : deletionProgress === 'auth_delete' ? (
                            <RefreshCw className="w-3.5 h-3.5 text-brand-green animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 text-brand-green" />
                          )}
                        </div>

                        {/* Step 3 */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-300">3. Cascading associated Firestore records</span>
                          {['auth_check', 'auth_delete'].includes(deletionProgress) ? (
                            <span className="text-[10px] text-gray-500 font-bold uppercase">Pending</span>
                          ) : deletionProgress === 'cascade_delete' ? (
                            <RefreshCw className="w-3.5 h-3.5 text-brand-green animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 text-brand-green" />
                          )}
                        </div>

                        {/* Step 4 */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-300">4. Finalizing security audit trails</span>
                          {['auth_check', 'auth_delete', 'cascade_delete'].includes(deletionProgress) ? (
                            <span className="text-[10px] text-gray-500 font-bold uppercase">Pending</span>
                          ) : deletionProgress === 'audit_log' ? (
                            <RefreshCw className="w-3.5 h-3.5 text-brand-green animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 text-brand-green" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error State */}
                {deletionError && (
                  <div className="space-y-4 py-2 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-500">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-bold text-white">User Deletion Failed</h4>
                      <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-left text-xs text-red-400 font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {deletionError}
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      If this issue persists, verify the user configuration or secure credential permissions.
                    </p>
                  </div>
                )}

                {/* Success State */}
                {deletionProgress === 'complete' && (
                  <div className="space-y-5 py-2">
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-brand-green/10 border border-brand-green/20 flex items-center justify-center mx-auto text-brand-green">
                        <ShieldCheck className="w-6 h-6 animate-bounce" />
                      </div>
                      <h4 className="text-base font-bold text-white">Deconstruction Complete</h4>
                      <p className="text-xs text-gray-400 max-w-xs mx-auto font-medium">
                        User and all associated profile details have been permanently expunged according to retention rules.
                      </p>
                    </div>

                    {deletionReport && (
                      <div className="bg-brand-dark/40 border border-brand-border rounded-xl p-4 space-y-2.5">
                        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-brand-border pb-1.5">
                          Data Clearance Cascade Audit
                        </h5>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="flex justify-between border-b border-brand-border/20 pb-1">
                            <span className="text-gray-500">User Profile:</span>
                            <span className="text-brand-green font-bold">1 Document</span>
                          </div>
                          <div className="flex justify-between border-b border-brand-border/20 pb-1">
                            <span className="text-gray-500">Notifications:</span>
                            <span className="text-white font-bold">{deletionReport.notifications || 0} Records</span>
                          </div>
                          <div className="flex justify-between border-b border-brand-border/20 pb-1">
                            <span className="text-gray-500">Sourcing:</span>
                            <span className="text-white font-bold">{deletionReport.consultationRequests || deletionReport.sourcingRequests || 0} Records</span>
                          </div>
                          <div className="flex justify-between border-b border-brand-border/20 pb-1">
                            <span className="text-gray-500">Receipts:</span>
                            <span className="text-white font-bold">{deletionReport.paymentReceipts || 0} Records</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Deliveries:</span>
                            <span className="text-white font-bold">{deletionReport.deliveryRequests || 0} Records</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Invoices:</span>
                            <span className="text-white font-bold">{deletionReport.invoices || 0} Records</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="px-6 py-4 border-t border-brand-border bg-brand-card flex justify-end gap-2">
                {deletionProgress === 'idle' && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      className="bg-red-600 text-white font-bold"
                      onClick={executeSecureUserDeletion}
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Execute Cascade Deletion
                    </Button>
                  </>
                )}

                {deletionError && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteModal(false)}
                    >
                      Close
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-brand-green"
                      onClick={executeSecureUserDeletion}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Retry Execution
                    </Button>
                  </>
                )}

                {deletionProgress === 'complete' && (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-brand-green w-full"
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteTargetUser(null);
                    }}
                  >
                    Close & Finish
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
