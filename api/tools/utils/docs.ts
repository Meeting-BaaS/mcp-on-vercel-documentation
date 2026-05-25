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
//
// PUBLIC_DOCS is the browser-facing host used to build citable page links; it
// always uses DOCS_HOST (a public host) even if DOCS_ORIGIN is an internal IP.
// ---------------------------------------------------------------------------
const DOCS_HOST = process.env.DOCS_HOST || "docs.meetingbaas.com";
const DOCS_ORIGIN = process.env.DOCS_ORIGIN || `https://${DOCS_HOST}`;
const PUBLIC_DOCS = `https://${DOCS_HOST}`;
const docUrlFor = (category: string) => `${DOCS_ORIGIN}/llms/${category}`;

// Source-path → public page URL. "./content/docs/api-v2/reference/bots/x.mdx"
// → "https://<host>/docs/api-v2/reference/bots/x" (drop trailing /index).
const slugFromSource = (p: string) =>
  p.replace(/^\.\/content\/docs\//, "").replace(/\.mdx$/, "").replace(/\/index$/, "");
const pageUrl = (slug: string) => `${PUBLIC_DOCS}/docs/${slug}`;

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
const ALL_CATEGORY_VALUES = Object.values(DOC_CATEGORIES) as [string, ...string[]];

// The v2 API sections, for the index and slug→section routing.
const V2_SECTIONS: { cat: string; tool: string; label: string }[] = [
  { cat: DOC_CATEGORIES.API_V2_BOTS, tool: "getApiV2BotsDocs", label: "Bots" },
  { cat: DOC_CATEGORIES.API_V2_CALENDARS, tool: "getApiV2CalendarsDocs", label: "Calendars" },
  { cat: DOC_CATEGORIES.API_V2_CALLBACKS, tool: "getApiV2CallbacksDocs", label: "Callbacks" },
  { cat: DOC_CATEGORIES.API_V2_WEBHOOKS, tool: "getApiV2WebhooksDocs", label: "Webhooks" },
  { cat: DOC_CATEGORIES.API_V2_ZOOM_CREDENTIALS, tool: "getApiV2ZoomCredentialsDocs", label: "Zoom Credentials" },
];

// ---------------------------------------------------------------------------
// In-memory TTL cache + single-flight + conditional revalidation.
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = Number(process.env.DOCS_CACHE_TTL_MS) || 12 * 60 * 1000;

type CacheEntry = { body: string; etag?: string; lastModified?: string; expires: number };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string>>();

// Fetch a category's RAW bundle (cached). Returns markdown as the docs site emits it.
async function loadCategory(category: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(category);
  if (cached && cached.expires > now) {
    console.log(`docs cache HIT (fresh): ${category}`);
    return cached.body;
  }
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
      validateStatus: (status) => status === 304 || status < 500,
    });

    if (response.status === 304 && cached) {
      cache.set(category, { ...cached, expires: now + CACHE_TTL_MS });
      console.log(`docs cache REVALIDATED (304): ${category}`);
      return cached.body;
    }
    if (response.status !== 200) {
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

// ---------------------------------------------------------------------------
// Bundle post-processing: strip MDX/Fumadocs boilerplate and turn the
// "### Source: ./content/docs/X.mdx" markers into citable public links.
// ---------------------------------------------------------------------------
function enrich(raw: string): string {
  return raw
    .replace(/\{\/\*[\s\S]*?\*\/\}\s*/g, "") // strip MDX comments (Fumadocs "generated by …")
    .replace(
      /^### Source:\s*(\.\/content\/docs\/\S+\.mdx)\s*$/gm,
      (_m, p: string) => `**Source:** ${pageUrl(slugFromSource(p))}`
    );
}

type DocPage = { slug: string; title: string; url: string; body: string };

// Split a section bundle into individual pages. Anchored on the "### Source:"
// markers (one per file); the page title is the "## " line just above it.
function parsePages(raw: string): DocPage[] {
  const lines = raw.split("\n");
  const srcIdx: number[] = [];
  lines.forEach((l, i) => {
    if (/^### Source:\s*\.\/content\/docs\/\S+\.mdx/.test(l)) srcIdx.push(i);
  });
  const titleAbove = (si: number): number => {
    let t = si - 1;
    while (t >= 0 && !/^##\s+/.test(lines[t])) t--;
    return t;
  };
  const pages: DocPage[] = [];
  for (let k = 0; k < srcIdx.length; k++) {
    const si = srcIdx[k];
    const path = (lines[si].match(/(\.\/content\/docs\/\S+\.mdx)/) || [])[1] || "";
    const slug = slugFromSource(path);
    const ti = titleAbove(si);
    const title = ti >= 0 ? lines[ti].replace(/^##\s+/, "").trim() : slug.split("/").pop() || slug;
    const endExclusive = k + 1 < srcIdx.length ? Math.max(titleAbove(srcIdx[k + 1]), si + 1) : lines.length;
    const bodyLines = lines.slice(si + 1, endExclusive);
    while (bodyLines.length && (bodyLines[bodyLines.length - 1].trim() === "" || bodyLines[bodyLines.length - 1].trim() === "---")) {
      bodyLines.pop();
    }
    pages.push({ slug, title, url: pageUrl(slug), body: enrich(bodyLines.join("\n")).trim() });
  }
  return pages;
}

const categoryForSlug = (slug: string): string | null => {
  const m = slug.match(/^api-v2\/reference\/([^/]+)(?:\/|$)/);
  return m ? `api-v2/${m[1]}` : null;
};

// Tool result for a whole category bundle (enriched).
async function fetchDoc(category: string) {
  try {
    const text = enrich(await loadCategory(category));
    return { content: [{ type: "text" as const, text }] };
  } catch (error) {
    const stale = cache.get(category);
    if (stale) return { content: [{ type: "text" as const, text: enrich(stale.body) }] };
    const msg = error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`Documentation error for '${category}':`, error);
    return {
      content: [
        {
          type: "text" as const,
          text: `Error retrieving documentation for '${category}' from ${docUrlFor(category)}. Error: ${msg}`,
        },
      ],
    };
  }
}

export function registerDocumentationTools(server: McpServer): McpServer {
  server.tool(
    "listCategories",
    "List MeetingBaas documentation categories. The current API is v2 (api-v2); prefer it. Use getApiDocs for a small v2 index, then a section tool or getDocsPage for detail.",
    {},
    async () => ({
      content: [
        {
          type: "text" as const,
          text: `MeetingBaas Documentation (v2-first):

START HERE: getApiDocs → a small INDEX of the v2 API (sections + endpoints + links).
Then drill in with a section tool, or getDocsPage({ slug }) for ONE endpoint.

v2 section tools: ${V2_SECTIONS.map((s) => s.tool).join(", ")}
Full v2 dump (large, last resort): getApiV2FullDocs
Other: getTypeScriptSdkDocs, getSdkDocs, getMcpServersDocs, getSelfHostingDocs, getTranscriptSeekerDocs, getSpeakingBotsDocs, getUpdatesDocs
Legacy v1 (only if explicitly asked): getApiV1Docs
Everything in one bundle (very large): getAllDocs`,
        },
      ],
    })
  );

  // --- v2: index-first ---

  // Headline API tool → compact INDEX (not the 88k dump). Keeps the chat fast.
  server.tool(
    "getApiDocs",
    "Get an INDEX of the current MeetingBaas v2 API: sections and their endpoints with links — small and fast. Use this first, then call a section tool (e.g. getApiV2BotsDocs) or getDocsPage({ slug }) for the actual content. For the full v2 dump use getApiV2FullDocs (large).",
    {},
    async () => {
      const blocks: string[] = [
        "# MeetingBaas API v2 — Index",
        "Use a section tool for full detail, or getDocsPage({ slug }) for one endpoint.",
        "",
      ];
      for (const s of V2_SECTIONS) {
        blocks.push(`## ${s.label} — \`${s.tool}\``);
        try {
          const pages = parsePages(await loadCategory(s.cat));
          for (const p of pages) {
            blocks.push(`- ${p.title} — ${p.url}  \`slug: ${p.slug}\``);
          }
        } catch {
          blocks.push(`- (index unavailable; call \`${s.tool}\`)`);
        }
        blocks.push("");
      }
      return { content: [{ type: "text" as const, text: blocks.join("\n") }] };
    }
  );

  // Per-page fetch — returns ONE endpoint's page (small), sliced from the
  // cached section bundle (no extra docs round-trip once the section is warm).
  (server as any).tool(
    "getDocsPage",
    "Fetch a SINGLE documentation page by slug (cheapest option). Get slugs from getApiDocs. Example slug: api-v2/reference/bots/createBot.",
    {
      slug: z
        .string()
        .describe("Page slug, e.g. 'api-v2/reference/bots/createBot' (as shown by getApiDocs)"),
    },
    async ({ slug }: { slug: string }) => {
      const norm = slug.replace(/^\/?(docs\/)?/, "").replace(/\/$/, "").replace(/\.mdx$/, "");
      const cat = categoryForSlug(norm) || DOC_CATEGORIES.API_V2;
      try {
        let pages = parsePages(await loadCategory(cat));
        let page = pages.find((p) => p.slug === norm) || pages.find((p) => p.slug.endsWith(norm));
        if (!page && cat !== DOC_CATEGORIES.API_V2) {
          pages = parsePages(await loadCategory(DOC_CATEGORIES.API_V2));
          page = pages.find((p) => p.slug === norm) || pages.find((p) => p.slug.endsWith(norm));
        }
        if (!page) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No page found for slug '${norm}'. Call getApiDocs to list valid slugs.`,
              },
            ],
          };
        }
        return {
          content: [
            { type: "text" as const, text: `# ${page.title}\n\n**Source:** ${page.url}\n\n${page.body}` },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return { content: [{ type: "text" as const, text: `Error fetching page '${norm}': ${msg}` }] };
      }
    }
  );

  // v2 section tools (scoped content with links).
  server.tool("getApiV2BotsDocs", "Get v2 Bots API docs — create/list/manage bots, recording, chat. Start here for 'how do I send a bot?'.", {}, async () => fetchDoc(DOC_CATEGORIES.API_V2_BOTS));
  server.tool("getApiV2CalendarsDocs", "Get v2 Calendars API docs — connections, events, calendar bots.", {}, async () => fetchDoc(DOC_CATEGORIES.API_V2_CALENDARS));
  server.tool("getApiV2WebhooksDocs", "Get v2 Webhooks API docs.", {}, async () => fetchDoc(DOC_CATEGORIES.API_V2_WEBHOOKS));
  server.tool("getApiV2CallbacksDocs", "Get v2 Callbacks API docs.", {}, async () => fetchDoc(DOC_CATEGORIES.API_V2_CALLBACKS));
  server.tool("getApiV2ZoomCredentialsDocs", "Get v2 Zoom Credentials API docs.", {}, async () => fetchDoc(DOC_CATEGORIES.API_V2_ZOOM_CREDENTIALS));

  // Full v2 dump — large; last resort.
  server.tool(
    "getApiV2FullDocs",
    "Get the ENTIRE v2 API reference in one bundle. Large (~90k tokens) — prefer getApiDocs (index) + section tools / getDocsPage. Use only when you truly need everything.",
    {},
    async () => fetchDoc(DOC_CATEGORIES.API_V2)
  );

  // Legacy v1 — deprecated.
  server.tool(
    "getApiV1Docs",
    "DEPRECATED: legacy v1 API documentation. Only if the user explicitly asks about v1; otherwise use getApiDocs (v2).",
    {},
    async () => fetchDoc(DOC_CATEGORIES.API_V1)
  );

  // Topic bundles.
  server.tool("getCalendarsDocs", "Get Calendars documentation (v2 reference).", {}, async () => fetchDoc(DOC_CATEGORIES.CALENDARS));
  server.tool("getWebhooksDocs", "Get Webhooks documentation (v2 reference).", {}, async () => fetchDoc(DOC_CATEGORIES.WEBHOOKS));
  server.tool("getSdkDocs", "Get MeetingBaas SDK overview documentation.", {}, async () => fetchDoc(DOC_CATEGORIES.SDK));
  server.tool("getTypeScriptSdkDocs", "Get TypeScript SDK documentation.", {}, async () => fetchDoc(DOC_CATEGORIES.TYPESCRIPT_SDK));
  server.tool("getTranscriptSeekerDocs", "Get Transcript Seeker documentation.", {}, async () => fetchDoc(DOC_CATEGORIES.TRANSCRIPT_SEEKER));
  server.tool("getSpeakingBotsDocs", "Get Speaking Bots documentation.", {}, async () => fetchDoc(DOC_CATEGORIES.SPEAKING_BOTS));
  server.tool("getMcpServersDocs", "Get MCP servers documentation.", {}, async () => fetchDoc(DOC_CATEGORIES.MCP_SERVERS));
  server.tool("getSelfHostingDocs", "Get self-hosting documentation.", {}, async () => fetchDoc(DOC_CATEGORIES.SELF_HOSTING));
  server.tool("getUpdatesDocs", "Get MeetingBaas product updates and changelog.", {}, async () => fetchDoc(DOC_CATEGORIES.UPDATES));

  // Everything — very large; last resort.
  server.tool(
    "getAllDocs",
    "Get ALL docs in one bundle. WARNING: ~200k tokens — almost never the right tool. Prefer getApiDocs + a section tool / getDocsPage.",
    {},
    async () => fetchDoc(DOC_CATEGORIES.ALL)
  );

  // Generic by-category fetch.
  (server as any).tool(
    "getDocsByCategory",
    "Get a documentation category bundle by name. Prefer v2 (api-v2, api-v2/bots, …); `api` is legacy v1.",
    {
      category: z.enum(ALL_CATEGORY_VALUES).describe("Category to fetch (v2-first; `api` is legacy v1)"),
    },
    async ({ category }: { category: string }) => fetchDoc(category)
  );

  return server;
}

export default registerDocumentationTools;
