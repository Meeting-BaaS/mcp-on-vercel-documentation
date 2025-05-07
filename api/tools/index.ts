import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDocumentationTools } from "./utils/docs";
import registerEchoTool from "./utils/echo";
import registerGitHubTools from "./utils/github";

export function registerTools(server: McpServer): McpServer {
  // Register documentation tools
  let finalServer = registerDocumentationTools(server);

  // Register the documentation helper assistant
  finalServer = registerEchoTool(finalServer);

  // Register GitHub repositories and README tools
  finalServer = registerGitHubTools(finalServer);

  return finalServer;
}

export default registerTools;
