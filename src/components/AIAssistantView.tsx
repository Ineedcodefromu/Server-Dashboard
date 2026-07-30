import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, Bot, User, Trash2, Plus, 
  MessageSquare, Loader2, Sparkles,
  ChevronRight, History, Settings
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, addDoc, 
  updateDoc, doc, deleteDoc, serverTimestamp, 
  orderBy, limit
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface ChatSession {
  id: string;
  title: string;
  userId: string;
  createdAt: any;
  updatedAt: any;
}

interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  role: 'user' | 'model';
  content: string;
  createdAt: any;
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export function AIAssistantView() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';

  // Toggle sidebar based on screen size on mount
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    setIsSidebarOpen(!isMobile);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch sessions
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'chat_sessions'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatSession[];
      setSessions(sessionData);
      
      // If no session selected, select the first one
      if (sessionData.length > 0 && !currentSessionId) {
        setCurrentSessionId(sessionData[0].id);
      }
    });
    return () => unsubscribe();
  }, [currentSessionId]);

  // Fetch messages for current session
  useEffect(() => {
    if (!currentSessionId || !auth.currentUser) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, 'chat_messages'),
      where('sessionId', '==', currentSessionId),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessage[];
      setMessages(msgData);
    });
    return () => unsubscribe();
  }, [currentSessionId]);

  const handleCreateSession = async () => {
    if (!auth.currentUser) return;
    const newSession = await addDoc(collection(db, 'chat_sessions'), {
      title: 'Neuer Chat',
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setCurrentSessionId(newSession.id);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteDoc(doc(db, 'chat_sessions', id));
    if (currentSessionId === id) setCurrentSessionId(null);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || !auth.currentUser || isLoading) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      const newSession = await addDoc(collection(db, 'chat_sessions'), {
        title: inputValue.trim().substring(0, 30) + (inputValue.length > 30 ? '...' : ''),
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      sessionId = newSession.id;
      setCurrentSessionId(sessionId);
    }

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    try {
      // Save user message
      await addDoc(collection(db, 'chat_messages'), {
        sessionId,
        userId: auth.currentUser.uid,
        role: 'user',
        content: userMessage,
        createdAt: serverTimestamp(),
      });

      // Update session title if it's the first message
      if (messages.length === 0) {
        await updateDoc(doc(db, 'chat_sessions', sessionId), {
          title: userMessage.substring(0, 40) + (userMessage.length > 40 ? '...' : ''),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'chat_sessions', sessionId), {
          updatedAt: serverTimestamp(),
        });
      }

      // Preparation for AI call: history
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));
      history.push({ role: 'user', parts: [{ text: userMessage }] });

      // Call Gemini
      const adminInstruction = `
        Du bist ein intelligenter KI-Assistent mit ADMINISTRATOR-Berechtigungen. 
        Du hast Zugriff auf interne Systeminformationen und darfst dem Nutzer bei der Verwaltung des Dashboards helfen.
        Der Nutzer hat die Rolle: ${profile?.role}.
        Deine Antworten sind präzise, technisch fundiert und professionell.
      `;

      const userInstruction = `
        Du bist ein intelligenter KI-Assistent für BENUTZER. 
        Du hast KEINEN Zugriff auf Server-Interna, globale Logs oder administrative Einstellungen.
        Sollte der Nutzer nach sensiblen Systemdaten fragen, lehne dies höflich ab und verweise auf mangelnde Berechtigungen.
        Deine Aufgabe ist es, bei der allgemeinen Nutzung des Dashboards und bei Projekten zu helfen.
      `;

      const chat = genAI.chats.create({
        model: "gemini-3-flash-preview",
        history: messages.map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        })),
        config: {
          systemInstruction: isAdmin ? adminInstruction : userInstruction
        }
      });

      const result = await chat.sendMessage({
        message: userMessage,
      });

      const responseText = result.text;

      // Save AI response
      await addDoc(collection(db, 'chat_messages'), {
        sessionId,
        userId: auth.currentUser.uid,
        role: 'model',
        content: responseText,
        createdAt: serverTimestamp(),
      });

    } catch (error) {
      console.error('AI Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-14rem)] md:h-[calc(100vh-12rem)] gap-4 md:gap-6 relative">
      {/* Sidebar Overlay for mobile */}
      {isSidebarOpen && window.innerWidth < 1024 && (
        <div 
          className="fixed inset-0 bg-[#050508]/80 backdrop-blur-sm z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Chat History */}
      <div className={`flex flex-col gap-4 transition-all duration-300 fixed lg:relative z-40 lg:z-0 bg-[#0a0a0f] lg:bg-transparent h-full lg:h-auto p-6 lg:p-0 border-r lg:border-none border-white/5 ${isSidebarOpen ? 'w-72 left-0' : 'w-0 -left-72 lg:left-0 lg:w-0 overflow-hidden'}`}>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-accent" />
            <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Verlauf</span>
          </div>
          <button 
            onClick={handleCreateSession}
            className="p-1.5 hover:bg-input-bg rounded-lg text-text-secondary hover:text-accent transition-all border border-transparent hover:border-accent/20"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleSelectSession(session.id)}
              className={`w-full text-left p-3 rounded-xl transition-all group relative flex items-center gap-3 border cursor-pointer ${
                currentSessionId === session.id 
                  ? 'bg-accent/10 border-accent/30 text-text-primary' 
                  : 'bg-transparent border-transparent text-text-secondary hover:bg-input-bg hover:border-border-subtle'
              }`}
            >
              <MessageSquare className={`w-4 h-4 shrink-0 ${currentSessionId === session.id ? 'text-accent' : 'text-slate-500'}`} />
              <span className="text-xs font-bold truncate pr-6">{session.title}</span>
              <button
                type="button"
                onClick={(e) => handleDeleteSession(session.id, e)}
                className="absolute right-3 opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-500 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-center py-8 opacity-30">
              <Sparkles className="w-8 h-8 mx-auto mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest">Keine Chats</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 glass-card rounded-3xl flex flex-col overflow-hidden border-border-subtle hover:border-accent/20 transition-all relative">
        {/* Chat Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-white"
            >
              <History className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-2xl bg-accent/10 sm:flex hidden items-center justify-center border border-accent/20">
              <Bot className="w-5 h-5 text-accent" />
            </div>
            <div className="truncate">
              <h3 className="text-sm font-bold text-text-primary truncate max-w-[120px] sm:max-w-none">KI Assistent</h3>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest hidden sm:inline">Online • Gemini 3</p>
                <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest sm:hidden">Online</p>
                <span className="w-1 h-1 rounded-full bg-slate-500/30 hidden sm:inline" />
                <p className={`text-[10px] font-bold uppercase tracking-widest truncate ${isAdmin ? 'text-accent' : 'text-text-secondary'}`}>
                   {isAdmin ? 'Admin' : 'Basis'}
                </p>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-input-bg rounded-xl text-text-secondary transition-all hidden lg:block"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Messages area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
        >
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-accent/5 flex items-center justify-center border border-accent/10 mb-2">
                <Sparkles className="w-8 h-8 text-accent animate-pulse" />
              </div>
              <h4 className="text-lg font-bold text-text-primary">Wie kann ich dir heute helfen?</h4>
              <p className="text-sm text-text-secondary leading-relaxed">
                Ich kann Code analysieren, Aufgaben planen oder einfach Fragen zu deinem Dashboard beantworten.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                 {['Projektplan erstellen', 'Code optimieren', 'Statusbericht'].map(tag => (
                   <button 
                    key={tag}
                    onClick={() => setInputValue(tag)}
                    className="px-3 py-1.5 rounded-full bg-input-bg border border-border-subtle text-[10px] font-bold text-text-secondary hover:border-accent/30 hover:text-accent transition-all uppercase tracking-widest"
                   >
                     {tag}
                   </button>
                 ))}
              </div>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border ${
                  msg.role === 'user' 
                    ? 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400' 
                    : 'bg-accent/10 border-accent/20 text-accent'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-accent text-white rounded-tr-none'
                    : 'bg-input-bg border border-border-subtle rounded-tl-none text-text-primary'
                }`}>
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-white/10">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  <div className={`text-[8px] mt-2 opacity-50 font-bold uppercase tracking-widest ${msg.role === 'user' ? 'text-right' : ''}`}>
                    {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Senden...'}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4"
            >
              <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-accent" />
              </div>
              <div className="bg-input-bg border border-border-subtle rounded-2xl rounded-tl-none p-4 flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
                <span className="text-xs font-bold text-text-secondary uppercase tracking-widest animate-pulse">KI denkt nach...</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input area */}
        <div className="p-6 bg-white/5 border-t border-border-subtle">
          <form 
            onSubmit={handleSendMessage}
            className="relative flex items-center gap-3"
          >
            <div className="relative flex-1 group">
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Schreibe eine Nachricht..."
                readOnly={isLoading}
                className="w-full bg-input-bg border border-border-subtle rounded-2xl px-5 py-4 text-sm text-text-primary focus:border-accent/50 outline-none transition-all pr-12 group-hover:border-border-subtle/80"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${inputValue.trim() ? 'bg-accent animate-pulse scale-100' : 'bg-slate-500 scale-50 opacity-30'}`} />
              </div>
            </div>
            <button 
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="w-14 h-14 bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:hover:bg-accent rounded-2xl flex items-center justify-center text-white shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
          <p className="text-[9px] text-center mt-3 text-text-secondary font-medium tracking-tight uppercase">
            Gemini kann Fehler machen. Überprüfe wichtige Informationen.
          </p>
        </div>
      </div>
    </div>
  );
}
