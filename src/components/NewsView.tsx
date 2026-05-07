import { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, Clock, Plus, Trash2, Filter, RefreshCcw, Search, Loader2 } from 'lucide-react';
import { dashboardService, RSSFeed } from '../services/dashboardService';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../lib/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { GoogleGenAI } from "@google/genai";

export function NewsView() {
  const { profile } = useAuth();
  const [feed, setFeed] = useState<RSSFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [feeds, setFeeds] = useState([
    { name: 'Heise Online', url: 'https://www.heise.de/rss/heise-atom.xml' },
    { name: 'Spiegel Online', url: 'https://www.spiegel.de/schlagzeilen/index.rss' },
    { name: 'Tagesschau', url: 'https://www.tagesschau.de/infoservices/alle-meldungen-100~rss2.xml' }
  ]);
  const DEFAULT_FEEDS = [
    { name: 'Tagesschau', url: 'https://www.tagesschau.de/infoservices/alle-meldungen-100~rss2.xml' },
    { name: 'Heise Online', url: 'https://www.heise.de/rss/heise-atom.xml' },
    { name: 'Spiegel Online', url: 'https://www.spiegel.de/schlagzeilen/index.rss' }
  ];
  const [activeUrl, setActiveUrl] = useState(DEFAULT_FEEDS[0].url);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{name: string, url: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Initialize Gemini
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Load newsFeeds from profile if they exist
  useEffect(() => {
    if (profile?.newsFeeds && profile.newsFeeds.length > 0) {
      // Migration: Replace broken Reuters feed if it exists in the list
      const migratedFeeds = profile.newsFeeds.map(f => {
        if (f.url.includes('feeds.reuters.com')) {
          return { name: 'Tagesschau', url: 'https://www.tagesschau.de/infoservices/alle-meldungen-100~rss2.xml' };
        }
        return f;
      });

      setFeeds(migratedFeeds);
      
      // If activeUrl is not in the new feeds list, switch to the first one
      if (!migratedFeeds.find(f => f.url === activeUrl)) {
        setActiveUrl(migratedFeeds[0].url);
      }
    }
  }, [profile?.newsFeeds]);

  const fetchFeed = async (targetUrl: string = activeUrl) => {
    if (!targetUrl) return;
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getRSS(targetUrl);
      setFeed(data);
    } catch (err: any) {
      console.error(err);
      let detail = err.response?.data?.details || err.message;
      let errorTitle = 'Fehler beim Laden';

      if (detail.includes('ENOTFOUND')) {
        detail = 'Der News-Server konnte nicht gefunden werden. Die URL ist wahrscheinlich veraltet oder falsch geschrieben.';
      } else if (err.response?.status === 404 || detail.includes('404')) {
        detail = 'Dieser News-Feed existiert nicht mehr unter dieser Adresse (404). Du solltest ihn entfernen.';
        errorTitle = 'Feed nicht gefunden';
      } else if (detail.includes('Feed not recognized') || detail.includes('Attribute without value')) {
        detail = 'Diese URL ist kein gültiger News-Feed (RSS/Atom). Wahrscheinlich hast du die normale Webseite statt des Feeds eingegeben.';
        errorTitle = 'Kein News-Feed';
      }
      
      setError(`${errorTitle}: ${detail}`);
      setFeed(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed(activeUrl);
  }, [activeUrl]);

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

  const resetToDefaults = async () => {
    setFeeds(DEFAULT_FEEDS);
    setActiveUrl(DEFAULT_FEEDS[0].url);
    
    if (profile?.uid) {
      try {
        const userRef = doc(db, 'users', profile.uid);
        await updateDoc(userRef, { newsFeeds: DEFAULT_FEEDS });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
      }
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const result = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Finde die offiziellen RSS-Feed-URLs für: "${searchQuery}". 
        Antworte NUR mit einem validen JSON-Array von Objekten im Format [{"name": "Seitenname", "url": "https://..."}]. 
        Gib maximal 5 relevante Ergebnisse zurück. Nur echte RSS Feeds.`
      });
      const text = result.text;
      const jsonMatch = text.match(/\[\s*\{.*\}\s*\]/s);
      const results = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      setSearchResults(results);
    } catch (err) {
      console.error("Search error:", err);
      setError("Fehler bei der Suche nach Feeds.");
    } finally {
      setIsSearching(false);
    }
  };

  const addFeedFromSearch = async (name: string, url: string) => {
    if (feeds.find(f => f.url === url)) return;
    
    const updatedFeeds = [...feeds, { name, url }];
    setFeeds(updatedFeeds);
    setActiveUrl(url);
    setIsAdding(false);
    setSearchQuery('');
    setSearchResults([]);

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
            onClick={() => fetchFeed()}
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
              title="Feed hinzufügen"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button 
              onClick={resetToDefaults}
              className="px-3 py-2 text-slate-400 hover:text-red-500 transition-colors border-l border-slate-200"
              title="Standard wiederherstellen"
            >
              <RefreshCcw className="w-4 h-4" />
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
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Neues Magazin hinzufügen</h3>
              <button onClick={() => { setIsAdding(false); setSearchResults([]); }} className="text-slate-400 hover:text-slate-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSearch} className="relative">
              <input 
                type="text" 
                placeholder="Name des Magazins suchen (z.B. Wired, BBC, Zeit...)"
                required
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl outline-hidden focus:ring-2 focus:ring-blue-500/20"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <button 
                type="submit"
                disabled={isSearching}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Suchen'}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchResults.map((result, i) => (
                  <button
                    key={i}
                    onClick={() => addFeedFromSearch(result.name, result.url)}
                    className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-left"
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{result.name}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{result.url}</p>
                    </div>
                    <Plus className="w-4 h-4 text-blue-500" />
                  </button>
                ))}
              </div>
            )}

            {searchResults.length === 0 && !isSearching && searchQuery && (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500">Gib einen Namen ein und klicke auf Suchen, um Feeds zu finden.</p>
              </div>
            )}
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
          ) : error ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full py-12 text-center space-y-4"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <Filter className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-slate-500 font-medium">{error}</p>
              <div className="flex justify-center gap-3">
                <button 
                  onClick={() => fetchFeed(activeUrl)}
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                >
                  Erneut versuchen
                </button>
                <button 
                  onClick={resetToDefaults}
                  className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                >
                  Standard wiederherstellen
                </button>
              </div>
            </motion.div>
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
