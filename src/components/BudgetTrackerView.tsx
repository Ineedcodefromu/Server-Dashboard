import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, Plus, TrendingUp, TrendingDown, 
  DollarSign, PieChart, ArrowUpRight, ArrowDownRight,
  Trash2, Filter, Calendar, Target,
  MoreVertical, ChevronRight, Layers, CreditCard
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, addDoc, 
  deleteDoc, doc, serverTimestamp, 
  orderBy, updateDoc, writeBatch 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, Cell, PieChart as RePieChart, Pie 
} from 'recharts';

interface Budget {
  id: string;
  userId: string;
  name: string;
  amount: number;
  spent: number;
  currency: string;
  createdAt: any;
}

interface Expense {
  id: string;
  userId: string;
  budgetId: string;
  title: string;
  amount: number;
  date: any;
  category: string;
}

const CATEGORIES = ['Software', 'Hardware', 'Marketing', 'Personal', 'Sonstiges'];

export function BudgetTrackerView() {
  const { profile } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isAddingBudget, setIsAddingBudget] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  
  // Forms
  const [budgetName, setBudgetName] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseBudget, setExpenseBudget] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Software');

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubBudgets = onSnapshot(query(collection(db, 'budgets'), where('userId', '==', auth.currentUser.uid)), (snap) => {
      setBudgets(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Budget[]);
    });

    const unsubExpenses = onSnapshot(query(collection(db, 'expenses'), where('userId', '==', auth.currentUser.uid), orderBy('date', 'desc')), (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Expense[]);
    });

    return () => {
      unsubBudgets();
      unsubExpenses();
    };
  }, []);

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetName || !budgetAmount || !auth.currentUser) return;
    await addDoc(collection(db, 'budgets'), {
      userId: auth.currentUser.uid,
      name: budgetName,
      amount: parseFloat(budgetAmount),
      spent: 0,
      currency: 'EUR',
      createdAt: serverTimestamp(),
    });
    setBudgetName('');
    setBudgetAmount('');
    setIsAddingBudget(false);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle || !expenseAmount || !expenseBudget || !auth.currentUser) return;
    
    const amountNum = parseFloat(expenseAmount);
    const budget = budgets.find(b => b.id === expenseBudget);
    if (!budget) return;

    const batch = writeBatch(db);
    
    // Add Expense
    const expenseRef = doc(collection(db, 'expenses'));
    batch.set(expenseRef, {
      userId: auth.currentUser.uid,
      budgetId: expenseBudget,
      title: expenseTitle,
      amount: amountNum,
      category: expenseCategory,
      date: serverTimestamp(),
    });

    // Update Budget spent amount
    batch.update(doc(db, 'budgets', expenseBudget), {
      spent: (budget.spent || 0) + amountNum
    });

    await batch.commit();
    setExpenseTitle('');
    setExpenseAmount('');
    setIsAddingExpense(false);
  };

  const deleteExpense = async (expense: Expense) => {
    const budget = budgets.find(b => b.id === expense.budgetId);
    const batch = writeBatch(db);
    
    batch.delete(doc(db, 'expenses', expense.id));
    if (budget) {
      batch.update(doc(db, 'budgets', expense.budgetId), {
        spent: Math.max(0, (budget.spent || 0) - expense.amount)
      });
    }
    await batch.commit();
  };

  const totalBudget = budgets.reduce((acc, curr) => acc + curr.amount, 0);
  const totalSpent = budgets.reduce((acc, curr) => acc + curr.spent, 0);
  const remaining = totalBudget - totalSpent;

  const chartData = budgets.map(b => ({
    name: b.name,
    ausgegeben: b.spent,
    budget: b.amount,
    prozent: (b.spent / b.amount) * 100
  }));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight">Finanz-Tracker</h2>
          <p className="text-text-secondary text-sm">Übersicht deiner Projektausgaben und Budgets.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsAddingBudget(true)}
            className="px-6 py-4 glass-card border-border-subtle bg-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-accent hover:border-accent/30 transition-all flex items-center gap-2"
          >
            <Layers className="w-4 h-4" /> Budget anlegen
          </button>
          <button 
            onClick={() => setIsAddingExpense(true)}
            className="px-6 py-4 bg-accent text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-accent/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Ausgabe erfassen
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-8 rounded-[2.5rem] border-accent/20 bg-accent/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 text-accent/5 transition-transform group-hover:scale-110 duration-700">
            <Target className="w-24 h-24 stroke-[1]" />
          </div>
          <div className="relative z-10 space-y-4">
             <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent">
               <Layers className="w-6 h-6" />
             </div>
             <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-accent/60 mb-1">Gesamtbudget</p>
               <h4 className="text-4xl font-black text-text-primary tracking-tighter">€{totalBudget.toLocaleString()}</h4>
             </div>
          </div>
        </div>

        <div className="glass-card p-8 rounded-[2.5rem] border-border-subtle hover:border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 text-emerald-500/5 transition-transform group-hover:scale-110 duration-700">
            <TrendingUp className="w-24 h-24 stroke-[1]" />
          </div>
          <div className="relative z-10 space-y-4">
             <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
               <DollarSign className="w-6 h-6" />
             </div>
             <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60 mb-1">Ausgegeben</p>
               <h4 className="text-4xl font-black text-text-primary tracking-tighter">€{totalSpent.toLocaleString()}</h4>
             </div>
          </div>
        </div>

        <div className="glass-card p-8 rounded-[2.5rem] border-border-subtle hover:border-amber-500/20 bg-amber-500/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 text-amber-500/5 transition-transform group-hover:scale-110 duration-700">
            <CreditCard className="w-24 h-24 stroke-[1]" />
          </div>
          <div className="relative z-10 space-y-4">
             <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500">
               <Wallet className="w-6 h-6" />
             </div>
             <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/60 mb-1">Verfügbar</p>
               <h4 className="text-4xl font-black text-text-primary tracking-tighter">€{remaining.toLocaleString()}</h4>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Budgets List & Chart */}
        <div className="glass-card rounded-[2.5rem] p-8 border-border-subtle flex flex-col gap-8">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-3">
               <PieChart className="w-5 h-5 text-accent" />
               <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">Budget Auslastung</h3>
             </div>
           </div>

           <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="#8E9299" fontSize={10} width={80} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#151619', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  />
                  <Bar dataKey="ausgegeben" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.prozent > 90 ? '#ef4444' : entry.prozent > 70 ? '#f59e0b' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
           </div>

           <div className="space-y-4">
             {budgets.map(budget => (
               <div key={budget.id} className="p-4 bg-input-bg border border-border-subtle rounded-2xl group hover:border-accent/30 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-text-primary">{budget.name}</span>
                    <span className="text-[10px] font-bold text-text-secondary uppercase">
                      €{budget.spent.toLocaleString()} / €{budget.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (budget.spent / budget.amount) * 100)}%` }}
                      className={`h-full ${
                        (budget.spent / budget.amount) > 0.9 ? 'bg-red-500' : (budget.spent / budget.amount) > 0.7 ? 'bg-amber-500' : 'bg-accent'
                      }`}
                    />
                  </div>
               </div>
             ))}
           </div>
        </div>

        {/* Recent Expenses */}
        <div className="glass-card rounded-[2.5rem] p-8 border-border-subtle flex flex-col gap-6">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-3">
               <Calendar className="w-5 h-5 text-accent" />
               <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">Letzte Ausgaben</h3>
             </div>
           </div>

           <div className="flex-1 space-y-2 overflow-y-auto max-h-[600px] custom-scrollbar pr-2">
             {expenses.map(expense => {
               const budget = budgets.find(b => b.id === expense.budgetId);
               return (
                 <div key={expense.id} className="flex items-center gap-4 p-4 border border-border-subtle hover:border-accent/20 rounded-2xl group transition-all">
                   <div className="w-10 h-10 rounded-xl bg-input-bg flex items-center justify-center text-accent shrink-0 font-bold text-xs">
                     {expense.category[0]}
                   </div>
                   <div className="flex-1 min-w-0">
                     <h4 className="text-sm font-bold text-text-primary truncate">{expense.title}</h4>
                     <p className="text-[10px] text-text-secondary uppercase font-black tracking-widest truncate">
                       {budget?.name || 'Kein Budget'} • {expense.category}
                     </p>
                   </div>
                   <div className="text-right">
                     <p className="text-sm font-black text-rose-500">-€{expense.amount.toLocaleString()}</p>
                     <p className="text-[9px] text-text-secondary font-medium uppercase">
                       {expense.date?.toDate ? expense.date.toDate().toLocaleDateString() : 'Gerade jetzt'}
                     </p>
                   </div>
                   <button 
                    onClick={() => deleteExpense(expense)}
                    className="p-2 opacity-0 group-hover:opacity-100 text-text-secondary hover:text-rose-500 transition-all"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                 </div>
               );
             })}
             {expenses.length === 0 && (
               <div className="h-64 flex flex-col items-center justify-center opacity-20 text-center">
                 <DollarSign className="w-12 h-12 mb-2" />
                 <p className="text-[10px] font-black uppercase tracking-widest">Keine Ausgaben erfasst</p>
               </div>
             )}
           </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isAddingBudget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingBudget(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.form
              onSubmit={handleAddBudget}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md glass-card rounded-[2rem] p-8 space-y-6 border-accent/20"
            >
              <h3 className="text-xl font-bold text-text-primary tracking-tight">Neues Budget erstellen</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary ml-1">Name</label>
                  <input 
                    type="text"
                    value={budgetName}
                    onChange={(e) => setBudgetName(e.target.value)}
                    placeholder="z.B. Marketing 2025"
                    className="w-full bg-input-bg border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-accent/40 outline-none"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary ml-1">Limit (€)</label>
                  <input 
                    type="number"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    placeholder="5000"
                    className="w-full bg-input-bg border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-accent/40 outline-none"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAddingBudget(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-border-subtle font-bold text-xs uppercase tracking-widest"
                >
                  Abbrechen
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 px-4 bg-accent text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-accent/20"
                >
                  Erstellen
                </button>
              </div>
            </motion.form>
          </div>
        )}

        {isAddingExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingExpense(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.form
              onSubmit={handleAddExpense}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md glass-card rounded-[2rem] p-8 space-y-6 border-emerald-500/20"
            >
              <h3 className="text-xl font-bold text-text-primary tracking-tight">Ausgabe erfassen</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary ml-1">Beschreibung</label>
                  <input 
                    type="text"
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    placeholder="z.B. Hosting-Kosten"
                    className="w-full bg-input-bg border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-emerald-500/40 outline-none"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary ml-1">Betrag (€)</label>
                    <input 
                      type="number"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      placeholder="120"
                      className="w-full bg-input-bg border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-emerald-500/40 outline-none"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary ml-1">Kategorie</label>
                    <select 
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="w-full bg-input-bg border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-emerald-500/40 outline-none appearance-none"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary ml-1">Budget</label>
                  <select 
                    value={expenseBudget}
                    onChange={(e) => setExpenseBudget(e.target.value)}
                    className="w-full bg-input-bg border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-emerald-500/40 outline-none"
                    required
                  >
                    <option value="">Wähle ein Budget...</option>
                    {budgets.map(b => (
                      <option key={b.id} value={b.id}>{b.name} (Rest: €{(b.amount - b.spent).toLocaleString()})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAddingExpense(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-border-subtle font-bold text-xs uppercase tracking-widest"
                >
                  Abbrechen
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 px-4 bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                >
                  Erfassen
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
