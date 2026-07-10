/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  INVESTOR = 'investor',
  CUSTODIAN = 'custodian',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export enum LivestockStatus {
  AVAILABLE = 'AVAILABLE',
  ASSIGNED = 'ASSIGNED',
  SOLD = 'SOLD',
  RETIRED = 'RETIRED',
  ACTIVE = 'ACTIVE',
  SICK = 'SICK',
  DELIVERED = 'DELIVERED',
  DECEASED = 'DECEASED',
  TRANSFERRED = 'TRANSFERRED',
  ARCHIVED = 'ARCHIVED',
}

export enum DeliveryStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export interface DeliveryRequest {
  id: string;
  investorId: string;
  livestockId: string;
  address: string;
  contactPhone: string;
  status: DeliveryStatus;
  requestedAt: number;
  scheduledAt?: number;
}

export enum SourcingRequestStatus {
  AWAITING_REVIEW = 'AWAITING_REVIEW',
  INVOICED = 'INVOICED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

export enum ConsultationRequestStatus {
  PENDING_CONTACT = 'Pending Contact',
  CONTACTED = 'Contacted',
  QUOTATION_PREPARED = 'Quotation Prepared',
  INVOICE_SENT = 'Invoice Sent',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

export enum PaymentStatus {
  AWAITING_VERIFICATION = 'AWAITING_VERIFICATION',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  name?: string; // Alias for displayName (Requested structure)
  role: UserRole;
  roleName?: string;
  permissions?: string[];
  isVerified: boolean;
  createdAt: number;
  phoneNumber?: string;
  investorId?: string; // e.g., INV-1001
  address?: string;
  photoURL?: string;
  status: 'active' | 'suspended' | 'pending';
  accountStatus?: 'active' | 'suspended' | 'pending'; // Alias for status (Requested structure)
  lastLogin?: number;
  investmentPlan?: string;
  region?: string;
}

export interface HealthRecord {
  id: string;
  livestockId: string;
  date: number;
  description: string;
  doctor: string;
  status: 'ROUTINE' | 'EMERGENCY' | 'ILLNESS';
  treatment?: string;
  photos?: string[];
}

export interface Vaccination {
  id: string;
  livestockId: string;
  date: number;
  type: string;
  notes: string;
  nextDueDate?: number;
}

export interface Livestock {
  id: string;
  tagNumber: string; // CPG-CW-0001
  rfid?: string;
  breed: string;
  gender: 'M' | 'F';
  age: string;
  weight: string;
  purchaseDate: number;
  purchasePrice?: number;
  investmentPackage: string;
  ownerId: string; // Investor ID
  custodianId: string;
  feedSchedule: string;
  growthProgress: string;
  photos: string[];
  status: LivestockStatus;
  healthStatus: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  lastUpdated: number;
  statusChangeDate?: number;
  statusChangeReason?: string;
  statusChangeNotes?: string;
  statusChangeAdminId?: string;
  statusChangeAdminName?: string;
  type?: string;
  farm?: string;
}

export interface SourcingRequest {
  id: string;
  investorId: string;
  animalType: string;
  breed: string;
  quantity: number;
  budgetRange: string;
  notes: string;
  status: SourcingRequestStatus;
  createdAt: number;
}

export interface ConsultationRequest {
  id: string;
  userId: string;
  investorName: string;
  email: string;
  phoneNumber: string;
  preferredContactMethod: 'Phone' | 'WhatsApp' | 'Email';
  preferredContactTime: string;
  budgetRange: string;
  livestockInterest: 'Cattle' | 'Rams' | 'Goats' | 'Multiple';
  notes?: string;
  status: ConsultationRequestStatus;
  createdAt: number;
  internalNotes?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  requestId: string;
  investorId: string;
  investorName?: string;
  livestockPackage?: string;
  livestockDetails?: string;
  quantity?: number;
  breed?: string;
  expectedWeightAge?: string;
  purchaseCost?: number;
  transportationCost?: number;
  veterinaryCost?: number;
  otherCharges?: number;
  amount?: number;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  dueDate: number;
  expectedTagNumbers?: string[];
  notes?: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  createdAt: number;
  items: {
    description: string;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
  bankDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
  paymentInstructions?: string;
}

export interface PaymentReceipt {
  id: string;
  invoiceId: string;
  investorId: string;
  receiptUrl: string;
  senderBank: string;
  amount: number;
  referenceNumber: string;
  status: PaymentStatus;
  notes?: string;
  createdAt: number;
}

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  location: string;
  requirements: string[];
  deadline: number;
  createdAt: number;
  status: 'OPEN' | 'CLOSED';
  salary?: string;
}

export interface InvestmentPackage {
  id: string;
  name: string;
  livestockType: string;
  managementPeriod: string;
  description: string;
  createdAt: number;
}

export interface OpportunityApplication {
  id: string;
  opportunityId: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: 'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED';
  createdAt: number;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  targetRoles: UserRole[];
  authorId: string;
  createdAt: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string; // e.g., "User registered", "Invoice generated"
  targetId: string;
  targetType: string;
  timestamp: number;
  metadata?: any;
}

export interface PlatformSettings {
  id: 'global';
  companyName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  bankDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
  invoicePrefix: string;
  tagPrefix: string;
  notificationTemplates: {
    [key: string]: string;
  };
  branding: {
    logoUrl?: string;
    primaryColor?: string;
  };
}

export type NotificationPriority = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';

export type NotificationCategory =
  | 'Announcements'
  | 'Investment Updates'
  | 'Payment Confirmations'
  | 'Deposit Confirmations'
  | 'Withdrawal Updates'
  | 'Portfolio Performance'
  | 'New Investment Opportunities'
  | 'System Maintenance'
  | 'Security Alerts'
  | 'KYC Requests'
  | 'Messages from Support';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  read: boolean;
  archived?: boolean;
  createdAt: number;
  actionText?: string;
  actionLink?: string;
}

export interface NotificationPreferences {
  browserPush: boolean;
  email: boolean;
  sms: boolean;
  investmentAlerts: boolean;
  promotional: boolean;
  securityAlerts: boolean; // Cannot be disabled (always true)
}

