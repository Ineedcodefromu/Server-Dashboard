import axios from 'axios';

export interface StockData {
  symbol: string;
  name: string;
  price: string;
  change: string;
  priceEUR: string;
  changeEUR: string;
  changePercent: string;
  currency: string;
  updatedAt: string;
}

export interface StocksResponse {
  stocks: StockData[];
  eurUsdRate: number;
}

export interface RSSFeed {
  title: string;
  description: string;
  items: Array<{
    title: string;
    link: string;
    contentSnippet: string;
    pubDate: string;
  }>;
}

export const dashboardService = {
  getStocks: async (symbols: string[]): Promise<StocksResponse> => {
    const response = await axios.get(`/api/stocks?symbols=${symbols.join(',')}`);
    return response.data;
  },
  
  getRSS: async (url: string): Promise<RSSFeed> => {
    const response = await axios.get(`/api/rss?url=${encodeURIComponent(url)}`);
    return response.data;
  }
};
