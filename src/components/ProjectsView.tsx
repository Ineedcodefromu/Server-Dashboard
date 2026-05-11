import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { Briefcase, Plus, MoreVertical, Clock, CheckCircle2, AlertCircle, PlayCircle, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/AuthContext';

interface Project {
  id: string;
  title: string;
  description: string;
  status: 'planned' | 'active' | 'paused' | 'completed';
  progress: number;
}

export function ProjectsView() {
  const { profile, permissions } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', description: '', status: 'planned', progress: 0 });

  const [editingProject, setEditingProject] = useState<Project | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
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
      if (editingProject) {
        await updateDoc(doc(db, path, editingProject.id), {
          ...newProject,
          updatedAt: serverTimestamp()
        });
        setEditingProject(null);
      } else {
        await addDoc(collection(db, path), {
          ...newProject,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setNewProject({ title: '', description: '', status: 'planned', progress: 0 });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bist du sicher, dass du dieses Projekt löschen möchtest?')) return;
    const path = 'projects';
    try {
      await deleteDoc(doc(db, path, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const startEdit = (p: Project) => {
    setEditingProject(p);
    setNewProject({ title: p.title, description: p.description, status: p.status, progress: p.progress });
    setIsAdding(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planned': return <Clock className="w-4 h-4 text-slate-400" />;
      case 'active': return <PlayCircle className="w-4 h-4 text-accent" />;
      case 'paused': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default: return null;
    }
  };

  const hasAccess = permissions.includes('projects.view') || profile?.role === 'owner';
  const canEdit = permissions.includes('projects.edit') || profile?.role === 'owner';

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-20 glass-card rounded-3xl border-rose-500/20 bg-rose-500/5">
        <Lock className="w-12 h-12 text-rose-500 mb-4" />
        <h3 className="text-xl font-bold text-text-primary">Zugriff verweigert</h3>
        <p className="text-text-secondary text-sm">Du hast keine Berechtigung, Projekte einzusehen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center glass-card p-6 rounded-3xl">
        <div>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">Projekt-Übersicht</h2>
          <p className="text-text-secondary text-sm">Verwalte deine aktuellen Entwicklungsziele.</p>
        </div>
        {canEdit && (
          <button 
            onClick={() => {
              setEditingProject(null);
              setNewProject({ title: '', description: '', status: 'planned', progress: 0 });
              setIsAdding(true);
            }}
            className="bg-accent text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-accent/20 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Neues Projekt
          </button>
        )}
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
              <h3 className="text-xl font-bold text-white mb-4">
                {editingProject ? 'Projekt bearbeiten' : 'Neues Projekt erstellen'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input 
                  type="text" 
                  placeholder="Projekt-Titel"
                  required
                  value={newProject.title}
                  onChange={e => setNewProject({...newProject, title: e.target.value})}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl outline-hidden focus:ring-2 focus:ring-accent/20" 
                />
                <select 
                  value={newProject.status}
                  onChange={e => setNewProject({...newProject, status: e.target.value as any})}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl outline-hidden focus:ring-2 focus:ring-accent/20"
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
                className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl outline-hidden focus:ring-2 focus:ring-accent/20 min-h-[100px]"
              />
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-400">
                  <span>Fortschritt</span>
                  <span>{newProject.progress}%</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={newProject.progress}
                  onChange={e => setNewProject({...newProject, progress: parseInt(e.target.value)})}
                  className="w-full accent-accent"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setIsAdding(false); setEditingProject(null); }} className="px-6 py-3 text-slate-500 font-bold hover:text-white transition-colors">Abbrechen</button>
                <button type="submit" className="px-8 py-3 bg-white text-black rounded-xl font-bold hover:bg-slate-200 transition-colors">
                  {editingProject ? 'Aktualisieren' : 'Speichern'}
                </button>
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
            className="bg-[#11111a]/60 rounded-3xl border border-white/5 p-6 hover:border-accent/30 transition-all group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 group-hover:scale-110 transition-transform">
                <Briefcase className="w-5 h-5 text-accent" />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/5 rounded-full">
                {getStatusIcon(project.status)}
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{project.status}</span>
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-2 truncate group-hover:text-accent transition-colors">{project.title}</h3>
            <p className="text-sm text-slate-500 line-clamp-2 h-10 mb-6 leading-relaxed">{project.description}</p>

            <div className="space-y-3">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-600">Fortschritt</span>
                <span className="text-accent">{project.progress}%</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${project.progress}%` }}
                  className="h-full bg-gradient-to-r from-accent to-indigo-500 shadow-[0_0_10px_rgba(var(--accent-rgb),0.3)]"
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-2 border-t border-white/5 pt-4">
               {canEdit && (
                 <>
                   <button 
                     onClick={() => startEdit(project)}
                     className="p-2 text-slate-600 hover:text-accent transition-colors"
                   >
                     <MoreVertical className="w-5 h-5" />
                   </button>
                   <button 
                     onClick={() => handleDelete(project.id)}
                     className="p-2 text-slate-600 hover:text-red-500 transition-colors"
                   >
                     <Trash2 className="w-5 h-5" />
                   </button>
                 </>
               )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
