import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import axios from "axios";
import { z } from "zod";

// Documentation base URL
const DOCS_BASE_URL = `https://docs.${process.env.BAAS_URL}/llms`;

// Define all documentation categories
const DOC_CATEGORIES = {
  ALL: "all",
  API: "api",
  CALENDARS: "calendars",
  MEETINGS: "meetings",
  USERS: "users",
  WEBHOOKS: "webhooks",
  SDK: "sdk",
  TYPESCRIPT_SDK: "typescript-sdk",
  TYPESCRIPT_SDK_COMMON: "typescript-sdk-common",
  TYPESCRIPT_SDK_BOTS: "typescript-sdk-bots",
  TYPESCRIPT_SDK_CALENDARS: "typescript-sdk-calendars",
  TYPESCRIPT_SDK_WEBHOOKS: "typescript-sdk-webhooks",
  TRANSCRIPT_SEEKER: "transcript-seeker",
  SPEAKING_BOTS: "speaking-bots",
};

// Helper function to fetch documentation
async function fetchDoc(category: string) {
  try {
    const docUrl = `${DOCS_BASE_URL}/${category}`;

    const response = await axios.get(docUrl, {
      headers: {
        accept: "application/json",
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });

    if (response.status !== 200) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to fetch documentation for '${category}' from endpoint: ${docUrl}. Status code: ${response.status}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: response.data,
        },
      ],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    const docUrl = `${DOCS_BASE_URL}/${category}`;
    console.error(`Documentation API error when accessing ${docUrl}:`, error);

    return {
      content: [
        {
          type: "text" as const,
          text: `Error retrieving documentation from endpoint: ${docUrl}. Error: ${errorMessage}`,
        },
      ],
    };
  }
}

