import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  File, FileText, Image as ImageIcon, Video, 
  Search, Plus, MoreHorizontal, Download, 
  Trash2, Filter, Grid, List as ListIcon,
  Cloud, HardDrive, Share2, ChevronRight
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, addDoc, 
  deleteDoc, doc, serverTimestamp, orderBy 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

interface Document {
  id: string;
  name: string;
  size: number; // in KB
  type: string;
  category: string;
  userId: string;
  createdAt: any;
}

const CATEGORIES = ['Alle', 'Dokumente', 'Bilder', 'Projekte', 'Rechnungen'];

export function DocumentsView() {
  const { effectiveRole } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Alle');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'documents'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Document[];
      setDocuments(docs);
    });

    return () => unsubscribe();
  }, []);

  const handleUploadSim = async () => {
    if (!auth.currentUser) return;
    
    // Simulate some document metadata
    const demos = [
      { name: 'jahresabschluss_2025.pdf', type: 'pdf', size: 1240, category: 'Rechnungen' },
      { name: 'logo_entwurf.png', type: 'png', size: 450, category: 'Bilder' },
      { name: 'projektplan_delta.docx', type: 'docx', size: 85, category: 'Projekte' },
    ];
    const demo = demos[Math.floor(Math.random() * demos.length)];

    await addDoc(collection(db, 'documents'), {
      ...demo,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });
  };

  const deleteDocument = async (id: string) => {
    await deleteDoc(doc(db, 'documents', id));
  };

  const getFileIcon = (type: string) => {
    if (['png', 'jpg', 'jpeg'].includes(type)) return <ImageIcon className="w-5 h-5 text-emerald-500" />;
    if (['mp4', 'mov'].includes(type)) return <Video className="w-5 h-5 text-purple-500" />;
    return <FileText className="w-5 h-5 text-accent" />;
  };

  const filtered = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = activeCategory === 'Alle' || doc.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const totalStorage = documents.reduce((acc, curr) => acc + curr.size, 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold text-text-primary tracking-tight">Dokumente</h2>
          <p className="text-text-secondary text-sm">Verwalte alle Team-Dateien und Projektunterlagen zentral.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-3 px-6 py-4 glass-card rounded-2xl border-border-subtle bg-white/5">
            <Cloud className="w-5 h-5 text-accent" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary pr-4">Gesamt-Speicher</p>
                <span className="text-[10px] font-bold text-text-primary">{(totalStorage / 1024).toFixed(1)} MB / 512 MB</span>
              </div>
              <div className="w-40 h-1 bg-input-bg rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent transition-all duration-1000" 
                  style={{ width: `${(totalStorage / (512 * 1024)) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <button 
            onClick={handleUploadSim}
            className="flex items-center gap-2 px-6 py-4 bg-accent text-white rounded-[1.5rem] font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-accent/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Hochladen
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Controls */}
        <div className="md:col-span-1 space-y-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary group-focus-within:text-accent transition-colors" />
            <input 
              type="text"
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-input-bg border border-border-subtle rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-accent/30 transition-all"
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-text-secondary ml-2">Kategorien</h3>
            <div className="flex flex-col gap-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all font-bold text-xs flex items-center justify-between group ${
                    activeCategory === cat 
                      ? 'bg-accent/10 text-accent border border-accent/20' 
                      : 'text-text-secondary hover:bg-input-bg border border-transparent'
                  }`}
                >
                  {cat}
                  <ChevronRight className={`w-3 h-3 transition-transform ${activeCategory === cat ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* File Display */}
        <div className="md:col-span-3 space-y-4">
          <div className="flex items-center justify-between px-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
              {filtered.length} Dateien gefunden
            </p>
            <div className="flex bg-input-bg p-1 rounded-xl border border-border-subtle">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-text-secondary hover:text-text-primary'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-text-secondary hover:text-text-primary'}`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {viewMode === 'grid' ? (
              <motion.div 
                layout
                className="grid grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {filtered.map(doc => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="glass-card p-4 rounded-[2rem] border-border-subtle hover:border-accent/30 group transition-all"
                  >
                    <div className="aspect-square bg-input-bg/50 rounded-2xl flex items-center justify-center mb-4 relative overflow-hidden">
                       <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                       <div className="transform scale-150 group-hover:scale-[2] transition-transform duration-500">
                         {getFileIcon(doc.type)}
                       </div>
                       <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          {(doc.userId === auth.currentUser?.uid || effectiveRole === 'admin' || effectiveRole === 'owner') && (
                            <button 
                              onClick={() => deleteDocument(doc.id)}
                              className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                       </div>
                    </div>
                    <div className="space-y-1 pr-2">
                       <h4 className="text-[12px] font-bold text-text-primary truncate">{doc.name}</h4>
                       <div className="flex items-center justify-between">
                         <span className="text-[10px] text-text-secondary font-medium tracking-tight uppercase">
                            {(doc.size / 1024).toFixed(1)} MB
                         </span>
                         <span className="text-[8px] font-black text-accent uppercase tracking-widest bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">
                            {doc.type}
                         </span>
                       </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="space-y-2">
                {filtered.map(doc => (
                  <motion.div
                    key={doc.id}
                    className="glass-card p-4 rounded-2xl border-border-subtle hover:border-accent/20 flex items-center gap-4 group transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-input-bg flex items-center justify-center shrink-0">
                      {getFileIcon(doc.type)}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="text-sm font-bold text-text-primary truncate">{doc.name}</h4>
                      <p className="text-[10px] text-text-secondary font-medium uppercase tracking-widest">
                        {doc.category} • {(doc.size / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2 text-text-secondary hover:text-accent transition-all">
                        <Download className="w-4 h-4" />
                      </button>
                      {(doc.userId === auth.currentUser?.uid || effectiveRole === 'admin' || effectiveRole === 'owner') && (
                        <button 
                          onClick={() => deleteDocument(doc.id)}
                          className="p-2 text-text-secondary hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="py-32 flex flex-col items-center justify-center text-center opacity-20">
               <HardDrive className="w-16 h-16 mb-4 stroke-1" />
               <p className="text-[10px] font-black uppercase tracking-widest tracking-[0.2em]">Keine Dateien in dieser Ansicht</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
