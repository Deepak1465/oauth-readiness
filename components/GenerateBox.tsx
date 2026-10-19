"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Step = { id: string; label: string; detail?: string; done: boolean };

const EXAMPLES = ["Spotify", "Xero", "Shopify", "Dropbox", "hubspot.com"];

export function GenerateBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function run(q: string) {
    const text = q.trim();
    if (text.length < 2) {
      setError("Enter an app name or website, for example Spotify or xero.com.");
      return;
    }
    setRunning(true);
    setError(null);
    setSteps([]);
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: text }) });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status}).`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.type === "step") {
            setSteps((prev) => {
              const others = prev.map((s) => (s.id === e.id ? s : { ...s, done: true }));
              const existing = others.find((s) => s.id === e.id);
              return existing ? others.map((s) => (s.id === e.id ? { ...s, detail: e.detail ?? s.detail } : s)) : [...others, { id: e.id, label: e.label, detail: e.detail, done: false }];
            });
          } else if (e.type === "done") {
            setSteps((prev) => prev.map((s) => ({ ...s, done: true })));
            router.push(`/guide/${e.slug}`);
            return;
          } else if (e.type === "error") {
            throw new Error(e.message);
          }
        }
      }
      throw new Error("The connection closed before the guide was ready. Try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setRunning(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        <label htmlFor="app-query" className="sr-only">App name or website</label>
        <input
          id="app-query"
          name="app"
          autoComplete="off"
          spellCheck={false}
          placeholder="App name or website, e.g. Spotify"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={running}
          style={{ flex: "1 1 280px", font: "inherit", fontSize: 18, padding: "12px 14px", borderRadius: 8, border: "1px solid var(--ink-3)", background: "var(--surface)", color: "var(--ink)", minWidth: 0 }}
        />
        <button className="btn" type="submit" disabled={running} style={{ fontSize: 17, padding: "12px 20px" }}>
          {running ? "Researching" : "Generate guide"}
        </button>
      </form>

      {!running && !steps.length && (
        <p className="faint" style={{ fontSize: 14, margin: "10px 0 0" }}>
          Try{" "}
          {EXAMPLES.map((ex, i) => (
            <span key={ex}>
              <button
                type="button"
                onClick={() => {
                  setQuery(ex);
                  run(ex);
                }}
                style={{ font: "inherit", background: "none", border: 0, padding: 0, color: "var(--link)", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}
              >
                {ex}
              </button>
              {i < EXAMPLES.length - 1 ? ", " : ""}
            </span>
          ))}
          . A new guide takes about a minute.
        </p>
      )}

      {steps.length > 0 && (
        <ol aria-live="polite" style={{ listStyle: "none", padding: 0, margin: "18px 0 0" }}>
          {steps.map((s) => (
            <li key={s.id} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "4px 0" }}>
              <span
                aria-hidden
                style={{ width: 10, height: 10, borderRadius: "50%", flex: "none", background: s.done ? "var(--ok)" : "var(--wait)", animation: s.done ? undefined : "pulse 1.2s ease-in-out infinite" }}
              />
              <span>
                {s.label}
                {s.detail && <span className="faint">: {s.detail}</span>}
                <span className="sr-only">{s.done ? " (done)" : " (in progress)"}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p role="alert" style={{ color: "var(--bad)", margin: "14px 0 0", fontWeight: 600 }}>
          {error}
        </p>
      )}
    </div>
  );
}
