import { getDb } from "@/lib/db";

// Identifiers are a closed allowlist; query text is only compared in JavaScript.
const columns = {
  band: ["slug", "name_ko", "name_jp", "name_en"],
  work: ["slug", "name_ko", "name_jp", "name_en"],
  series: ["slug", "name_ko", "name_jp", "name_en"],
  tour: ["slug", "name_ko", "name_jp", "name_en"],
  live: ["title_ko", "title_jp", "title_en", "venue_name"],
  vendor: ["slug", "name"],
  api_key: ["name", "key_prefix"],
} as const;

/** D1 LIKE only folds ASCII. Match Unicode in JS before SQL pagination/count. */
export async function searchIds(
  table: keyof typeof columns,
  query: string,
): Promise<number[]> {
  const fields = columns[table];
  const { results } = await getDb()
    .prepare(`SELECT id, ${fields.join(", ")} FROM "${table}"`)
    .all<Record<string, string | number | null>>();
  // Match fixed-width segments in order to preserve LIKE wildcards without
  // introducing unbounded regular-expression backtracking from repeated %.
  const segments = query.normalize("NFC").toLowerCase().split("%").map((part) =>
    new RegExp([...part].map((char) =>
      char === "_" ? "." : char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ).join(""), "su"),
  );
  return results
    .filter((row) => fields.some((field) => {
      const value = row[field];
      if (typeof value !== "string") return false;
      const text = value.normalize("NFC").toLowerCase();
      let offset = 0;
      return segments.every((segment) => {
        const match = segment.exec(text.slice(offset));
        if (!match) return false;
        offset += match.index + match[0].length;
        return true;
      });
    }))
    .map((row) => Number(row.id));
}
