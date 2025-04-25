import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDocumentationTools } from "./utils/docs";
import registerEchoTool from "./utils/echo";

export function registerTools(server: McpServer): McpServer {
  // Register documentation tools
  let finalServer = registerDocumentationTools(server);
  
  // Register the documentation helper assistant
  finalServer = registerEchoTool(finalServer);
  
  return finalServer;
}

export default registerTools;
