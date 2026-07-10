import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { UserProfile, UserRole } from '../types';
import { getDefaultPermissionsForRole } from './permissions';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: Error | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isInvestor: boolean;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  error: null,
  isAdmin: false,
  isSuperAdmin: false,
  isInvestor: false,
  signOut: async () => {},
  hasPermission: () => false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setError(null);
      if (user) {
        console.log("Auth success: User authenticated with UID:", user.uid);
        
        // Listen for profile changes
        const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          setError(null);
          console.log("Firestore lookup: Checking profile for UID:", user.uid);
          
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            console.log("Firestore success: Profile retrieved with role:", data.role);
            
            if (data.status === 'suspended') {
              console.warn("User is suspended. Signing out...");
              auth.signOut();
              setError(new Error("Your account has been suspended. Please contact support."));
              setProfile(null);
              setLoading(false);
              return;
            }
            
            setProfile(data);
            
            // Auto-promotion logic for the Super Admin
            if (user.email?.toLowerCase() === 'tugbobodare4@gmail.com' && data.role !== UserRole.SUPER_ADMIN) {
              console.log("Super Admin Detection: Promoting user to super_admin");
              import('firebase/firestore').then(({ updateDoc, doc: firestoreDoc }) => {
                updateDoc(firestoreDoc(db, 'users', user.uid), {
                  role: UserRole.SUPER_ADMIN,
                  status: 'active',
                  accountStatus: 'active'
                }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`));
              });
            }
            setLoading(false);
          } else {
            console.log("No profile with UID exists. Checking for pre-registered email:", user.email);
            
            // Check if there is an existing profile created by an admin with this email
            import('firebase/firestore').then(({ getDocs, query, collection, where, deleteDoc, setDoc, doc: firestoreDoc }) => {
              const usersRef = collection(db, 'users');
              const q = query(usersRef, where('email', '==', user.email));
              
              getDocs(q).then((querySnapshot) => {
                if (!querySnapshot.empty) {
                  const existingDoc = querySnapshot.docs[0];
                  const existingData = existingDoc.data() as UserProfile;
                  
                  console.log("Pre-registered user found! Migrating profile data to real UID:", user.uid);
                  const migratedProfile: UserProfile = {
                    ...existingData,
                    uid: user.uid,
                    lastLogin: Date.now()
                  };
                  
                  setDoc(firestoreDoc(db, 'users', user.uid), migratedProfile)
                    .then(() => {
                      if (existingDoc.id !== user.uid) {
                        deleteDoc(existingDoc.ref).catch(err => console.error("Error removing pre-registered temp doc:", err));
                      }
                      setProfile(migratedProfile);
                      setLoading(false);
                    })
                    .catch((err) => {
                      console.error("Error writing migrated profile:", err);
                      setLoading(false);
                    });
                } else {
                  // Fallback to standard auto-profile creation
                  const emailLower = user.email?.toLowerCase() || '';
                  let roleToAssign = UserRole.INVESTOR; // Default role
                  
                  if (emailLower === 'tugbobodare4@gmail.com') {
                    roleToAssign = UserRole.SUPER_ADMIN;
                  } else if (emailLower.includes('admin') || emailLower.includes('manager')) {
                    roleToAssign = UserRole.ADMIN;
                  } else if (emailLower.includes('custodian')) {
                    roleToAssign = UserRole.CUSTODIAN;
                  }

                  console.log(`Auto profile creation: Triggering fallback create-profile action for UID: ${user.uid} with role: ${roleToAssign}`);
                  
                  const defaultProfile: UserProfile = {
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName || user.email?.split('@')[0] || 'User',
                    name: user.displayName || user.email?.split('@')[0] || 'User',
                    role: roleToAssign,
                    status: 'active',
                    accountStatus: 'active',
                    isVerified: roleToAssign === UserRole.SUPER_ADMIN,
                    createdAt: Date.now()
                  };

                  if (roleToAssign === UserRole.INVESTOR) {
                    defaultProfile.investorId = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
                  }
                  
                  setDoc(firestoreDoc(db, 'users', user.uid), defaultProfile)
                    .then(() => {
                      console.log("Auto profile creation successful");
                      setProfile(defaultProfile);
                      setLoading(false);
                    })
                    .catch(err => {
                      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
                      setError(err as Error);
                      setLoading(false);
                    });
                }
              }).catch((err) => {
                console.error("Error querying users collection:", err);
                setLoading(false);
              });
            }).catch((err) => {
              console.error("Error importing firestore inside AuthContext fallback:", err);
              setLoading(false);
            });
          }
        }, (error) => {
          console.log(`[Auth] Firestore onSnapshot error for user ${user.uid}:`, error);
          if (error.code === 'permission-denied') {
             console.log(`[Auth] Permission denied listening to profile (likely deleted). Forcing sign-out.`);
             signOut().catch(() => {});
          } else {
             setError(error as Error);
             handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          }
          setLoading(false);
        });

        return () => {
          unsubscribeProfile();
        };
      } else {
        console.log("Auth: No user signed in");
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const isSuperAdmin = profile?.role === UserRole.SUPER_ADMIN;
  const isAdmin = isSuperAdmin || profile?.role === UserRole.ADMIN;
  const isInvestor = profile?.role === UserRole.INVESTOR;

  const hasPermission = (permission: string): boolean => {
    if (!profile) return false;
    if (profile.role === UserRole.SUPER_ADMIN) return true;
    const userPermissions = profile.permissions || getDefaultPermissionsForRole(profile.role);
    return userPermissions.includes(permission);
  };

  const signOut = async () => {
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ 
      user, profile, loading, error, 
      isAdmin, isSuperAdmin, isInvestor,
      signOut,
      hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
