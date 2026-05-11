import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { Code, Plus, Terminal, Hash, Copy, Check, Pencil, Trash2, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/AuthContext';

interface Snippet {
  id: string;
  title: string;
  code: string;
  language: string;
  tags: string[];
}

export function CodeView() {
  const { profile, permissions } = useAuth();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newSnippet, setNewSnippet] = useState({ title: '', code: '', language: 'TypeScript', tags: '' });
  const [editSnippet, setEditSnippet] = useState({ title: '', code: '', language: '', tags: '' });

  useEffect(() => {
    const q = query(collection(db, 'snippets'));
    const path = 'snippets';
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Snippet));
      setSnippets(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = 'snippets';
    try {
      await addDoc(collection(db, path), {
        ...newSnippet,
        tags: newSnippet.tags.split(',').map(t => t.trim()).filter(t => t !== ''),
        createdAt: serverTimestamp()
      });
      setNewSnippet({ title: '', code: '', language: 'TypeScript', tags: '' });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const path = `snippets/${editingId}`;
    try {
      const snippetRef = doc(db, 'snippets', editingId);
      await updateDoc(snippetRef, {
        ...editSnippet,
        tags: editSnippet.tags.split(',').map(t => t.trim()).filter(t => t !== ''),
        updatedAt: serverTimestamp()
      });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const id = deletingId;
    const path = `snippets/${id}`;
    try {
      await deleteDoc(doc(db, 'snippets', id));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const startEditing = (snippet: Snippet) => {
    setEditingId(snippet.id);
    setEditSnippet({
      title: snippet.title,
      code: snippet.code,
      language: snippet.language,
      tags: snippet.tags.join(', ')
    });
  };

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasAccess = permissions.includes('code.view') || profile?.role === 'owner';
  const canEdit = permissions.includes('code.edit') || profile?.role === 'owner';

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-20 glass-card rounded-3xl border-rose-500/20 bg-rose-500/5">
        <Lock className="w-12 h-12 text-rose-500 mb-4" />
        <h3 className="text-xl font-bold text-text-primary">Zugriff verweigert</h3>
        <p className="text-text-secondary text-sm">Du hast keine Berechtigung, Code-Snippets einzusehen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[#11111a]/60 backdrop-blur-xl p-6 rounded-3xl border border-white/5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Code Bibliothek</h2>
          <p className="text-slate-500 text-sm">Speichere deine wichtigsten Algorithmen und Logik-Snippets.</p>
        </div>
        {canEdit && (
          <button 
            onClick={() => {
              setIsAdding(true);
              setEditingId(null);
            }}
            className="bg-white text-black px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-200 transition-all shadow-xl active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Snippet speichern
          </button>
        )}
      </div>

      <AnimatePresence>
        {(isAdding || editingId) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <form 
              onSubmit={editingId ? handleUpdate : handleCreate} 
              className="bg-[#11111a] p-8 rounded-3xl border border-white/10 shadow-2xl space-y-4 w-full max-w-2xl relative"
            >
              <h3 className="text-xl font-bold text-white mb-4">
                {editingId ? 'Snippet bearbeiten' : 'Neues Snippet'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input 
                  type="text" 
                  placeholder="Snippet Titel"
                  required
                  value={editingId ? editSnippet.title : newSnippet.title}
                  onChange={e => editingId ? setEditSnippet({...editSnippet, title: e.target.value}) : setNewSnippet({...newSnippet, title: e.target.value})}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl outline-hidden focus:ring-2 focus:ring-accent/20" 
                />
                <input 
                  type="text" 
                  placeholder="Sprache (z.B. Python)"
                  value={editingId ? editSnippet.language : newSnippet.language}
                  onChange={e => editingId ? setEditSnippet({...editSnippet, language: e.target.value}) : setNewSnippet({...newSnippet, language: e.target.value})}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl outline-hidden focus:ring-2 focus:ring-accent/20" 
                />
              </div>
              <textarea 
                placeholder="Code hier einfügen..."
                required
                value={editingId ? editSnippet.code : newSnippet.code}
                onChange={e => editingId ? setEditSnippet({...editSnippet, code: e.target.value}) : setNewSnippet({...newSnippet, code: e.target.value})}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl outline-hidden focus:ring-2 focus:ring-accent/20 min-h-[200px] font-mono text-sm"
              />
              <input 
                type="text" 
                placeholder="Tags (kommagetrennt)"
                value={editingId ? editSnippet.tags : newSnippet.tags}
                onChange={e => editingId ? setEditSnippet({...editSnippet, tags: e.target.value}) : setNewSnippet({...newSnippet, tags: e.target.value})}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded-xl outline-hidden focus:ring-2 focus:ring-accent/20" 
              />
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                  }} 
                  className="px-6 py-3 text-slate-500 font-bold hover:text-white transition-colors"
                >
                  Abbrechen
                </button>
                <button type="submit" className="px-8 py-3 bg-accent text-white rounded-xl font-bold hover:opacity-90 transition-colors shadow-lg shadow-accent/20">
                  {editingId ? 'Änderungen speichern' : 'Snippet erstellen'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#11111a] p-8 rounded-3xl border border-white/10 shadow-2xl max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Snippet löschen?</h3>
              <p className="text-slate-500 text-sm mb-8">Dieser Vorgang kann nicht rückgängig gemacht werden.</p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="px-6 py-3 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-colors"
                >
                  Abbrechen
                </button>
                <button 
                  onClick={handleDelete}
                  className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"
                >
                  Löschen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {snippets.map((snippet) => (
          <div key={snippet.id} className="bg-[#11111a]/60 rounded-3xl border border-white/5 overflow-hidden flex flex-col group hover:border-accent/20 transition-all">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg border border-white/5 group-hover:scale-110 transition-transform">
                  <Terminal className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-white group-hover:text-accent transition-colors">{snippet.title}</h3>
                  <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">{snippet.language}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <>
                    <button 
                      onClick={() => startEditing(snippet)}
                      className="p-2 bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
                      title="Bearbeiten"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setDeletingId(snippet.id)}
                      className="p-2 bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
                      title="Löschen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <button 
                  onClick={() => copyToClipboard(snippet.code, snippet.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95 ml-2"
                >
                  {copiedId === snippet.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedId === snippet.id ? 'Kopiert' : 'Kopieren'}
                </button>
              </div>
            </div>
            <div className="p-6 bg-[#050508] text-slate-400 font-mono text-sm overflow-x-auto min-h-[120px] custom-scrollbar selection:bg-accent/30">
              <pre><code className="block">{snippet.code}</code></pre>
            </div>
            <div className="p-4 bg-white/2 border-t border-white/5 flex gap-2 flex-wrap">
              {snippet.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-white/5 rounded-lg text-[10px] font-bold text-slate-500 hover:text-accent transition-colors cursor-default">
                  <Hash className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
