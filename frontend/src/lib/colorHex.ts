// Maps common blank colour names → a hex swatch. Falls back to a neutral grey.
const MAP: Record<string, string> = {
  black: "#111827",
  white: "#ffffff",
  navy: "#1e3a5f",
  red: "#dc2626",
  grey: "#9ca3af",
  gray: "#9ca3af",
  sand: "#e7d8b6",
  natural: "#e8e0cf",
  stone: "#d6d3c4",
  pink: "#ec4899",
  clear: "#e5f0f6",
  blue: "#2563eb",
  green: "#16a34a",
  yellow: "#eab308",
};

export function colorHex(name: string): string {
  const key = name.trim().toLowerCase();
  if (MAP[key]) return MAP[key];
  // Multi-word names ("Heather Grey", "Dark Navy"): try the known base colour
  // inside the name before falling back, so swatches don't all collapse to the
  // same indistinguishable grey.
  for (const word of key.split(/[\s-]+/)) {
    if (MAP[word]) return MAP[word];
  }
  return "#cbd5e1";
}

/** A near-white swatch needs a visible border. */
export function isLightColor(name: string): boolean {
  const hex = colorHex(name).replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 210;
}
