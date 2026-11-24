// The retailers an item can be bought from, in the order they appear in the picker and list.
// Ids are stored in Firestore (and validated in firestore.rules), so never rename an id;
// labels can change freely.
export const SHOPS = [
  { id: 'lidl', label: 'Lidl' },
  { id: 'ms', label: 'M&S' },
  { id: 'aldi', label: 'Aldi' },
  { id: 'sainsburys', label: "Sainsbury's" },
  { id: 'tesco', label: 'Tesco' },
  { id: 'morrisons', label: 'Morrisons' },
  { id: 'waitrose', label: 'Waitrose' },
  { id: 'home-bargains', label: 'Home Bargains' },
  { id: 'bm', label: 'B&M' },
] as const;

export type ShopId = (typeof SHOPS)[number]['id'];

/** Group key for items added before shops existed. */
export const OTHER_SHOP = 'other';

export function shopLabel(id: string | null | undefined): string {
  return SHOPS.find((s) => s.id === id)?.label ?? 'Other';
}
