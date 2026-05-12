import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, Check, Trash2, Info, 
  CheckCircle2, AlertTriangle, AlertCircle,
  X, Circle, Calendar, Filter
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, 
  updateDoc, doc, deleteDoc, serverTimestamp, 
  orderBy, writeBatch 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: any;
}

export function NotificationsView() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const deleteNotification = async (id: string) => {
    await deleteDoc(doc(db, 'notifications', id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <Info className="w-5 h-5 text-accent" />;
    }
  };

  const filtered = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold text-text-primary tracking-tight">Benachrichtigungen</h2>
          <p className="text-text-secondary text-sm">Bleibe auf dem Laufenden über Projektfortschritte.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-input-bg rounded-2xl p-1 flex gap-1 border border-border-subtle">
            <button 
              onClick={() => setFilter('all')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all uppercase tracking-widest ${filter === 'all' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Alle
            </button>
            <button 
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all uppercase tracking-widest ${filter === 'unread' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Ungelesen
            </button>
          </div>
          <button 
            onClick={markAllAsRead}
            className="px-4 py-3 bg-white/5 border border-border-subtle hover:border-accent/30 rounded-2xl text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-accent transition-all"
          >
            Alle als gelesen markieren
          </button>
        </div>
      </div>

      <div className="space-y-4 max-w-4xl">
        <AnimatePresence mode="popLayout">
          {filtered.map((notif) => (
            <motion.div
              key={notif.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`glass-card p-5 rounded-[2rem] border transition-all flex items-start gap-5 relative group ${
                notif.read ? 'border-border-subtle bg-white/5 opacity-70' : 'border-accent/30 bg-accent/5'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                notif.read ? 'bg-slate-500/10' : 'bg-accent/10'
              }`}>
                {getIcon(notif.type)}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className={`text-sm font-bold ${notif.read ? 'text-text-secondary' : 'text-text-primary'}`}>
                    {notif.title}
                  </h4>
                  <span className="text-[10px] text-text-secondary font-medium">
                    {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Gerade jetzt'}
                  </span>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed pr-8">
                  {notif.message}
                </p>
              </div>

              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                {!notif.read && (
                  <button 
                    onClick={() => markAsRead(notif.id)}
                    className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                    title="Als gelesen markieren"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={() => deleteNotification(notif.id)}
                  className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                  title="Löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {!notif.read && (
                <div className="absolute top-5 right-5 w-2 h-2 bg-accent rounded-full animate-pulse group-hover:hidden" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
            <div className="w-20 h-20 rounded-[2.5rem] bg-input-bg border-4 border-dashed border-border-subtle flex items-center justify-center">
              <Bell className="w-8 h-8" />
            </div>
            <div>
              <p className="text-lg font-bold">Keine Benachrichtigungen</p>
              <p className="text-sm uppercase tracking-widest font-black">Alles auf dem neusten Stand</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
