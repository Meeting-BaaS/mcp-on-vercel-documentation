import { initializeMcpApiHandler } from "../lib/mcp-api-handler";
import registerTools from "./tools/index";

const handler = initializeMcpApiHandler(
  (server) => {
    // Register tools
    server = registerTools(server);
  },
  {
    capabilities: {
      tools: {
        // Documentation Category Tools
        listCategories: {
          description:
            "List all available MeetingBaas documentation categories",
          category: "Documentation",
        },
        getAllDocs: {
          description: "Get all MeetingBaas documentation content",
          category: "Documentation",
        },
        getApiDocs: {
          description: "Get MeetingBaas API documentation",
          category: "Documentation",
        },
        getCalendarsDocs: {
          description: "Get Calendars API documentation",
          category: "Documentation",
        },
        getMeetingsDocs: {
          description: "Get Meetings API documentation",
          category: "Documentation",
        },
        getUsersDocs: {
          description: "Get Users API documentation",
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
        getTypeScriptSdkCommonDocs: {
          description:
            "Get Common TypeScript SDK methods and types documentation",
          category: "Documentation",
        },
        getTypeScriptSdkBotsDocs: {
          description: "Get Bot-related TypeScript SDK documentation",
          category: "Documentation",
        },
        getTypeScriptSdkCalendarsDocs: {
          description: "Get Calendar-related TypeScript SDK documentation",
          category: "Documentation",
        },
        getTypeScriptSdkWebhooksDocs: {
          description: "Get Webhook-related TypeScript SDK documentation",
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
      },
    },
  }
);

export default handler;
