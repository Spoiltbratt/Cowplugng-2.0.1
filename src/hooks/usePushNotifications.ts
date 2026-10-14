import { useState, useEffect } from 'react';
import { getToken } from 'firebase/messaging';
import { messaging, auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export const usePushNotifications = () => {
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult === 'granted') {
        await registerToken();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request notification permission');
    } finally {
      setIsLoading(false);
    }
  };

  const registerToken = async () => {
    if (!messaging || !auth.currentUser) return;
    
    try {
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        throw new Error('Push notification configuration missing: VITE_FIREBASE_VAPID_KEY is not set.');
      }
      const currentToken = await getToken(messaging, { 
        vapidKey 
      });
      if (currentToken) {
        setToken(currentToken);
        
        // Save token to Firestore using the structure expected by the backend
        await setDoc(doc(db, 'fcmTokens', `${auth.currentUser.uid}_${currentToken.slice(-16)}`), {
          userId: auth.currentUser.uid,
          token: currentToken,
          platform: 'web',
          active: true,
          updatedAt: Date.now()
        }, { merge: true });
        
        console.log('Token registered:', currentToken);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to register FCM token');
    }
  };

  return { permission, token, requestPermission, isLoading, error };
};
