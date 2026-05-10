import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, Users, MessageSquare, Circle, 
  Trash2, Shield, User, Bot, Sparkles,
  Hash, Image as ImageIcon, Smile
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, addDoc, 
  deleteDoc, doc, serverTimestamp, 
  orderBy, limit, Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

interface GlobalMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: any;
}

interface Member {
  uid: string;
  displayName: string | null;
  role: string;
  lastActive: any;
}

export function PresenceChatView() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<GlobalMessage[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch messages
  useEffect(() => {
    const q = query(
      collection(db, 'global_messages'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GlobalMessage[];
      setMessages(msgData.reverse());
    });
    return () => unsubscribe();
  }, []);

  // Fetch members
  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({ 
        uid: doc.id, 
        ...doc.data() 
      })) as Member[];
      setMembers(membersData);
    });
    return () => unsubscribe();
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !auth.currentUser || isSending) return;

    setIsSending(true);
    try {
      await addDoc(collection(db, 'global_messages'), {
        userId: auth.currentUser.uid,
        userName: profile?.displayName || 'Anonym',
        content: inputValue.trim(),
        createdAt: serverTimestamp(),
      });
      setInputValue('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const deleteMessage = async (id: string) => {
    if (profile?.role === 'admin' || profile?.role === 'owner') {
      await deleteDoc(doc(db, 'global_messages', id));
    }
  };

  const isOnline = (lastActive: any) => {
    if (!lastActive) return false;
    const last = lastActive instanceof Timestamp ? lastActive.toDate() : new Date(lastActive);
    const diff = Date.now() - last.getTime();
    return diff < 120000; // 2 minutes
  };

  const onlineMembers = members.filter(m => isOnline(m.lastActive));
  const offlineMembers = members.filter(m => !isOnline(m.lastActive));

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Sidebar - Members */}
      <div className="w-1/4 flex flex-col gap-6">
        <div className="glass-card rounded-3xl p-6 border-border-subtle hover:border-accent/20 transition-all flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-accent" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Mitglieder</h3>
            </div>
            <div className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {onlineMembers.length} Online
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary/50">Online</p>
              {onlineMembers.map(member => (
                <div key={member.uid} className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-accent" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold text-text-primary truncate">{member.displayName || 'Unbekannt'}</p>
                    <p className="text-[8px] font-black uppercase tracking-widest text-text-secondary">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary/50">Offline</p>
              {offlineMembers.map(member => (
                <div key={member.uid} className="flex items-center gap-3 opacity-50 grayscale">
                  <div className="w-10 h-10 rounded-2xl bg-input-bg border border-border-subtle flex items-center justify-center">
                    <User className="w-5 h-5 text-text-secondary" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold text-text-primary truncate">{member.displayName || 'Unbekannt'}</p>
                    <p className="text-[8px] font-black uppercase tracking-widest text-text-secondary">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 glass-card rounded-3xl flex flex-col overflow-hidden border-border-subtle hover:border-accent/20 transition-all">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-accent/5 flex items-center justify-center border border-accent/10">
              <Hash className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">Team Chat</h3>
              <p className="text-[9px] text-text-secondary font-medium tracking-tight">Kollaboration & Austausch</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-3">
              {onlineMembers.slice(0, 3).map(m => (
                 <div key={m.uid} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent">
                   {m.displayName?.[0] || 'U'}
                 </div>
              ))}
              {onlineMembers.length > 3 && (
                <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white">
                  +{onlineMembers.length - 3}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
        >
          {messages.map((msg, idx) => {
            const isMe = msg.userId === auth.currentUser?.uid;
            const showName = idx === 0 || messages[idx-1].userId !== msg.userId;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {showName && !isMe && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1 ml-12">
                    {msg.userName}
                  </span>
                )}
                <div className={`flex gap-3 max-w-[70%] group ${isMe ? 'flex-row-reverse' : ''}`}>
                  {!isMe && (
                    <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 shrink-0 flex items-center justify-center text-accent text-xs font-bold">
                       {msg.userName?.[0] || '?'}
                    </div>
                  )}
                  <div className={`relative p-4 rounded-2xl ${
                    isMe 
                      ? 'bg-accent text-white rounded-tr-none' 
                      : 'bg-input-bg border border-border-subtle rounded-tl-none text-text-primary'
                  }`}>
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    
                    {/* Timestamp & Actions */}
                    <div className={`flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'justify-end' : ''}`}>
                       <span className={`text-[8px] font-bold uppercase tracking-widest ${isMe ? 'text-white/60' : 'text-text-secondary'}`}>
                         {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                       </span>
                       {(profile?.role === 'admin' || profile?.role === 'owner') && (
                         <button 
                           onClick={() => deleteMessage(msg.id)}
                           className="p-1 hover:text-red-500 transition-colors"
                         >
                           <Trash2 className="w-3 h-3" />
                         </button>
                       )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Input */}
        <div className="p-6 bg-white/5 border-t border-border-subtle">
           <form onSubmit={handleSendMessage} className="flex gap-4">
              <div className="flex-1 relative group">
                <input 
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Nachricht an das Team..."
                  className="w-full h-14 bg-input-bg border border-border-subtle rounded-2xl px-5 text-sm outline-none focus:border-accent/40 group-hover:border-border-subtle/80 transition-all pr-24"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-text-secondary">
                  <button type="button" className="p-1.5 hover:text-accent transition-all"><ImageIcon className="w-4 h-4" /></button>
                  <button type="button" className="p-1.5 hover:text-accent transition-all"><Smile className="w-4 h-4" /></button>
                </div>
              </div>
              <button 
                type="submit"
                disabled={!inputValue.trim() || isSending}
                className="w-14 h-14 bg-accent text-white rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-accent/20"
              >
                <Send className="w-5 h-5" />
              </button>
           </form>
        </div>
      </div>
    </div>
  );
}
