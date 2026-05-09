import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, RefreshCcw, Search, Plus, Trash2 } from 'lucide-react';
import { dashboardService, StockData } from '../services/dashboardService';
import { motion } from 'motion/react';
import { useAuth } from '../lib/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export function StocksView() {
  const { profile } = useAuth();
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'BTC-USD']);
  const [newSymbol, setNewSymbol] = useState('');
  const [currency, setCurrency] = useState<'EUR' | 'USD'>('EUR');

  // Load watchlist from profile on mount/profile change
  useEffect(() => {
    if (profile?.watchlist && profile.watchlist.length > 0) {
      setWatchlist(profile.watchlist);
    }
  }, [profile?.watchlist]);

  const fetchStocks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getStocks(watchlist);
      setStocks(data.stocks);
    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.details || err.response?.data?.error || err.message;
      setError(`Kursdaten-Fehler: ${detail}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();
    const interval = setInterval(fetchStocks, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [watchlist]);

  const handleAddSymbol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newSymbol && !watchlist.includes(newSymbol.toUpperCase())) {
      const updatedWatchlist = [...watchlist, newSymbol.toUpperCase()];
      setWatchlist(updatedWatchlist);
      setNewSymbol('');

      if (profile?.uid) {
        try {
          const userRef = doc(db, 'users', profile.uid);
          await updateDoc(userRef, { watchlist: updatedWatchlist });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
        }
      }
    }
  };

  const handleRemoveSymbol = async (symbol: string) => {
    const updatedWatchlist = watchlist.filter(s => s !== symbol);
    setWatchlist(updatedWatchlist);

    if (profile?.uid) {
      try {
        const userRef = doc(db, 'users', profile.uid);
        await updateDoc(userRef, { watchlist: updatedWatchlist });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card-bg p-6 rounded-3xl border border-border-subtle shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-text-primary uppercase tracking-tight">Aktienmarkt</h2>
          <p className="text-text-secondary text-xs uppercase font-bold tracking-widest mt-1">Status: Echtzeit-Überwachung</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex bg-input-bg p-1 rounded-xl border border-border-subtle">
             <button 
               onClick={() => setCurrency('EUR')}
               className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currency === 'EUR' ? 'bg-card-bg text-text-primary shadow-sm border border-border-subtle' : 'text-text-secondary hover:text-text-primary'}`}
             >
               EUR
             </button>
             <button 
               onClick={() => setCurrency('USD')}
               className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currency === 'USD' ? 'bg-card-bg text-text-primary shadow-sm border border-border-subtle' : 'text-text-secondary hover:text-text-primary'}`}
             >
               USD
             </button>
          </div>
          <form onSubmit={handleAddSymbol} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input 
                type="text" 
                placeholder="Symbol (z.B. TSLA)" 
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="pl-10 pr-4 py-2 bg-input-bg border border-border-subtle text-text-primary rounded-xl outline-hidden focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm font-medium"
              />
            </div>
            <button type="submit" className="bg-accent text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-colors shadow-lg shadow-accent/20">
              <Plus className="w-4 h-4" />
              Symbol hinzufügen
            </button>
          </form>
          <button 
            onClick={fetchStocks}
            className="p-2 border border-border-subtle bg-input-bg rounded-xl hover:bg-card-hover transition-colors"
          >
            <RefreshCcw className={`w-5 h-5 text-text-secondary ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && stocks.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card-bg p-6 rounded-3xl border border-border-subtle animate-pulse h-48 flex items-center justify-center">
              <RefreshCcw className="w-8 h-8 text-input-bg animate-spin" />
            </div>
          ))
        ) : error ? (
          <div className="col-span-full py-12 text-center bg-card-bg rounded-3xl border border-dashed border-border-subtle">
             <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingDown className="w-8 h-8 text-red-500" />
             </div>
             <p className="text-text-primary font-medium">{error}</p>
             <button 
               onClick={fetchStocks}
               className="mt-4 px-6 py-2 bg-accent text-white rounded-xl font-bold hover:opacity-90 transition-colors"
             >
               Erneut versuchen
             </button>
          </div>
        ) : stocks.length === 0 && !loading ? (
          <div className="col-span-full py-12 text-center bg-card-bg rounded-3xl border border-dashed border-border-subtle">
            <p className="text-text-secondary">Keine Aktien in der Watchlist.</p>
          </div>
        ) : (
          stocks.map((stock) => (
            <motion.div 
              layout
              key={stock.symbol}
              className="bg-card-bg p-6 rounded-3xl border border-border-subtle relative group hover:border-accent/30 transition-all"
            >
              <button 
                onClick={() => handleRemoveSymbol(stock.symbol)}
                className="absolute top-4 right-4 p-2 text-text-secondary opacity-0 group-hover:opacity-100 transition-all hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-input-bg rounded-2xl flex items-center justify-center font-bold text-text-primary border border-border-subtle overflow-hidden text-[10px]">
                  {stock.symbol}
                </div>
                <div className="text-right flex-1 ml-4 overflow-hidden">
                  <p className="text-sm font-bold text-text-primary uppercase tracking-wider truncate">{(stock as any).name || stock.symbol}</p>
                  <p className="text-xs text-text-secondary font-medium">{stock.symbol}</p>
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-text-primary tracking-tight">
                  {currency === 'EUR' ? `${stock.priceEUR}€` : `$${stock.price}`}
                </p>
                <div className={`flex items-center gap-1 text-sm font-bold ${Number(stock.change) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {Number(stock.change) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {stock.changePercent}%
                </div>
              </div>

              <div className="mt-6 h-1 w-full bg-input-bg rounded-full overflow-hidden">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: '100%' }}
                   transition={{ duration: 1 }}
                   className={`h-full ${Number(stock.change) >= 0 ? 'bg-green-500' : 'bg-red-500'} opacity-20`}
                 />
              </div>
              <p className="text-[10px] text-text-secondary mt-2 font-medium">Zuletzt aktualisiert: {new Date(stock.updatedAt).toLocaleTimeString()}</p>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
