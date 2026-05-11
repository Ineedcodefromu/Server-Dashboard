import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Shield, AlertTriangle, Info, Clock, Lock } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import axios from 'axios';

interface LogEntry {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  source: string;
  timestamp: any;
  details?: string;
  isBackend?: boolean;
}

export function LogsView() {
  const { profile, permissions } = useAuth();
  const [firestoreLogs, setFirestoreLogs] = useState<LogEntry[]>([]);
  const [backendLogs, setBackendLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'info' | 'warning' | 'error'>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Firestore Audit Logs
  useEffect(() => {
    const q = query(
      collection(db, 'logs'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isBackend: false
      })) as LogEntry[];
      setFirestoreLogs(logsData);
    });

    return () => unsubscribe();
  }, []);

  // Backend System Logs
  useEffect(() => {
    const fetchBackendLogs = async () => {
      try {
        const response = await axios.get('/api/system-logs');
        const logsWithSource = response.data.map((log: any) => ({
          ...log,
          isBackend: true,
          timestamp: { toDate: () => new Date(log.timestamp) } // Normalize timestamp
        }));
        setBackendLogs(logsWithSource);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch backend logs:', error);
      }
    };

    fetchBackendLogs();
    const interval = setInterval(fetchBackendLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  // Combine and Sort Logs
  const allLogs = [...firestoreLogs, ...backendLogs].sort((a, b) => {
    const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
    const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
    return timeB - timeA;
  }).slice(0, 50);

  const filteredLogs = allLogs.filter(log => filter === 'all' || log.type === filter);

  const hasAccess = permissions.includes('logs.view') || profile?.role === 'owner';

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-20 glass-card rounded-3xl border-rose-500/20 bg-rose-500/5">
        <Lock className="w-12 h-12 text-rose-500 mb-4" />
        <h3 className="text-xl font-bold text-text-primary">Zugriff verweigert</h3>
        <p className="text-text-secondary text-sm">Du hast keine Berechtigung, System-Logs einzusehen.</p>
      </div>
    );
  }

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'warning': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'success': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      default: return 'text-accent bg-accent/10 border-accent/20';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle className="w-3.5 h-3.5" />;
      case 'warning': return <AlertTriangle className="w-3.5 h-3.5" />;
      case 'success': return <Shield className="w-3.5 h-3.5" />;
      default: return <Info className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold bg-clip-text text-text-primary tracking-tight">System-Protokolle</h2>
          <p className="text-text-secondary text-sm">Echtzeit-Überwachung der Dashboard-Aktivitäten und Sicherheitsereignisse.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-input-bg p-1 rounded-xl border border-border-subtle">
          {(['all', 'info', 'warning', 'error'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                filter === f 
                  ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card-bg rounded-3xl border border-border-subtle overflow-hidden flex flex-col min-h-[600px] transition-colors duration-300">
        <div className="p-4 border-b border-border-subtle bg-input-bg/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Live Stream • {filteredLogs.length} Einträge</span>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-[10px] text-text-secondary font-mono">Filter: {filter.toUpperCase()}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[700px] custom-scrollbar p-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-4">
                <Clock className="w-8 h-8 text-accent animate-spin" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Lade Protokolle...</p>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-slate-700 font-bold uppercase tracking-widest text-xs">Keine Protokolle gefunden</p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-card-bg z-10 border-b border-border-subtle">
                <tr className="text-[9px] uppercase font-bold text-text-secondary tracking-[0.2em] text-left">
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Zeitstempel</th>
                  <th className="px-6 py-4">Quelle</th>
                  <th className="px-6 py-4">Ereignis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                <AnimatePresence initial={false}>
                  {filteredLogs.map((log) => (
                    <motion.tr 
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group hover:bg-card-hover transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[9px] font-black uppercase tracking-wider ${getTypeStyles(log.type)}`}>
                          {getTypeIcon(log.type)}
                          {log.type}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[11px] font-mono text-text-secondary whitespace-nowrap">
                        {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : new Date().toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest bg-input-bg px-2 py-0.5 rounded-sm">
                            {log.source}
                          </span>
                          {log.isBackend && (
                            <span className="text-[8px] font-black text-accent/80 uppercase">System</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-text-primary font-medium group-hover:text-accent transition-colors">{log.message}</span>
                          {log.details && (
                            <span className="text-xs text-text-secondary font-mono truncate max-w-xl transition-colors">
                              {log.details}
                            </span>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
