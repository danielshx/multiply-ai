/**
 * Cognee Cloud client (server-only).
 *
 * Talks to the tenant-scoped Cognee Cloud REST API. Tenant is baked into the
 * base URL; auth is via X-Api-Key header. All payloads use camelCase per the
 * Cognee OpenAPI spec.
 *
 * Env:
 *   COGNEE_API_URL   = https://tenant-<uuid>.aws.cognee.ai
 *   COGNEE_API_KEY   = the API key from platform.cognee.ai/api-keys
 */

const BASE_URL = process.env.COGNEE_API_URL ?? "";

function headers(): HeadersInit {
  const key = process.env.COGNEE_API_KEY;
  if (!key) throw new Error("COGNEE_API_KEY is not set");
  return {
    "Content-Type": "application/json",
    "X-Api-Key": key,
    Accept: "application/json",
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!BASE_URL) throw new Error("COGNEE_API_URL is not set");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Cognee ${res.status} ${res.statusText} on ${path}: ${text.slice(0, 400)}`);
  }
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export type RememberInput = {
  text: string;
  dataset?: string;
  metadata?: Record<string, unknown>;
};

export type RecallHit = {
  text?: string;
  content?: string;
  score?: number;
  metadata?: Record<string, unknown>;
  node_id?: string;
};

export type RecallResult = {
  results: RecallHit[];
  raw?: unknown;
};

export type Dataset = {
  id: string;
  name: string;
  owner_id?: string;
  created_at?: string;
};

const DEFAULT_DATASET = "multiply";

export const cognee = {
  /**
   * Ingest one piece of text. Metadata is appended to the body (cognee parses
   * structured info during cognify). For batch use addText().
   */
  async remember(input: RememberInput): Promise<{ ok: boolean }> {
    const dataset = input.dataset ?? DEFAULT_DATASET;
    const metaSuffix = input.metadata
      ? `\n\n[metadata]\n${Object.entries(input.metadata)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
          .join("\n")}`
      : "";
    await request("/api/v1/add_text", {
      method: "POST",
      body: JSON.stringify({
        text_data: [input.text + metaSuffix],
        datasetName: dataset,
      }),
    });
    return { ok: true };
  },

  /**
   * Trigger graph build for a dataset. Required after add_text before recall
   * returns rich graph results.
   */
  async cognify(dataset = DEFAULT_DATASET, runInBackground = false): Promise<{ ok: boolean }> {
    await request("/api/v1/cognify", {
      method: "POST",
      body: JSON.stringify({
        datasets: [dataset],
        runInBackground,
      }),
    });
    return { ok: true };
  },

  /**
   * Semantic + graph recall. Default searchType GRAPH_COMPLETION uses the
   * full graph context for the answer.
   */
  async recall(
    query: string,
    opts: {
      dataset?: string;
      topK?: number;
      searchType?:
        | "GRAPH_COMPLETION"
        | "RAG_COMPLETION"
        | "CHUNKS"
        | "SUMMARIES"
        | "FEELING_LUCKY";
    } = {},
  ): Promise<RecallResult> {
    const raw = await request<unknown>("/api/v1/recall", {
      method: "POST",
      body: JSON.stringify({
        searchType: opts.searchType ?? "GRAPH_COMPLETION",
        datasets: [opts.dataset ?? DEFAULT_DATASET],
        query,
        topK: opts.topK ?? 5,
      }),
    });
    const arr = Array.isArray(raw) ? raw : (raw as { results?: unknown[] })?.results ?? [];
    const results: RecallHit[] = [];
    for (const item of arr as unknown[]) {
      if (typeof item === "string") {
        results.push({ text: item });
        continue;
      }
      const obj = item as Record<string, unknown>;
      const inner = obj.search_result;
      if (Array.isArray(inner)) {
        for (const t of inner) {
          if (typeof t === "string") results.push({ text: t });
          else results.push({ text: JSON.stringify(t) });
        }
        continue;
      }
      results.push({
        text: (obj.text as string) ?? (obj.content as string) ?? JSON.stringify(obj),
        score: obj.score as number | undefined,
        metadata: obj.metadata as Record<string, unknown> | undefined,
        node_id: obj.node_id as string | undefined,
      });
    }
    return { results, raw };
  },

  async forget(dataset = DEFAULT_DATASET): Promise<{ ok: boolean }> {
    await request("/api/v1/forget", {
      method: "POST",
      body: JSON.stringify({ dataset }),
    });
    return { ok: true };
  },

  async listDatasets(): Promise<Dataset[]> {
    const res = await request<unknown>("/api/v1/datasets/", { method: "GET" });
    if (Array.isArray(res)) return res as Dataset[];
    return [];
  },

  /**
   * Resolve a dataset name → UUID (needed for visualize endpoint).
   */
  async getDatasetId(name = DEFAULT_DATASET): Promise<string | null> {
    const all = await this.listDatasets();
    return all.find((d) => d.name === name)?.id ?? null;
  },

  /**
   * Cognee Cloud's visualize endpoint returns an interactive HTML page.
   * We return the URL with the API key as a query param so it's iframable.
   * NOTE: API key in URL is fine for a demo iframe; for production use a
   * server-side proxy that streams the HTML.
   */
  visualizeUrl(datasetId: string): string {
    const key = process.env.COGNEE_API_KEY ?? "";
    return `${BASE_URL}/api/v1/visualize?dataset_id=${encodeURIComponent(datasetId)}&api_key=${encodeURIComponent(key)}`;
  },

  /**
   * Returns the visualization HTML server-side so we can iframe via srcDoc
   * (avoids leaking the API key in the iframe URL).
   */
  async visualizeHtml(datasetId: string): Promise<string> {
    if (!BASE_URL) throw new Error("COGNEE_API_URL is not set");
    const res = await fetch(`${BASE_URL}/api/v1/visualize?dataset_id=${encodeURIComponent(datasetId)}`, {
      headers: { "X-Api-Key": process.env.COGNEE_API_KEY ?? "" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Cognee visualize ${res.status} ${res.statusText}`);
    return res.text();
  },
};
