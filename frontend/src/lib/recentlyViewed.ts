// Recently-viewed products, kept client-side in localStorage (no backend).

const KEY = "mhc:recently-viewed";
const MAX = 8;

export interface RecentItem {
  id: string;
  name: string;
  image_url: string | null;
  base_price: string | number;
  provider: string;
}

export function getRecentlyViewed(): RecentItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch {
    return [];
  }
}

export function pushRecentlyViewed(item: RecentItem): void {
  try {
    const list = getRecentlyViewed().filter((r) => r.id !== item.id);
    list.unshift(item);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // ignore quota/serialization errors — recently-viewed is best-effort
  }
}
