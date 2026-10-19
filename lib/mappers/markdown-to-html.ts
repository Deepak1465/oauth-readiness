// The reader service returns Markdown; we turn it back into minimal HTML so excerpting, link-following
// and the quote check work the same as for directly fetched pages.
export function markdownToHtml(md: string): string {
  const body = md.split(/\n?Markdown Content:\n/)[1] ?? md;
  // Pull links out first so stripping Markdown punctuation can't mangle URLs or the generated tags.
  const links: string[] = [];
  const text = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_, t: string, u: string) => `\u0000${links.push(`<a href="${u}">${t.replace(/[*_`]/g, "")}</a>`) - 1}\u0000`)
    .replace(/^\s*>\s?/gm, "")
    .replace(/[*`#]+|\b_+|_+\b/g, "")
    .replace(/\|/g, " ");
  return text
    .split(/\n+/)
    .map((line) => `<p>${line.trim().replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)]!)}</p>`)
    .join("\n");
}
