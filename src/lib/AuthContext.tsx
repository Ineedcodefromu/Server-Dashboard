import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocFromServer, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrorHandler';

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: 'owner' | 'admin' | 'user';
  groupId?: string;
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
  lastActive?: any;
  dashboardLayout?: string[];
  warframe?: {
    meisterschaftsRang: number;
    stunden: number;
    clan: string;
    syndicates: {
      steelMeridian: number;
      arbitersOfHexis: number;
      cephalonSuda: number;
    };
    foundry: any[];
  };
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  effectiveRole: 'owner' | 'admin' | 'user' | null;
  permissions: string[];
  loading: boolean;
  setImpersonatedRole: (role: 'owner' | 'admin' | 'user' | null) => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  effectiveRole: null,
  permissions: [],
  loading: true,
  setImpersonatedRole: () => {} 
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [groupPermissions, setGroupPermissions] = useState<string[]>([]);
  const [impersonatedRole, setImpersonatedRole] = useState<'owner' | 'admin' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);

  const effectiveRole = impersonatedRole || profile?.role || null;
  
  // Combine user permissions and group permissions
  // If owner, they have all permissions implicitly in the app logic or through the rules
  // But for UI toggles, we combine them.
  const permissions = Array.from(new Set([
    ...(profile?.permissions || []),
    ...groupPermissions
  ]));

  useEffect(() => {
    if (profile?.groupId) {
      const unsubGroup = onSnapshot(doc(db, 'user_groups', profile.groupId), (snap) => {
        if (snap.exists()) {
          setGroupPermissions(snap.data().permissions || []);
        } else {
          setGroupPermissions([]);
        }
      });
      return () => unsubGroup();
    } else {
      setGroupPermissions([]);
    }
  }, [profile?.groupId]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let heartbeat: any;

    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (heartbeat) {
        clearInterval(heartbeat);
      }

      if (authUser) {
        const userRef = doc(db, 'users', authUser.uid);
        
        // Presence heartbeat
        const updatePresence = async () => {
          try {
            await updateDoc(userRef, { lastActive: serverTimestamp() });
          } catch (e) {
            console.error("Presence error:", e);
          }
        };
        updatePresence();
        heartbeat = setInterval(updatePresence, 30000); // every 30s
        
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
                ? ['dashboard.view', 'chat.global', 'chat.direct', 'budget.view', 'ai.use', 'projects.view', 'projects.edit', 'code.view', 'code.edit', 'logs.view', 'users.manage'] 
                : ['dashboard.view', 'chat.global', 'chat.direct', 'budget.view', 'ai.use', 'code.view', 'code.edit'],
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
                permissions: Array.from(new Set([...existingData.permissions, 'chat.global', 'chat.direct', 'budget.view', 'ai.use', 'users.manage', 'projects.view', 'projects.edit', 'logs.view']))
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
      if (heartbeat) clearInterval(heartbeat);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, effectiveRole, permissions, loading, setImpersonatedRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
