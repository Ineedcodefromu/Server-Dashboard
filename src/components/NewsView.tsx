import { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, Clock, Plus, Trash2, Filter } from 'lucide-react';
import { dashboardService, RSSFeed } from '../services/dashboardService';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

export function NewsView() {
  const [feed, setFeed] = useState<RSSFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [feeds, setFeeds] = useState([
    { name: 'Heise Online', url: 'https://www.heise.de/rss/heise-atom.xml' },
    { name: 'Reuters Business', url: 'http://feeds.reuters.com/reuters/businessNews' }
  ]);
  const [activeUrl, setActiveUrl] = useState(feeds[0].url);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Nachrichten</h2>
          <p className="text-slate-500">Aktuelle Feeds aus aller Welt.</p>
        </div>
        <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100 overflow-x-auto max-w-full">
          {feeds.map(f => (
            <button
              key={f.url}
              onClick={() => setActiveUrl(f.url)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                activeUrl === f.url 
                  ? 'bg-white text-blue-600 shadow-sm shadow-blue-500/10' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {f.name}
            </button>
          ))}
          <button className="px-3 py-2 text-slate-400 hover:text-slate-900 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

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
