import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { Briefcase, Plus, MoreVertical, Clock, CheckCircle2, AlertCircle, PlayCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Project {
  id: string;
  title: string;
  description: string;
  status: 'planned' | 'active' | 'paused' | 'completed';
  progress: number;
}

export function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', description: '', status: 'planned', progress: 0 });

  useEffect(() => {
    const q = query(collection(db, 'projects'));
    const path = 'projects';
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = 'projects';
    try {
      await addDoc(collection(db, path), {
        ...newProject,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewProject({ title: '', description: '', status: 'planned', progress: 0 });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planned': return <Clock className="w-4 h-4 text-slate-400" />;
      case 'active': return <PlayCircle className="w-4 h-4 text-blue-500" />;
      case 'paused': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[#11111a]/60 backdrop-blur-xl p-6 rounded-3xl border border-white/5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Projekt-Übersicht</h2>
          <p className="text-slate-500 text-sm">Verwalte deine aktuellen Entwicklungsziele.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Neues Projekt
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleCreate} className="bg-[#11111a]/80 backdrop-blur-2xl p-8 rounded-3xl border border-white/10 shadow-2xl space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input 
                  type="text" 
                  placeholder="Projekt-Titel"
                  required
                  value={newProject.title}
                  onChange={e => setNewProject({...newProject, title: e.target.value})}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl outline-hidden focus:ring-2 focus:ring-blue-500/20" 
                />
                <select 
                  value={newProject.status}
                  onChange={e => setNewProject({...newProject, status: e.target.value as any})}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl outline-hidden focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="planned">Geplant</option>
                  <option value="active" className="bg-[#050508]">Aktiv</option>
                  <option value="paused" className="bg-[#050508]">Pausiert</option>
                  <option value="completed" className="bg-[#050508]">Abgeschlossen</option>
                </select>
              </div>
              <textarea 
                placeholder="Beschreibung..."
                value={newProject.description}
                onChange={e => setNewProject({...newProject, description: e.target.value})}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl outline-hidden focus:ring-2 focus:ring-blue-500/20 min-h-[100px]"
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-3 text-slate-500 font-bold hover:text-white transition-colors">Abbrechen</button>
                <button type="submit" className="px-8 py-3 bg-white text-black rounded-xl font-bold hover:bg-slate-200 transition-colors">Speichern</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.map((project) => (
          <motion.div 
            layout
            key={project.id}
            className="bg-[#11111a]/60 rounded-3xl border border-white/5 p-6 hover:border-blue-500/30 transition-all group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 group-hover:scale-110 transition-transform">
                <Briefcase className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/5 rounded-full">
                {getStatusIcon(project.status)}
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{project.status}</span>
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-2 truncate group-hover:text-blue-400 transition-colors">{project.title}</h3>
            <p className="text-sm text-slate-500 line-clamp-2 h-10 mb-6 leading-relaxed">{project.description}</p>

            <div className="space-y-3">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-600">Fortschritt</span>
                <span className="text-blue-400">{project.progress}%</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${project.progress}%` }}
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-2 border-t border-white/5 pt-4">
               <button className="p-2 text-slate-600 hover:text-white transition-colors">
                 <MoreVertical className="w-5 h-5" />
               </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
