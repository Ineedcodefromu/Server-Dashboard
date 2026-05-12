import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, Users, MessageSquare, Circle, 
  Trash2, Shield, User, Bot, Sparkles,
  Hash, Image as ImageIcon, Smile, X
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, addDoc, 
  deleteDoc, doc, serverTimestamp, 
  orderBy, limit, Timestamp 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

interface GlobalMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: any;
}

interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  content: string;
  participants: string[];
  createdAt: any;
}

interface Member {
  uid: string;
  displayName: string | null;
  role: string;
  lastActive: any;
}

export function PresenceChatView() {
  const { profile, permissions, effectiveRole } = useAuth();
  const [messages, setMessages] = useState<(GlobalMessage | DirectMessage)[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedContact, setSelectedContact] = useState<Member | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isPowerful = effectiveRole === 'owner' || effectiveRole === 'admin';
  const hasGlobalChat = true; // Allowed for everyone signed in
  const hasDirectChat = true; // Allowed for everyone signed in

  // Initialize selected contact if global chat is disabled but direct is enabled
  useEffect(() => {
    if (!hasGlobalChat && hasDirectChat && !selectedContact && members.length > 0) {
      const firstAvailable = members.find(m => m.uid !== auth.currentUser?.uid);
      if (firstAvailable) setSelectedContact(firstAvailable);
    }
  }, [hasGlobalChat, hasDirectChat, members]);

  // Fetch messages
  useEffect(() => {
    if (!auth.currentUser) return;
    
    let q;
    const collectionName = !selectedContact ? 'global_messages' : 'direct_messages';
    
    if (!selectedContact) {
      q = query(
        collection(db, 'global_messages'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    } else {
      q = query(
        collection(db, 'direct_messages'),
        where('participants', 'array-contains', auth.currentUser?.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let msgData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (GlobalMessage | DirectMessage)[];
      
      if (selectedContact) {
        // Client-side filter for the specific DM conversation
        msgData = (msgData as DirectMessage[]).filter(m => 
          m.participants.includes(selectedContact.uid)
        );
      }
      
      setMessages(msgData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeA - timeB;
      }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, collectionName);
    });
    return () => unsubscribe();
  }, [selectedContact]);

  // Fetch members
  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({ 
        uid: doc.id, 
        ...doc.data() 
      })) as Member[];
      setMembers(membersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !auth.currentUser || isSending) return;

    setIsSending(true);
    try {
      if (!selectedContact) {
        await addDoc(collection(db, 'global_messages'), {
          userId: auth.currentUser.uid,
          userName: profile?.displayName || 'Anonym',
          content: inputValue.trim(),
          createdAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'direct_messages'), {
          senderId: auth.currentUser.uid,
          recipientId: selectedContact.uid,
          senderName: profile?.displayName || 'Anonym',
          content: inputValue.trim(),
          participants: [auth.currentUser.uid, selectedContact.uid],
          createdAt: serverTimestamp(),
        });
      }
      setInputValue('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const deleteMessage = async (id: string) => {
    const collectionName = selectedContact ? 'direct_messages' : 'global_messages';
    if (profile?.role === 'admin' || profile?.role === 'owner') {
      await deleteDoc(doc(db, collectionName, id));
    }
  };

  const isOnline = (lastActive: any) => {
    if (!lastActive) return false;
    const last = lastActive instanceof Timestamp ? lastActive.toDate() : new Date(lastActive);
    const diff = Date.now() - last.getTime();
    return diff < 120000; // 2 minutes
  };

  const onlineMembers = members.filter(m => isOnline(m.lastActive) && m.uid !== auth.currentUser?.uid);
  const offlineMembers = members.filter(m => !isOnline(m.lastActive) && m.uid !== auth.currentUser?.uid);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-14rem)] md:h-[calc(100vh-12rem)] gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Sidebar - Members */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} lg:flex fixed lg:relative inset-0 lg:inset-auto z-50 lg:z-0 bg-[#050508] lg:bg-transparent p-4 lg:p-0 w-full lg:w-1/4 flex-col gap-6`}>
        <div className="glass-card rounded-3xl p-6 border-border-subtle hover:border-accent/20 transition-all flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-accent" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Chats</h3>
            </div>
            <button onClick={() => setShowSidebar(false)} className="lg:hidden p-2 -mr-2 text-slate-500">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
            {/* Global Chat Button */}
            {hasGlobalChat && (
              <button 
                onClick={() => { setSelectedContact(null); setShowSidebar(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                  !selectedContact ? 'bg-accent/10 border border-accent/20' : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="w-10 h-10 rounded-2xl bg-accent/20 flex items-center justify-center text-accent">
                  <Hash className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-text-primary">Team Chat</p>
                  <p className="text-[8px] font-black uppercase tracking-widest text-text-secondary">Global</p>
                </div>
              </button>
            )}

            {hasDirectChat && (
              <div className="space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary/50">Mitglieder</p>
                {[...onlineMembers, ...offlineMembers].map(member => (
                  <button 
                    key={member.uid}
                    onClick={() => { setSelectedContact(member); setShowSidebar(false); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                      selectedContact?.uid === member.uid ? 'bg-accent/10 border border-accent/20' : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-2xl bg-input-bg border border-border-subtle flex items-center justify-center">
                        <User className="w-5 h-5 text-text-secondary" />
                      </div>
                      {isOnline(member.lastActive) && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                      )}
                    </div>
                    <div className="text-left flex-1 overflow-hidden">
                      <p className="text-sm font-bold text-text-primary truncate">{member.displayName || 'Unbekannt'}</p>
                      <p className="text-[8px] font-black uppercase tracking-widest text-text-secondary">{member.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 glass-card rounded-3xl flex flex-col overflow-hidden border-border-subtle hover:border-accent/20 transition-all">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowSidebar(true)}
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-white"
            >
              <Users className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-2xl bg-accent/5 hidden sm:flex items-center justify-center border border-accent/10">
              {selectedContact ? <User className="w-5 h-5 text-accent" /> : <Hash className="w-5 h-5 text-accent" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest truncate max-w-[150px] sm:max-w-none">
                {selectedContact ? selectedContact.displayName : 'Team Chat'}
              </h3>
              <p className="text-[9px] text-text-secondary font-medium tracking-tight">
                {selectedContact ? `${selectedContact.role} • ${isOnline(selectedContact.lastActive) ? 'Online' : 'Offline'}` : 'Kollaboration & Austausch'}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
        >
          {messages.map((msg, idx) => {
            const senderId = 'userId' in msg ? msg.userId : msg.senderId;
            const senderName = 'userName' in msg ? msg.userName : msg.senderName;
            const isMe = senderId === auth.currentUser?.uid;
            const showName = idx === 0 || ('userId' in messages[idx-1] ? (messages[idx-1] as GlobalMessage).userId : (messages[idx-1] as DirectMessage).senderId) !== senderId;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {showName && !isMe && !selectedContact && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1 ml-12">
                    {senderName}
                  </span>
                )}
                <div className={`flex gap-3 max-w-[70%] group ${isMe ? 'flex-row-reverse' : ''}`}>
                  {!isMe && !selectedContact && (
                    <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 shrink-0 flex items-center justify-center text-accent text-xs font-bold">
                       {senderName?.[0] || '?'}
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
                  placeholder={selectedContact ? `Nachricht an ${selectedContact.displayName}...` : "Nachricht an das Team..."}
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

