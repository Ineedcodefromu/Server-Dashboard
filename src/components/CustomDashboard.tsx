import { useState } from 'react';
import { motion, Reorder } from 'motion/react';
import { 
  Layout, LayoutGrid, BarChart3, TrendingUp, 
  Newspaper, Briefcase, Sparkles, MessageSquare,
  Settings, GripVertical, Check, Eye
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { DashboardOverview } from './DashboardOverview';
import { PerformanceView } from './PerformanceView';
import { StocksView } from './StocksView';
import { NewsView } from './NewsView';
import { ProjectsView } from './ProjectsView';
import { AIAssistantView } from './AIAssistantView';
import { PresenceChatView } from './PresenceChatView';

const WIDGETS = [
  { id: 'stats', label: 'Statistiken', icon: BarChart3, component: DashboardOverview },
  { id: 'performance', label: 'Performance', icon: TrendingUp, component: PerformanceView },
  { id: 'stocks', label: 'Markt/Stocks', icon: TrendingUp, component: StocksView },
  { id: 'news', label: 'News Feed', icon: Newspaper, component: NewsView },
  { id: 'projects', label: 'Projekte', icon: Briefcase, component: ProjectsView },
  { id: 'ai', label: 'AI Assistent', icon: Sparkles, component: AIAssistantView },
  { id: 'chat', label: 'Team Chat', icon: MessageSquare, component: PresenceChatView },
];

export function CustomDashboard() {
  const { profile } = useAuth();
  const [layout, setLayout] = useState<string[]>(profile?.dashboardLayout || ['stats', 'performance', 'stocks']);
  const [isEditing, setIsEditing] = useState(false);

  const handleSaveLayout = async () => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        dashboardLayout: layout
      });
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleWidget = (id: string) => {
    if (layout.includes(id)) {
      setLayout(layout.filter(w => w !== id));
    } else {
      setLayout([...layout, id]);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold text-text-primary tracking-tight">Dein Dashboard</h2>
          <p className="text-text-secondary text-sm">Personalisiere deine Ansicht durch Drag & Drop.</p>
        </div>
        <button 
          onClick={() => isEditing ? handleSaveLayout() : setIsEditing(true)}
          className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-accent/20 ${
            isEditing ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-accent text-white hover:bg-accent/90'
          }`}
        >
          {isEditing ? (
            <><Check className="w-4 h-4" /> Layout speichern</>
          ) : (
            <><Settings className="w-4 h-4" /> Ansicht anpassen</>
          )}
        </button>
      </div>

      {isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
           {/* Widget Selector */}
           <div className="md:col-span-1 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-text-secondary ml-2">Verfügbare Widgets</h3>
              <div className="space-y-2">
                {WIDGETS.map(widget => (
                  <button
                    key={widget.id}
                    onClick={() => toggleWidget(widget.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                      layout.includes(widget.id)
                        ? 'bg-accent/10 border-accent/30 text-accent'
                        : 'bg-input-bg border-border-subtle text-text-secondary opacity-60'
                    }`}
                  >
                    <widget.icon className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">{widget.label}</span>
                    {layout.includes(widget.id) && <Check className="w-4 h-4 ml-auto" />}
                  </button>
                ))}
              </div>
           </div>

           {/* Reorder List */}
           <div className="md:col-span-3 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-text-secondary ml-2">Reihenfolge anpassen</h3>
              <Reorder.Group 
                axis="y" 
                values={layout} 
                onReorder={setLayout}
                className="space-y-3"
              >
                {layout.map(widgetId => {
                  const widget = WIDGETS.find(w => w.id === widgetId);
                  if (!widget) return null;
                  return (
                    <Reorder.Item 
                      key={widgetId} 
                      value={widgetId}
                      className="glass-card p-5 rounded-2xl border-border-subtle flex items-center gap-4 cursor-grab active:cursor-grabbing hover:border-accent/40 transition-colors"
                    >
                      <GripVertical className="w-4 h-4 text-text-secondary" />
                      <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
                        <widget.icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-bold text-text-primary uppercase tracking-widest">{widget.label}</span>
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
           {layout.map(widgetId => {
             const widget = WIDGETS.find(w => w.id === widgetId);
             if (!widget) return null;
             return (
               <motion.div
                 key={widgetId}
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="space-y-4"
               >
                 <div className="flex items-center gap-2 px-2">
                    <div className="w-1 h-4 bg-accent rounded-full" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                      {widget.label}
                    </h3>
                 </div>
                 <div className="glass-card rounded-[2.5rem] p-6 border-border-subtle">
                   <widget.component />
                 </div>
               </motion.div>
             );
           })}
           {layout.length === 0 && (
             <div className="py-32 flex flex-col items-center justify-center text-center opacity-30">
                <LayoutGrid className="w-16 h-16 mb-4 stroke-1" />
                <p className="text-[10px] font-black uppercase tracking-widest">Dashboard ist leer</p>
                <button onClick={() => setIsEditing(true)} className="mt-4 text-accent font-bold hover:underline">Ansicht anpassen</button>
             </div>
           )}
        </div>
      )}
    </div>
  );
}
