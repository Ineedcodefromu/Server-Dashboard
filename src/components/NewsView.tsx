import { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, Clock, Plus, Trash2, Filter, RefreshCcw } from 'lucide-react';
import { dashboardService, RSSFeed } from '../services/dashboardService';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../lib/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export function NewsView() {
  const { profile } = useAuth();
  const [feed, setFeed] = useState<RSSFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [feeds, setFeeds] = useState([
    { name: 'Heise Online', url: 'https://www.heise.de/rss/heise-atom.xml' },
    { name: 'Reuters Business', url: 'http://feeds.reuters.com/reuters/businessNews' }
  ]);
  const [activeUrl, setActiveUrl] = useState(feeds[0].url);
  const [isAdding, setIsAdding] = useState(false);
  const [newFeed, setNewFeed] = useState({ name: '', url: '' });

  // Load newsFeeds from profile if they exist
  useEffect(() => {
    if (profile?.newsFeeds && profile.newsFeeds.length > 0) {
      setFeeds(profile.newsFeeds);
      // If activeUrl is not in the new feeds list, switch to the first one
      if (!profile.newsFeeds.find(f => f.url === activeUrl)) {
        setActiveUrl(profile.newsFeeds[0].url);
      }
    }
  }, [profile?.newsFeeds]);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const data = await dashboardService.getRSS(activeUrl);
      setFeed(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [activeUrl]);

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newFeed.name && newFeed.url) {
      const updatedFeeds = [...feeds, { ...newFeed }];
      setFeeds(updatedFeeds);
      setIsAdding(false);
      setNewFeed({ name: '', url: '' });
      setActiveUrl(newFeed.url);

      if (profile?.uid) {
        try {
          const userRef = doc(db, 'users', profile.uid);
          await updateDoc(userRef, { newsFeeds: updatedFeeds });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
        }
      }
    }
  };

  const removeFeed = async (url: string) => {
    if (feeds.length <= 1) return;
    const updatedFeeds = feeds.filter(f => f.url !== url);
    setFeeds(updatedFeeds);
    if (activeUrl === url) {
      setActiveUrl(updatedFeeds[0].url);
    }

    if (profile?.uid) {
      try {
        const userRef = doc(db, 'users', profile.uid);
        await updateDoc(userRef, { newsFeeds: updatedFeeds });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Nachrichten</h2>
          <p className="text-slate-500">Aktuelle Feeds aus aller Welt.</p>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          <button 
            onClick={fetchFeed}
            disabled={loading}
            className={`p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all ${loading ? 'animate-spin opacity-50' : ''}`}
            title="Aktualisieren"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>

          <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100 overflow-x-auto max-w-full items-center">
            {feeds.map(f => (
              <div key={f.url} className="relative group">
                <button
                  onClick={() => setActiveUrl(f.url)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                    activeUrl === f.url 
                      ? 'bg-white text-blue-600 shadow-sm shadow-blue-500/10' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {f.name}
                </button>
                {feeds.length > 1 && (
                  <button 
                    onClick={() => removeFeed(f.url)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-2 h-2" />
                  </button>
                )}
              </div>
            ))}
            <button 
              onClick={() => setIsAdding(true)}
              className="px-3 py-2 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl"
          >
            <form onSubmit={handleAddFeed} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Name des Magazins</label>
                <input 
                  type="text" 
                  placeholder="z.B. Spiegel Online"
                  required
                  value={newFeed.name}
                  onChange={e => setNewFeed({...newFeed, name: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">RSS URL</label>
                <input 
                  type="url" 
                  placeholder="https://..."
                  required
                  value={newFeed.url}
                  onChange={e => setNewFeed({...newFeed, url: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsAdding(false)}
                  className="px-6 py-2 text-slate-500 font-bold hover:text-slate-900 transition-colors"
                >
                  Abbrechen
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg"
                >
                  Hinzufügen
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 animate-pulse space-y-4">
                <div className="h-4 bg-slate-100 rounded-full w-3/4"></div>
                <div className="h-24 bg-slate-50 rounded-2xl"></div>
                <div className="h-4 bg-slate-100 rounded-full w-1/4"></div>
              </div>
            ))
          ) : (
            feed?.items.map((item, idx) => (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={item.link || idx}
                className="bg-white flex flex-col rounded-3xl border border-slate-200 hover:border-blue-500/30 transition-all hover:shadow-xl hover:shadow-blue-500/5 group"
              >
                <div className="p-6 flex-1">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-3">
                    <Clock className="w-3 h-3" />
                    {item.pubDate ? formatDistanceToNow(new Date(item.pubDate), { addSuffix: true, locale: de }) : 'Gerade eben'}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 leading-snug mb-3 group-hover:text-blue-600 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed">
                    {item.contentSnippet || 'Keine Beschreibung verfügbar.'}
                  </p>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 mt-auto flex justify-between items-center rounded-b-3xl">
                  <span className="text-xs font-bold text-slate-400">{feed.title}</span>
                  <a 
                    href={item.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
