import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";

export function registerEchoTool(server: McpServer): McpServer {
  server.tool(
    "docHelpAssistant",
    "Echo a message with a Documentation Helper prefix",
    { message: z.string().describe("The message to be repeated by the documentation helper") },
    async ({ message }: { message: string }) => ({
      content: [
        {
          type: "text",
          text: `📚 🐟 MeetingBaaS Docs Assistant: ${message}`,
        },
      ],
    })
  );

  return server;
}

export default registerEchoTool;
