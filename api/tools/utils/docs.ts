import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import axios from "axios";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Where the docs `/llms/*` bundles are fetched from.
//
//  - DOCS_ORIGIN (full scheme+host, e.g. http://127.0.0.1:4010) takes priority.
//    Set this when self-hosting so the MCP hits the in-cluster docs origin
//    directly and skips the public TLS/nginx/CDN hop.
//  - Otherwise https://${DOCS_HOST}, default docs.meetingbaas.com.
//
// NB: NOT derived from BAAS_URL — the white-label host (docs.gmeetrecorder.com)
// has no docs deployment / TLS SAN, so fetching there fails. BAAS_URL only
// governs the server's own public URL (see lib/mcp-api-handler.ts).
// ---------------------------------------------------------------------------
const DOCS_HOST = process.env.DOCS_HOST || "docs.meetingbaas.com";
const DOCS_ORIGIN = process.env.DOCS_ORIGIN || `https://${DOCS_HOST}`;
const docUrlFor = (category: string) => `${DOCS_ORIGIN}/llms/${category}`;

// ---------------------------------------------------------------------------
// Documentation categories — v2-first.
//
// Mirrors the source of truth `content/llm-config.ts` in the docs repo
// (docs-v2). The top-level `api` is the LEGACY v1 reference; the current API is
// `api-v2` and its per-section bundles. `calendars`/`webhooks` already point at
// the api-v2 reference in llm-config.
//
// The api-v2 sub-bundles (api-v2/bots, …) are only reachable once the docs-v2
// `[...path]` route joins segments with '/' (the join('-') bug). Verify they
// 200 before relying on the sub-tools.
//
// Removed (returned empty stubs after the v2 migration): meetings, users,
// typescript-sdk-{common,bots,calendars,webhooks}.
// ---------------------------------------------------------------------------
const DOC_CATEGORIES = {
  ALL: "all",
  API_V2: "api-v2",
  API_V2_BOTS: "api-v2/bots",
  API_V2_CALENDARS: "api-v2/calendars",
  API_V2_WEBHOOKS: "api-v2/webhooks",
  API_V2_CALLBACKS: "api-v2/callbacks",
  API_V2_ZOOM_CREDENTIALS: "api-v2/zoom-credentials",
  API_V1: "api",
  CALENDARS: "calendars",
  WEBHOOKS: "webhooks",
  SDK: "sdk",
  TYPESCRIPT_SDK: "typescript-sdk",
  TRANSCRIPT_SEEKER: "transcript-seeker",
  SPEAKING_BOTS: "speaking-bots",
  MCP_SERVERS: "mcp-servers",
  SELF_HOSTING: "self-hosting",
  UPDATES: "updates",
};

// All category strings, for the generic getDocsByCategory enum.
const ALL_CATEGORY_VALUES = Object.values(DOC_CATEGORIES) as [string, ...string[]];

// ---------------------------------------------------------------------------
// In-memory TTL cache + single-flight + conditional revalidation.
//
// Docs only change on deploy, so a multi-minute TTL is plenty. On expiry we
// revalidate with If-None-Match; a 304 refreshes the entry with zero body
// transfer. Concurrent fetches of the same category share one request.
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = Number(process.env.DOCS_CACHE_TTL_MS) || 12 * 60 * 1000;

type CacheEntry = { body: string; etag?: string; lastModified?: string; expires: number };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string>>();

