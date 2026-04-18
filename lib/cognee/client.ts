/**
 * Cognee REST client (server-only).
 *
 * Cognee is a knowledge graph + vector memory engine. Multiply uses it as the
 * "brain" that persists every call transcript, dossier, and learning across
 * runs — so the Negotiator + Researcher agents get smarter with each call.
 *
 * Self-hosted via docker-compose (see docker-compose.cognee.yml) or pointed at
 * Cognee Cloud. Set COGNEE_API_URL + COGNEE_API_KEY in .env.local.
 */

const BASE_URL = process.env.COGNEE_API_URL ?? "http://localhost:8000";

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const key = process.env.COGNEE_API_KEY;
  if (key) h["Authorization"] = `Bearer ${key}`;
  return h;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cognee ${res.status} ${res.statusText} on ${path}: ${body}`);
  }
  return (await res.json()) as T;
}

export type CogneeRememberInput = {
  text: string;
  dataset?: string;
  metadata?: Record<string, unknown>;
};

export type CogneeRecallResult = {
  results: Array<{
    text: string;
    score?: number;
    metadata?: Record<string, unknown>;
    node_id?: string;
  }>;
  graph?: {
    nodes: Array<{ id: string; label: string; type?: string }>;
    edges: Array<{ source: string; target: string; relation?: string }>;
  };
};

export const cognee = {
  /**
   * Ingest text + metadata into the knowledge graph.
   * Used by: log-learning tool (after every call), research tool (cache dossiers).
   */
  async remember(input: CogneeRememberInput): Promise<{ ok: boolean; node_id?: string }> {
    return request("/api/v1/add", {
      method: "POST",
      body: JSON.stringify({
        data: input.text,
        dataset_name: input.dataset ?? "multiply",
        metadata: input.metadata,
      }),
    });
  },

  /**
   * Trigger graph build / cognification on accumulated data.
   * Call after batches of remember() — typically nightly or after demo data seed.
   */
  async cognify(dataset = "multiply"): Promise<{ ok: boolean }> {
    return request("/api/v1/cognify", {
      method: "POST",
      body: JSON.stringify({ datasets: [dataset] }),
    });
  },

  /**
   * Semantic + graph recall. Auto-routes between vector search and graph traversal.
   * Used by: Negotiator (rebuttal lookup), Researcher (dossier lookup), Personaliser.
   */
  async recall(query: string, opts: { dataset?: string; sessionId?: string; topK?: number } = {}): Promise<CogneeRecallResult> {
    return request("/api/v1/search", {
      method: "POST",
      body: JSON.stringify({
        query_text: query,
        query_type: "GRAPH_COMPLETION",
        datasets: [opts.dataset ?? "multiply"],
        session_id: opts.sessionId,
        top_k: opts.topK ?? 5,
      }),
    });
  },

  /**
   * Fetch full graph for visualization.
   * Used by: Knowledge Graph tab in UI.
   */
  async graph(dataset = "multiply"): Promise<CogneeRecallResult["graph"]> {
    const res = await request<{ graph: CogneeRecallResult["graph"] }>(
      `/api/v1/datasets/${encodeURIComponent(dataset)}/graph`,
    );
    return res.graph;
  },

  async forget(dataset = "multiply"): Promise<{ ok: boolean }> {
    return request(`/api/v1/datasets/${encodeURIComponent(dataset)}`, {
      method: "DELETE",
    });
  },
};
