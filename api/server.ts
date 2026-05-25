import { initializeMcpApiHandler } from "../lib/mcp-api-handler";
import registerTools from "./tools/index";

const handler = initializeMcpApiHandler(
  (server) => {
    // Register tools
    server = registerTools(server);
  },
  {
    instructions:
      "This server returns MeetingBaas documentation as markdown bundles. " +
      "ALWAYS use the v2 API (api-v2) — call getApiDocs (which returns v2) and the " +
      "getApiV2*Docs sub-tools (getApiV2BotsDocs, getApiV2CalendarsDocs, " +
      "getApiV2WebhooksDocs, getApiV2CallbacksDocs, getApiV2ZoomCredentialsDocs). " +
      "Only use getApiV1Docs if the user explicitly asks about the legacy v1 API. " +
      "Prefer narrowly-scoped category tools over getAllDocs, which is very large. " +
      "For 'how do I send a bot?' start with getApiV2BotsDocs.",
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
            "Get the MeetingBaas API documentation — the CURRENT v2 API (always prefer this)",
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
