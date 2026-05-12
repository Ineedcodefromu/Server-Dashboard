import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Briefcase, Columns, Bell, Terminal, TrendingUp, ChevronRight
} from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

export function StatCard({ label, value, icon: Icon, trend }: { label: string, value: string, icon: any, trend?: string }) {
  return (
    <div className="bg-[#11111a]/60 rounded-2xl border border-white/5 p-6 flex flex-col justify-between hover:border-accent/30 hover:scale-[1.02] transition-all group cursor-pointer">
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
          <Icon className="w-6 h-6" />
        </div>
        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <h4 className="text-3xl font-black text-white tracking-tighter">{value}</h4>
        {trend && (
          <span className="text-[10px] font-mono text-emerald-500 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> {trend}
          </span>
        )}
      </div>
    </div>
  );
}

export function DashboardOverview() {
  const { profile } = useAuth();
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchLogs = async () => {
      // Mock logs for now or fetched from DB
      const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(5));
      const unsub = onSnapshot(q, (snap) => {
        setRecentLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return unsub;
    };
    
    if (auth.currentUser) {
      // Tasks
      const qTasks = query(
        collection(db, 'tasks'),
        where('userId', '==', auth.currentUser.uid),
        where('status', '!=', 'done')
      );
      const unsubTasks = onSnapshot(qTasks, (snapshot) => {
        setTaskCount(snapshot.size);
      });

      // Notifications
      const qNotifs = query(
        collection(db, 'notifications'),
        where('userId', '==', auth.currentUser.uid),
        where('read', '==', false)
      );
      const unsubNotifs = onSnapshot(qNotifs, (snapshot) => {
        setUnreadCount(snapshot.size);
      });

      fetchLogs();
      return () => {
        unsubTasks();
        unsubNotifs();
      };
    }
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-white tracking-tight">Willkommen zurück, {profile?.displayName?.split(' ')[0] || 'User'}</h2>
        <p className="text-slate-500 text-sm">Dashboard Status: <span className="text-green-500 font-medium">System Online</span> • Alle Module bereit.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Projekte" value="12" icon={Briefcase} trend="+2" />
        <StatCard label="Offene Aufgaben" value={taskCount.toString()} icon={Columns} />
        <StatCard label="Alerts" value={unreadCount.toString()} icon={Bell} />
        <StatCard label="System Logs" value={recentLogs.length.toString()} icon={Terminal} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12 xl:col-span-7 bg-[#11111a]/60 rounded-2xl border border-white/5 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-white/5 bg-white/2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse"></span> Projektstatus
            </h3>
          </div>
          <div className="p-8 space-y-8">
            {[
              { name: 'OmniDash Platform', status: 'Aktiv', progress: 85, color: 'bg-accent' },
              { name: 'Mobile App Redesign', status: 'Geplant', progress: 10, color: 'bg-slate-700' },
              { name: 'API Integration', status: 'Testen', progress: 60, color: 'bg-indigo-500' },
            ].map((p) => (
              <div key={p.name} className="space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-sm font-bold text-white">{p.name}</span>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{p.status}</p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{p.progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${p.progress}%` }}
                    className={`${p.color} h-full shadow-[0_0_10px_rgba(var(--accent-rgb),0.3)]`} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-12 xl:col-span-5 bg-[#11111a]/60 rounded-2xl border border-white/5 flex flex-col">
          <div className="p-6 border-b border-white/5 bg-white/2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-500" /> Letzte Aktivität
            </h3>
          </div>
          <div className="p-6 space-y-6">
            {recentLogs.length > 0 ? (
              recentLogs.map((n) => (
                <div key={n.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${
                      n.type === 'error' ? 'bg-red-500' : 
                      n.type === 'warning' ? 'bg-amber-500' : 'bg-accent'
                    }`} />
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-accent transition-colors line-clamp-1">{n.message}</h4>
                      <span className="text-[10px] text-slate-600 font-mono italic uppercase">{n.source}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-4">
                    {n.timestamp instanceof Date ? n.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                     n.timestamp?.toDate ? n.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                     new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-700">
                <Terminal className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-[10px] uppercase font-black">Keine Aktivität</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
