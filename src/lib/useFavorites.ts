import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from './firebase';

export function useFavorites() {
  const { user, profile } = useAuth();
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const storageKey = `cowplug_favs_${user?.uid || 'guest'}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored);
      return profile?.favorites || [];
    } catch {
      return profile?.favorites || [];
    }
  });

  // Keep in sync with user profile favorites from Firestore
  useEffect(() => {
    if (profile?.favorites && Array.isArray(profile.favorites)) {
      setFavorites(profile.favorites);
      try {
        const storageKey = `cowplug_favs_${profile.uid}`;
        localStorage.setItem(storageKey, JSON.stringify(profile.favorites));
      } catch {}
    }
  }, [profile?.favorites, profile?.uid]);

  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (id: string, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      if (!id) return;

      const alreadyFav = favorites.includes(id);
      const updated = alreadyFav
        ? favorites.filter((f) => f !== id)
        : [...favorites, id];

      setFavorites(updated);

      const storageKey = `cowplug_favs_${user?.uid || 'guest'}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}

      if (user?.uid) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            favorites: alreadyFav ? arrayRemove(id) : arrayUnion(id),
          });
        } catch (err) {
          console.warn('Could not persist favorite to Firestore:', err);
        }
      }
    },
    [favorites, user?.uid]
  );

  return { favorites, isFavorite, toggleFavorite };
}
