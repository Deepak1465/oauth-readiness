import type { Guide } from "@/lib/entities/guide";

// Inline citation markers. Each links to the source entry at the bottom of the guide.
export function Cite({ ids, guide }: { ids: string[]; guide: Guide }) {
  const known = ids.filter((id) => guide.sources.some((s) => s.id === id));
  if (!known.length) return <span className="faint" style={{ fontSize: 13 }}> (no source)</span>;
  return (
    <span style={{ fontSize: 13, whiteSpace: "nowrap" }}>
      {known.map((id) => {
        const n = guide.sources.findIndex((s) => s.id === id) + 1;
        return (
          <a key={id} href={`#src-${id}`} style={{ marginLeft: 4, textDecoration: "none" }} aria-label={`Source ${n}`}>
            [{n}]
          </a>
        );
      })}
    </span>
  );
}
