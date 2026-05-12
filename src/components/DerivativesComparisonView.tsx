import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, Plus, Trash2, Calculator, 
  DollarSign, PieChart, ArrowUpRight, BarChart2 
} from 'lucide-react';

interface Derivative {
  id: string;
  name: string;
  entryPrice: number;
  priceIncrease: number; // Percentage
}

export function DerivativesComparisonView() {
  const [budget, setBudget] = useState<number>(1000);
  const [derivatives, setDerivatives] = useState<Derivative[]>([
    { id: '1', name: 'Beispiel Zertifikat 1', entryPrice: 10.50, priceIncrease: 5 }
  ]);

  const addDerivative = () => {
    const newDeriv: Derivative = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Zertifikat ${derivatives.length + 1}`,
      entryPrice: 0,
      priceIncrease: 0
    };
    setDerivatives([...derivatives, newDeriv]);
  };

  const removeDerivative = (id: string) => {
    setDerivatives(derivatives.filter(d => d.id !== id));
  };

  const updateDerivative = (id: string, updates: Partial<Derivative>) => {
    setDerivatives(derivatives.map(d => d.id === id ? { ...d, ...updates } : d));
  };

  const calculateResults = (entryPrice: number, increasePercent: number) => {
    if (entryPrice <= 0) return { units: 0, profit: 0, totalValue: 0 };
    const units = Math.floor(budget / entryPrice);
    const totalValue = units * entryPrice * (1 + increasePercent / 100);
    const profit = totalValue - (units * entryPrice);
    return { units, profit, totalValue };
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glass-card p-6 rounded-3xl">
        <div>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">Derivate Vergleich</h2>
          <p className="text-text-secondary text-sm">Berechne und vergleiche Faktor-Zertifikate effizient.</p>
        </div>
        <div className="w-full sm:w-auto relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-accent to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative flex items-center gap-3 bg-card-bg/80 backdrop-blur-xl px-4 py-2 mt-2 md:mt-0 rounded-2xl border border-white/5">
            <DollarSign className="w-4 h-4 text-accent" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-widest text-text-secondary">Gesamtbudget (€)</span>
              <input 
                type="number"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="bg-transparent border-none text-white font-bold focus:ring-0 w-32 p-0 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <AnimatePresence mode="popLayout">
            {derivatives.map((deriv, index) => {
              const { units, profit } = calculateResults(deriv.entryPrice, deriv.priceIncrease);
              return (
                <motion.div 
                  key={deriv.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass-card rounded-2xl p-6 border-border-subtle group hover:border-accent/30 transition-all"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-4 space-y-2">
                       <div className="flex items-center gap-2">
                         <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20">
                           <span className="text-[10px] font-bold text-accent">{index + 1}</span>
                         </div>
                         <input 
                           type="text" 
                           value={deriv.name}
                           onChange={(e) => updateDerivative(deriv.id, { name: e.target.value })}
                           className="bg-transparent border-none text-white font-bold p-0 focus:ring-0 w-full"
                           placeholder="Zertifikat Name"
                         />
                       </div>
                    </div>

                    <div className="md:col-span-2">
                      <p className="text-[9px] uppercase font-black tracking-widest text-text-secondary mb-1">Einstieg (€)</p>
                      <input 
                        type="number" 
                        value={deriv.entryPrice}
                        onChange={(e) => updateDerivative(deriv.id, { entryPrice: Number(e.target.value) })}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white w-full text-sm font-bold focus:border-accent/50 selection:bg-accent/30"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <p className="text-[9px] uppercase font-black tracking-widest text-text-secondary mb-1">Anstieg (%)</p>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={deriv.priceIncrease}
                          onChange={(e) => updateDerivative(deriv.id, { priceIncrease: Number(e.target.value) })}
                          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white w-full text-sm font-bold focus:border-accent/50 pr-8"
                        />
                        <ArrowUpRight className="w-3 h-3 text-emerald-500 absolute right-2 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    <div className="md:col-span-3 grid grid-cols-2 gap-2">
                      <div className="p-2 bg-white/5 rounded-xl border border-white/5">
                        <p className="text-[8px] uppercase text-text-secondary font-bold">Stück</p>
                        <p className="text-sm font-bold text-white">{units.toLocaleString()}</p>
                      </div>
                      <div className={`p-2 rounded-xl border ${profit >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                        <p className="text-[8px] uppercase text-text-secondary font-bold">Gewinn</p>
                        <p className={`text-sm font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {profit >= 0 ? '+' : ''}{profit.toFixed(2)}€
                        </p>
                      </div>
                    </div>

                    <div className="md:col-span-1 flex justify-end">
                      <button 
                        onClick={() => removeDerivative(deriv.id)}
                        className="p-2 text-rose-500/40 hover:text-rose-500 transition-colors bg-rose-500/5 hover:bg-rose-500/10 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          <button 
            onClick={addDerivative}
            className="w-full py-4 border-2 border-dashed border-white/5 rounded-2xl flex items-center justify-center gap-2 text-text-secondary hover:text-accent hover:border-accent/30 hover:bg-accent/5 transition-all group"
          >
            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-sm uppercase tracking-widest">Weiteres Derivat hinzufügen</span>
          </button>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card rounded-3xl p-6 border-border-subtle bg-gradient-to-br from-indigo-600/10 to-accent/5">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-accent" />
              <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">Zusammenfassung</h3>
            </div>
            
            <div className="space-y-4">
              {derivatives.sort((a, b) => {
                const resA = calculateResults(a.entryPrice, a.priceIncrease);
                const resB = calculateResults(b.entryPrice, b.priceIncrease);
                return resB.profit - resA.profit;
              }).slice(0, 3).map((deriv, idx) => {
                const { profit } = calculateResults(deriv.entryPrice, deriv.priceIncrease);
                return (
                  <div key={deriv.id} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-amber-500/20 text-amber-500' : 
                        idx === 1 ? 'bg-slate-300/20 text-slate-300' : 
                        'bg-orange-700/20 text-orange-700'
                      }`}>
                        #{idx + 1}
                      </div>
                      <span className="text-xs font-bold text-white truncate max-w-[100px]">{deriv.name}</span>
                    </div>
                    <span className="text-emerald-400 font-bold text-sm">+{profit.toFixed(2)}€</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-secondary">Vergleichbare Derivate</span>
                <span className="text-white font-bold">{derivatives.length}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-secondary">Max. Potenzieller Gewinn</span>
                <span className="text-emerald-400 font-bold">
                  {Math.max(...derivatives.map(d => calculateResults(d.entryPrice, d.priceIncrease).profit)).toFixed(2)}€
                </span>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6 border-border-subtle text-center space-y-4">
            <Calculator className="w-8 h-8 text-white/20 mx-auto" />
            <h4 className="text-xs font-bold text-white uppercase tracking-widest">Wichtiger Hinweis</h4>
            <p className="text-[10px] text-text-secondary leading-relaxed">
              Diese Berechnung dient nur zu Vergleichszwecken. Faktor-Zertifikate unterliegen hohen Risiken und dem Pfadabhängigkeitseffekt. Keine Anlageberatung.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
