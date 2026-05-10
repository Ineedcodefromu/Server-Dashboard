import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, MoreVertical, Trash2, Calendar, 
  AlertCircle, CheckCircle2, Circle, Clock,
  ChevronRight, GripVertical
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, addDoc, 
  updateDoc, doc, deleteDoc, serverTimestamp, 
  orderBy 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type TaskStatus = 'todo' | 'in-progress' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  userId: string;
  createdAt: any;
  updatedAt: any;
}

const COLUMNS: { id: TaskStatus; label: string; icon: any; color: string }[] = [
  { id: 'todo', label: 'Zu Erledigen', icon: Circle, color: 'text-slate-400' },
  { id: 'in-progress', label: 'In Arbeit', icon: Clock, color: 'text-accent' },
  { id: 'done', label: 'Abgeschlossen', icon: CheckCircle2, color: 'text-emerald-500' },
];

export function KanbanView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAdding, setIsAdding] = useState<TaskStatus | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const path = 'tasks';
    const q = query(
      collection(db, path),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      setTasks(taskData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, []);

  const handleAddTask = async (status: TaskStatus) => {
    if (!newTaskTitle.trim() || !auth.currentUser) return;

    setIsSubmitting(true);
    const path = 'tasks';
    try {
      await addDoc(collection(db, path), {
        title: newTaskTitle.trim(),
        status,
        priority: newTaskPriority,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewTaskTitle('');
      setIsAdding(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveTask = async (taskId: string, newStatus: TaskStatus) => {
    const path = `tasks/${taskId}`;
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const path = `tasks/${taskId}`;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'high': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'low': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-text-primary tracking-tight">Aufgabenplanung</h2>
        <p className="text-text-secondary text-sm">Organisiere deine Workflows mit dem Kanban-System.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {COLUMNS.map(column => (
          <div key={column.id} className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <column.icon className={`w-4 h-4 ${column.color}`} />
                <h3 className="text-xs font-black text-text-secondary uppercase tracking-widest">{column.label}</h3>
                <span className="bg-input-bg text-[10px] font-bold text-text-secondary px-2 py-0.5 rounded-full border border-border-subtle">
                  {tasks.filter(t => t.status === column.id).length}
                </span>
              </div>
              <button 
                onClick={() => setIsAdding(column.id)}
                className="p-1 hover:bg-input-bg rounded-lg text-text-secondary transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 min-h-[400px]">
              <AnimatePresence>
                {isAdding === column.id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card p-4 rounded-2xl border-accent/30 space-y-4"
                  >
                    <input 
                      autoFocus
                      type="text" 
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTask(column.id)}
                      placeholder="Was ist zu tun?"
                      className="w-full bg-input-bg border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-primary focus:border-accent/50 outline-none transition-all"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => setNewTaskPriority(p)}
                            className={`text-[8px] px-2 py-1 rounded-md uppercase font-black tracking-widest border transition-all ${
                              newTaskPriority === p 
                                ? getPriorityColor(p)
                                : 'bg-input-bg text-text-secondary border-border-subtle hover:border-text-secondary'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setIsAdding(null)}
                          className="px-3 py-1.5 text-[10px] font-bold text-text-secondary hover:text-text-primary uppercase tracking-widest"
                        >
                          Abbrechen
                        </button>
                        <button 
                          onClick={() => handleAddTask(column.id)}
                          disabled={isSubmitting || !newTaskTitle.trim()}
                          className="px-3 py-1.5 bg-accent text-white rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-accent/20 disabled:opacity-50"
                        >
                          Hinzufügen
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {tasks
                  .filter(task => task.status === column.id)
                  .map((task) => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="glass-card p-4 rounded-2xl group hover:border-accent/30 transition-all cursor-move"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.2em] border ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1 text-text-secondary hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      
                      <h4 className="text-sm font-bold text-text-primary mb-4 line-clamp-2 leading-relaxed tracking-tight group-hover:text-accent transition-colors">
                        {task.title}
                      </h4>

                      <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
                        <div className="flex items-center gap-1.5 text-[10px] text-text-secondary font-medium">
                          <Clock className="w-3 h-3" />
                          <span>{task.updatedAt?.toDate ? task.updatedAt.toDate().toLocaleDateString() : 'Gerade jetzt'}</span>
                        </div>
                        <div className="flex gap-1">
                          {COLUMNS.filter(c => c.id !== task.status).map(c => (
                            <button
                              key={c.id}
                              onClick={() => handleMoveTask(task.id, c.id)}
                              className="w-6 h-6 flex items-center justify-center rounded-lg bg-input-bg border border-border-subtle text-text-secondary hover:text-accent hover:border-accent/30 transition-all"
                              title={`Verschieben nach ${c.label}`}
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </AnimatePresence>

              {tasks.filter(t => t.status === column.id).length === 0 && !isAdding && (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border-subtle rounded-3xl opacity-20 p-8">
                   <column.icon className="w-8 h-8 mb-2" />
                   <p className="text-[10px] font-black uppercase tracking-widest">Leer</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
