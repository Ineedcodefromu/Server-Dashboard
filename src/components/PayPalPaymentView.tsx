import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { 
  CreditCard, DollarSign, CheckCircle2, AlertCircle, Sparkles, 
  Settings, History, Lock, ShieldCheck, Heart, ExternalLink, 
  RefreshCw, Info, HelpCircle, ArrowRight, Copy, Check
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { doc, updateDoc, arrayUnion, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Transaction {
  id: string;
  paypalOrderId?: string;
  payerName?: string;
  payerEmail?: string;
  amount: number;
  currency: string;
  note: string;
  timestamp: number;
  status: 'completed' | 'pending' | 'failed';
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];
const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'CAD', symbol: '$', label: 'CAD ($)' },
  { code: 'AUD', symbol: '$', label: 'AUD ($)' },
];

export function PayPalPaymentView() {
  const { user, effectiveRole } = useAuth();
  const isOwner = effectiveRole === 'owner' || effectiveRole === 'admin' || user?.email === 'mathewsniko02@gmail.com';
  
  // Mode selection: 'friends' (Freunde & Familie) vs 'sdk' (Waren & Dienstleistungen)
  const [paymentMode, setPaymentMode] = useState<'friends' | 'sdk'>('friends');
  const [enableOfficialCheckout, setEnableOfficialCheckout] = useState<boolean>(true);

  // Selection states
  const [selectedPreset, setSelectedPreset] = useState<number | 'custom'>(25);
  const [customAmount, setCustomAmount] = useState<string>('25.00');
  const [currency, setCurrency] = useState<string>('EUR');
  const [paymentNote, setPaymentNote] = useState<string>('');
  
  // Config state
  const [clientId, setClientId] = useState<string>(() => {
    return localStorage.getItem('paypal_client_id') || 'test';
  });
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [tempClientId, setTempClientId] = useState<string>(clientId);
  const [paypalMeUsername, setPaypalMeUsername] = useState<string>(() => {
    return localStorage.getItem('paypal_me_username') || '';
  });

  // Sync PayPal settings from Firestore in real time
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'app_settings', 'paypal'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data.enableOfficialCheckout === 'boolean') {
          setEnableOfficialCheckout(data.enableOfficialCheckout);
          if (!data.enableOfficialCheckout) {
            setPaymentMode('friends');
          }
        }
        if (data.clientId) {
          setClientId(data.clientId);
          setTempClientId(data.clientId);
        }
        if (data.paypalMeUsername !== undefined) {
          setPaypalMeUsername(data.paypalMeUsername);
        }
      }
    }, (err) => {
      console.warn("Could not listen to paypal settings:", err);
    });
    return () => unsub();
  }, []);
  
  // Transaction processing states
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('paypal_transactions');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [
      {
        id: 'TX-90218412',
        paypalOrderId: '5O1902831201920',
        payerName: 'Alex Mercer',
        payerEmail: 'alex.mercer@example.com',
        amount: 25.00,
        currency: 'USD',
        note: 'Project Support',
        timestamp: Date.now() - 86400000 * 2,
        status: 'completed'
      }
    ];
  });
  
  const [recentSuccess, setRecentSuccess] = useState<Transaction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Compute final amount to pay
  const getFinalAmountNumber = (): number => {
    if (selectedPreset === 'custom') {
      const parsed = parseFloat(customAmount);
      return isNaN(parsed) || parsed <= 0 ? 0 : parsed;
    }
    return selectedPreset;
  };

  const finalAmount = getFinalAmountNumber();
  const currentSymbol = CURRENCIES.find(c => c.code === currency)?.symbol || '$';

  // Save config changes (Owner only)
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;

    const cleaned = tempClientId.trim() || 'test';
    const cleanedUsername = paypalMeUsername.trim();

    setClientId(cleaned);
    localStorage.setItem('paypal_client_id', cleaned);
    localStorage.setItem('paypal_me_username', cleanedUsername);

    try {
      await setDoc(doc(db, 'app_settings', 'paypal'), {
        clientId: cleaned,
        paypalMeUsername: cleanedUsername,
        enableOfficialCheckout: enableOfficialCheckout,
        updatedAt: Date.now(),
        updatedBy: user?.email || 'owner'
      }, { merge: true });
    } catch (err) {
      console.error("Error saving paypal settings:", err);
    }
    setShowConfig(false);
  };

  // Record a successful transaction
  const recordTransaction = async (newTx: Transaction) => {
    const updated = [newTx, ...transactions];
    setTransactions(updated);
    localStorage.setItem('paypal_transactions', JSON.stringify(updated));
    setRecentSuccess(newTx);
    setErrorMessage(null);

    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          paymentHistory: arrayUnion(newTx)
        });
      } catch (e) {
        console.warn("Could not save payment to Firestore profile:", e);
      }
    }
  };

  const copyPaypalMeLink = () => {
    if (!paypalMeUsername) return;
    const link = `https://paypal.me/${paypalMeUsername}/${finalAmount > 0 ? finalAmount : ''}${currency}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Clear transient error when currency or amount changes
  useEffect(() => {
    setErrorMessage(null);
  }, [currency, finalAmount]);

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-white/5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#003087] to-[#0070BA] rounded-xl flex items-center justify-center border border-[#0070BA]/30 shadow-lg shadow-[#0070BA]/20">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                PayPal Checkout
                <span className="text-[10px] bg-[#0070BA]/20 text-[#0070BA] border border-[#0070BA]/30 font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                  Official Overlay
                </span>
              </h2>
            </div>
          </div>
          <p className="text-slate-500 text-sm">
            Select or enter a custom amount to process payments securely via the official PayPal overlay.
          </p>
        </div>

        {isOwner && (
          <button 
            onClick={() => {
              setTempClientId(clientId);
              setShowConfig(!showConfig);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 active:scale-95 text-xs text-slate-300 font-bold uppercase tracking-wider rounded-xl border border-white/10 transition-all self-start md:self-auto"
          >
            <Settings className="w-4 h-4 text-accent" />
            {showConfig ? 'Schließen' : 'PayPal Einstellungen (Owner)'}
          </button>
        )}
      </div>

      {/* Mode Selection Tabs: Friends & Family (Fee-Free) vs Commercial SDK */}
      <div className={`grid grid-cols-1 ${enableOfficialCheckout ? 'sm:grid-cols-2' : ''} gap-4`}>
        <button
          type="button"
          onClick={() => setPaymentMode('friends')}
          className={`p-4 rounded-2xl border transition-all text-left flex items-start gap-3 ${
            paymentMode === 'friends'
              ? 'bg-gradient-to-br from-emerald-500/15 via-[#0070BA]/10 to-transparent border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
              : 'bg-white/2 hover:bg-white/5 border-white/5 text-slate-400'
          }`}
        >
          <div className={`p-2.5 rounded-xl ${paymentMode === 'friends' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-400'}`}>
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-black ${paymentMode === 'friends' ? 'text-white' : 'text-slate-300'}`}>
                Freunde & Familie
              </span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-black uppercase">
                0% Gebühren
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Für Freunde, Bekannte & Geschenke via PayPal.me Link oder QR-Code ohne Abzüge.
            </p>
          </div>
        </button>

        {enableOfficialCheckout && (
          <button
            type="button"
            onClick={() => setPaymentMode('sdk')}
            className={`p-4 rounded-2xl border transition-all text-left flex items-start gap-3 ${
              paymentMode === 'sdk'
                ? 'bg-gradient-to-br from-[#0070BA]/20 via-[#003087]/20 to-transparent border-[#0070BA] shadow-[0_0_20px_rgba(0,112,186,0.15)]'
                : 'bg-white/2 hover:bg-white/5 border-white/5 text-slate-400'
            }`}
          >
            <div className={`p-2.5 rounded-xl ${paymentMode === 'sdk' ? 'bg-[#0070BA] text-white' : 'bg-white/5 text-slate-400'}`}>
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-black ${paymentMode === 'sdk' ? 'text-white' : 'text-slate-300'}`}>
                  Offizieller Checkout
                </span>
                <span className="text-[9px] bg-[#0070BA]/20 text-[#0070BA] border border-[#0070BA]/30 px-2 py-0.5 rounded-full font-black uppercase">
                  Waren & Dienstleistungen
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Direktes Kreditkarten/PayPal Overlay auf der Website mit Käuferschutz & Gebühren.
              </p>
            </div>
          </button>
        )}
      </div>

      {/* Configuration Modal / Accordion (Owner Only) */}
      <AnimatePresence>
        {showConfig && isOwner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSaveConfig} className="p-6 bg-[#0c1017] rounded-3xl border border-[#0070BA]/30 space-y-4">
              <div className="flex items-center gap-2 text-[#0070BA] font-black text-xs uppercase tracking-widest">
                <Settings className="w-4 h-4" />
                PayPal globale Einstellungen (Owner)
              </div>
              <p className="text-xs text-slate-400">
                Hier kannst du den Client ID Schlüssel und die Methoden für alle Besucher der Website steuern.
              </p>

              {/* Toggle for Official Checkout */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-white block">
                    Offizieller Checkout (Waren & Dienstleistungen) anzeigen
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Wenn deaktiviert, ist die Option "Offizieller Checkout" für alle Nutzer unsichtbar und es ist nur "Freunde & Familie" (0% Gebühren) aktiv.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableOfficialCheckout(!enableOfficialCheckout)}
                  className={`w-12 h-6 rounded-full p-1 transition-all ${
                    enableOfficialCheckout ? 'bg-[#0070BA]' : 'bg-slate-700'
                  } relative shrink-0`}
                >
                  <div 
                    className={`w-4 h-4 bg-white rounded-full transition-transform ${
                      enableOfficialCheckout ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1">
                    PayPal Client ID (Live or Sandbox)
                  </label>
                  <input 
                    type="text" 
                    value={tempClientId}
                    onChange={(e) => setTempClientId(e.target.value)}
                    placeholder="e.g. A21AAFe... or test"
                    className="w-full bg-white/5 border border-white/10 focus:border-[#0070BA] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1">
                    PayPal.me Username (Optional Direct Link Fallback)
                  </label>
                  <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                    <span className="text-xs text-slate-500 font-mono">paypal.me/</span>
                    <input 
                      type="text" 
                      value={paypalMeUsername}
                      onChange={(e) => setPaypalMeUsername(e.target.value)}
                      placeholder="yourusername"
                      className="w-full bg-transparent border-none text-xs text-white focus:outline-none font-mono p-0 pl-1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#0070BA] hover:bg-[#005ea6] text-xs font-black text-white rounded-xl uppercase tracking-wider"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid: Payment Selector + PayPal Button Overlay */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Preset & Custom Amount Selection (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="glass-card rounded-3xl p-6 md:p-8 border border-white/5 bg-[#0a0a0f]/60 space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-accent" />
                Select Payment Amount
              </h3>

              {/* Currency Selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold hidden sm:inline">Currency:</span>
                <select 
                  value={currency} 
                  onChange={(e) => setCurrency(e.target.value)}
                  className="bg-white/5 border border-white/10 text-white text-xs font-bold rounded-xl px-3 py-1.5 focus:border-accent focus:outline-none cursor-pointer"
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code} className="bg-[#0a0a0f] text-white">
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount Preset Grid */}
            <div className="space-y-3">
              <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block">
                Preset Options
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {PRESET_AMOUNTS.map((amt) => {
                  const isSelected = selectedPreset === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setSelectedPreset(amt);
                        setCustomAmount(amt.toFixed(2));
                      }}
                      className={`py-3.5 px-3 rounded-2xl font-black text-sm transition-all duration-200 border flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                        isSelected
                          ? 'bg-gradient-to-b from-[#0070BA]/30 to-[#003087]/40 border-[#0070BA] text-white shadow-[0_0_15px_rgba(0,112,186,0.3)]'
                          : 'bg-white/2 hover:bg-white/5 border-white/5 text-slate-300 hover:text-white'
                      }`}
                    >
                      <span className="text-xs font-normal opacity-70">{currentSymbol}</span>
                      <span>{amt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Amount Input Box */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block">
                  Or Custom Amount
                </label>
                {selectedPreset === 'custom' && (
                  <span className="text-[10px] text-accent font-bold uppercase tracking-wider">
                    Custom mode active
                  </span>
                )}
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">
                  {currentSymbol}
                </div>
                <input 
                  type="number"
                  step="0.01"
                  min="0.50"
                  placeholder="0.00"
                  value={customAmount}
                  onChange={(e) => {
                    setSelectedPreset('custom');
                    setCustomAmount(e.target.value);
                  }}
                  onFocus={() => setSelectedPreset('custom')}
                  className={`w-full bg-white/5 border rounded-2xl pl-10 pr-16 py-4 text-2xl font-black text-white focus:outline-none transition-all ${
                    selectedPreset === 'custom' 
                      ? 'border-[#0070BA] shadow-[0_0_15px_rgba(0,112,186,0.2)]' 
                      : 'border-white/10 focus:border-accent'
                  }`}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500 uppercase">
                  {currency}
                </div>
              </div>
            </div>

            {/* Purpose / Note input */}
            <div className="space-y-1.5 pt-2">
              <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block">
                Note / Description (Optional)
              </label>
              <input 
                type="text" 
                placeholder="e.g. Website support, custom service, tip..."
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-accent focus:outline-none placeholder:text-slate-600"
              />
            </div>

            {/* Summary Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#003087]/20 via-[#0070BA]/10 to-transparent border border-[#0070BA]/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">Total Amount to Pay</span>
                <span className="text-2xl font-black text-white">
                  {currentSymbol}{finalAmount > 0 ? finalAmount.toFixed(2) : '0.00'} <span className="text-xs font-bold text-slate-400">{currency}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                <ShieldCheck className="w-4 h-4" />
                <span>SSL Encrypted</span>
              </div>
            </div>

          </div>

          {/* Alternate PayPal.Me Link section if configured */}
          {paypalMeUsername && (
            <div className="p-5 bg-white/2 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-[#0070BA]" />
                  Direct PayPal.Me Link Fallback
                </p>
                <p className="text-[11px] text-slate-400">
                  paypal.me/{paypalMeUsername}/{finalAmount > 0 ? finalAmount : ''}{currency}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copyPaypalMeLink}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 transition-all active:scale-95"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? 'Copied' : 'Copy'}
                </button>
                <a 
                  href={`https://paypal.me/${paypalMeUsername}/${finalAmount > 0 ? finalAmount : ''}${currency}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-[#0070BA]/20 border border-[#0070BA]/30 hover:bg-[#0070BA]/30 text-xs font-bold text-[#0070BA] rounded-xl flex items-center gap-1 transition-all"
                >
                  Open
                  <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

             {/* Right Column: Friends & Family Link/QR OR Official PayPal SDK Overlay (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {paymentMode === 'friends' ? (
            <div className="glass-card rounded-3xl p-6 md:p-8 border border-emerald-500/30 bg-[#06120e] space-y-6 relative overflow-hidden flex flex-col justify-between min-h-[420px]">
              {/* Ambient background glow */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-[60px] pointer-events-none" />

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Heart className="w-4 h-4 text-emerald-400" />
                    Freunde & Familie Überweisung
                  </h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                    0 € Gebühren
                  </span>
                </div>

                {!paypalMeUsername ? (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Gib zuerst deinen PayPal.me-Namen ein:</span>
                    </div>
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                      <span className="text-xs text-slate-500 font-mono">paypal.me/</span>
                      <input 
                        type="text"
                        placeholder="DeinName"
                        value={paypalMeUsername}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          setPaypalMeUsername(val);
                          localStorage.setItem('paypal_me_username', val);
                        }}
                        className="w-full bg-transparent border-none text-xs text-white focus:outline-none font-mono p-0 pl-1"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      So können dir Freunde über deinen persönlichen Link direkt Geld senden.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="p-4 rounded-2xl bg-white/3 border border-white/5 text-center space-y-3">
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Nutze diesen Button oder den QR-Code, um <strong>{currentSymbol}{finalAmount.toFixed(2)} {currency}</strong> gebührenfrei zu überweisen:
                      </p>

                      <a
                        href={`https://paypal.me/${paypalMeUsername}/${finalAmount > 0 ? finalAmount : ''}${currency}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-95 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
                      >
                        <Heart className="w-4 h-4 fill-white" />
                        Geld via PayPal.me senden
                        <ExternalLink className="w-4 h-4 ml-1" />
                      </a>

                      {/* QR Code Container */}
                      <div className="pt-2 flex flex-col items-center justify-center space-y-2">
                        <div className="p-3 bg-white rounded-2xl shadow-xl">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`https://paypal.me/${paypalMeUsername}/${finalAmount > 0 ? finalAmount : ''}${currency}`)}`}
                            alt="PayPal.me QR Code"
                            className="w-36 h-36 rounded-lg"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          QR-Code mit Handy scannen
                        </p>
                      </div>
                    </div>

                    {/* Step-by-Step Info for Friends */}
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl space-y-2 text-xs">
                      <strong className="text-emerald-400 font-bold block uppercase tracking-wider text-[10px]">
                        So bleibt es für deinen Freund gebührenfrei:
                      </strong>
                      <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
                        <li>Auf den Button klicken oder QR-Code scannen</li>
                        <li>In PayPal den Betrag ({currentSymbol}{finalAmount.toFixed(2)}) bestätigen</li>
                        <li>Wichtig: Bei Verwendungszweck <strong>"An einen Freund senden"</strong> wählen</li>
                        <li>Fertig – 0 € Gebühren für den Empfänger!</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Note */}
              <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
                <span className="flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Privatüberweisung via PayPal.me
                </span>
                <span>0% Abzüge</span>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-3xl p-6 md:p-8 border border-[#0070BA]/30 bg-[#060a12] space-y-6 relative overflow-hidden flex flex-col justify-between min-h-[420px]">
              {/* Ambient background glow */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#0070BA]/10 rounded-full blur-[60px] pointer-events-none" />

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#0070BA]" />
                    Instant Payment Checkout
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Client ID: {clientId === 'test' ? 'Sandbox (test)' : `${clientId.slice(0, 6)}...`}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Clicking the PayPal button below launches the <strong>official PayPal secure overlay</strong> directly over this site. You can complete payment using your PayPal balance, credit/debit card, or Pay in 4.
                </p>

                {/* Success Notification Modal / Card */}
                <AnimatePresence>
                  {recentSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-left space-y-2 relative"
                    >
                      <button 
                        onClick={() => setRecentSuccess(null)}
                        className="absolute top-2 right-2 text-slate-400 hover:text-white p-1"
                      >
                        ×
                      </button>
                      <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4" />
                        Payment Processed Successfully!
                      </div>
                      <div className="text-xs text-slate-300 space-y-1">
                        <p><strong>Order ID:</strong> <span className="font-mono text-white">{recentSuccess.paypalOrderId}</span></p>
                        <p><strong>Amount Paid:</strong> <span className="text-emerald-400 font-bold">{recentSuccess.currency} {recentSuccess.amount.toFixed(2)}</span></p>
                        {recentSuccess.payerName && <p><strong>Payer:</strong> {recentSuccess.payerName}</p>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error Alert */}
                {errorMessage && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Payment Error</strong>
                      <span>{errorMessage}</span>
                    </div>
                  </div>
                )}

                {/* PayPal Buttons Render Container */}
                <div className="pt-2">
                  {finalAmount <= 0 ? (
                    <div className="p-6 rounded-2xl border border-dashed border-white/10 text-center space-y-2">
                      <Info className="w-6 h-6 text-slate-500 mx-auto" />
                      <p className="text-xs text-slate-400 font-bold">Please select or enter an amount greater than 0</p>
                    </div>
                  ) : (
                    <div className="min-h-[160px] bg-white/2 p-4 rounded-2xl border border-white/5">
                      <PayPalScriptProvider 
                        key={`paypal-provider-${currency}-${clientId}`}
                        options={{ 
                          clientId: clientId,
                          currency: currency,
                          intent: "capture"
                        }}
                      >
                        <PayPalButtons 
                          style={{ 
                            layout: "vertical", 
                            color: "gold", 
                            shape: "rect", 
                            label: "pay",
                            height: 48
                          }}
                          forceReRender={[finalAmount, currency, clientId, paymentNote]}
                          createOrder={(data, actions) => {
                            return actions.order.create({
                              intent: "CAPTURE",
                              purchase_units: [
                                {
                                  description: paymentNote || `OmniDash Payment (${finalAmount} ${currency})`,
                                  amount: {
                                    currency_code: currency,
                                    value: finalAmount.toFixed(2),
                                  },
                                },
                              ],
                            });
                          }}
                          onApprove={async (data, actions) => {
                            try {
                              if (actions.order) {
                                const details = await actions.order.capture();
                                const payerName = details.payer?.name?.given_name 
                                  ? `${details.payer.name.given_name} ${details.payer.name.surname || ''}`
                                  : 'PayPal Customer';
                                const payerEmail = details.payer?.email_address;

                                const newTx: Transaction = {
                                  id: `TX-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
                                  paypalOrderId: data.orderID,
                                  payerName: payerName,
                                  payerEmail: payerEmail,
                                  amount: finalAmount,
                                  currency: currency,
                                  note: paymentNote || 'PayPal Overlay Payment',
                                  timestamp: Date.now(),
                                  status: 'completed'
                                };

                                await recordTransaction(newTx);
                              }
                            } catch (err: any) {
                              console.error("Capture Error:", err);
                              setErrorMessage("The transaction could not be completed. Please try again.");
                            }
                          }}
                          onError={(err) => {
                            console.error("PayPal Overlay Error:", err);
                            setErrorMessage("PayPal window closed or experienced a connection issue. If testing, verify Client ID settings.");
                          }}
                        />
                      </PayPalScriptProvider>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Trust Badges */}
              <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Official PayPal JS SDK Overlay
                </span>
                <span>256-bit Encryption</span>
              </div>

            </div>
          )}

        </div>      </div>

      </div>

      {/* Payment History Log */}
      <div className="glass-card rounded-3xl p-6 border border-white/5 bg-[#0a0a0f]/40 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
            <History className="w-4 h-4 text-accent" />
            Recent Payment Log
          </h3>
          <span className="text-xs text-slate-500 font-bold">
            {transactions.length} record{transactions.length === 1 ? '' : 's'}
          </span>
        </div>

        {transactions.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">No payment transactions recorded yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {transactions.map((tx) => (
              <div key={tx.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/2 px-2 rounded-xl transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{tx.payerName || 'Anonymous Payer'}</span>
                    <span className="text-[10px] font-mono text-slate-500">({tx.id})</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {tx.note ? `Note: "${tx.note}" • ` : ''}
                    {new Date(tx.timestamp).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <span className="text-sm font-black text-emerald-400">
                    +{tx.currency} {tx.amount.toFixed(2)}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase rounded-lg">
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
