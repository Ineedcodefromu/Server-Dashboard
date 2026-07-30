import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
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
  Laptop,
  CreditCard,
  Sparkles,
  Columns,
  FileBox,
  Briefcase,
  Code,
  BarChart3,
  Terminal,
  Users,
  Wallet,
  TrendingUp,
  Newspaper,
  MessageSquare
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

const CONFIGURABLE_TABS = [
  { id: 'paypal', name: 'PayPal Checkout', desc: 'PayPal Zahlungen, QR-Code & Überweisungen', icon: CreditCard },
  { id: 'budget', name: 'Finanzen & Budget', desc: 'Ausgaben- & Budget-Tracking mit Charts', icon: Wallet },
  { id: 'stocks', name: 'Aktien & Crypto', desc: 'Echtzeit Kurse & Portfolio Watchlist', icon: TrendingUp },
  { id: 'news', name: 'News Feed', desc: 'RSS-Feeds & AI Schlagzeilen-Zusammenfassungen', icon: Newspaper },
  { id: 'ai', name: 'AI Assistent', desc: 'Künstliche Intelligenz Chat & Assistent', icon: Sparkles },
  { id: 'chat', name: 'Live Team Chat', desc: 'Echtzeit Chat & Raum-Kommunikation', icon: MessageSquare },
  { id: 'warframe', name: 'Warframe Hub', desc: 'Game-Nexus Tracker, Alerts & Item Database', icon: Shield },
  { id: 'kanban', name: 'Kanban Board', desc: 'Aufgaben- & Projekt-Board', icon: Columns },
  { id: 'documents', name: 'Dokumente', desc: 'Dateiverwaltung & Dokumenten-Archiv', icon: FileBox },
  { id: 'notifications', name: 'Alerts', desc: 'System-Benachrichtigungen & Warnungen', icon: Bell },
  { id: 'projects', name: 'Projekte', desc: 'Projektverwaltung & Meilensteine', icon: Briefcase },
  { id: 'code', name: 'Code Studio', desc: 'Entwickler Tools & Code Snippets', icon: Code },
  { id: 'performance', name: 'Leistung', desc: 'System-Performance & Metriken', icon: BarChart3 },
  { id: 'logs', name: 'System Logs', desc: 'System-Protokolle & Terminal Logs', icon: Terminal },
  { id: 'users', name: 'Team-Verwaltung', desc: 'Benutzer- & Rechteverwaltung', icon: Users },
];

import { logAuditEvent } from '../lib/auditLogger';

