import { useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { motion } from 'motion/react';
import { Cpu, HardDrive, Database, Zap, Activity } from 'lucide-react';
import axios from 'axios';

interface PerformanceMetric {
  time: string;
  cpu: number;
  ram: number;
  storageUsed: number;
  storageTotal: number;
  storageUsedGB: number;
}

export function PerformanceView() {
  const [history, setHistory] = useState<PerformanceMetric[]>([]);
  const [current, setCurrent] = useState<PerformanceMetric | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/api/performance');
        const newData = {
          ...response.data,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        
        setCurrent(newData);
        setHistory(prev => {
          const updated = [...prev, newData];
          if (updated.length > 20) return updated.slice(1);
          return updated;
        });
      } catch (error) {
        console.error('Failed to fetch performance data:', error);
      }
    };

    fetchData(); // Initial fetch
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const storageData = current ? [
    { name: 'Belegt', value: current.storageUsed, color: '#10b981' },
    { name: 'Frei', value: 100 - current.storageUsed, color: 'var(--color-border-subtle)' },
  ] : [];

  if (!current) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4">
        <Activity className="w-8 h-8 text-accent animate-pulse" />
        <p className="text-text-secondary font-bold uppercase tracking-widest text-[10px]">Initialisiere Sensoren...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-text-primary tracking-tight">Echtzeit-Leistung</h2>
        <p className="text-text-secondary text-sm">Direkte Hardware-Metriken vom Host-System.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card-bg rounded-2xl border border-border-subtle p-6 flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-accent/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent relative z-10">
            <Cpu className="w-6 h-6" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest leading-none mb-1">CPU Auslastung</p>
            <p className="text-2xl font-bold text-text-primary">{current.cpu}%</p>
          </div>
        </div>
        <div className="bg-card-bg rounded-2xl border border-border-subtle p-6 flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-indigo-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 relative z-10">
            <Activity className="w-6 h-6" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest leading-none mb-1">RAM Belegung</p>
            <p className="text-2xl font-bold text-text-primary">{current.ram}%</p>
          </div>
        </div>
        <div className="bg-card-bg rounded-2xl border border-border-subtle p-6 flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-emerald-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 relative z-10">
            <HardDrive className="w-6 h-6" />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest leading-none mb-1">Speicherplatz</p>
            <p className="text-2xl font-bold text-text-primary">{current.storageUsed}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-card-bg rounded-2xl border border-border-subtle p-6 h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" /> Hardware Historie
            </h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-[9px] text-text-secondary uppercase font-bold tracking-tighter">CPU</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-[9px] text-text-secondary uppercase font-bold tracking-tighter">RAM</span>
              </div>
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height="85%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis 
                dataKey="time" 
                stroke="var(--color-text-secondary)" 
                fontSize={9} 
                tickLine={false} 
                axisLine={false}
                minTickGap={40}
              />
              <YAxis 
                stroke="var(--color-text-secondary)" 
                fontSize={9} 
                tickLine={false} 
                axisLine={false} 
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--color-card-bg)', 
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: '8px',
                  fontSize: '10px',
                  color: 'var(--color-text-primary)'
                }}
                itemStyle={{ color: 'var(--color-text-primary)', padding: '2px 0' }}
              />
              <Area 
                type="monotone" 
                dataKey="cpu" 
                stroke="var(--color-accent)" 
                fillOpacity={1} 
                fill="url(#colorCpu)" 
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Area 
                type="monotone" 
                dataKey="ram" 
                stroke="#6366f1" 
                fillOpacity={1} 
                fill="url(#colorRam)" 
                strokeWidth={2}
                strokeDasharray="4 4"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-4 bg-card-bg rounded-2xl border border-border-subtle p-6 h-[400px] flex flex-col">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest flex items-center gap-2 mb-6">
            <Database className="w-4 h-4 text-emerald-400" /> Disk Kapazität
          </h3>
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={storageData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={8}
                  dataKey="value"
                  isAnimationActive={true}
                >
                  {storageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--color-card-bg)', 
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: '8px',
                    fontSize: '10px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center text-center pointer-events-none">
              <span className="text-4xl font-black text-text-primary">{current.storageUsed}%</span>
              <span className="text-[9px] text-text-secondary uppercase font-bold tracking-widest">Storage</span>
            </div>
          </div>

          <div className="space-y-4 mt-auto">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
              <span className="text-text-secondary">In Benutzung</span>
              <span className="text-text-primary">{current.storageUsedGB} GB / {current.storageTotal} GB</span>
            </div>
            <div className="w-full h-1.5 bg-input-bg rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${current.storageUsed}%` }}
                transition={{ duration: 1 }}
                className="h-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]" 
              />
            </div>
            <div className="flex justify-between items-center text-[9px] uppercase font-bold tracking-[0.2em]">
              <span className="text-text-secondary">Storage Node 01</span>
              <span className="text-emerald-500/80">ONLINE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
