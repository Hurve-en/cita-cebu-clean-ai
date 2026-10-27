import type { Barangay } from "./live-model";

// Alternate spellings supplied with the configured Cebu City list.
const aliases: Record<string, string[]> = {
  Budlaan: ["Budla-an"],
  "Cogon Ramos": ["Cogon-Ramos"],
  Kamputhaw: ["Camputhaw"],
  Parian: ["Pari-an"],
  Bulacao: ["Bulacao Pardo"],
  "Buot-Taop": ["Buot-Taup Pardo"],
  "Kinasang-an": ["Kinasang-an Pardo"],
  "Pung-ol Sibugay": ["Pung-ol-Sibugay"],
  Quiot: ["Quiot Pardo"],
  Sapangdaku: ["Sapangdako"],
  Suba: ["Suba San Nicolas"],
  "Tagba-o": ["Tag-bao"],
  Toong: ["To-ong Pardo"],
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\bbarangay\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function searchBarangays(rows: Barangay[], query: string): Barangay[] {
  const term = normalize(query);
  return rows.filter(row => !term || [row.name, ...(aliases[row.name] ?? [])]
    .some(name => normalize(name).includes(term)))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}
