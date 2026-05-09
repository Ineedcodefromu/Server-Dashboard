import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { 
  Shield, 
  ShieldAlert, 
  User, 
  Trash2, 
  Mail, 
  CheckCircle, 
  XCircle, 
  Bell, 
  Monitor, 
  Lock, 
  Palette, 
  Globe,
  Settings as SettingsIcon,
  Save,
  Moon,
  Sun,
  Laptop
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/AuthContext';

interface SystemUser {
  uid: string;
  email: string;
  role: 'owner' | 'admin' | 'user';
  displayName: string;
  permissions: string[];
}

export function SettingsView() {
  const { profile, effectiveRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'notifications' | 'team'>('profile');
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // Appearance States
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [accentColor, setAccentColor] = useState('blue');

  // Notification States
  const [notifications, setNotifications] = useState({
    system: true,
    trading: true,
    security: false,
    email: true
  });

  useEffect(() => {
    if (profile?.displayName) setDisplayName(profile.displayName);
    if (profile?.theme) setTheme(profile.theme);
    if (profile?.accentColor) setAccentColor(profile.accentColor);
    if (profile?.notifications) setNotifications(profile.notifications);
  }, [profile]);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const path = 'users';
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as SystemUser));
      setUsers(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  }, []);

  const handleUpdateProfile = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, { 
        displayName,
        theme,
        accentColor,
        notifications
      });
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRole = async (user: SystemUser) => {
    if (user.role === 'owner' && profile?.role !== 'owner') {
      alert('Nur ein Owner kann Owner-Rechte ändern.');
      return;
    }
    
    const path = `users/${user.uid}`;
    try {
      const userRef = doc(db, 'users', user.uid);
      let nextRole: 'owner' | 'admin' | 'user' = 'user';
      
      if (user.role === 'user') nextRole = 'admin';
      else if (user.role === 'admin' && profile?.role === 'owner') nextRole = 'owner';
      else nextRole = 'user';

      await updateDoc(userRef, { role: nextRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const deleteUser = async (uid: string) => {
    if (confirm('Bist du sicher, dass du diesen Benutzer löschen möchtest?')) {
      const path = `users/${uid}`;
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'appearance', label: 'Erscheinungsbild', icon: Palette },
    { id: 'notifications', label: 'Benachrichtigungen', icon: Bell },
    { id: 'team', label: 'Team & Rollen', icon: Shield, adminOnly: true },
  ].filter(t => !t.adminOnly || (effectiveRole === 'admin' || effectiveRole === 'owner'));

  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">System-Einstellungen</h2>
          <p className="text-slate-500 text-sm mt-1">Konfiguriere dein persönliches Erlebnis und verwalte Systemressourcen.</p>
        </div>
             {/* Tab Navigation */}
        <div className="p-1 bg-[#11111a] border border-white/5 rounded-2xl flex gap-1 self-start">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="min-h-[400px] flex flex-col gap-6"
        >
          {activeTab === 'profile' && (
            <div className="max-w-2xl space-y-6">
              <div className="bg-[#11111a]/60 p-8 rounded-3xl border border-white/5 space-y-8">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-full border-4 border-blue-600/20 p-1 relative">
                    <img 
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || '')}&background=020617&color=fff&size=128`} 
                      className="w-full h-full rounded-full bg-slate-800"
                    />
                    <button className="absolute bottom-0 right-0 p-1.5 bg-blue-600 rounded-full text-white border-2 border-[#11111a] hover:scale-110 transition-transform">
                      <SettingsIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{profile?.displayName}</h3>
                    <p className="text-slate-500 text-sm">{profile?.email}</p>
                    <div className="mt-2 inline-flex border border-white/10 px-2 py-0.5 rounded text-[10px] font-black uppercase text-blue-400 tracking-widest bg-blue-400/5">
                      {profile?.role}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Anzeigename</label>
                    <input 
                      type="text" 
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="bg-white/2 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500/50 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                      placeholder="Dein Name..."
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-Mail Adresse (Gelesen)</label>
                    <input 
                      type="email" 
                      value={profile?.email || ''} 
                      readOnly
                      className="bg-white/2 border border-white/10 rounded-xl px-4 py-3 text-slate-500 text-sm cursor-not-allowed opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="max-w-2xl space-y-6">
              <div className="bg-[#11111a]/60 p-8 rounded-3xl border border-white/5 space-y-10">
                <section>
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 px-1">Theme Modus</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'light', label: 'Hell', icon: Sun },
                      { id: 'dark', label: 'Dunkel', icon: Moon },
                      { id: 'system', label: 'System', icon: Laptop },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id as any)}
                        className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${
                          theme === t.id 
                            ? 'bg-blue-600/10 border-blue-600 text-white' 
                            : 'bg-white/2 border-white/5 text-slate-500 hover:border-white/10'
                        }`}
                      >
                        <t.icon className={`w-6 h-6 ${theme === t.id ? 'text-blue-400' : 'text-slate-600'}`} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 px-1">Akzentfarbe</h4>
                  <div className="flex flex-wrap gap-4">
                    {['blue', 'purple', 'emerald', 'amber', 'rose', 'indigo'].map(color => (
                      <button
                        key={color}
                        onClick={() => setAccentColor(color)}
                        className={`w-12 h-12 rounded-2xl transition-all relative ${
                          color === 'blue' ? 'bg-blue-600' :
                          color === 'purple' ? 'bg-purple-600' :
                          color === 'emerald' ? 'bg-emerald-600' :
                          color === 'amber' ? 'bg-amber-600' :
                          color === 'rose' ? 'bg-rose-600' :
                          'bg-indigo-600'
                        } ${accentColor === color ? 'scale-110 shadow-xl ring-4 ring-white/10' : 'hover:scale-105 shadow-md'}`}
                      >
                        {accentColor === color && (
                          <CheckCircle className="w-5 h-5 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="max-w-2xl space-y-6">
              <div className="bg-[#11111a]/60 p-8 rounded-3xl border border-white/5 space-y-6">
                {[
                  { id: 'system', label: 'System Benachrichtigungen', desc: 'Warnungen über Systemstatus und Updates.' },
                  { id: 'trading', label: 'Handels-Signale', desc: 'Alerts wenn KI-Signale generiert werden.' },
                  { id: 'security', label: 'Sicherheits-Aktivitäten', desc: 'Versuchte Logins und Passwortänderungen.' },
                  { id: 'email', label: 'E-Mail Zusammenfassung', desc: 'Wöchentlicher Report deiner Performance.' },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-white/2 rounded-2xl border border-white/5">
                    <div>
                      <p className="text-sm font-bold text-white tracking-tight">{item.label}</p>
                      <p className="text-[10px] text-slate-500 leading-tight mt-1 uppercase tracking-wider">{item.desc}</p>
                    </div>
                    <button 
                      onClick={() => setNotifications(prev => ({ ...prev, [item.id]: !prev[item.id as keyof typeof prev] }))}
                      className={`w-12 h-6 rounded-full p-1 transition-all ${
                        notifications[item.id as keyof typeof notifications] ? 'bg-blue-600' : 'bg-slate-700'
                      } relative`}
                    >
                      <motion.div 
                        initial={false}
                        animate={{ x: notifications[item.id as keyof typeof notifications] ? 24 : 0 }}
                        className="w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-6">
              <div className="bg-[#11111a]/60 p-6 rounded-3xl border border-white/5">
                <h2 className="text-2xl font-bold text-white tracking-tight">Benutzer & Berechtigungen</h2>
                <p className="text-slate-500 text-sm">Verwalte hier das Team und deren Zugriffsrechte.</p>
              </div>

              <div className="bg-[#11111a]/60 rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/2 border-b border-white/5">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Benutzer</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rolle</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {users.map((user) => (
                        <tr key={user.uid} className="hover:bg-white/2 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center overflow-hidden">
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || '')}&background=020617&color=fff`} className="w-full h-full object-cover opacity-80" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white">{user.displayName || 'Unbekannt'}</p>
                                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono tracking-tight">
                                  <Mail className="w-3 h-3" />
                                  {user.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              user.role === 'owner'
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                : user.role === 'admin' 
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {user.role === 'owner' ? <ShieldAlert className="w-3 h-3" /> : user.role === 'admin' ? <ShieldAlert className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                              <CheckCircle className="w-3.5 h-3.5" />
                              Active
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => toggleRole(user)}
                                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-slate-400 hover:border-blue-500/30 hover:text-blue-400 hover:bg-white/10 transition-all shadow-sm active:scale-95"
                              >
                                Rolle ändern
                              </button>
                              <button 
                                onClick={() => deleteUser(user.uid)}
                                disabled={user.role === 'owner'}
                                className={`p-1.5 transition-colors ${user.role === 'owner' ? 'text-slate-800 cursor-not-allowed opacity-20' : 'text-slate-600 hover:text-red-500'}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Save Action - Only for non-team tabs */}
          {activeTab !== 'team' && (
            <div className="flex justify-start">
              <button
                onClick={handleUpdateProfile}
                disabled={isSaving}
                className={`flex items-center gap-2 px-8 py-4 font-black uppercase tracking-widest text-xs rounded-2xl transition-all active:scale-95 disabled:opacity-50 shadow-2xl relative overflow-hidden group ${
                  showSaved 
                    ? 'bg-emerald-500 text-white' 
                    : isSaving 
                      ? 'bg-slate-800 text-slate-400' 
                      : 'bg-white text-black hover:bg-emerald-500 hover:text-white'
                }`}
              >
                <div className="relative z-10 flex items-center gap-2">
                  {showSaved ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : isSaving ? (
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent animate-spin rounded-full" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{showSaved ? 'Gespeichert!' : 'Einstellungen übernehmen'}</span>
                </div>
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Security Tip Overlayish Footer Card */}
      <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl flex gap-4">
        <div className="p-3 bg-amber-500/10 rounded-xl shadow-xl self-start">
          <Lock className="w-6 h-6 text-amber-500" />
        </div>
        <div>
          <h4 className="font-bold text-white mb-1 uppercase tracking-tight text-sm">Security Best Practices</h4>
          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
            Stelle sicher, dass dein Account mit Multi-Faktor-Authentifizierung gesichert ist. Ändere deine Rollen oder Team-Zugriffe nur in sicheren Umgebungen. Alle systemkritischen Aktionen werden in den System-Logs protokolliert.
          </p>
        </div>
      </div>
    </div>
  );
}

