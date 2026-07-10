/// <reference types="vite/client" />
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDwNZOwWgXEgBHArXc1UMfvuSR2AUrL9jU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "cowplugng-8b4ca.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "cowplugng-8b4ca",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "cowplugng-8b4ca.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "492508115182",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:492508115182:web:7ba2a59f9d6bc3d72983ff",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-Z3514GX7CS",
};

// Log warning if config is missing (will help debugging)
if (!firebaseConfig.apiKey) {
  console.warn("Firebase configuration is missing. Ensure VITE_FIREBASE environment variables are set.");
} else {
  console.log("Firebase config found for project:", firebaseConfig.projectId);
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Use the specific database ID if provided by the environment
// Ensure we don't accidentally use a Measurement ID (G-...) as a database ID
const databaseIdFromEnv = import.meta.env.VITE_FIREBASE_DATABASE_ID;
const databaseId = (databaseIdFromEnv && !databaseIdFromEnv.startsWith('G-')) 
  ? databaseIdFromEnv 
  : undefined;

console.log("Firebase Initialization: Using Database ID:", databaseId || "(default)");

export const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

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

export async function sendNotification(
  userId: string, 
  title: string, 
  message: string, 
  category: 'Announcements' | 'System Maintenance' | 'Security Alerts' | 'Investment Updates' | 'Payment Confirmations' | 'System Alerts' = 'System Alerts',
  priority: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL' = 'INFO'
) {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      message,
      category,
      priority,
      read: false,
      createdAt: Date.now()
    });
  } catch (err) {
    console.error("Failed to send notification:", err);
  }
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
