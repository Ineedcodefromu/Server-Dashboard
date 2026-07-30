import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WarframeIcon } from './WarframeIcon';
import { 
  Shield, Sparkles, Zap, Flame, Compass, Library, 
  RefreshCw, Cpu, Award, Users, Info, Settings, 
  Edit2, Save, X, Plus, Check, CheckCircle2, Trash2, Search, HelpCircle
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { searchWarframeItems, validateWarframeItem } from '../services/warframeService';
import { WarframeItem } from '../data/warframeItems';

interface Alert {
  id: string;
  mission: string;
  node: string;
  faction: string;
  type: string;
  reward: string;
  timeLeft: string;
}

interface FoundryItem {
  id: string;
  title: string;
  type: string;
  craftTimeSeconds: number;
  startedAt: number; // UTC timestamp of start
  claimed: boolean;
}

interface WarframeProfileData {
  meisterschaftsRang: number; // Stored natively for Firestore compatibility
  stunden: number;            // Stored natively for Firestore compatibility
  clan: string;
  syndicates: {
    steelMeridian: number;
    arbitersOfHexis: number;
    cephalonSuda: number;
  };
  foundry: FoundryItem[];
}

const DEFAULT_WARFRAME: WarframeProfileData = {
  meisterschaftsRang: 30,
  stunden: 1482,
  clan: "Lotus Operatives",
  syndicates: {
    steelMeridian: 132000,
    arbitersOfHexis: 90000,
    cephalonSuda: 115000,
  },
  foundry: [
    { id: '1', title: 'Excalibur Prime', type: 'Warframe', craftTimeSeconds: 259200, startedAt: Date.now() - 259205 * 1000, claimed: false },
    { id: '2', title: 'Soma Prime', type: 'Primary', craftTimeSeconds: 43200, startedAt: Date.now(), claimed: false }
  ]
};

export function WarframeView() {
  const { profile, user } = useAuth();
  
  // Real world Alerts translated entirely to English
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([
    { id: '1', mission: 'Interception (Level 35-40)', node: 'Hydron (Sedna)', faction: 'Grineer', type: 'Exilus Adapter Blueprint', reward: 'Exilus Adapter BP + 15,000 Credits', timeLeft: '14m' },
    { id: '2', mission: 'Survival (Level 45-50)', node: 'Mot (Void)', faction: 'Corrupted', type: 'Corrupted Mod', reward: 'Overextended + 20,000 Credits', timeLeft: '35m' },
    { id: '3', mission: 'Extermination (Level 20-25)', node: 'Tessera (Venus)', faction: 'Corpus', type: 'Nitain Extract x2', reward: '2x Nitain Extract + 10,000 Credits', timeLeft: '1h 05m' },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [timerTick, setTimerTick] = useState(0);

  // Fallback state representing the active profile
  const [localWfProfile, setLocalWfProfile] = useState<WarframeProfileData>(DEFAULT_WARFRAME);

  // Form values for editing properties
  const [editRang, setEditRang] = useState(30);
  const [editStunden, setEditStunden] = useState(1482);
  const [editClan, setEditClan] = useState("Lotus Operatives");
  
  // Syndicate values inside editor
  const [editSteelMeridian, setEditSteelMeridian] = useState(132000);
  const [editArbitersOfHexis, setEditArbitersOfHexis] = useState(90000);
  const [editCephalonSuda, setEditCephalonSuda] = useState(115000);

  // Search autocomplete states
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<WarframeItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<WarframeItem | null>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load configuration based on auth status
  useEffect(() => {
    if (user && profile?.warframe) {
      setLocalWfProfile(profile.warframe);
    } else if (!user) {
      const stored = localStorage.getItem('warframe_config');
      if (stored) {
        try {
          setLocalWfProfile(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse local warframe config:", e);
        }
      } else {
        setLocalWfProfile(DEFAULT_WARFRAME);
      }
    }
  }, [profile, user]);

  // Sync edits with local profile when editing loads
  useEffect(() => {
    setEditRang(localWfProfile.meisterschaftsRang ?? 30);
    setEditStunden(localWfProfile.stunden ?? 1482);
    setEditClan(localWfProfile.clan ?? "Lotus Operatives");
    setEditSteelMeridian(localWfProfile.syndicates?.steelMeridian ?? 132000);
    setEditArbitersOfHexis(localWfProfile.syndicates?.arbitersOfHexis ?? 90000);
    setEditCephalonSuda(localWfProfile.syndicates?.cephalonSuda ?? 115000);
  }, [localWfProfile, isEditing]);

  // Autocomplete suggestions search with debouncing
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSuggestions([]);
      setSearchError(null);
      return;
    }

    // Skip trigger if input matches exactly selected item's name to prevent re-fetch loop
    if (selectedItem && selectedItem.name.toLowerCase() === searchTerm.toLowerCase()) {
      return;
    }

    setIsSearchLoading(true);
    setSearchError(null);

    const delayDebounceFn = setTimeout(async () => {
      try {
        const results = await searchWarframeItems(searchTerm);
        setSuggestions(results);
        if (results.length === 0) {
          setSearchError("No craftable item found.");
        }
      } catch (err) {
        setSearchError("Failed to fetch suggestions.");
      } finally {
        setIsSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedItem]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Timer refresh tick loop
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const triggerRefresh = () => {
    setIsLoading(true);
    // Simulate real network fetch of refreshed missions
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  // Persists configuration individually per user
  const saveWarframeData = async (updatedWf: WarframeProfileData) => {
    setLocalWfProfile(updatedWf);
    if (user) {
      setIsSaving(true);
      const userRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userRef, { warframe: updatedWf });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      } finally {
        setIsSaving(false);
      }
    } else {
      localStorage.setItem('warframe_config', JSON.stringify(updatedWf));
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: WarframeProfileData = {
      ...localWfProfile,
      meisterschaftsRang: editRang,
      stunden: editStunden,
      clan: editClan,
      syndicates: {
        steelMeridian: editSteelMeridian,
        arbitersOfHexis: editArbitersOfHexis,
        cephalonSuda: editCephalonSuda
      }
    };
    await saveWarframeData(updated);
    setIsEditing(false);
  };

  const handleStartForge = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that the item matches an official craftable item
    const validated = selectedItem || await validateWarframeItem(searchTerm);
    if (!validated) {
      setSearchError("No craftable item found. Please select a valid item.");
      return;
    }

    const newItem: FoundryItem = {
      id: Math.random().toString(36).substring(2, 9),
      title: validated.name,
      type: validated.type,
      craftTimeSeconds: validated.buildTime,
      startedAt: Date.now(),
      claimed: false
    };

    const updatedFoundry = [...(localWfProfile.foundry || []), newItem];
    const updated: WarframeProfileData = {
      ...localWfProfile,
      foundry: updatedFoundry
    };

    await saveWarframeData(updated);
    
    // Clear forge addition inputs
    setSearchTerm("");
    setSelectedItem(null);
    setSuggestions([]);
    setSearchError(null);
  };

  const handleClaimItem = async (itemId: string) => {
    const updatedFoundry = (localWfProfile.foundry || []).map(item => {
      if (item.id === itemId) return { ...item, claimed: true };
      return item;
    });

    const updated: WarframeProfileData = {
      ...localWfProfile,
      foundry: updatedFoundry
    };
    await saveWarframeData(updated);
  };

  const handleTrashItem = async (itemId: string) => {
    const updatedFoundry = (localWfProfile.foundry || []).filter(item => item.id !== itemId);
    const updated: WarframeProfileData = {
      ...localWfProfile,
      foundry: updatedFoundry
    };
    await saveWarframeData(updated);
  };

  // Convert seconds into human-digestible English format (hours, minutes, days)
  const formatSecondsToDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds} seconds`;
    }
    const mins = Math.floor(seconds / 60);
    if (mins < 60) {
      return `${mins} minute${mins > 1 ? 's' : ''}`;
    }
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) {
      return `${hrs} hour${hrs > 1 ? 's' : ''}`;
    }
    const days = Math.floor(hrs / 24);
    const remainingHrs = hrs % 24;
    if (remainingHrs === 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    return `${days} day${days > 1 ? 's' : ''} ${remainingHrs} hour${remainingHrs > 1 ? 's' : ''}`;
  };

  // Helper to format remaining timer text
  const getRemainingTimeText = (item: FoundryItem) => {
    if (item.claimed) return "Claimed";
    
    const elapsedSeconds = (Date.now() - item.startedAt) / 1000;
    const remaining = Math.max(0, item.craftTimeSeconds - elapsedSeconds);

    if (remaining <= 0) {
      return "Ready to Claim";
    }

    if (remaining < 60) {
      return `${Math.ceil(remaining)}s`;
    }

    const min = Math.floor(remaining / 60);
    if (min < 60) {
      return `${min}m`;
    }

    const hrs = Math.floor(min / 60);
    const minLeft = min % 60;
    
    if (hrs >= 24) {
      const days = Math.floor(hrs / 24);
      const hrsLeft = hrs % 24;
      return `${days}d ${hrsLeft}h`;
    }
    
    return `${hrs}h ${minLeft}m`;
  };

  const getItemProgressPercentage = (item: FoundryItem) => {
    if (item.claimed) return 100;
    const elapsedSeconds = (Date.now() - item.startedAt) / 1000;
    if (elapsedSeconds >= item.craftTimeSeconds) return 100;
    return Math.min(100, Math.max(0, (elapsedSeconds / item.craftTimeSeconds) * 100));
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-white/5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#0a0a0f] to-accent/40 rounded-xl flex items-center justify-center border border-accent/20">
              <WarframeIcon className="w-6 h-6 text-accent animate-pulse" />
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Warframe Hub</h2>
          </div>
          <p className="text-slate-500 text-sm">
            Real progress tracking • Authenticated via OmniDash • Status: <span className="text-emerald-500 font-medium">{user ? "Cloud Sync Active" : "Local Fallback"}</span>
          </p>
        </div>
        <div className="flex gap-2 self-start md:self-auto">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent/15 border border-accent/30 hover:bg-accent/25 active:scale-95 text-xs text-accent uppercase font-black tracking-widest rounded-xl transition-all"
            id="button-toggle-edit"
          >
            {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
            {isEditing ? 'Close Editor' : 'Edit Profile'}
          </button>
          
          <button 
            onClick={triggerRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 active:scale-95 text-xs text-white uppercase font-black tracking-widest rounded-xl border border-white/5 transition-all"
            id="button-system-refresh"
          >
            <RefreshCw className={`w-4 h-4 text-accent ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Systems
          </button>
        </div>
      </div>

      {/* Cloud-Sync Info Banner in English */}
      <div className="p-4 bg-accent/5 rounded-2xl border border-accent/15 flex items-start gap-3">
        <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 space-y-1">
          <p className="font-bold text-white text-sm">Automated & Durable Account Configuration</p>
          <p>
            Warframe's developer <strong>Digital Extremes</strong> does not offer open OAuth access for third-party websites to extract personal inventory and mastery status seamlessly. To solve this, our hub links directly to your <strong>OmniDash account</strong>! Any updates to your Mastery Rank, custom clan details, syndicate rep stats, and custom Foundry timers are preserved permanently and isolated to your profile.
          </p>
        </div>
      </div>

      {/* Main Core Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: Console & Main Icon Visual */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Dashboard and Edit Profile Interface */}
          <div className="glass-card rounded-3xl p-8 border border-white/5 bg-[#0a0a0f]/40 relative overflow-hidden flex flex-col justify-between min-h-[350px]">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-indigo-600/5 rounded-full blur-[60px] pointer-events-none" />
            
            {/* Corner cybernetic accents */}
            <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-white/10 rounded-tl" />
            <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-white/10 rounded-tr" />
            <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-white/10 rounded-bl" />
            <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-white/10 rounded-br" />

            <AnimatePresence mode="wait">
              {isEditing ? (
                <motion.form 
                  key="editProfileForm"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  onSubmit={handleProfileSave}
                  className="relative z-10 space-y-6 w-full py-4 text-left"
                >
                  <h3 className="text-lg font-black text-white uppercase tracking-wider border-b border-white/5 pb-2 mb-4">Profile & Progress Editor</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1.5">Mastery Rank (1-34)</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="34"
                        value={editRang}
                        onChange={(e) => setEditRang(Math.max(1, Math.min(34, parseInt(e.target.value, 10) || 1)))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold focus:border-accent focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1.5">Play Time (Hours)</label>
                      <input 
                        type="number" 
                        min="0"
                        value={editStunden}
                        onChange={(e) => setEditStunden(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold focus:border-accent focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1.5">Clan / Alliance Name</label>
                      <input 
                        type="text" 
                        value={editClan}
                        onChange={(e) => setEditClan(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold focus:border-accent focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <h4 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Syndicates Standing (max 132,000)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white/2 p-3 rounded-xl border border-white/5">
                        <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block">Steel Meridian</label>
                        <input 
                          type="range" 
                          min="0" 
                          max="132000" 
                          step="1000"
                          value={editSteelMeridian} 
                          onChange={(e) => setEditSteelMeridian(parseInt(e.target.value, 10))}
                          className="w-full accent-accent mt-2"
                        />
                        <div className="text-[11px] text-right text-white font-mono mt-1 font-bold">
                          {(editSteelMeridian / 1000).toFixed(0)}k / 132k
                        </div>
                      </div>

                      <div className="bg-white/2 p-3 rounded-xl border border-white/5">
                        <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block">Arbiters of Hexis</label>
                        <input 
                          type="range" 
                          min="0" 
                          max="132000" 
                          step="1000"
                          value={editArbitersOfHexis} 
                          onChange={(e) => setEditArbitersOfHexis(parseInt(e.target.value, 10))}
                          className="w-full accent-emerald-400 mt-2"
                        />
                        <div className="text-[11px] text-right text-white font-mono mt-1 font-bold">
                          {(editArbitersOfHexis / 1000).toFixed(0)}k / 132k
                        </div>
                      </div>

                      <div className="bg-white/2 p-3 rounded-xl border border-white/5">
                        <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block">Cephalon Suda</label>
                        <input 
                          type="range" 
                          min="0" 
                          max="132000" 
                          step="1000"
                          value={editCephalonSuda} 
                          onChange={(e) => setEditCephalonSuda(parseInt(e.target.value, 10))}
                          className="w-full accent-violet-400 mt-2"
                        />
                        <div className="text-[11px] text-right text-white font-mono mt-1 font-bold">
                          {(editCephalonSuda / 1000).toFixed(0)}k / 132k
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                    <button 
                      type="button" 
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-xs font-bold bg-white/5 hover:bg-white/10 text-white rounded-xl uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSaving}
                      className="px-6 py-2 text-xs font-black bg-accent hover:opacity-90 active:scale-95 text-white rounded-xl uppercase tracking-widest flex items-center gap-2"
                    >
                      {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {user ? "Save in Cloud" : "Save Locally"}
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.div 
                  key="showProfile"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative flex flex-col items-center justify-center py-8 text-center w-full"
                >
                  <div className="relative group mb-4">
                    <div className="absolute -inset-1.5 rounded-3xl bg-[#0A7A9B]/10 blur-xl group-hover:bg-[#0A7A9B]/15 transition-all opacity-75" />
                    <div className="px-16 py-10 rounded-2xl bg-gradient-to-b from-[#060b10] to-[#010305] border border-[#0A7A9B]/20 flex flex-col items-center justify-center shadow-2xl relative">
                      <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-[#0A7A9B]/40" />
                      <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-[#0A7A9B]/40" />
                      <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-[#0A7A9B]/40" />
                      <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-[#0A7A9B]/40" />
                      
                      <WarframeIcon showText={true} className="w-52 h-auto text-accent filter drop-shadow-[0_0_10px_rgba(10,122,155,0.5)]" />
                    </div>
                  </div>
                  <p className="text-slate-500 text-[11px] uppercase tracking-[0.25em] max-w-sm mt-4">Awaiting Directives • Terminal Connection Active</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* General display attributes */}
            {!isEditing && (
              <div className="border-t border-white/5 pt-4 flex flex-wrap justify-around gap-4 text-center">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">MASTERY RANK</p>
                  <div className="flex items-center justify-center gap-1.5 mt-1 text-white font-bold">
                    <Award className="w-4 h-4 text-accent animate-pulse" />
                    <span>Rank {localWfProfile.meisterschaftsRang ?? 30} {localWfProfile.meisterschaftsRang >= 30 ? "(Grandmaster)" : ""}</span>
                  </div>
                </div>
                <div className="w-px bg-white/5 hidden md:block" />
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">PLAY TIME</p>
                  <div className="flex items-center justify-center gap-1.5 mt-1 text-white font-bold">
                    <Cpu className="w-4 h-4 text-[#F59E0B]" />
                    <span>{(localWfProfile.stunden ?? 1482).toLocaleString('en-US')} Hours</span>
                  </div>
                </div>
                <div className="w-px bg-white/5 hidden md:block" />
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">ACTIVE CLAN</p>
                  <div className="flex items-center justify-center gap-1.5 mt-1 text-white font-bold">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <span>{localWfProfile.clan ?? "Lotus Operatives"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* World State Section / Missions (System feed) */}
          <div className="glass-card rounded-3xl p-6 border border-white/5 bg-[#0a0a0f]/40">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
              <Compass className="w-4 h-4 text-accent" />
              Active Fissure Alerts (Relics)
            </h3>
            
            <div className="space-y-3">
              {activeAlerts.map(alert => (
                <div key={alert.id} className="p-4 bg-white/2 hover:bg-white/5 rounded-2xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-accent/10 border border-accent/20 text-accent">
                        {alert.faction}
                      </span>
                      <strong className="text-white text-xs">{alert.mission}</strong>
                    </div>
                    <p className="text-slate-500 text-[11px]">{alert.node} • Reward: <span className="text-slate-300 font-medium">{alert.type}</span></p>
                  </div>
                  <div className="flex items-center gap-4 justify-between md:justify-end">
                    <span className="text-[11px] text-[#EF4444] font-bold bg-[#EF4444]/10 px-2.5 py-1 rounded-lg border border-[#EF4444]/20 flex items-center gap-1">
                      <Zap className="w-3 h-3 animate-pulse" />
                      {alert.timeLeft} remaining
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Syndicate Status & Forge */}
        <div className="space-y-6">
          
          {/* Syndicate standing widgets */}
          <div className="glass-card rounded-3xl p-6 border border-white/5 bg-[#0a0a0f]/40 relative overflow-hidden flex flex-col justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
              <Library className="w-4 h-4 text-accent" />
              Syndicate Standing
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 font-bold">Steel Meridian</span>
                  <span className="text-accent font-bold">{(localWfProfile.syndicates?.steelMeridian ?? 132000).toLocaleString('en-US')} / 132k</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-accent to-accent/60 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${((localWfProfile.syndicates?.steelMeridian ?? 132000) / 132000) * 100}%` }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 font-bold">Arbiters of Hexis</span>
                  <span className="text-emerald-400 font-bold">{(localWfProfile.syndicates?.arbitersOfHexis ?? 90000).toLocaleString('en-US')} / 132k</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${((localWfProfile.syndicates?.arbitersOfHexis ?? 90000) / 132000) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 font-bold">Cephalon Suda</span>
                  <span className="text-[#A78BFA] font-bold">{(localWfProfile.syndicates?.cephalonSuda ?? 115000).toLocaleString('en-US')} / 132k</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-violet-500 to-violet-400 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${((localWfProfile.syndicates?.cephalonSuda ?? 115000) / 132000) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            
            <div className="border-t border-white/5 mt-6 pt-4 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold text-xs">Syndicate Missions</p>
              <p className="text-[11px] text-white/70 mt-1">Standing rewards available!</p>
            </div>
          </div>

          {/* Special Immersive Interactive Forge / Foundry */}
          <div className="glass-card rounded-3xl p-6 border border-white/5 bg-[#0a0a0f]/40 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-3">
              <Flame className="w-4 h-4 text-accent animate-pulse" />
              Foundry
            </h3>
            
            {/* Active craftings timeline */}
            <div className="space-y-3 max-h-[280px] overflow-y-auto no-scrollbar pr-1">
              {!(localWfProfile.foundry || []).length ? (
                <p className="text-xs text-slate-500 text-center py-4">No active blueprints under assembly. Forge some equipment below!</p>
              ) : (
                (localWfProfile.foundry || []).map(item => {
                  const remainingSec = item.claimed 
                    ? 0 
                    : Math.max(0, item.craftTimeSeconds - (Date.now() - item.startedAt) / 1000);
                  const isDone = remainingSec <= 0 && !item.claimed;
                  const pct = getItemProgressPercentage(item);

                  return (
                    <div 
                      key={item.id} 
                      className={`p-3 rounded-2xl border transition-all ${
                        isDone 
                          ? 'bg-emerald-500/5 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)] animate-pulse' 
                          : item.claimed 
                            ? 'bg-white/1 border-white/10 opacity-50' 
                            : 'bg-white/2 border-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-black ${
                            isDone 
                              ? 'bg-emerald-500/10 text-emerald-400' 
                              : 'bg-accent/10 text-accent'
                          }`}>
                            {item.type.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="text-white text-xs block font-bold truncate pr-1" title={item.title}>{item.title}</span>
                            <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">{item.type}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isDone ? (
                            <button
                              onClick={() => handleClaimItem(item.id)}
                              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-[9px] text-white font-black uppercase tracking-wider rounded-lg transition-all"
                            >
                              Claim
                            </button>
                          ) : item.claimed ? (
                            <span className="text-[9px] text-slate-400 font-bold bg-white/5 px-2 py-0.5 rounded border border-white/5 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              Claimed
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-500 font-black font-mono">
                              {getRemainingTimeText(item)}
                            </span>
                          )}

                          <button 
                            onClick={() => handleTrashItem(item.id)}
                            className="p-1 hover:text-red-400 text-slate-600 active:scale-90 transition-colors"
                            title="Abort Blueprint Assembly"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Assembly process indicator */}
                      {!item.claimed && (
                        <div className="mt-2.5 space-y-1">
                          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${
                                isDone ? 'bg-emerald-500' : 'bg-accent'
                              }`} 
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Immersive foundry assembly addition form */}
            <form onSubmit={handleStartForge} className="border-t border-white/5 pt-4 space-y-3" autoComplete="off">
              <h4 className="text-[10px] text-slate-400 uppercase tracking-widest font-black flex items-center gap-1">
                <Plus className="w-3.5 h-3.5 text-accent" />
                Assemble New Equipment
              </h4>
              
              <div className="space-y-2 relative" ref={dropdownRef}>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search e.g. Rhino Prime, Orthos Prime..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowDropdown(true);
                      if (selectedItem && e.target.value !== selectedItem.name) {
                        setSelectedItem(null);
                      }
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full bg-white/5 border border-white/5 focus:border-accent rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none placeholder:text-slate-600"
                  />
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                  
                  {isSearchLoading && (
                    <div className="absolute right-3 top-2.5">
                      <RefreshCw className="w-3.5 h-3.5 text-accent animate-spin" />
                    </div>
                  )}
                </div>

                {/* Autocomplete suggestion dropdown feedback */}
                {showDropdown && (searchTerm.trim() !== '') && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-[220px] overflow-y-auto rounded-xl bg-[#09090f] border border-white/10 shadow-2xl divide-y divide-white/5 no-scrollbar">
                    {suggestions.length > 0 ? (
                      suggestions.map((item) => (
                        <div 
                          key={item.name}
                          onClick={() => {
                            setSearchTerm(item.name);
                            setSelectedItem(item);
                            setShowDropdown(false);
                            setSearchError(null);
                          }}
                          className="px-3 py-2.5 text-left text-xs text-slate-300 hover:text-white hover:bg-accent/10 active:bg-accent/20 cursor-pointer flex justify-between items-center transition-all"
                        >
                          <div>
                            <span className="font-bold text-white block">{item.name}</span>
                            <span className="text-[9px] text-slate-500 uppercase tracking-wide font-black">{item.type}</span>
                          </div>
                          <span className="text-[9px] text-[#F59E0B] font-black uppercase font-mono bg-[#F59E0B]/5 border border-[#F59E0B]/15 px-2 py-0.5 rounded">
                            {formatSecondsToDuration(item.buildTime)}
                          </span>
                        </div>
                      ))
                    ) : (
                      !isSearchLoading && (
                        <div className="p-3 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-slate-600" />
                          <span>No craftable item found.</span>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Selected item design indicator */}
                {selectedItem && (
                  <div className="p-3 rounded-xl bg-accent/5 border border-accent/15 text-xs text-slate-300 flex items-center justify-between text-left animate-fade-in">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-black block">Selected blueprint specs</span>
                      <strong className="text-white shrink-0 block">{selectedItem.name}</strong>
                      <span className="text-[9px] text-accent font-bold uppercase">{selectedItem.type}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase font-black block">Assembly duration</span>
                      <span className="text-xs text-[#F59E0B] font-bold block">{formatSecondsToDuration(selectedItem.buildTime)}</span>
                    </div>
                  </div>
                )}

                {/* Search error warning */}
                {searchError && (
                  <p className="text-[11px] text-[#EF4444] font-black text-left">{searchError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={!searchTerm.trim() || isSearchLoading || !selectedItem || isSaving}
                className="w-full py-2 bg-[#0A7A9B]/10 hover:bg-[#0A7A9B]/20 disabled:hover:bg-[#0A7A9B]/10 active:scale-95 text-[10px] text-accent uppercase font-black tracking-widest border border-accent/20 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 md:gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                id="button-start-crafting"
              >
                {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Flame className="w-3.5 h-3.5 text-accent" />}
                Start Crafting
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
