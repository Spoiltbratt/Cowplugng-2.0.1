import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { collection, doc, setDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { app, auth, db } from './firebase';

export interface PushDeviceStatus {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isRegistered: boolean;
  token: string | null;
  platform: 'android' | 'ios' | 'desktop' | 'unknown';
  isStandalone: boolean;
}

let messagingInstance: Messaging | null = null;
let foregroundListenerInitialized = false;

// Detect user client platform
export function detectPlatform(): 'android' | 'ios' | 'desktop' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/windows|macintosh|linux/i.test(ua)) return 'desktop';
  return 'unknown';
}

// Get or initialize Firebase Messaging
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  
  try {
    const supported = await isSupported();
    if (!supported) {
      console.log('[CowPlug NG Push] Firebase Messaging is not supported on this browser/environment.');
      return null;
    }

    if (!messagingInstance) {
      messagingInstance = getMessaging(app);
    }
    return messagingInstance;
  } catch (err) {
    console.warn('[CowPlug NG Push] Failed to initialize Firebase Messaging:', err);
    return null;
  }
}

// Check current Push status
export async function checkPushStatus(): Promise<PushDeviceStatus> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return {
      isSupported: false,
      permission: 'unsupported',
      isRegistered: false,
      token: null,
      platform: detectPlatform(),
      isStandalone: false
    };
  }

  const supported = await isSupported().catch(() => false);
  const permission = Notification.permission;
  const savedToken = localStorage.getItem('cowplug_fcm_token');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;

  return {
    isSupported: supported,
    permission: permission,
    isRegistered: Boolean(savedToken && permission === 'granted'),
    token: savedToken,
    platform: detectPlatform(),
    isStandalone
  };
}

// Request permission and register FCM device token
export async function requestPushPermissionAndRegister(userProfile?: { uid: string; email?: string; role?: string }): Promise<{ success: boolean; token?: string; error?: string }> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Cannot register push notifications in non-browser environment' };
  }

  if (!('Notification' in window)) {
    return { success: false, error: 'Notifications are not supported in this browser' };
  }

  try {
    // 1. Request Browser Notification Permission
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      return { success: false, error: permission === 'denied' ? 'Notification permission was denied. Please allow notifications in your browser settings.' : 'Notification permission was not granted.' };
    }

    // 2. Ensure Service Worker is registered and active
    let registration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        registration = await navigator.serviceWorker.getRegistration('/');
        if (!registration) {
          registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        }
        await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn('[CowPlug NG Push] Service Worker ready check error:', swErr);
      }
    }

    // 3. Initialize Firebase Messaging
    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      return { success: false, error: 'Firebase Messaging is not available on this browser' };
    }

    // 4. Obtain FCM Registration Token
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;
    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey: vapidKey
    });

    if (!token) {
      return { success: false, error: 'Failed to generate device registration token from Firebase Messaging' };
    }

    console.log('[CowPlug NG Push] FCM Token successfully acquired:', token.substring(0, 15) + '...');
    localStorage.setItem('cowplug_fcm_token', token);

    const currentUser = auth.currentUser;
    const uid = userProfile?.uid || currentUser?.uid;
    const email = userProfile?.email || currentUser?.email || '';
    const role = userProfile?.role || 'investor';

    if (uid) {
      // 5. Store Token in Firestore and Server backend
      const platform = detectPlatform();
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      const userAgent = navigator.userAgent;

      // Register via backend API
      try {
        const idToken = await currentUser?.getIdToken();
        if (idToken) {
          await fetch('/api/notifications/register-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              token,
              platform,
              userAgent,
              isStandalone
            })
          });
        }
      } catch (apiErr) {
        console.warn('[CowPlug NG Push] Backend token register warning:', apiErr);
      }

      // Direct Firestore backup registration for high availability
      try {
        const tokenDocId = `${uid}_${btoa(token.slice(-16)).replace(/[^a-zA-Z0-9]/g, '')}`;
        await setDoc(doc(db, 'fcmTokens', tokenDocId), {
          userId: uid,
          userEmail: email,
          userRole: role,
          token: token,
          platform: platform,
          userAgent: userAgent,
          isStandalone: isStandalone,
          active: true,
          updatedAt: Date.now()
        }, { merge: true });
      } catch (fsErr) {
        console.warn('[CowPlug NG Push] Firestore token backup write warning:', fsErr);
      }
    }

    // 6. Setup Foreground Message Listener
    setupForegroundMessageListener();

    return { success: true, token };
  } catch (error: any) {
    console.error('[CowPlug NG Push] Push registration error:', error);
    return { success: false, error: error.message || 'Failed to register push notifications' };
  }
}

// Setup foreground message listener for active app sessions
export function setupForegroundMessageListener(onNotificationReceived?: (payload: any) => void) {
  if (foregroundListenerInitialized || typeof window === 'undefined') return;

  getFirebaseMessaging().then((messaging) => {
    if (!messaging) return;

    onMessage(messaging, (payload) => {
      console.log('[CowPlug NG Push] Foreground push message received:', payload);

      const title = payload.notification?.title || payload.data?.title || 'CowPlug NG Alert';
      const body = payload.notification?.body || payload.data?.message || payload.data?.body || 'You have an update in CowPlug NG.';

      // Play soft chime sound if enabled
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } catch (e) {
        // AudioContext ignored if blocked
      }

      if (onNotificationReceived) {
        onNotificationReceived(payload);
      }
    });

    foregroundListenerInitialized = true;
  });
}

// Unregister device token
export async function unregisterCurrentDeviceToken(): Promise<{ success: boolean; error?: string }> {
  try {
    const token = localStorage.getItem('cowplug_fcm_token');
    localStorage.removeItem('cowplug_fcm_token');

    const currentUser = auth.currentUser;
    if (currentUser && token) {
      const tokenDocId = `${currentUser.uid}_${btoa(token.slice(-16)).replace(/[^a-zA-Z0-9]/g, '')}`;
      try {
        await deleteDoc(doc(db, 'fcmTokens', tokenDocId));
      } catch (e) {
        console.warn('Could not delete token from Firestore:', e);
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to unregister push device' };
  }
}

// Trigger Test Push Message
export async function sendTestPushToDevice(title = 'CowPlug NG Push Test', message = 'Real-time push notifications are active on this device!'): Promise<{ success: boolean; result?: any; error?: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { success: false, error: 'User must be signed in to send a test push' };
  }

  try {
    const idToken = await currentUser.getIdToken();
    const res = await fetch('/api/notifications/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        userId: 'TEST_ME',
        title,
        message,
        category: 'System Alerts',
        priority: 'INFO',
        actionLink: '/?tab=notifications',
        actionText: 'Open Notifications'
      })
    });

    const result = await res.json();
    return { success: res.ok && result.success, result, error: result.error || result.warning };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error sending test push' };
  }
}
