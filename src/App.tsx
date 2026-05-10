/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ReactNode, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, Code, FileText, Settings, LayoutDashboard, 
  TrendingUp, Newspaper, Briefcase, LogOut, Menu, X, 
  Terminal, User as UserIcon, Shield, ShieldAlert, ChevronRight, Columns, Sparkles
} from 'lucide-react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { auth, db } from './lib/firebase';
import { signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { StocksView } from './components/StocksView';
import { NewsView } from './components/NewsView';
import { ProjectsView } from './components/ProjectsView';
import { KanbanView } from './components/KanbanView';
import { AIAssistantView } from './components/AIAssistantView';
import { CodeView } from './components/CodeView';
import { SettingsView } from './components/SettingsView';
import { PerformanceView } from './components/PerformanceView';
import { LogsView } from './components/LogsView';
import axios from 'axios';

// --- Components ---

function ThemeManager() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile) return;

    // Theme logic
    const theme = profile.theme || 'dark';
    const root = window.document.documentElement;
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.remove('light', 'dark');
      root.classList.add(systemTheme);
    } else {
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
    }

    // Accent logic
    const colors: Record<string, string> = {
      blue: '59, 130, 246',
      purple: '147, 51, 234',
      emerald: '16, 185, 129',
      amber: '245, 158, 11',
      rose: '244, 63, 94',
      indigo: '79, 70, 229'
    };

    const accentRgb = colors[profile.accentColor || 'blue'];
    root.style.setProperty('--accent-rgb', accentRgb);

  }, [profile]);

  return null;
}

