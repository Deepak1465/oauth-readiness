import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Structured generation on Gemini's free tier. To move to another model provider, replace this file:
// the rest of the app only calls generateStructured(prompt, schema, onBusy).

// Free-tier models available to new keys (checked 2026-10-19). If one is overloaded we try the next.
const MODELS = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"];

const ALLOWED = new Set(["type", "format", "title", "description", "enum", "items", "minItems", "maxItems", "minimum", "maximum", "anyOf", "properties", "additionalProperties", "required", "$defs", "$ref"]);

// Gemini accepts only a subset of JSON Schema; drop the keywords it rejects.
function geminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(geminiSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "properties" || k === "$defs") out[k] = Object.fromEntries(Object.entries(v as object).map(([p, s]) => [p, geminiSchema(s)]));
    else if (ALLOWED.has(k)) out[k] = geminiSchema(v);
  }
  return out;
}

let client: GoogleGenAI | null = null;
function gemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set. Add it to .env.local.");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

// Calls the first free model that answers, parsing against the schema; one retry with the error on bad JSON.
export async function generateStructured<T>(contents: string, schema: z.ZodType<T>, onBusy: (model: string) => void): Promise<T> {
  const ai = gemini();
  let last: unknown;
  for (const model of MODELS) {
    let feedback = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      let text: string;
      try {
        const res = await ai.models.generateContent({
          model,
          contents: contents + feedback,
          config: { responseMimeType: "application/json", responseJsonSchema: geminiSchema(z.toJSONSchema(schema)), temperature: 0.1 },
        });
        text = res.text ?? "";
      } catch (e) {
        last = e;
        const msg = e instanceof Error ? e.message : String(e);
        if (!/503|429|404|UNAVAILABLE|RESOURCE_EXHAUSTED|NOT_FOUND|overloaded|high demand/i.test(msg)) throw e;
        onBusy(model);
        break; // try the next model
      }
      try {
        return schema.parse(JSON.parse(text));
      } catch (e) {
        last = e;
        feedback = `\n\nYour previous output was invalid: ${(e instanceof Error ? e.message : "parse error").slice(0, 400)}. Return valid JSON.`;
      }
    }
  }
  throw last instanceof Error ? last : new Error("The model could not produce a valid answer.");
}

// Fails fast, before any work starts, when no key is configured.
export function assertLlmConfigured(): void {
  gemini();
}
