import { UserRole } from '../types';

export interface PermissionItem {
  id: string;
  name: string;
  description: string;
}

export interface PermissionGroup {
  id: string;
  name: string;
  permissions: PermissionItem[];
}

export const ALL_PERMISSIONS: PermissionGroup[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    permissions: [
      { id: 'dashboard.view', name: 'View Dashboard', description: 'Access the main dashboard view' },
      { id: 'dashboard.analytics', name: 'View Analytics', description: 'View performance and analytical charts' },
      { id: 'dashboard.export', name: 'Export Reports', description: 'Export dashboard reports and metrics' },
    ]
  },
  {
    id: 'users',
    name: 'User Management',
    permissions: [
      { id: 'users.view', name: 'View Users', description: 'Browse and view the user directory' },
      { id: 'users.create', name: 'Create Users', description: 'Create and invite new system users' },
      { id: 'users.edit', name: 'Edit Users', description: 'Modify existing user details and permissions' },
      { id: 'users.delete', name: 'Delete Users', description: 'Permanently remove user accounts' },
      { id: 'users.suspend', name: 'Suspend Users', description: 'Suspend or reactivate user accounts' },
      { id: 'users.password_reset', name: 'Reset Passwords', description: 'Trigger password reset for users' },
    ]
  },
  {
    id: 'investors',
    name: 'Investors',
    permissions: [
      { id: 'investors.view', name: 'View Investors', description: 'View investor accounts and details' },
      { id: 'investors.create', name: 'Create Investors', description: 'Register new investor accounts' },
      { id: 'investors.edit', name: 'Edit Investors', description: 'Modify investor details' },
      { id: 'investors.delete', name: 'Delete Investors', description: 'Remove investor accounts' },
      { id: 'investors.approve', name: 'Approve Investors', description: 'Approve investor applications' },
    ]
  },
  {
    id: 'custodians',
    name: 'Custodians',
    permissions: [
      { id: 'custodians.view', name: 'View Custodians', description: 'View custodians and farm partners' },
      { id: 'custodians.create', name: 'Create Custodians', description: 'Add new custodian accounts' },
      { id: 'custodians.edit', name: 'Edit Custodians', description: 'Modify custodian details' },
      { id: 'custodians.delete', name: 'Delete Custodians', description: 'Remove custodian accounts' },
    ]
  },
  {
    id: 'livestock',
    name: 'Livestock',
    permissions: [
      { id: 'livestock.view', name: 'View Livestock', description: 'View livestock registry and records' },
      { id: 'livestock.add', name: 'Add Livestock', description: 'Add new animals/livestock to registry' },
      { id: 'livestock.edit', name: 'Edit Livestock', description: 'Modify animal details and health status' },
      { id: 'livestock.delete', name: 'Delete Livestock', description: 'Remove livestock records' },
      { id: 'livestock.verify', name: 'Verify Livestock', description: 'Verify animal tags and health statuses' },
    ]
  },
  {
    id: 'finance',
    name: 'Finance',
    permissions: [
      { id: 'finance.payments_view', name: 'View Payments', description: 'Browse payment receipts and ledger records' },
      { id: 'finance.payments_verify', name: 'Verify Payments', description: 'Approve payment proofs uploaded by investors' },
      { id: 'finance.payments_refund', name: 'Refund Payments', description: 'Process payment refunds' },
      { id: 'finance.invoices_manage', name: 'Manage Invoices', description: 'Create, issue, and delete invoices' },
    ]
  },
  {
    id: 'reports',
    name: 'Reports',
    permissions: [
      { id: 'reports.view', name: 'View Reports', description: 'View standard business and operational reports' },
      { id: 'reports.export', name: 'Export Reports', description: 'Export spreadsheet and CSV raw reports' },
      { id: 'reports.download', name: 'Download Reports', description: 'Download generated reports as PDF' },
    ]
  },
  {
    id: 'settings',
    name: 'Settings',
    permissions: [
      { id: 'settings.view', name: 'View Settings', description: 'Access system-wide setup options' },
      { id: 'settings.edit', name: 'Edit Settings', description: 'Update system preferences' },
      { id: 'settings.manage_roles', name: 'Manage Roles', description: 'Configure custom user role configurations' },
      { id: 'settings.manage_permissions', name: 'Manage Permissions', description: 'Modify role permission mapping' },
    ]
  }
];

export const ROLE_TEMPLATES = [
  {
    name: 'Super Admin',
    role: UserRole.SUPER_ADMIN,
    permissions: ALL_PERMISSIONS.flatMap(g => g.permissions.map(p => p.id))
  },
  {
    name: 'Administrator',
    role: UserRole.ADMIN,
    permissions: ALL_PERMISSIONS.flatMap(g => g.permissions.map(p => p.id)).filter(p => p !== 'users.delete')
  },
  {
    name: 'Operations Manager',
    role: UserRole.ADMIN,
    permissions: [
      'dashboard.view', 'dashboard.analytics',
      'users.view',
      'investors.view',
      'custodians.view',
      'livestock.view', 'livestock.add', 'livestock.edit', 'livestock.verify'
    ]
  },
  {
    name: 'Finance Officer',
    role: UserRole.ADMIN,
    permissions: [
      'dashboard.view', 'dashboard.analytics',
      'users.view',
      'investors.view',
      'finance.payments_view', 'finance.payments_verify', 'finance.payments_refund', 'finance.invoices_manage',
      'reports.view', 'reports.download'
    ]
  },
  {
    name: 'Customer Support',
    role: UserRole.ADMIN,
    permissions: [
      'dashboard.view',
      'users.view',
      'investors.view'
    ]
  },
  {
    name: 'Logistics Lead',
    role: UserRole.ADMIN,
    permissions: [
      'dashboard.view',
      'custodians.view'
    ]
  },
  {
    name: 'Investor Relations',
    role: UserRole.ADMIN,
    permissions: [
      'dashboard.view',
      'users.view',
      'investors.view', 'investors.create', 'investors.edit', 'investors.approve',
      'finance.payments_view'
    ]
  },
  {
    name: 'Warehouse Manager',
    role: UserRole.ADMIN,
    permissions: [
      'dashboard.view',
      'livestock.view', 'livestock.add', 'livestock.edit', 'livestock.verify'
    ]
  },
  {
    name: 'Read-Only Auditor',
    role: UserRole.ADMIN,
    permissions: [
      'dashboard.view', 'dashboard.analytics',
      'users.view',
      'investors.view',
      'custodians.view',
      'livestock.view',
      'finance.payments_view',
      'reports.view',
      'settings.view'
    ]
  }
];

export const getDefaultPermissionsForRole = (role: UserRole): string[] => {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return ROLE_TEMPLATES.find(t => t.role === UserRole.SUPER_ADMIN)?.permissions || [];
    case UserRole.ADMIN:
      return ROLE_TEMPLATES.find(t => t.name === 'Administrator')?.permissions || [];
    default:
      return [];
  }
};
