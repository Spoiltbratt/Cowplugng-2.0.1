import { useEffect } from 'react';
import { onMessage } from 'firebase/messaging';
import { messaging } from '../../lib/firebase';

export const PushNotificationHandler = () => {
  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground push notification received:', payload);
      
      const title = payload.notification?.title || 'CowPlug NG';
      const body = payload.notification?.body || 'New update received.';
      
      // Using a simple toast or browser notification for foreground
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body: body,
          icon: '/icons/icon-192x192.png'
        });
      } else {
        // Fallback to simple alert if not allowed or preferred
        console.log(`Foreground Notification: ${title} - ${body}`);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return null;
};