export function registerDocumentationTools(server: McpServer): McpServer {
  // Register a tool for listing all categories
  server.tool(
    "listCategories",
    "List all available MeetingBaas documentation categories",
    {},
    async () => {
      return {
        content: [
          {
            type: "text" as const,
            text: `Available MeetingBaas Documentation Categories:
- ${DOC_CATEGORIES.ALL} - All MeetingBaas documentation content
- ${DOC_CATEGORIES.API} - MeetingBaas API, the main purpose of the documentation
- ${DOC_CATEGORIES.CALENDARS} - Calendars API, for managing calendar integrations and events
- ${DOC_CATEGORIES.MEETINGS} - Meetings API, for scheduling and managing virtual meetings
- ${DOC_CATEGORIES.USERS} - Users API, for user management and authentication
- ${DOC_CATEGORIES.WEBHOOKS} - Webhooks API, for event notifications and integrations
- ${DOC_CATEGORIES.SDK} - MeetingBaas SDK, client libraries for various programming languages
- ${DOC_CATEGORIES.TYPESCRIPT_SDK} - TypeScript SDK for MeetingBaas
- ${DOC_CATEGORIES.TYPESCRIPT_SDK_COMMON} - Common TypeScript SDK methods and types
- ${DOC_CATEGORIES.TYPESCRIPT_SDK_BOTS} - Bot-related TypeScript SDK methods and types
- ${DOC_CATEGORIES.TYPESCRIPT_SDK_CALENDARS} - Calendar-related TypeScript SDK methods and types
- ${DOC_CATEGORIES.TYPESCRIPT_SDK_WEBHOOKS} - Webhook-related TypeScript SDK methods and types
- ${DOC_CATEGORIES.TRANSCRIPT_SEEKER} - Transcript Seeker, the open-source transcription playground
- ${DOC_CATEGORIES.SPEAKING_BOTS} - Speaking Bots, the Pipecat-powered bots`,
          },
        ],
      };
    }
  );

  // Register a tool for all docs
  server.tool(
    "getAllDocs",
    "Get all MeetingBaas documentation content",
    {},
    async () => fetchDoc(DOC_CATEGORIES.ALL)
  );

  // Register a tool for API docs
  server.tool("getApiDocs", "Get MeetingBaas API documentation", {}, async () =>
    fetchDoc(DOC_CATEGORIES.API)
  );

  // Register a tool for Calendars API docs
  server.tool(
    "getCalendarsDocs",
    "Get Calendars API documentation",
    {},
    async () => fetchDoc(DOC_CATEGORIES.CALENDARS)
  );

  // Register a tool for Meetings API docs
  server.tool(
    "getMeetingsDocs",
    "Get Meetings API documentation",
    {},
    async () => fetchDoc(DOC_CATEGORIES.MEETINGS)
  );

  // Register a tool for Users API docs
  server.tool("getUsersDocs", "Get Users API documentation", {}, async () =>
    fetchDoc(DOC_CATEGORIES.USERS)
  );

  // Register a tool for Webhooks API docs
  server.tool(
    "getWebhooksDocs",
    "Get Webhooks API documentation",
    {},
    async () => fetchDoc(DOC_CATEGORIES.WEBHOOKS)
  );

  // Register a tool for SDK docs
  server.tool("getSdkDocs", "Get MeetingBaas SDK documentation", {}, async () =>
    fetchDoc(DOC_CATEGORIES.SDK)
  );

  // Register a tool for TypeScript SDK docs
  server.tool(
    "getTypeScriptSdkDocs",
    "Get TypeScript SDK documentation",
    {},
    async () => fetchDoc(DOC_CATEGORIES.TYPESCRIPT_SDK)
  );

  // Register a tool for TypeScript SDK Common docs
  server.tool(
    "getTypeScriptSdkCommonDocs",
    "Get Common TypeScript SDK methods and types documentation",
    {},
    async () => fetchDoc(DOC_CATEGORIES.TYPESCRIPT_SDK_COMMON)
  );

  // Register a tool for TypeScript SDK Bots docs
  server.tool(
    "getTypeScriptSdkBotsDocs",
    "Get Bot-related TypeScript SDK documentation",
    {},
    async () => fetchDoc(DOC_CATEGORIES.TYPESCRIPT_SDK_BOTS)
  );

  // Register a tool for TypeScript SDK Calendars docs
  server.tool(
    "getTypeScriptSdkCalendarsDocs",
    "Get Calendar-related TypeScript SDK documentation",
    {},
    async () => fetchDoc(DOC_CATEGORIES.TYPESCRIPT_SDK_CALENDARS)
  );

  // Register a tool for TypeScript SDK Webhooks docs
  server.tool(
    "getTypeScriptSdkWebhooksDocs",
    "Get Webhook-related TypeScript SDK documentation",
    {},
    async () => fetchDoc(DOC_CATEGORIES.TYPESCRIPT_SDK_WEBHOOKS)
  );

  // Register a tool for Transcript Seeker docs
  server.tool(
    "getTranscriptSeekerDocs",
    "Get Transcript Seeker documentation",
    {},
    async () => fetchDoc(DOC_CATEGORIES.TRANSCRIPT_SEEKER)
  );

  // Register a tool for Speaking Bots docs
  server.tool(
    "getSpeakingBotsDocs",
    "Get Speaking Bots documentation",
    {},
    async () => fetchDoc(DOC_CATEGORIES.SPEAKING_BOTS)
  );

  // Also keep a generic tool for fetching by category
  server.tool(
    "getDocsByCategory",
    "Get documentation by category name",
    {
      category: z
        .enum([
          DOC_CATEGORIES.ALL,
          DOC_CATEGORIES.API,
          DOC_CATEGORIES.CALENDARS,
          DOC_CATEGORIES.MEETINGS,
          DOC_CATEGORIES.USERS,
          DOC_CATEGORIES.WEBHOOKS,
          DOC_CATEGORIES.SDK,
          DOC_CATEGORIES.TYPESCRIPT_SDK,
          DOC_CATEGORIES.TYPESCRIPT_SDK_COMMON,
          DOC_CATEGORIES.TYPESCRIPT_SDK_BOTS,
          DOC_CATEGORIES.TYPESCRIPT_SDK_CALENDARS,
          DOC_CATEGORIES.TYPESCRIPT_SDK_WEBHOOKS,
          DOC_CATEGORIES.TRANSCRIPT_SEEKER,
          DOC_CATEGORIES.SPEAKING_BOTS,
        ])
        .describe("The documentation category to fetch"),
    },
    async ({ category }: { category: string }) => fetchDoc(category)
  );

  return server;
}

export default registerDocumentationTools;
