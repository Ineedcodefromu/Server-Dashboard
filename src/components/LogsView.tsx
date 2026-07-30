import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, deleteDoc, updateDoc, writeBatch, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, Shield, ShieldAlert, AlertTriangle, Info, Clock, 
  Lock, Monitor, Smartphone, LogOut, Trash2, Key, Settings, 
  UserCheck, Search, Filter, RotateCcw, Laptop, Activity, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import axios from 'axios';
import { logAuditEvent } from '../lib/auditLogger';

interface LogEntry {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  source: string;
  timestamp: any;
  details?: string;
  isBackend?: boolean;
}

interface AuditLogEntry {
  id: string;
  action: string;
  category: 'security' | 'settings' | 'users' | 'paypal' | 'auth';
  details: string;
  previousValue?: string | null;
  newValue?: string | null;
  userId: string;
  userEmail: string;
  timestamp: any;
  ip?: string;
  userAgent?: string;
}

interface ActiveSession {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  userAgent: string;
  platform: string;
  lastActive: number;
  status: 'online' | 'idle' | 'offline';
  revoked?: boolean;
}

export function LogsView() {
  const { profile, effectiveRole, permissions, user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'system' | 'audit' | 'sessions'>('audit');

  // System Logs States
  const [firestoreLogs, setFirestoreLogs] = useState<LogEntry[]>([]);
  const [backendLogs, setBackendLogs] = useState<LogEntry[]>([]);
  const [systemFilter, setSystemFilter] = useState<'all' | 'info' | 'warning' | 'error'>('all');
  const [isLoadingSystem, setIsLoadingSystem] = useState(true);

  // Audit Logs States
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogEntry | null>(null);

  // Active Sessions States
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [sessionSearch, setSessionSearch] = useState('');
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [isTerminatingAll, setIsTerminatingAll] = useState(false);

  const isOwnerOrAdmin = effectiveRole === 'owner' || effectiveRole === 'admin' || currentUser?.email === 'mathewsniko02@gmail.com';
  const hasAccess = permissions.includes('logs.view') || isOwnerOrAdmin;

  // 1. Fetch System Logs
  useEffect(() => {
    if (activeTab !== 'system') return;
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

    const fetchBackendLogs = async () => {
      try {
        const response = await axios.get('/api/system-logs');
        const logsWithSource = response.data.map((log: any) => ({
          ...log,
          isBackend: true,
          timestamp: { toDate: () => new Date(log.timestamp) }
        }));
        setBackendLogs(logsWithSource);
        setIsLoadingSystem(false);
      } catch (error) {
        console.error('Failed to fetch backend logs:', error);
        setIsLoadingSystem(false);
      }
    };

    fetchBackendLogs();
    const interval = setInterval(fetchBackendLogs, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [activeTab]);

  // 2. Fetch Security Audit Logs
  useEffect(() => {
    if (activeTab !== 'audit') return;
    const q = query(
      collection(db, 'audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AuditLogEntry[];
      setAuditLogs(logsData);
    });

    return () => unsubscribe();
  }, [activeTab]);

  // 3. Fetch Active Sessions
  useEffect(() => {
    if (activeTab !== 'sessions') return;
    const q = query(
      collection(db, 'active_sessions')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const sessionData = snapshot.docs.map(doc => {
        const data = doc.data();
        const diffSec = (now - (data.lastActive || 0)) / 1000;
        let computedStatus: 'online' | 'idle' | 'offline' = 'online';
        if (diffSec > 120) computedStatus = 'offline';
        else if (diffSec > 45) computedStatus = 'idle';

        return {
          id: doc.id,
          ...data,
          status: computedStatus
        } as ActiveSession;
      });

      // Sort by last active (most recent first)
      sessionData.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
      setSessions(sessionData);
    });

    return () => unsubscribe();
  }, [activeTab]);

  // Combine and Sort System Logs
  const allSystemLogs = [...firestoreLogs, ...backendLogs].sort((a, b) => {
    const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
    const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
    return timeB - timeA;
  }).slice(0, 50);

  const filteredSystemLogs = allSystemLogs.filter(log => systemFilter === 'all' || log.type === systemFilter);

  // Filter Audit Logs
  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesCategory = auditCategoryFilter === 'all' || log.category === auditCategoryFilter;
    const matchesSearch = !auditSearch || 
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.details.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(auditSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Filter Active Sessions
  const filteredSessions = sessions.filter(s => {
    if (!sessionSearch) return true;
    return s.email.toLowerCase().includes(sessionSearch.toLowerCase()) ||
           s.displayName.toLowerCase().includes(sessionSearch.toLowerCase()) ||
           s.userAgent.toLowerCase().includes(sessionSearch.toLowerCase());
  });

  // Terminate Single Remote Session
  const handleTerminateSession = async (sessionId: string, userEmail: string) => {
    setRevokingSessionId(sessionId);
    try {
      const sessionRef = doc(db, 'active_sessions', sessionId);
      await updateDoc(sessionRef, { revoked: true });
      await deleteDoc(sessionRef);

      await logAuditEvent(
        'REMOTE_SESSION_BEENDET',
        'security',
        `Administrator hat die aktive Session '${sessionId}' von Nutzer ${userEmail} remote beendet.`,
        null,
        { sessionId, targetEmail: userEmail }
      );
    } catch (err) {
      console.error("Failed to revoke session:", err);
    } finally {
      setRevokingSessionId(null);
    }
  };

  // Terminate All Fremde Sessions
  const handleTerminateAllOtherSessions = async () => {
    if (!confirm("Bist du sicher, dass du ALLE anderen aktiven Sessions aller Nutzer abmelden möchtest?")) return;
    setIsTerminatingAll(true);
    try {
      const currentSessId = sessionStorage.getItem('app_session_id');
      const snap = await getDocs(collection(db, 'active_sessions'));
      const batch = writeBatch(db);

      let terminatedCount = 0;
      snap.docs.forEach((docSnap) => {
        if (docSnap.id !== currentSessId) {
          batch.update(docSnap.ref, { revoked: true });
          batch.delete(docSnap.ref);
          terminatedCount++;
        }
      });

      await batch.commit();

      await logAuditEvent(
        'ALLE_REMOTE_SESSIONS_BEENDET',
        'security',
        `Owner hat alle ${terminatedCount} fremden aktiven Sessions im Gesamtsystem remote beendet.`,
        null,
        { terminatedCount }
      );
    } catch (err) {
      console.error("Failed to revoke all sessions:", err);
    } finally {
      setIsTerminatingAll(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-20 glass-card rounded-3xl border-rose-500/20 bg-rose-500/5">
        <Lock className="w-12 h-12 text-rose-500 mb-4" />
        <h3 className="text-xl font-bold text-text-primary">Zugriff verweigert</h3>
        <p className="text-text-secondary text-sm">Du hast keine Berechtigung, die Sicherheits- & Audit-Protokolle einzusehen.</p>
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

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'security': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'settings': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'paypal': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'users': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default: return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  const parseDevice = (ua: string) => {
    if (/iphone|ipad|ipod/i.test(ua)) return { icon: Smartphone, name: 'iOS Device' };
    if (/android/i.test(ua)) return { icon: Smartphone, name: 'Android Device' };
    if (/mac/i.test(ua)) return { icon: Laptop, name: 'macOS Workstation' };
    if (/win/i.test(ua)) return { icon: Monitor, name: 'Windows PC' };
    if (/linux/i.test(ua)) return { icon: Monitor, name: 'Linux Workstation' };
    return { icon: Laptop, name: 'Web Client' };
  };

  const parseBrowser = (ua: string) => {
    if (/edg/i.test(ua)) return 'Microsoft Edge';
    if (/chrome|crios/i.test(ua)) return 'Google Chrome';
    if (/firefox|fxios/i.test(ua)) return 'Mozilla Firefox';
    if (/safari/i.test(ua)) return 'Apple Safari';
    return 'Web Browser';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-accent" />
            <h2 className="text-3xl font-black bg-clip-text text-text-primary tracking-tight">Sicherheits- & Audit-Konsole</h2>
          </div>
          <p className="text-text-secondary text-sm">Owner-Nachverfolgung aller System-Änderungen & Echtzeit-Session-Verwaltung.</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-input-bg p-1.5 rounded-2xl border border-border-subtle self-start lg:self-auto">
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'audit' 
                ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Shield className="w-4 h-4" />
            Sicherheits-Audit ({auditLogs.length})
          </button>

          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'sessions' 
                ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Activity className="w-4 h-4" />
            Aktive Sessions ({sessions.filter(s => s.status === 'online').length})
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'system' 
                ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Terminal className="w-4 h-4" />
            System-Logs
          </button>
        </div>
      </div>

      {/* TAB 1: SICHERHEITS-AUDIT-LOG */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card-bg p-4 rounded-2xl border border-border-subtle">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input 
                type="text" 
                placeholder="Audit-Logs durchsuchen..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-input-bg border border-border-subtle rounded-xl text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <Filter className="w-4 h-4 text-text-secondary shrink-0" />
              {(['all', 'security', 'settings', 'paypal', 'users'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setAuditCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 transition-all ${
                    auditCategoryFilter === cat 
                      ? 'bg-accent/20 text-accent border border-accent/40' 
                      : 'bg-input-bg text-text-secondary hover:text-text-primary border border-border-subtle'
                  }`}
                >
                  {cat === 'all' ? 'Alle Kategorien' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-card-bg rounded-3xl border border-border-subtle overflow-hidden min-h-[500px]">
            <div className="p-4 border-b border-border-subtle bg-input-bg/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-accent" />
                <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">
                  Administrator-Änderungsprotokoll • {filteredAuditLogs.length} Ereignisse
                </span>
              </div>
              <span className="text-[10px] text-text-secondary font-mono">Unveränderliches Audit-Log</span>
            </div>

            <div className="overflow-x-auto">
              {filteredAuditLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 text-center">
                  <ShieldAlert className="w-12 h-12 text-slate-600 mb-3" />
                  <p className="text-sm font-bold text-text-secondary uppercase tracking-wider">Keine Audit-Einträge vorhanden</p>
                  <p className="text-xs text-slate-500 mt-1">Änderungen an PayPal-Keys, Rollen oder System-Einstellungen werden hier protokolliert.</p>
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-[9px] uppercase font-black text-text-secondary tracking-[0.2em] text-left border-b border-border-subtle bg-card-bg">
                      <th className="px-6 py-4">Kategorie</th>
                      <th className="px-6 py-4">Ereignis / Aktion</th>
                      <th className="px-6 py-4">Ausgeführt von</th>
                      <th className="px-6 py-4">Zeitstempel</th>
                      <th className="px-6 py-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-card-hover transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[9px] font-black uppercase tracking-wider ${getCategoryBadge(log.category)}`}>
                            {log.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-text-primary group-hover:text-accent transition-colors">
                              {log.action}
                            </span>
                            <span className="text-xs text-text-secondary font-medium">
                              {log.details}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-[10px] font-bold text-accent">
                              {log.userEmail.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-text-primary">{log.userEmail}</span>
                              <span className="text-[10px] text-text-secondary font-mono">IP: {log.ip || '127.0.0.1'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-text-secondary">
                          {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString('de-DE') : new Date().toLocaleString('de-DE')}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {(log.previousValue || log.newValue) && (
                            <button
                              onClick={() => setSelectedAuditLog(log)}
                              className="px-3 py-1 bg-input-bg hover:bg-accent/20 text-accent border border-border-subtle rounded-lg text-xs font-bold transition-all"
                            >
                              Diff anzeigen
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AKTIVE SESSIONS & REMOTE REVOKE */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          {/* Controls & Bulk Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card-bg p-4 rounded-2xl border border-border-subtle">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input 
                type="text" 
                placeholder="Sessions oder Nutzer suchen..."
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-input-bg border border-border-subtle rounded-xl text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
              />
            </div>

            {isOwnerOrAdmin && (
              <button
                onClick={handleTerminateAllOtherSessions}
                disabled={isTerminatingAll || sessions.length <= 1}
                className="w-full sm:w-auto px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                {isTerminatingAll ? 'Beende Sessions...' : 'Alle fremden Sessions beenden'}
              </button>
            )}
          </div>

          {/* Sessions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((sess) => {
              const devInfo = parseDevice(sess.userAgent || '');
              const browserName = parseBrowser(sess.userAgent || '');
              const DevIcon = devInfo.icon;
              const currentSessId = sessionStorage.getItem('app_session_id');
              const isCurrentSession = sess.id === currentSessId;

              return (
                <motion.div 
                  key={sess.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-5 rounded-2xl border backdrop-blur-xl relative flex flex-col justify-between gap-4 ${
                    isCurrentSession 
                      ? 'bg-accent/5 border-accent/40 shadow-[0_0_20px_rgba(59,130,246,0.15)]' 
                      : 'bg-card-bg border-border-subtle hover:border-border-subtle/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-input-bg border border-border-subtle flex items-center justify-center text-accent shrink-0">
                        <DevIcon className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-text-primary truncate">{sess.displayName}</span>
                          {isCurrentSession && (
                            <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent text-[9px] font-black uppercase">
                              Diese Session
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-text-secondary truncate">{sess.email}</span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0 ${
                      sess.status === 'online' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : sess.status === 'idle'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}>
                      • {sess.status}
                    </span>
                  </div>

                  <div className="space-y-2 py-2 border-y border-border-subtle/50 text-xs text-text-secondary">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Gerät & OS:</span>
                      <span className="font-medium text-text-primary">{devInfo.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Browser:</span>
                      <span className="font-medium text-text-primary">{browserName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Zuletzt aktiv:</span>
                      <span className="font-mono text-text-primary">
                        {sess.lastActive ? new Date(sess.lastActive).toLocaleTimeString('de-DE') : 'Jetzt'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[10px] font-mono text-text-secondary truncate max-w-[140px]">
                      ID: {sess.id.substring(0, 14)}...
                    </span>

                    {!isCurrentSession && isOwnerOrAdmin && (
                      <button
                        onClick={() => handleTerminateSession(sess.id, sess.email)}
                        disabled={revokingSessionId === sess.id}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        {revokingSessionId === sess.id ? 'Beende...' : 'Session beenden'}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM LOGS */}
      {activeTab === 'system' && (
        <div className="bg-card-bg rounded-3xl border border-border-subtle overflow-hidden flex flex-col min-h-[600px] transition-colors duration-300">
          <div className="p-4 border-b border-border-subtle bg-input-bg/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">System Live Stream • {filteredSystemLogs.length} Einträge</span>
            </div>
            <div className="flex items-center gap-2">
              {(['all', 'info', 'warning', 'error'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSystemFilter(f)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    systemFilter === f 
                      ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[700px] custom-scrollbar p-1">
            {isLoadingSystem ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-4">
                  <Clock className="w-8 h-8 text-accent animate-spin" />
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Lade Protokolle...</p>
                </div>
              </div>
            ) : filteredSystemLogs.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-slate-700 font-bold uppercase tracking-widest text-xs">Keine System-Protokolle gefunden</p>
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
                    {filteredSystemLogs.map((log) => (
                      <motion.tr 
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="group hover:bg-card-hover transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[9px] font-black uppercase tracking-wider ${getTypeStyles(log.type)}`}>
                            {log.type}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[11px] font-mono text-text-secondary whitespace-nowrap">
                          {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString('de-DE') : new Date().toLocaleString('de-DE')}
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
      )}

      {/* Audit Log Diff Modal */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a0a0f] border border-white/10 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-accent" />
                <h3 className="text-base font-bold text-white">Änderungs-Details (Diff)</h3>
              </div>
              <button 
                onClick={() => setSelectedAuditLog(null)}
                className="text-slate-400 hover:text-white font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-mono block mb-1">AKTION:</span>
                <span className="font-bold text-white bg-white/5 px-2 py-1 rounded">{selectedAuditLog.action}</span>
              </div>

              <div>
                <span className="text-slate-400 font-mono block mb-1">AUSGEFÜHRT VON:</span>
                <span className="text-slate-200">{selectedAuditLog.userEmail}</span>
              </div>

              {selectedAuditLog.previousValue && (
                <div>
                  <span className="text-rose-400 font-mono block mb-1">VORHERIGER WERT:</span>
                  <pre className="bg-rose-950/30 border border-rose-500/20 text-rose-200 p-3 rounded-xl overflow-x-auto text-[11px]">
                    {selectedAuditLog.previousValue}
                  </pre>
                </div>
              )}

              {selectedAuditLog.newValue && (
                <div>
                  <span className="text-emerald-400 font-mono block mb-1">NEUER WERT:</span>
                  <pre className="bg-emerald-950/30 border border-emerald-500/20 text-emerald-200 p-3 rounded-xl overflow-x-auto text-[11px]">
                    {selectedAuditLog.newValue}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-2 bg-accent text-white font-bold rounded-xl text-xs hover:opacity-90"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

