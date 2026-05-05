import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { Shield, ShieldAlert, User, Trash2, Mail, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface SystemUser {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  displayName: string;
  permissions: string[];
}

export function SettingsView() {
  const [users, setUsers] = useState<SystemUser[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const path = 'users';
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data() as SystemUser);
      setUsers(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  }, []);

  const toggleRole = async (user: SystemUser) => {
    const path = `users/${user.uid}`;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        role: user.role === 'admin' ? 'user' : 'admin'
      });
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

  return (
    <div className="space-y-6">
      <div className="bg-[#11111a]/60 backdrop-blur-xl p-6 rounded-3xl border border-white/5">
        <h2 className="text-2xl font-bold text-white tracking-tight">Benutzer & Berechtigungen</h2>
        <p className="text-slate-500 text-sm">Verwalte hier das Team und deren Zugriffsrechte.</p>
      </div>

      <div className="bg-[#11111a]/60 rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
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
                    <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-400" />
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
                    user.role === 'admin' 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {user.role === 'admin' ? <ShieldAlert className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Aktiv
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
                      className="p-1.5 text-slate-600 hover:text-red-500 transition-colors"
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
      
      <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-3xl flex gap-4">
        <div className="p-3 bg-blue-500/10 rounded-xl shadow-xl self-start">
          <ShieldAlert className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h4 className="font-bold text-white mb-1 uppercase tracking-tight text-sm">Berechtigungshinweis</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Änderungen an Rollen und Berechtigungen greifen sofort. Admins haben vollen Zugriff auf alle Bereiche inkl. Projekten, Code und System-Logs.
          </p>
        </div>
      </div>
    </div>
  );
}
