import { initializeMcpApiHandler } from "../lib/mcp-api-handler";
import registerTools from "./tools/index";

const handler = initializeMcpApiHandler(
  (server) => {
    // Register tools
    server = registerTools(server);
  },
  {
    instructions:
      "This server returns MeetingBaas documentation. ALWAYS use the v2 API (api-v2); " +
      "only use getApiV1Docs if the user explicitly asks about legacy v1. " +
      "Work narrow-to-wide to stay fast: 1) getApiDocs returns a small INDEX of v2 " +
      "sections + endpoints with links; 2) getDocsPage({ slug }) fetches ONE endpoint " +
      "(cheapest); 3) a section tool (getApiV2BotsDocs, …CalendarsDocs, …WebhooksDocs, " +
      "…CallbacksDocs, …ZoomCredentialsDocs) returns a whole section. " +
      "AVOID getApiV2FullDocs (~90k tokens) and getAllDocs (~200k) unless truly needed. " +
      "Each result includes Source: links — cite them. " +
      "For 'how do I send a bot?': getApiDocs, then getDocsPage or getApiV2BotsDocs.",
    capabilities: {
      tools: ({
        // Documentation Category Tools
        listCategories: {
          description:
            "List all available MeetingBaas documentation categories",
          category: "Documentation",
        },
        getAllDocs: {
          description:
            "Get ALL docs in one bundle — very large; prefer a scoped tool",
          category: "Documentation",
        },
        getApiDocs: {
          description:
            "Get a small INDEX of the v2 API (sections + endpoints + links) — start here",
          category: "Documentation",
        },
        getDocsPage: {
          description:
            "Fetch a SINGLE doc page by slug (cheapest); get slugs from getApiDocs",
          category: "Documentation",
        },
        getApiV2FullDocs: {
          description:
            "Full v2 API reference in one bundle (~90k tokens; last resort)",
          category: "Documentation",
        },
        getApiV2BotsDocs: {
          description: "Get v2 Bots API documentation (send/manage bots)",
          category: "Documentation",
        },
        getApiV2CalendarsDocs: {
          description: "Get v2 Calendars API documentation",
          category: "Documentation",
        },
        getApiV2WebhooksDocs: {
          description: "Get v2 Webhooks API documentation",
          category: "Documentation",
        },
        getApiV2CallbacksDocs: {
          description: "Get v2 Callbacks API documentation",
          category: "Documentation",
        },
        getApiV2ZoomCredentialsDocs: {
          description: "Get v2 Zoom Credentials API documentation",
          category: "Documentation",
        },
        getApiV1Docs: {
          description:
            "DEPRECATED: legacy v1 API documentation (only if explicitly asked)",
          category: "Documentation",
        },
        getCalendarsDocs: {
          description: "Get Calendars API documentation",
          category: "Documentation",
        },
        getWebhooksDocs: {
          description: "Get Webhooks API documentation",
          category: "Documentation",
        },
        getSdkDocs: {
          description: "Get MeetingBaas SDK documentation",
          category: "Documentation",
        },
        getTypeScriptSdkDocs: {
          description: "Get TypeScript SDK documentation",
          category: "Documentation",
        },
        getTranscriptSeekerDocs: {
          description: "Get Transcript Seeker documentation",
          category: "Documentation",
        },
        getSpeakingBotsDocs: {
          description: "Get Speaking Bots documentation",
          category: "Documentation",
        },
        getMcpServersDocs: {
          description: "Get MCP servers documentation",
          category: "Documentation",
        },
        getSelfHostingDocs: {
          description: "Get self-hosting documentation",
          category: "Documentation",
        },
        getUpdatesDocs: {
          description: "Get MeetingBaas product updates and changelog",
          category: "Documentation",
        },
        getDocsByCategory: {
          description: "Get documentation by category name",
          category: "Documentation",
        },

        // GitHub Repository Tools
        listRepositories: {
          description:
            "List all publicly available GitHub repositories from Meeting-Baas organization",
          category: "GitHub",
        },
        getRepositoryReadme: {
          description:
            "Get README.md file from a specific Meeting-Baas GitHub repository",
          category: "GitHub",
        },

        // Utility Tools
        docHelpAssistant: {
          description: "Echo a message with a Documentation Helper prefix",
          category: "Utility",
        },
      }) as any,
    },
  }
);

export default handler;