async function loadCategory(category: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(category);

  // Fresh cache hit — no outbound HTTP.
  if (cached && cached.expires > now) {
    console.log(`docs cache HIT (fresh): ${category}`);
    return cached.body;
  }

  // Single-flight: collapse concurrent identical fetches into one request.
  const existing = inflight.get(category);
  if (existing) return existing;

  const fetchPromise = (async () => {
    const url = docUrlFor(category);
    const headers: Record<string, string> = { accept: "application/json" };
    if (cached?.etag) headers["If-None-Match"] = cached.etag;
    if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;

    const response = await axios.get(url, {
      headers,
      maxRedirects: 5,
      // 304 must reach us as a value, not an error; <500 stays non-throwing.
      validateStatus: (status) => status === 304 || status < 500,
    });

    // Not modified — refresh TTL, reuse cached body, no transfer.
    if (response.status === 304 && cached) {
      cache.set(category, { ...cached, expires: now + CACHE_TTL_MS });
      console.log(`docs cache REVALIDATED (304): ${category}`);
      return cached.body;
    }

    if (response.status !== 200) {
      // Don't cache non-200s (404 stub / transient). Surface, fall back to
      // stale body if we have one.
      if (cached) {
        console.warn(`docs fetch ${response.status} for ${category}; serving stale cache`);
        return cached.body;
      }
      throw new Error(`HTTP ${response.status} from ${url}`);
    }

    const body =
      typeof response.data === "string" ? response.data : JSON.stringify(response.data);
    cache.set(category, {
      body,
      etag: response.headers["etag"],
      lastModified: response.headers["last-modified"],
      expires: now + CACHE_TTL_MS,
    });
    console.log(`docs cache MISS → fetched: ${category} (${body.length}B)`);
    return body;
  })().finally(() => inflight.delete(category));

  inflight.set(category, fetchPromise);
  return fetchPromise;
}

// Helper that returns the MCP tool result for a category.
async function fetchDoc(category: string) {
  try {
    const text = await loadCategory(category);
    return { content: [{ type: "text" as const, text }] };
  } catch (error) {
    const stale = cache.get(category);
    if (stale) {
      return { content: [{ type: "text" as const, text: stale.body }] };
    }
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`Documentation error for '${category}':`, error);
    return {
      content: [
        {
          type: "text" as const,
          text: `Error retrieving documentation for '${category}' from ${docUrlFor(category)}. Error: ${errorMessage}`,
        },
      ],
    };
  }
}

