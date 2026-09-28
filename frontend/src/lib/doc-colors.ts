// Har document ko ek stable color + letter (A, B, C...) milta hai, taaki
// sidebar, compare bar aur citation chips mein wahi document hamesha
// same rang/letter se pehchana ja sake.

const COLORS = [
  "#ff7c52",
  "#4dabf7",
  "#51cf66",
  "#cc5de8",
  "#fcc419",
  "#22b8cf",
  "#f06595",
  "#94d82d",
];

export interface DocStyle {
  color: string;
  letter: string;
}

const registry = new Map<string, DocStyle>();

export function getDocStyle(documentId: string): DocStyle {
  let entry = registry.get(documentId);
  if (!entry) {
    const i = registry.size;
    entry = {
      color: COLORS[i % COLORS.length],
      letter: String.fromCharCode(65 + (i % 26)),
    };
    registry.set(documentId, entry);
  }
  return entry;
}

export function registerDocs(documentIds: string[]) {
  documentIds.forEach(getDocStyle);
}
