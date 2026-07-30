import { WARFRAME_ITEMS, WarframeItem } from '../data/warframeItems';

// Local cache for API query results to optimize performance and prevent redundant network calls
const cache: Record<string, WarframeItem[]> = {};

/**
 * Searches for craftable Warframe items from either the local curated dataset or a public Warframe API.
 * Merges and filters the results to ensure retrieve of craftable items with correct build times.
 *
 * @param query The search query string
 * @returns A promise resolving to an array of WarframeItem
 */
export async function searchWarframeItems(query: string): Promise<WarframeItem[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  // Check in-memory cache first
  if (cache[trimmed]) {
    return cache[trimmed];
  }

  // 1. Filter local curated items (instant, offline-first)
  const localResults = WARFRAME_ITEMS.filter(item =>
    item.name.toLowerCase().includes(trimmed)
  );

  // 2. Fetch from public API as an additional/real data source to discover non-curated items
  let apiResults: WarframeItem[] = [];
  try {
    const response = await fetch(`https://api.warframestat.us/items/search/${encodeURIComponent(trimmed)}`);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        apiResults = data
          .filter((item: any) => {
            // Only capture items that have valid build times or are components/weapons/warframes
            const hasBuildTime = item.buildTime !== undefined && item.buildTime > 0;
            const isCraftableType = ['Warframe', 'Primary', 'Secondary', 'Melee', 'Archwing', 'Sentinel', 'Gear'].includes(item.type);
            return hasBuildTime || (isCraftableType && item.components);
          })
          .map((item: any) => ({
            name: item.name,
            type: item.type || "Other",
            buildTime: item.buildTime || 43200, // Fallback to 12 hours if unspecified
            isCraftable: true,
            components: item.components ? item.components.map((c: any) => c.name) : undefined
          }));
      }
    }
  } catch (error) {
    console.warn("WarframeStat API rate-limited or unavailable. Using robust local dataset fallback.", error);
  }

  // Bind them together, avoiding duplicates by choosing local version or API version
  const seen = new Set<string>();
  const combined: WarframeItem[] = [];

  // Local wins for accuracy of selected types and times
  for (const item of localResults) {
    const key = item.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(item);
    }
  }

  // Append API version
  for (const item of apiResults) {
    const key = item.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(item);
    }
  }

  // Limit to top 8 suggestions for a clean autocomplete UI
  const limitedResults = combined.slice(0, 8);
  cache[trimmed] = limitedResults;
  return limitedResults;
}

/**
 * Validates whether a specific item is a valid, craftable Warframe item.
 *
 * @param itemName The exactly matches item name to check
 * @returns The WarframeItem or null if not valid
 */
export async function validateWarframeItem(itemName: string): Promise<WarframeItem | null> {
  const match = WARFRAME_ITEMS.find(item => item.name.toLowerCase() === itemName.toLowerCase());
  if (match) return match;

  // Check API if not in local list
  try {
    const results = await searchWarframeItems(itemName);
    const apiMatch = results.find(item => item.name.toLowerCase() === itemName.toLowerCase());
    return apiMatch || null;
  } catch {
    return null;
  }
}
