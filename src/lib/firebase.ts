/// <reference types="vite/client" />
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyDwNZOwWgXEgBHArXc1UMfvuSR2AUrL9jU",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "cowplugng-8b4ca.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "cowplugng-8b4ca",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "cowplugng-8b4ca.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "492508115182",
  appId: env.VITE_FIREBASE_APP_ID || "1:492508115182:web:7ba2a59f9d6bc3d72983ff",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-Z3514GX7CS",
};

// Log warning if config is missing (will help debugging)
if (!firebaseConfig.apiKey) {
  console.warn("Firebase configuration is missing. Ensure VITE_FIREBASE environment variables are set.");
} else {
  console.log("Firebase config found for project:", firebaseConfig.projectId);
}

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const storage = getStorage(app);
export const messaging = (typeof window !== 'undefined' && 'serviceWorker' in navigator) 
  ? getMessaging(app) 
  : null as any;

// Use the specific database ID if provided by the environment
// Ensure we don't accidentally use a Measurement ID (G-...) as a database ID
const databaseIdFromEnv = env.VITE_FIREBASE_DATABASE_ID;
const databaseId = (databaseIdFromEnv && !databaseIdFromEnv.startsWith('G-')) 
  ? databaseIdFromEnv 
  : undefined;

console.log("Firebase Initialization: Using Database ID:", databaseId || "(default)");

let dbInstance;
try {
  dbInstance = initializeFirestore(app, { ignoreUndefinedProperties: true }, databaseId);
} catch (e) {
  dbInstance = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
}
export const db = dbInstance;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

import { collection, addDoc } from 'firebase/firestore';

import { UserProfile, UserRole, VerificationStatus, NotificationCategory, NotificationPriority } from '../types';

export async function sendNotification(
  userId: string, 
  title: string, 
  message: string, 
  category: NotificationCategory = 'Security Alerts',
  priority: NotificationPriority = 'INFO',
  actionLink?: string,
  actionText?: string
) {
  try {
    const payload: any = {
      userId,
      title,
      message,
      category,
      priority,
      read: false,
      createdAt: Date.now(),
    };
    if (actionLink !== undefined && actionLink !== null) payload.actionLink = actionLink;
    if (actionText !== undefined && actionText !== null) payload.actionText = actionText;

    // 1. In-App Notification (Always stored in Firestore)
    await addDoc(collection(db, 'notifications'), payload);

    // 2. Real Device Push Notification via Backend (Non-blocking)
    if (typeof window !== 'undefined') {
      const currentUser = auth.currentUser;
      if (currentUser) {
        currentUser.getIdToken().then((idToken) => {
          fetch('/api/notifications/send-push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              userId,
              title,
              message,
              category,
              priority,
              actionLink,
              actionText
            })
          }).catch((pushErr) => {
            console.warn('[Push Dispatch Client Warning]:', pushErr);
          });
        }).catch((tokenErr) => {
          console.warn('[Push Token Error]:', tokenErr);
        });
      }
    }
  } catch (err) {
    console.error("Failed to send notification:", err);
  }
}

export async function notifyAdmins(
  title: string, 
  message: string, 
  category: NotificationCategory = 'Security Alerts',
  priority: NotificationPriority = 'INFO',
  actionLink?: string,
  actionText?: string
) {
  // Use a special tag for admin broadcasts
  await sendNotification('ADMIN_BROADCAST', title, message, category, priority, actionLink, actionText);
}

export async function logActivity(
  userId: string,
  userName: string,
  action: string,
  targetType: 'USER' | 'LIVESTOCK' | 'INVOICE' | 'SETTING' | 'SYSTEM' | 'PAYMENT' | 'AUTH' | 'CONSULTATION' | 'DELIVERY' | 'ANNOUNCEMENT' | 'PACKAGE',
  targetId: string,
  details: string,
  metadata?: any
) {
  try {
    await addDoc(collection(db, 'activityLogs'), {
      userId,
      adminId: userId, // Legacy support
      adminName: userName,
      action,
      targetType,
      targetId,
      details,
      timestamp: Date.now(),
      metadata: metadata || {}
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}

export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestoreData(item)) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleanObj[key] = sanitizeFirestoreData(value);
      }
    }
    return cleanObj as T;
  }
  return obj;
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Not throwing to prevent crashing the UI on transient background errors
}