function ProfileMenu() {
  const { profile, effectiveRole, setImpersonatedRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ left: 0, bottom: 0 });

  if (!profile) return null;

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        left: rect.right + 12,
        bottom: window.innerHeight - rect.bottom
      });
    }
  };

  const toggleMenu = () => {
    updateCoords();
    setIsOpen(!isOpen);
  };

  const roles: ('owner' | 'admin' | 'user')[] = profile.role === 'owner' 
    ? ['owner', 'admin', 'user'] 
    : ['admin', 'user'];

  const isEmulating = effectiveRole !== profile.role;

  return (
    <div className="relative">
      <button 
        ref={buttonRef}
        onClick={toggleMenu}
        className={`w-10 h-10 rounded-full border p-0.5 shrink-0 transition-all duration-300 relative group overflow-visible ${
          isEmulating 
            ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]' 
            : 'border-white/10 hover:border-accent/50'
        }`}
      >
        <img 
          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName || 'User')}&background=020617&color=fff`} 
          alt="Avatar" 
          className="w-full h-full rounded-full bg-slate-700 object-cover" 
        />
        {isEmulating && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-[#11111a] z-10" />
        )}
      </button>

      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)} />
          <motion.div 
            initial={{ opacity: 0, x: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            style={{ 
              position: 'fixed',
              left: coords.left,
              bottom: coords.bottom,
              zIndex: 101
            }}
            className="w-64 bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-2xl"
          >
            <div className="p-4 border-b border-white/5 bg-white/2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{profile.displayName}</p>
                  <p className="text-[10px] text-slate-500 truncate">{profile.email}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                  profile.role === 'owner' ? 'bg-purple-500/20 text-purple-400' :
                  profile.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                  'bg-accent/20 text-accent'
                }`}>
                  {profile.role}
                </span>
                {isEmulating && (
                  <span className="text-[10px] text-amber-500 font-bold uppercase tracking-tighter animate-pulse">
                    • Emulating {effectiveRole}
                  </span>
                )}
              </div>
            </div>

            {(profile.role === 'owner' || profile.role === 'admin') && (
              <div className="p-3 bg-white/1 border-b border-white/5">
                <p className="text-[8px] uppercase font-black text-slate-500 tracking-[0.2em] mb-2 px-2">Role Emulation</p>
                <div className="grid grid-cols-1 gap-1">
                  {roles.map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setImpersonatedRole(r === profile.role ? null : r);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-between ${
                        effectiveRole === r 
                          ? 'bg-accent/20 text-accent' 
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {r}
                      {effectiveRole === r && <div className="w-1 h-1 bg-current rounded-full" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-2">
              <button 
                onClick={() => {
                  signOut(auth);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all group"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Sign Out</span>
              </button>
            </div>
          </motion.div>
        </>,
        document.body
      )}
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) {
  const { profile, effectiveRole } = useAuth();
  
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ai', label: 'AI Assistent', icon: Sparkles },
    { id: 'kanban', label: 'Kanban', icon: Columns, permission: 'projects.view' },
    { id: 'projects', label: 'Projekte', icon: Briefcase, permission: 'projects.view' },
    { id: 'code', label: 'Code', icon: Code, permission: 'code.view' },
    { id: 'performance', label: 'Leistung', icon: BarChart3, permission: 'dashboard.view' },
    { id: 'stocks', label: 'Aktien', icon: TrendingUp, permission: 'dashboard.view' },
    { id: 'news', label: 'News', icon: Newspaper, permission: 'dashboard.view' },
    { id: 'logs', label: 'Logs', icon: Terminal, permission: 'logs.view' },
    { id: 'settings', label: 'Einstellungen', icon: Settings, adminOnly: true },
  ];

  const filteredItems = menuItems.filter(item => {
    const isPowerful = effectiveRole === 'admin' || effectiveRole === 'owner';
    if (item.adminOnly && !isPowerful) return false;
    if (item.permission && !profile?.permissions.includes(item.permission) && !isPowerful) return false;
    return true;
  });

  return (
    <div className="fixed left-0 top-0 h-screen w-20 bg-[#0a0a0f]/40 backdrop-blur-md border-r border-white/5 flex flex-col items-center py-8 z-20 overflow-y-auto no-scrollbar">
      <div className="mb-10">
        <div className="w-10 h-10 bg-gradient-to-br from-accent to-indigo-600 rounded-lg glow-accent flex items-center justify-center">
          <Shield className="w-6 h-6 text-white" />
        </div>
      </div>
      
      <nav className="flex-1 flex flex-col gap-6">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`p-3 rounded-xl transition-all duration-300 group relative ${
              activeTab === item.id 
                ? 'bg-accent/20 text-accent border border-accent/30' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
            title={item.label}
          >
            <item.icon className="w-6 h-6" />
            {activeTab === item.id && (
              <motion.div 
                layoutId="active-pill"
                className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-accent rounded-full"
              />
            )}
          </button>
        ))}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-6">
        <ProfileMenu />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, trend }: { label: string, value: string, icon: any, trend?: string }) {
  return (
    <div className="bg-[#11111a]/60 rounded-2xl border border-white/5 p-6 flex flex-col justify-between hover:border-accent/30 hover:scale-[1.02] transition-all group cursor-pointer">
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
          <Icon className="w-6 h-6" />
        </div>
        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{label}</span>
      </div>
      <div>
        <div className="text-3xl font-bold text-white mb-1">{value}</div>
        {trend && (
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className={trend.startsWith('+') ? 'text-blue-400' : 'text-red-400'}>{trend}</span>
            <span className="text-slate-600">• Trend</span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Page Views ---

function DashboardOverview() {
  const { profile } = useAuth();
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [taskCount, setTaskCount] = useState(0);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await axios.get('/api/system-logs');
        setRecentLogs(response.data.slice(0, 5));
      } catch (error) {
        console.error('Dashboard logs fetch failed', error);
      }
    };
    
    if (auth.currentUser) {
      const q = query(
        collection(db, 'tasks'),
        where('userId', '==', auth.currentUser.uid),
        where('status', '!=', 'done')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setTaskCount(snapshot.size);
      });
      fetchLogs();
      return () => unsubscribe();
    }
    
    fetchLogs();
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
        <StatCard label="Markt" value="+4.2%" icon={TrendingUp} trend="+1.2%" />
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
                    {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

function SectionPlaceholder({ title, description }: { title: string, description: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-20 bg-[#11111a]/40 rounded-3xl border border-dashed border-white/10">
      <div className="w-16 h-16 rounded-2xl bg-accent/5 flex items-center justify-center mb-6">
        <Shield className="w-8 h-8 text-accent/20" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">{title}</h2>
      <p className="text-slate-500 text-center max-w-md text-sm">{description}</p>
      <button className="mt-8 px-6 py-3 bg-accent text-white rounded-xl font-bold hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-accent/20">
        Modul konfigurieren
      </button>
    </div>
  );
}

function LoginPage() {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] bg-accent/20 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md bg-[#11111a]/80 backdrop-blur-2xl rounded-3xl border border-white/5 shadow-2xl p-10 text-center relative z-10">
        <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent/60 rounded-2xl flex items-center justify-center mx-auto mb-8 glow-accent">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-black text-white mb-4 tracking-tighter uppercase">Omni<span className="text-accent">Dash</span></h1>
        <p className="text-slate-500 mb-10 text-sm">Identity Management Service • Bitte authentifizieren Sie sich.</p>
        
        <button 
          onClick={handleLogin}
          className="w-full py-4 bg-white text-[#050508] rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-200 transition-all active:scale-95 shadow-xl"
        >
          <img src="https://www.gstatic.com/firebase/builtwith/google.svg" className="w-5 h-5" alt="Google" />
          GOOGLE AUTHENTICATION
        </button>
        
        <div className="mt-8 pt-8 border-t border-white/5 text-[10px] text-slate-600 uppercase tracking-widest space-y-1">
          <p>Access Level: System Administrator</p>
          <p>Version: 2.4.0-stable</p>
        </div>
      </div>
    </div>
  );
}

function AuthenticatedLayout({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) {
  const { profile, effectiveRole } = useAuth();
  
  return (
    <div className="bg-[#050508] min-h-screen pl-20 relative overflow-hidden flex flex-col">
      {/* Decorative Orbs */}
      <div className="fixed top-[-100px] left-20 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="fixed bottom-[-100px] right-[-100px] w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none"></div>

      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <header className="fixed top-0 right-0 left-20 h-16 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5 z-10 px-8 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          <LayoutDashboard className="w-3 h-3" />
          <span>Central Hub</span>
          <span className="text-white/20">/</span>
          <span className="text-accent">{activeTab}</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] uppercase font-bold text-green-400 tracking-wider">System Live</span>
          </div>

          {(effectiveRole === 'admin' || effectiveRole === 'owner') && (
            <>
              <div className="w-px h-6 bg-white/5" />
              <div className="flex items-center gap-2">
                <div className="text-[10px] text-right">
                    <p className="text-white font-bold leading-tight uppercase">
                      {effectiveRole === 'owner' ? 'Owner Console' : 'Admin Console'}
                    </p>
                    <p className="text-slate-600 leading-tight">v2.4.0-stable</p>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="pt-24 p-8 flex-1 max-w-7xl w-full mx-auto relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'dashboard' && <DashboardOverview />}
            {activeTab === 'ai' && <AIAssistantView />}
            {activeTab === 'kanban' && <KanbanView />}
            {activeTab === 'projects' && <ProjectsView />}
            {activeTab === 'code' && <CodeView />}
            {activeTab === 'performance' && <PerformanceView />}
            {activeTab === 'stocks' && <StocksView />}
            {activeTab === 'news' && <NewsView />}
            {activeTab === 'logs' && <LogsView />}
            {activeTab === 'settings' && <SettingsView />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="h-10 border-t border-white/5 bg-[#0a0a0f] flex items-center justify-between px-8 text-[10px] text-slate-600 z-10 mt-auto">
        <div className="flex gap-4 items-center uppercase tracking-widest font-bold">
          <span>OmniDash Core</span>
          <span className="w-1 h-1 bg-white/10 rounded-full"></span>
          <span className="text-accent/60">Ready</span>
        </div>
        <div className="flex gap-6 items-center uppercase tracking-widest font-bold">
          <div className="flex gap-2 items-center text-emerald-500">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
            <span>Encrypted Connection active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  return (
    <AuthProvider>
      <ThemeManager />
      <AppContent activeTab={activeTab} setActiveTab={setActiveTab} />
    </AuthProvider>
  );
}

function AppContent({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="relative">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-2 border-white/5 border-t-accent rounded-full"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Shield className="w-6 h-6 text-accent glow-accent animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="antialiased min-h-screen bg-brand-bg text-text-primary font-sans transition-colors duration-300">
      {!user ? (
        <LoginPage />
      ) : (
        <AuthenticatedLayout activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
    </div>
  );
}