export function registerDocumentationTools(server: McpServer): McpServer {
  // List categories — v2-first, mirrors content/llm-config.ts.
  server.tool(
    "listCategories",
    "List MeetingBaas documentation categories. The current API is v2 (api-v2); prefer it and its sub-sections. `api` is the legacy v1 reference.",
    {},
    async () => {
      return {
        content: [
          {
            type: "text" as const,
            text: `MeetingBaas Documentation Categories (v2-first):

CURRENT API (v2) — prefer these:
- ${DOC_CATEGORIES.API_V2} - MeetingBaas API v2, the current API (use getApiDocs)
- ${DOC_CATEGORIES.API_V2_BOTS} - Bots endpoints (create/list/manage bots, recording, chat)
- ${DOC_CATEGORIES.API_V2_CALENDARS} - Calendars endpoints
- ${DOC_CATEGORIES.API_V2_WEBHOOKS} - Webhooks endpoints
- ${DOC_CATEGORIES.API_V2_CALLBACKS} - Callbacks endpoints
- ${DOC_CATEGORIES.API_V2_ZOOM_CREDENTIALS} - Zoom credentials endpoints

SDK & guides:
- ${DOC_CATEGORIES.TYPESCRIPT_SDK} - TypeScript SDK
- ${DOC_CATEGORIES.SDK} - SDK overview (client libraries)
- ${DOC_CATEGORIES.MCP_SERVERS} - MCP servers
- ${DOC_CATEGORIES.SELF_HOSTING} - Self-hosting
- ${DOC_CATEGORIES.TRANSCRIPT_SEEKER} - Transcript Seeker
- ${DOC_CATEGORIES.SPEAKING_BOTS} - Speaking Bots
- ${DOC_CATEGORIES.UPDATES} - Product updates / changelog

LEGACY (v1) — only if explicitly asked:
- ${DOC_CATEGORIES.API_V1} - Legacy v1 API reference (use getApiV1Docs)

Note: ${DOC_CATEGORIES.ALL} exists but is very large — prefer a scoped category above.`,
          },
        ],
      };
    }
  );

  // --- Current API (v2) ---

  // Headline API tool → v2.
  server.tool(
    "getApiDocs",
    "Get the MeetingBaas API documentation. Returns the CURRENT v2 API (api-v2). Use this for anything about sending/managing bots, calendars, webhooks, callbacks, or zoom credentials. Always prefer this over the legacy v1 tool.",
    {},
    async () => fetchDoc(DOC_CATEGORIES.API_V2)
  );

  server.tool(
    "getApiV2BotsDocs",
    "Get v2 Bots API documentation — creating/listing/managing bots, recording control, chat, screenshots. Use this for 'how do I send a bot?' type questions.",
    {},
    async () => fetchDoc(DOC_CATEGORIES.API_V2_BOTS)
  );

  server.tool(
    "getApiV2CalendarsDocs",
    "Get v2 Calendars API documentation — calendar connections, events, and calendar-driven bots.",
    {},
    async () => fetchDoc(DOC_CATEGORIES.API_V2_CALENDARS)
  );

  server.tool(
    "getApiV2WebhooksDocs",
    "Get v2 Webhooks API documentation.",
    {},
    async () => fetchDoc(DOC_CATEGORIES.API_V2_WEBHOOKS)
  );

  server.tool(
    "getApiV2CallbacksDocs",
    "Get v2 Callbacks API documentation.",
    {},
    async () => fetchDoc(DOC_CATEGORIES.API_V2_CALLBACKS)
  );

  server.tool(
    "getApiV2ZoomCredentialsDocs",
    "Get v2 Zoom Credentials API documentation.",
    {},
    async () => fetchDoc(DOC_CATEGORIES.API_V2_ZOOM_CREDENTIALS)
  );

  // --- Legacy API (v1) — deprecated ---
  server.tool(
    "getApiV1Docs",
    "DEPRECATED: Get the LEGACY v1 API documentation. Only use this if the user explicitly asks about the old v1 API. For everything else use getApiDocs (v2).",
    {},
    async () => fetchDoc(DOC_CATEGORIES.API_V1)
  );

  // --- Topic bundles (v2-backed) ---
  server.tool(
    "getCalendarsDocs",
    "Get Calendars documentation (v2 reference).",
    {},
    async () => fetchDoc(DOC_CATEGORIES.CALENDARS)
  );

  server.tool(
    "getWebhooksDocs",
    "Get Webhooks documentation (v2 reference).",
    {},
    async () => fetchDoc(DOC_CATEGORIES.WEBHOOKS)
  );

  server.tool("getSdkDocs", "Get MeetingBaas SDK overview documentation.", {}, async () =>
    fetchDoc(DOC_CATEGORIES.SDK)
  );

  server.tool(
    "getTypeScriptSdkDocs",
    "Get TypeScript SDK documentation.",
    {},
    async () => fetchDoc(DOC_CATEGORIES.TYPESCRIPT_SDK)
  );

  server.tool(
    "getTranscriptSeekerDocs",
    "Get Transcript Seeker documentation.",
    {},
    async () => fetchDoc(DOC_CATEGORIES.TRANSCRIPT_SEEKER)
  );

  server.tool(
    "getSpeakingBotsDocs",
    "Get Speaking Bots documentation.",
    {},
    async () => fetchDoc(DOC_CATEGORIES.SPEAKING_BOTS)
  );

  server.tool(
    "getMcpServersDocs",
    "Get MCP servers documentation.",
    {},
    async () => fetchDoc(DOC_CATEGORIES.MCP_SERVERS)
  );

  server.tool(
    "getSelfHostingDocs",
    "Get self-hosting documentation.",
    {},
    async () => fetchDoc(DOC_CATEGORIES.SELF_HOSTING)
  );

  server.tool(
    "getUpdatesDocs",
    "Get MeetingBaas product updates and changelog.",
    {},
    async () => fetchDoc(DOC_CATEGORIES.UPDATES)
  );

  // Discouraged: the full dump is large; prefer a scoped category.
  server.tool(
    "getAllDocs",
    "Get ALL MeetingBaas documentation in one bundle. WARNING: very large (~800 KB) — prefer a scoped tool like getApiDocs or getApiV2BotsDocs. Only use when you genuinely need everything.",
    {},
    async () => fetchDoc(DOC_CATEGORIES.ALL)
  );

  // Generic by-category fetch.
  (server as any).tool(
    "getDocsByCategory",
    "Get documentation by category name. Prefer v2 categories (api-v2, api-v2/bots, …); `api` is legacy v1.",
    {
      category: z
        .enum(ALL_CATEGORY_VALUES)
        .describe("The documentation category to fetch (v2-first; `api` is legacy v1)"),
    },
    async ({ category }: { category: string }) => fetchDoc(category)
  );

  return server;
}

export default registerDocumentationTools;
