import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Shield, ShieldCheck, User as UserIcon, 
  Search, Filter, MoreVertical, Edit2, 
  Check, X, AlertCircle, Trash2, 
  Lock, Unlock, Mail, Clock, Layers, Plus, ExternalLink
} from 'lucide-react';
import { 
  collection, query, onSnapshot, doc, 
  updateDoc, deleteDoc, getDocs, where,
  addDoc, serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'user';
  groupId?: string;
  permissions: string[];
  lastActive?: any;
}

interface UserGroup {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  createdAt: any;
  isSystem?: boolean;
}

const ALL_PERMISSIONS = [
  { id: 'dashboard.view', label: 'Dashboard ansehen', category: 'Allgemein' },
  { id: 'projects.view', label: 'Projekte ansehen', category: 'Projekte' },
  { id: 'projects.edit', label: 'Projekte bearbeiten', category: 'Projekte' },
  { id: 'code.view', label: 'Code-Notizen ansehen', category: 'Entwicklung' },
  { id: 'code.edit', label: 'Code-Notizen bearbeiten', category: 'Entwicklung' },
  { id: 'logs.view', label: 'System-Logs einsehen', category: 'System' },
  { id: 'users.manage', label: 'Benutzer verwalten', category: 'Administration' },
];

export function UsersManagementView() {
  const { profile, permissions } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [editGroupData, setEditGroupData] = useState<{
    id: string;
    name: string;
    description: string;
    permissions: string[];
    isSystem?: boolean;
  } | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);

  const initializeDefaultGroups = async () => {
    setIsInitializing(true);
    try {
      const existingAdmin = groups.find(g => g.name.toLowerCase() === 'admin');
      const existingUser = groups.find(g => g.name.toLowerCase() === 'user');

      if (!existingAdmin) {
        await addDoc(collection(db, 'user_groups'), {
          name: 'Admin',
          description: 'Administratoren-Gruppe mit vollen Systemrechten.',
          permissions: ALL_PERMISSIONS.map(p => p.id),
          createdAt: serverTimestamp(),
          isSystem: true
        });
      }

      if (!existingUser) {
        await addDoc(collection(db, 'user_groups'), {
          name: 'User',
          description: 'Standard-Benutzergruppe mit Basisberechtigungen.',
          permissions: ['dashboard.view', 'projects.view', 'code.view'],
          createdAt: serverTimestamp(),
          isSystem: true
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'user_groups');
    } finally {
      setIsInitializing(false);
    }
  };

  const hasDefaultGroups = groups.some(g => g.name.toLowerCase() === 'admin') && 
                          groups.some(g => g.name.toLowerCase() === 'user');

  useEffect(() => {
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const userData = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
      setUsers(userData);
      setLoading(false);
    });

    const qGroups = query(collection(db, 'user_groups'));
    const unsubGroups = onSnapshot(qGroups, (snapshot) => {
      const groupData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserGroup));
      setGroups(groupData);
    });

    return () => {
      unsubUsers();
      unsubGroups();
    };
  }, []);

  const handleUpdateRole = async (uid: string, newRole: 'owner' | 'admin' | 'user') => {
    if (profile?.role !== 'owner' && newRole === 'owner') return;

    const userRef = doc(db, 'users', uid);
    try {
      await updateDoc(userRef, { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleUpdateUserGroup = async (uid: string, groupId: string) => {
    const userRef = doc(db, 'users', uid);
    try {
      await updateDoc(userRef, { groupId: groupId || null });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const toggleUserPermission = async (uid: string, permId: string) => {
    const user = users.find(u => u.uid === uid);
    if (!user) return;

    const newPermissions = user.permissions.includes(permId)
      ? user.permissions.filter(p => p !== permId)
      : [...user.permissions, permId];

    const userRef = doc(db, 'users', uid);
    try {
      await updateDoc(userRef, { permissions: newPermissions });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editGroupData || !editGroupData.name.trim()) return;
    
    const groupRef = doc(db, 'user_groups', editGroupData.id);
    try {
      await updateDoc(groupRef, {
        name: editGroupData.name,
        description: editGroupData.description,
        permissions: editGroupData.permissions,
        updatedAt: serverTimestamp()
      });
      setIsEditingGroup(false);
      setEditGroupData(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `user_groups/${editGroupData.id}`);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await addDoc(collection(db, 'user_groups'), {
        name: newGroupName,
        description: newGroupDesc,
        permissions: [],
        createdAt: serverTimestamp()
      });
      setNewGroupName('');
      setNewGroupDesc('');
      setIsAddingGroup(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'user_groups');
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (uid === auth.currentUser?.uid) {
      alert('Du kannst dich nicht selbst löschen!');
      return;
    }
    const user = users.find(u => u.uid === uid);
    if (user?.role === 'owner' && profile?.role !== 'owner') {
      alert('Besitzer können nur von anderen Besitzern gelöscht werden.');
      return;
    }
    if (!confirm('Benutzer wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.')) return;
    
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    if (group.isSystem) {
      alert('Systemgruppen können nicht gelöscht werden.');
      return;
    }

    const membersInGroup = users.filter(u => u.groupId === groupId);
    if (membersInGroup.length > 0) {
      alert(`Diese Gruppe kann nicht gelöscht werden, da sie noch ${membersInGroup.length} Mitglieder hat. Bitte weise die Benutzer erst einer anderen Gruppe zu.`);
      return;
    }

    if (!confirm(`Gruppe "${group.name}" wirklich löschen?`)) return;

    try {
      await deleteDoc(doc(db, 'user_groups', groupId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `user_groups/${groupId}`);
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasAccess = permissions.includes('users.manage') || profile?.role === 'owner';

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-20 glass-card rounded-3xl border-rose-500/20 bg-rose-500/5">
        <Lock className="w-12 h-12 text-rose-500 mb-4" />
        <h3 className="text-xl font-bold text-text-primary">Zugriff verweigert</h3>
        <p className="text-text-secondary text-sm">Du hast keine Berechtigung, Benutzer zu verwalten.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight">Benutzerverwaltung</h2>
          <p className="text-text-secondary text-sm">Rollen, Gruppen und Berechtigungen des Teams steuern.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary group-focus-within:text-accent transition-colors" />
            <input 
              type="text"
              placeholder={activeTab === 'users' ? "Nach Name oder E-Mail suchen..." : "Nach Gruppe suchen..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-80 bg-input-bg border border-border-subtle rounded-2xl py-3 pl-11 pr-4 text-sm focus:border-accent/40 outline-none transition-all"
            />
          </div>
          {activeTab === 'groups' && (
            <div className="flex items-center gap-2">
              {!hasDefaultGroups && (
                <button 
                  onClick={initializeDefaultGroups}
                  disabled={isInitializing}
                  className="bg-white/5 text-text-primary px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-white/10 transition-all border border-white/10 active:scale-95 whitespace-nowrap"
                >
                  <ShieldCheck className="w-5 h-5 text-accent" />
                  Standardgruppen erstellen
                </button>
              )}
              <button 
                onClick={() => setIsAddingGroup(true)}
                className="bg-accent text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-accent/20 active:scale-95 whitespace-nowrap"
              >
                <Plus className="w-5 h-5" />
                Gruppe erstellen
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-white/5 rounded-2xl w-fit">
        {[
          { id: 'users', label: 'Benutzer', icon: Users },
          { id: 'groups', label: 'Gruppen', icon: Layers },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              setSearchTerm('');
            }}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              activeTab === tab.id 
                ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' ? (
        <div className="glass-card rounded-[2.5rem] border-border-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-border-subtle">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary">Benutzer</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary">Rolle</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary">Gruppe</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary">Indiv. Berechtigungen</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-text-secondary text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="hover:bg-white/2 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                          <UserIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-text-primary">{user.displayName || 'Kein Name'}</div>
                          <div className="text-[10px] text-text-secondary font-medium tracking-tight flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${
                          user.role === 'owner' ? 'bg-amber-500/10 text-amber-500' :
                          user.role === 'admin' ? 'bg-accent/10 text-accent' :
                          'bg-slate-500/10 text-slate-500'
                        }`}>
                          {user.role === 'owner' ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                        </div>
                        <select 
                          value={user.role}
                          onChange={(e) => handleUpdateRole(user.uid, e.target.value as any)}
                          disabled={user.role === 'owner' && profile?.role !== 'owner'}
                          className="bg-transparent text-xs font-bold uppercase tracking-widest outline-none cursor-pointer hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          {profile?.role === 'owner' && <option value="owner">Owner</option>}
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <select 
                        value={user.groupId || ''}
                        onChange={(e) => handleUpdateUserGroup(user.uid, e.target.value)}
                        className="bg-input-bg/50 border border-border-subtle rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-widest outline-none cursor-pointer hover:border-accent transition-all"
                      >
                        <option value="">Keine Gruppe</option>
                        {groups.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1.5">
                        {user.permissions.slice(0, 2).map(pId => {
                          const perm = ALL_PERMISSIONS.find(ap => ap.id === pId);
                          return (
                            <span key={pId} className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-input-bg border border-border-subtle text-text-secondary">
                              {perm?.label || pId}
                            </span>
                          );
                        })}
                        {user.permissions.length > 2 && (
                          <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-input-bg border border-border-subtle text-text-secondary text-accent">
                            +{user.permissions.length - 2} Extra
                          </span>
                        )}
                        <button 
                          onClick={() => {
                            setSelectedUser(user);
                            setIsEditingUser(true);
                          }}
                          className="p-1 text-accent hover:bg-accent/10 rounded-lg transition-all"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button 
                        onClick={() => handleDeleteUser(user.uid)}
                        className="p-2 text-text-secondary hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Benutzer löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map((group) => (
            <div key={group.id} className="glass-card rounded-3xl border-border-subtle p-6 hover:border-accent/30 transition-all group flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary group-hover:text-accent group-hover:bg-accent/10 group-hover:border-accent/20 transition-all">
                  <Layers className="w-6 h-6" />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      setEditGroupData({
                        id: group.id,
                        name: group.name,
                        description: group.description,
                        permissions: group.permissions,
                        isSystem: group.isSystem
                      });
                      setIsEditingGroup(true);
                    }}
                    className="p-2 hover:bg-white/5 rounded-xl text-accent transition-colors"
                    title="Gruppe bearbeiten"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteGroup(group.id)}
                    disabled={group.isSystem}
                    className={`p-2 rounded-xl transition-colors ${group.isSystem ? 'text-text-secondary/20 cursor-not-allowed' : 'hover:bg-rose-500/10 text-rose-500'}`}
                    title={group.isSystem ? "Systemgruppen können nicht gelöscht werden" : "Löschen"}
                  >
                    <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-text-primary mb-1 flex items-center gap-2">
                {group.name}
                {group.isSystem && (
                  <span className="px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-[8px] font-black uppercase tracking-widest text-accent">
                    System
                  </span>
                )}
              </h3>
              <p className="text-xs text-text-secondary mb-6 line-clamp-2 min-h-[32px]">{group.description || 'Keine Beschreibung vorhanden.'}</p>
              
              <div className="mt-auto space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {group.permissions.slice(0, 3).map(pId => (
                    <span key={pId} className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-input-bg border border-border-subtle text-text-secondary">
                      {ALL_PERMISSIONS.find(ap => ap.id === pId)?.label || pId}
                    </span>
                  ))}
                  {group.permissions.length > 3 && (
                    <span key="more" className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-input-bg border border-border-subtle text-text-secondary">
                      +{group.permissions.length - 3}
                    </span>
                  )}
                  {group.permissions.length === 0 && (
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 italic">Keine Berechtigungen</span>
                  )}
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
                  <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary flex items-center gap-1.5">
                    <Users className="w-3 h-3" />
                    {users.filter(u => u.groupId === group.id).length} Mitglieder
                  </span>
                  <div className="flex -space-x-2">
                    {users.filter(u => u.groupId === group.id).slice(0, 3).map(u => (
                      <div key={u.uid} className="w-6 h-6 rounded-full border-2 border-slate-950 bg-accent/20 flex items-center justify-center text-[8px] font-bold text-accent" title={u.displayName}>
                        {u.displayName?.charAt(0)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {filteredGroups.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-30 grayscale">
              <Layers className="w-16 h-16 mb-4" />
              <p className="text-xl font-bold uppercase tracking-widest">Keine Gruppen gefunden</p>
            </div>
          )}
        </div>
      )}

      {/* Permissions Modal (User) */}
      <AnimatePresence>
        {isEditingUser && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingUser(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl glass-card rounded-[2rem] p-8 overflow-hidden flex flex-col max-h-[80vh] border-accent/20"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-text-primary">Individuelle Berechtigungen</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">{selectedUser.displayName} ({selectedUser.email})</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditingUser(false)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 mb-6">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-500">Hinweis zu Gruppen-Berechtigungen</h4>
                    <p className="text-[10px] text-amber-500/70">Diese Berechtigungen werden ZUSÄTZLICH zu denen seiner Gruppe ({groups.find(g => g.id === selectedUser.groupId)?.name || 'Keine Gruppe'}) vergeben.</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                {['Allgemein', 'Projekte', 'Entwicklung', 'System', 'Administration'].map(category => (
                  <div key={category} className="mb-8 last:mb-0">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-accent mb-4 ml-1">{category}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ALL_PERMISSIONS.filter(p => p.category === category).map(perm => {
                        const hasPerm = selectedUser.permissions.includes(perm.id);
                        return (
                          <button
                            key={perm.id}
                            onClick={() => toggleUserPermission(selectedUser.uid, perm.id)}
                            className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                              hasPerm 
                                ? 'bg-accent/10 border-accent/30 text-accent' 
                                : 'bg-input-bg border-border-subtle text-text-secondary hover:border-border-subtle/80'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                              hasPerm ? 'bg-accent border-accent text-white' : 'border-border-subtle'
                            }`}>
                              {hasPerm && <Check className="w-3 h-3" />}
                            </div>
                            <span className="text-xs font-bold tracking-tight">{perm.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-border-subtle flex justify-end">
                <button 
                  onClick={() => setIsEditingUser(false)}
                  className="px-8 py-3 bg-accent text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all"
                >
                  Schließen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Group Modal */}
      <AnimatePresence>
        {isEditingGroup && editGroupData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingGroup(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl glass-card rounded-[2rem] p-8 overflow-hidden flex flex-col max-h-[90vh] border-accent/20"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                    <Edit2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-text-primary">Gruppe bearbeiten</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                      {editGroupData.isSystem ? 'Systemgruppe' : 'Custom Gruppe'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditingGroup(false)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2 space-y-8">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary ml-1">Name</label>
                    <input 
                      type="text" 
                      value={editGroupData.name}
                      onChange={(e) => setEditGroupData({ ...editGroupData, name: e.target.value })}
                      disabled={editGroupData.isSystem}
                      className="w-full bg-input-bg border border-border-subtle rounded-xl py-3 px-4 text-sm focus:border-accent/40 outline-none transition-all disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary ml-1">Beschreibung</label>
                    <input 
                      type="text" 
                      value={editGroupData.description}
                      onChange={(e) => setEditGroupData({ ...editGroupData, description: e.target.value })}
                      className="w-full bg-input-bg border border-border-subtle rounded-xl py-3 px-4 text-sm focus:border-accent/40 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Permissions Grid */}
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-text-primary">Berechtigungen verwalten</h4>
                  {['Allgemein', 'Projekte', 'Entwicklung', 'System', 'Administration'].map(category => (
                    <div key={category} className="space-y-3">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-accent/60 ml-1">{category}</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {ALL_PERMISSIONS.filter(p => p.category === category).map(perm => {
                          const hasPerm = editGroupData.permissions.includes(perm.id);
                          return (
                            <button
                              key={perm.id}
                              onClick={() => {
                                const newPerms = hasPerm 
                                  ? editGroupData.permissions.filter(p => p !== perm.id)
                                  : [...editGroupData.permissions, perm.id];
                                setEditGroupData({ ...editGroupData, permissions: newPerms });
                              }}
                              className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                                hasPerm 
                                  ? 'bg-accent/10 border-accent/30 text-accent' 
                                  : 'bg-input-bg border-border-subtle text-text-secondary hover:border-border-subtle/80'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                                hasPerm ? 'bg-accent border-accent text-white' : 'border-border-subtle'
                              }`}>
                                {hasPerm && <Check className="w-3 h-3" />}
                              </div>
                              <span className="text-xs font-bold tracking-tight">{perm.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-border-subtle flex justify-end gap-3">
                <button 
                  onClick={() => setIsEditingGroup(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest text-text-secondary hover:bg-white/5 transition-all"
                >
                  Abbrechen
                </button>
                <button 
                  onClick={handleUpdateGroup}
                  className="px-8 py-3 bg-accent text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all"
                >
                  Änderungen speichern
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Group Modal */}
      <AnimatePresence>
        {isAddingGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingGroup(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg glass-card rounded-[2rem] p-8 overflow-hidden flex flex-col border-accent/20"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-text-primary">Neue Benutzergruppe</h3>
                <button onClick={() => setIsAddingGroup(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary ml-1">Gruppenname</label>
                  <input 
                    type="text" 
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="z.B. Entwickler-Team"
                    className="w-full bg-input-bg border border-border-subtle rounded-xl py-3 px-4 text-sm focus:border-accent/40 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary ml-1">Beschreibung</label>
                  <textarea 
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    placeholder="Wofür ist diese Gruppe gedacht?"
                    className="w-full bg-input-bg border border-border-subtle rounded-xl py-3 px-4 text-sm focus:border-accent/40 outline-none transition-all min-h-[100px] resize-none"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button 
                  onClick={() => setIsAddingGroup(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest text-text-secondary hover:bg-white/5 transition-all"
                >
                  Abbrechen
                </button>
                <button 
                  onClick={handleCreateGroup}
                  disabled={!newGroupName.trim()}
                  className="px-8 py-3 bg-accent text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Erstellen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
