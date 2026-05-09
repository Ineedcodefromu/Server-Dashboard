import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocFromServer, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrorHandler';

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: 'owner' | 'admin' | 'user';
  permissions: string[];
  theme?: 'light' | 'dark' | 'system';
  accentColor?: 'blue' | 'purple' | 'emerald' | 'amber' | 'rose' | 'indigo';
  notifications?: {
    system: boolean;
    trading: boolean;
    security: boolean;
    email: boolean;
  };
  watchlist?: string[];
  newsFeeds?: { name: string; url: string }[];
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  effectiveRole: 'owner' | 'admin' | 'user' | null;
  loading: boolean;
  setImpersonatedRole: (role: 'owner' | 'admin' | 'user' | null) => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  effectiveRole: null,
  loading: true,
  setImpersonatedRole: () => {} 
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [impersonatedRole, setImpersonatedRole] = useState<'owner' | 'admin' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);

  const effectiveRole = impersonatedRole || profile?.role || null;

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (authUser) {
        const userRef = doc(db, 'users', authUser.uid);
        
        // Setup Real-time listener
        unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data() as UserProfile);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${authUser.uid}`);
        });

        // Initialize user if not exists
        try {
          const userDoc = await getDoc(userRef);
          const isBootstrapOwner = authUser.email === 'mathewsniko02@gmail.com';
          
          if (!userDoc.exists()) {
            const newProfile: UserProfile = {
              uid: authUser.uid,
              email: authUser.email,
              displayName: authUser.displayName,
              role: isBootstrapOwner ? 'owner' : 'user',
              permissions: isBootstrapOwner 
                ? ['dashboard.view', 'projects.view', 'projects.edit', 'code.view', 'code.edit', 'logs.view', 'users.manage'] 
                : ['dashboard.view', 'code.view', 'code.edit'],
              theme: 'dark',
              accentColor: 'blue',
              notifications: {
                system: true,
                trading: true,
                security: true,
                email: false
              }
            };
            await setDoc(userRef, newProfile);
          } else {
            const existingData = userDoc.data() as UserProfile;
            if (isBootstrapOwner && existingData.role !== 'owner') {
              // Force upgrade to owner for the bootstrap user
              await updateDoc(userRef, { 
                role: 'owner',
                permissions: Array.from(new Set([...existingData.permissions, 'users.manage', 'projects.view', 'projects.edit', 'logs.view']))
              });
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${authUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, effectiveRole, loading, setImpersonatedRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
