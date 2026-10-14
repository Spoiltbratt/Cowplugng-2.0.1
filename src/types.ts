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
  AWAITING_ARRIVAL = 'AWAITING_ARRIVAL',
}

export enum DeliveryStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export type LiquidationStatus = 
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SOLD'
  | 'AWAITING_BANK_CREDIT'
  | 'AWAITING_USER_CONFIRMATION'
  | 'COMPLETED';

export interface LiquidationRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  livestockId: string;
  livestockTag: string;
  livestockBreed: string;
  originalPurchaseAmount: number;
  purchaseDate: number;
  reason: string;
  requestedAt: number;
  status: LiquidationStatus;
  
  // Admin decision
  adminId?: string;
  adminName?: string;
  adminDecisionAt?: number;
  rejectionReason?: string;
  
  // Sale details
  salePrice?: number;
  saleDate?: number;
  buyerRef?: string;
  saleNotes?: string;
  
  // Credit details
  creditedAmount?: number;
  creditDate?: number;
  paymentRef?: string;
  paymentMethod?: string;
  adjustmentNote?: string;
  
  // Receipt details
  receiptUrl?: string;
  receiptPublicId?: string;
  
  // User confirmation
  userConfirmedAt?: number;
  
  updatedAt: number;
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
  IN_PROGRESS = 'Sourcing in Progress',
  QUOTATION_PREPARED = 'Quotation Prepared',
  INVOICE_SENT = 'Invoice Sent',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

export enum PaymentStatus {
  UNDER_REVIEW = 'UNDER_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  AWAITING_VERIFICATION = 'UNDER_REVIEW', // Compatibility alias
  APPROVED = 'VERIFIED' // Compatibility alias
}

export enum VerificationStatus {
  NOT_STARTED = 'NOT_STARTED',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  VERIFICATION_ISSUE = 'VERIFICATION_ISSUE',
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
  verificationStatus: VerificationStatus;
  verifiedName?: string;
  ninNumber?: string;
  ninLocation?: string;
  ninFrontUrl?: string;
  ninBackUrl?: string;
  rejectionReason?: string;
  verificationIssueReason?: string;
  verificationIssueMessage?: string;
  verificationSubmittedAt?: number;
  verificationReviewedAt?: number;
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
  favorites?: string[];
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

export type ChargeCategory = 
  | 'Livestock Purchase' 
  | 'Livestock'
  | 'Feed & Supplement' 
  | 'Feed & Nutrition'
  | 'Farm Management' 
  | 'Veterinary / Health' 
  | 'Medication & Drugs' 
  | 'Transportation / Logistics' 
  | 'Infrastructure / Farm Construction' 
  | 'Equipment' 
  | 'Land / Farm Operations' 
  | 'Insurance' 
  | 'Other';

export interface InvoiceItem {
  id?: string;
  item?: string;
  description: string;
  category: ChargeCategory;
  quantity: number;
  unitPrice: number;
  amount: number;
  price?: number; // legacy alias
  livestockId?: string;
  livestockTag?: string;
}

export interface SpendingTransaction {
  id: string;
  userId: string;
  userName?: string;
  invoiceId: string;
  invoiceNumber?: string;
  paymentId?: string;
  livestockId?: string;
  livestockTag?: string;
  category: ChargeCategory;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  currency: string;
  status: 'CONFIRMED' | 'PENDING';
  date: number;
  createdAt?: number;
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
  livestockImageUrl?: string;
  livestockImagePublicId?: string;
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
  saleAmount?: number;
  saleDate?: number;
  saleNotes?: string;
  sourcingRequestId?: string;
  invoiceId?: string;
  paymentId?: string;
  liquidationStatus?: LiquidationStatus;
  isLiquidated?: boolean;
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
  quantity?: number;
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
  items: InvoiceItem[];
  subtotal?: number;
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
  receiptPublicId?: string;
  receiptFileName?: string;
  receiptUploadedAt?: number;
  senderBank: string;
  bankUsed?: string; // alias for senderBank
  amount: number;
  reportedAmount?: number; // alias for amount
  paymentDate?: number;
  referenceNumber: string;
  transactionRef?: string; // alias for referenceNumber
  status: PaymentStatus;
  notes?: string;
  createdAt: number;
  verifiedAt?: number;
  verifiedBy?: string;
  verifiedByName?: string;
  rejectedAt?: number;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectionReason?: string;
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
  userId?: string;
  userName?: string;
  userEmail?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  experience?: string;
  coverLetter?: string;
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
  adminId?: string; // Legacy support for admin tracking
  adminName: string; // Required for existing ActivityLogs view
  action: string; // e.g., "User registered", "Invoice generated"
  targetId: string;
  targetType: string;
  details: string;
  timestamp: number;
  metadata?: any;
}

export interface AppBrandingConfig {
  appName?: string;
  tagline?: string;
  primaryColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  cloudinaryPublicId?: string;
  storagePath?: string;
  updatedAt?: number;
  updatedBy?: string;
  updatedByName?: string;
  fileSize?: number;
  dimensions?: {
    width: number;
    height: number;
  };
  fileType?: string;
  logoSize?: number;
  logoOffsetX?: number;
  logoOffsetY?: number;
  logoWidth?: number;
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
  branding: AppBrandingConfig;
  siteControls: {
    maintenanceMode: boolean;
    maintenanceMessage?: string;
    disableNewSignups: boolean;
    requireEmailVerification: boolean;
    maxUploadSizeMB: number;
    showLiveStatsOnLanding: boolean;
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
  | 'System Alerts'
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