export function SettingsView() {
  const { profile, effectiveRole } = useAuth();
  const isOwner = effectiveRole === 'owner' || effectiveRole === 'admin' || profile?.email === 'mathewsniko02@gmail.com';
  
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'notifications' | 'website'>('profile');
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

  // Website Navigation & Global Config States (Owner/Admin only)
  const [disabledTabs, setDisabledTabs] = useState<Record<string, boolean>>({});
  const [enableOfficialCheckout, setEnableOfficialCheckout] = useState<boolean>(true);
  const [paypalClientId, setPaypalClientId] = useState<string>('test');
  const [paypalUsername, setPaypalUsername] = useState<string>('');
  const [savingWebSettings, setSavingWebSettings] = useState(false);
  const [webSettingsSaved, setWebSettingsSaved] = useState(false);

  useEffect(() => {
    if (profile?.displayName) setDisplayName(profile.displayName);
    if (profile?.theme) setTheme(profile.theme);
    if (profile?.accentColor) setAccentColor(profile.accentColor);
    if (profile?.notifications) setNotifications(profile.notifications);
  }, [profile]);

  // Real-time listener for global navigation & PayPal settings
  useEffect(() => {
    if (!isOwner) return;

    const unsubNav = onSnapshot(doc(db, 'app_settings', 'navigation'), (snap) => {
      if (snap.exists()) {
        setDisabledTabs(snap.data().disabledTabs || {});
      }
    }, (err) => {
      console.warn("Could not listen to navigation settings:", err);
    });

    const unsubPaypal = onSnapshot(doc(db, 'app_settings', 'paypal'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (typeof d.enableOfficialCheckout === 'boolean') setEnableOfficialCheckout(d.enableOfficialCheckout);
        if (d.clientId) setPaypalClientId(d.clientId);
        if (d.paypalMeUsername !== undefined) setPaypalUsername(d.paypalMeUsername);
      }
    }, (err) => {
      console.warn("Could not listen to paypal settings:", err);
    });

    return () => {
      unsubNav();
      unsubPaypal();
    };
  }, [isOwner]);

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

  const handleSaveWebsiteSettings = async () => {
    if (!isOwner) return;
    setSavingWebSettings(true);
    try {
      await setDoc(doc(db, 'app_settings', 'navigation'), {
        disabledTabs: disabledTabs,
        updatedAt: Date.now(),
        updatedBy: profile?.email || 'owner'
      }, { merge: true });

      await setDoc(doc(db, 'app_settings', 'paypal'), {
        enableOfficialCheckout: enableOfficialCheckout,
        clientId: paypalClientId.trim() || 'test',
        paypalMeUsername: paypalUsername.trim(),
        updatedAt: Date.now(),
        updatedBy: profile?.email || 'owner'
      }, { merge: true });

      await logAuditEvent(
        'EINSTELLUNGEN_GESPEICHERT',
        'settings',
        `Website-Konfiguration und PayPal Client-ID aktualisiert (${paypalClientId.substring(0, 8)}...)`,
        null,
        { disabledTabs, paypalClientId: paypalClientId.substring(0, 8) + '...', paypalUsername, enableOfficialCheckout }
      );

      setWebSettingsSaved(true);
      setTimeout(() => setWebSettingsSaved(false), 2000);
    } catch (err) {
      console.error("Error saving website settings:", err);
      handleFirestoreError(err, OperationType.WRITE, 'app_settings/navigation');
    } finally {
      setSavingWebSettings(false);
    }
  };

  const toggleTabState = async (tabId: string) => {
    const isNowDisabled = !disabledTabs[tabId];
    const updated = {
      ...disabledTabs,
      [tabId]: isNowDisabled
    };
    setDisabledTabs(updated);

    if (isOwner) {
      try {
        await setDoc(doc(db, 'app_settings', 'navigation'), {
          disabledTabs: updated,
          updatedAt: Date.now(),
          updatedBy: profile?.email || 'owner'
        }, { merge: true });

        await logAuditEvent(
          'REITER_STATUS_GEÄNDERT',
          'settings',
          `Reiter '${tabId}' wurde ${isNowDisabled ? 'DEAKTIVIERT' : 'AKTIVIERT'}`,
          { tabId, status: disabledTabs[tabId] ? 'enabled' : 'disabled' },
          { tabId, status: isNowDisabled ? 'disabled' : 'enabled' }
        );

        setWebSettingsSaved(true);
        setTimeout(() => setWebSettingsSaved(false), 1500);
      } catch (err) {
        console.error("Error updating navigation tab state:", err);
        handleFirestoreError(err, OperationType.WRITE, 'app_settings/navigation');
      }
    }
  };

  const toggleOfficialCheckout = async () => {
    const nextVal = !enableOfficialCheckout;
    setEnableOfficialCheckout(nextVal);

    if (isOwner) {
      try {
        await setDoc(doc(db, 'app_settings', 'paypal'), {
          enableOfficialCheckout: nextVal,
          clientId: paypalClientId.trim() || 'test',
          paypalMeUsername: paypalUsername.trim(),
          updatedAt: Date.now(),
          updatedBy: profile?.email || 'owner'
        }, { merge: true });

        await logAuditEvent(
          'PAYPAL_CHECKOUT_MODUS_GEÄNDERT',
          'paypal',
          `Offizieller PayPal-Checkout wurde ${nextVal ? 'AKTIVIERT' : 'DEAKTIVIERT'}`,
          { enableOfficialCheckout: !nextVal },
          { enableOfficialCheckout: nextVal }
        );

        setWebSettingsSaved(true);
        setTimeout(() => setWebSettingsSaved(false), 1500);
      } catch (err) {
        console.error("Error updating paypal checkout setting:", err);
        handleFirestoreError(err, OperationType.WRITE, 'app_settings/paypal');
      }
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'appearance', label: 'Erscheinungsbild', icon: Palette },
    { id: 'notifications', label: 'Benachrichtigungen', icon: Bell },
    ...(isOwner ? [{ id: 'website', label: 'Website Einstellungen', icon: Globe }] : [])
  ];

  return (
    <div className="flex flex-col gap-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">System-Einstellungen</h2>
          <p className="text-slate-500 text-sm mt-1">Konfiguriere dein persönliches Erlebnis und verwalte Systemressourcen.</p>
        </div>
             {/* Tab Navigation */}
        <div className="p-1 bg-card-bg border border-border-subtle rounded-2xl flex gap-1 self-start">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab.id 
                  ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
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
              <div className="bg-card-bg p-8 rounded-3xl border border-border-subtle space-y-8">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-full border-4 border-accent/20 p-1 relative">
                    <img 
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || '')}&background=020617&color=fff&size=128`} 
                      className="w-full h-full rounded-full bg-input-bg"
                    />
                    <button className="absolute bottom-0 right-0 p-1.5 bg-accent rounded-full text-white border-2 border-card-bg hover:scale-110 transition-transform">
                      <SettingsIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-text-primary">{profile?.displayName}</h3>
                    <p className="text-text-secondary text-sm">{profile?.email}</p>
                    <div className="mt-2 inline-flex border border-accent/20 px-2 py-0.5 rounded text-[10px] font-black uppercase text-accent tracking-widest bg-accent/5">
                      {profile?.role}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-1.5">
                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1">Anzeigename</label>
                    <input 
                      type="text" 
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="bg-input-bg border border-border-subtle rounded-xl px-4 py-3 text-text-primary text-sm focus:border-accent/50 focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all"
                      placeholder="Dein Name..."
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1">E-Mail Adresse (Gelesen)</label>
                    <input 
                      type="email" 
                      value={profile?.email || ''} 
                      readOnly
                      className="bg-input-bg border border-border-subtle rounded-xl px-4 py-3 text-text-secondary text-sm cursor-not-allowed opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="max-w-2xl space-y-6">
              <div className="bg-card-bg p-8 rounded-3xl border border-border-subtle space-y-10">
                <section>
                  <h4 className="text-xs font-black text-text-secondary uppercase tracking-widest mb-6 px-1">Theme Modus</h4>
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
                            ? 'bg-accent/10 border-accent text-text-primary' 
                            : 'bg-input-bg border-border-subtle text-text-secondary hover:border-accent/30'
                        }`}
                      >
                        <t.icon className={`w-6 h-6 ${theme === t.id ? 'text-accent' : 'text-text-secondary'}`} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <h4 className="text-xs font-black text-text-secondary uppercase tracking-widest mb-6 px-1">Akzentfarbe</h4>
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
                        } ${accentColor === color ? 'scale-110 shadow-xl ring-4 ring-accent/20' : 'hover:scale-105 shadow-md'}`}
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
              <div className="bg-card-bg p-8 rounded-3xl border border-border-subtle space-y-6">
                {[
                  { id: 'system', label: 'System Benachrichtigungen', desc: 'Warnungen über Systemstatus und Updates.' },
                  { id: 'trading', label: 'Handels-Signale', desc: 'Alerts wenn KI-Signale generiert werden.' },
                  { id: 'security', label: 'Sicherheits-Aktivitäten', desc: 'Versuchte Logins und Passwortänderungen.' },
                  { id: 'email', label: 'E-Mail Zusammenfassung', desc: 'Wöchentlicher Report deiner Performance.' },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-input-bg rounded-2xl border border-border-subtle">
                    <div>
                      <p className="text-sm font-bold text-text-primary tracking-tight">{item.label}</p>
                      <p className="text-[10px] text-text-secondary leading-tight mt-1 uppercase tracking-wider">{item.desc}</p>
                    </div>
                    <button 
                      onClick={() => setNotifications(prev => ({ ...prev, [item.id]: !prev[item.id as keyof typeof prev] }))}
                      className={`w-12 h-6 rounded-full p-1 transition-all ${
                        notifications[item.id as keyof typeof notifications] ? 'bg-accent' : 'bg-slate-700'
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

          {activeTab === 'website' && isOwner && (
            <div className="max-w-4xl space-y-8">
              {/* Card 1: Sidebar Navigation Tabs Control */}
              <div className="bg-card-bg p-8 rounded-3xl border border-border-subtle space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-accent" />
                    <h3 className="text-lg font-bold text-white uppercase tracking-tight">Globale Seiten-Navigation (Echtzeit)</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Aktiviere oder deaktiviere hier Reiter der Website. Sobald du einen Reiter einschränkst, wird dieser in <strong>Echtzeit für ALLE aktiven Nutzer</strong> auf der Website ausgeblendet.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {CONFIGURABLE_TABS.map((item) => {
                    const isDisabled = disabledTabs[item.id] === true;
                    const IconComp = item.icon;
                    return (
                      <div 
                        key={item.id} 
                        className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                          !isDisabled 
                            ? 'bg-input-bg border-border-subtle' 
                            : 'bg-red-500/5 border-red-500/20 opacity-75'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${!isDisabled ? 'bg-accent/10 text-accent' : 'bg-red-500/10 text-red-400'}`}>
                            <IconComp className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-text-primary tracking-tight">{item.name}</span>
                              {isDisabled && (
                                <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-black uppercase">
                                  Inaktiv
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-text-secondary leading-tight mt-0.5">{item.desc}</p>
                          </div>
                        </div>

                        <button 
                          type="button"
                          onClick={() => toggleTabState(item.id)}
                          className={`w-12 h-6 rounded-full p-1 transition-all ${
                            !isDisabled ? 'bg-accent' : 'bg-slate-700'
                          } relative shrink-0`}
                        >
                          <motion.div 
                            initial={false}
                            animate={{ x: !isDisabled ? 24 : 0 }}
                            className="w-4 h-4 bg-white rounded-full shadow-sm"
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 2: PayPal Global Configuration */}
              <div className="bg-card-bg p-8 rounded-3xl border border-border-subtle space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-[#0070BA]" />
                    <h3 className="text-lg font-bold text-white uppercase tracking-tight">Globale PayPal Einstellungen</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Verwalte den PayPal Checkout-Modus und API-Schlüssel global für das gesamte System.
                  </p>
                </div>

                <div className="p-4 bg-input-bg border border-border-subtle rounded-2xl flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-text-primary tracking-tight">Offizieller Checkout (Waren & Dienstleistungen) anzeigen</p>
                    <p className="text-[10px] text-text-secondary leading-tight mt-0.5">
                      Wenn deaktiviert, ist die Option "Offizieller Checkout" für alle Besucher global unsichtbar. Es steht dann nur "Freunde & Familie" (0% Gebühren) zur Verfügung.
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={toggleOfficialCheckout}
                    className={`w-12 h-6 rounded-full p-1 transition-all ${
                      enableOfficialCheckout ? 'bg-[#0070BA]' : 'bg-slate-700'
                    } relative shrink-0`}
                  >
                    <motion.div 
                      initial={false}
                      animate={{ x: enableOfficialCheckout ? 24 : 0 }}
                      className="w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1 block mb-1">PayPal REST API Client ID</label>
                    <input 
                      type="text" 
                      value={paypalClientId}
                      onChange={(e) => setPaypalClientId(e.target.value)}
                      placeholder="Live or Sandbox Client ID"
                      className="w-full bg-input-bg border border-border-subtle focus:border-[#0070BA] rounded-xl px-4 py-3 text-white text-xs font-mono focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1 block mb-1">PayPal.me Username (Direktlink)</label>
                    <div className="flex items-center bg-input-bg border border-border-subtle rounded-xl px-4 py-3">
                      <span className="text-xs text-slate-500 font-mono">paypal.me/</span>
                      <input 
                        type="text" 
                        value={paypalUsername}
                        onChange={(e) => setPaypalUsername(e.target.value)}
                        placeholder="deinname"
                        className="w-full bg-transparent border-none text-white text-xs font-mono focus:outline-none p-0 pl-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Website Settings Save Button */}
              <div className="flex justify-start">
                <button
                  onClick={handleSaveWebsiteSettings}
                  disabled={savingWebSettings}
                  className={`flex items-center gap-2 px-8 py-4 font-black uppercase tracking-widest text-xs rounded-2xl transition-all active:scale-95 disabled:opacity-50 shadow-2xl relative overflow-hidden group ${
                    webSettingsSaved 
                      ? 'bg-emerald-500 text-white' 
                      : savingWebSettings 
                        ? 'bg-slate-800 text-slate-400' 
                        : 'bg-accent text-white hover:bg-accent/80'
                  }`}
                >
                  <div className="relative z-10 flex items-center gap-2">
                    {webSettingsSaved ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : savingWebSettings ? (
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent animate-spin rounded-full" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{webSettingsSaved ? 'Echtzeit-Synchronisiert!' : 'Website Einstellungen Live Speichern'}</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Bottom Save Action for non-website tabs */}
          {activeTab !== 'website' && (
            <div className="flex justify-start">
              <button
                onClick={handleUpdateProfile}
                disabled={isSaving}
                className={`flex items-center gap-2 px-8 py-4 font-black uppercase tracking-widest text-xs rounded-2xl transition-all active:scale-95 disabled:opacity-50 shadow-2xl relative overflow-hidden group ${
                  showSaved 
                    ? 'bg-emerald-500 text-white' 
                    : isSaving 
                      ? 'bg-slate-800 text-slate-400' 
                      : 'bg-text-primary text-brand-bg hover:bg-accent hover:text-white'
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

