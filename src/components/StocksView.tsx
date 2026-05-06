import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, RefreshCcw, Search, Plus, Trash2 } from 'lucide-react';
import { dashboardService, StockData } from '../services/dashboardService';
import { motion } from 'motion/react';

export function StocksView() {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState(['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'BTC']);
  const [newSymbol, setNewSymbol] = useState('');
  const [currency, setCurrency] = useState<'EUR' | 'USD'>('EUR');

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const data = await dashboardService.getStocks(watchlist);
      setStocks(data.stocks);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();
    const interval = setInterval(fetchStocks, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [watchlist]);

  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSymbol && !watchlist.includes(newSymbol.toUpperCase())) {
      setWatchlist([...watchlist, newSymbol.toUpperCase()]);
      setNewSymbol('');
    }
  };

  const handleRemoveSymbol = (symbol: string) => {
    setWatchlist(watchlist.filter(s => s !== symbol));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Aktienmarkt</h2>
          <p className="text-slate-500">Überwache deine Watchlist in Echtzeit.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex bg-slate-100 p-1 rounded-xl">
             <button 
               onClick={() => setCurrency('EUR')}
               className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currency === 'EUR' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               EUR
             </button>
             <button 
               onClick={() => setCurrency('USD')}
               className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currency === 'USD' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               USD
             </button>
          </div>
          <form onSubmit={handleAddSymbol} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Symbol (z.B. TSLA)" 
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
              />
            </div>
            <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-lg">
              <Plus className="w-4 h-4" />
              Symbol hinzufügen
            </button>
          </form>
          <button 
            onClick={fetchStocks}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <RefreshCcw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stocks.map((stock) => (
          <motion.div 
            layout
            key={stock.symbol}
            className="bg-white p-6 rounded-3xl border border-slate-200 relative group"
          >
            <button 
              onClick={() => handleRemoveSymbol(stock.symbol)}
              className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center font-bold text-slate-900 border border-slate-100 overflow-hidden text-[10px]">
                {stock.symbol}
              </div>
              <div className="text-right flex-1 ml-4 overflow-hidden">
                <p className="text-sm font-bold text-slate-900 uppercase tracking-wider truncate">{(stock as any).name || stock.symbol}</p>
                <p className="text-xs text-slate-400 font-medium">{stock.symbol}</p>
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black text-slate-900 tracking-tight">
                {currency === 'EUR' ? `${stock.priceEUR}€` : `$${stock.price}`}
              </p>
              <div className={`flex items-center gap-1 text-sm font-bold ${Number(stock.change) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Number(stock.change) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {stock.changePercent}%
              </div>
            </div>

            <div className="mt-6 h-1 w-full bg-slate-50 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: '100%' }}
                 transition={{ duration: 1 }}
                 className={`h-full ${Number(stock.change) >= 0 ? 'bg-green-500' : 'bg-red-500'} opacity-20`}
               />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-medium">Zuletzt aktualisiert: {new Date(stock.updatedAt).toLocaleTimeString()}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
