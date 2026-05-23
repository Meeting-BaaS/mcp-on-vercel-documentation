import crypto from "node:crypto";
import type { ServerOptions as McpServerOptions } from "@modelcontextprotocol/sdk/server/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { IncomingMessage, ServerResponse } from "http";
import type z from "zod";

interface ServerOptions extends McpServerOptions {
  parameters?: {
    schema: z.ZodSchema;
  };
}

// How long a session may sit idle (no requests) before we evict it, and how
// often we sweep for idle sessions. A well-behaved client sends DELETE /mcp to
// terminate, which cleans up immediately via transport.onclose; this sweep is
// the backstop for clients that just disconnect, so the Map can't grow without
// bound on a long-running (non-serverless) host.
const SESSION_IDLE_MS = Number(process.env.MCP_SESSION_IDLE_MS) || 30 * 60 * 1000;
const SESSION_SWEEP_MS = Number(process.env.MCP_SESSION_SWEEP_MS) || 5 * 60 * 1000;

export function initializeMcpApiHandler(
  initializeServer: (server: McpServer) => void,
  serverOptions: ServerOptions = {}
) {
  // Map session IDs to their transport plus last-activity timestamp. This is a
  // public documentation server: no authentication, no Redis — sessions live
  // in-process.
  const sessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; lastActive: number }
  >();

  // Backstop sweep: close any session idle longer than SESSION_IDLE_MS.
  // transport.close() fires onclose, which removes the entry. unref() so this
  // timer never keeps the process alive on shutdown.
  const sweep = setInterval(() => {
    const cutoff = Date.now() - SESSION_IDLE_MS;
    for (const [id, { transport, lastActive }] of sessions) {
      if (lastActive < cutoff) {
        console.log("Evicting idle MCP session:", id);
        void transport.close();
      }
    }
  }, SESSION_SWEEP_MS);
  sweep.unref?.();

  return async function mcpApiHandler(
    req: IncomingMessage,
    res: ServerResponse
  ) {
    const url = new URL(
      req.url || "",
      `https://mcp-documentation.${process.env.BAAS_URL}`
    );

    if (url.pathname !== "/mcp") {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    // Route to an existing session or create a new one.
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const session = sessionId ? sessions.get(sessionId) : undefined;

    if (session) {
      // Existing session — forward to its transport and mark it active.
      session.lastActive = Date.now();
      await session.transport.handleRequest(req, res);
    } else if (!sessionId && req.method === "POST") {
      // New session — create transport + server.
      console.log("Got new MCP connection", req.url, req.method);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (id) => {
          console.log("New MCP session:", id);
          sessions.set(id, { transport, lastActive: Date.now() });
        },
        enableJsonResponse: true,
      });

      const server = new McpServer(
        {
          name: "mcp-typescript server on vercel",
          version: "0.1.0",
        },
        serverOptions
      );

      try {
        initializeServer(server);
      } catch (error) {
        console.error("Error initializing server:", error);
        // Continue without failing — this is a public server.
      }

      await server.connect(transport);

      transport.onclose = () => {
        if (transport.sessionId) {
          console.log("MCP session closed:", transport.sessionId);
          sessions.delete(transport.sessionId);
        }
      };

      await transport.handleRequest(req, res);
    } else if (sessionId) {
      // Stale / unknown session.
      res.writeHead(404, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Session not found. The client must start a new session.",
          },
          id: null,
        })
      );
    } else {
      res.writeHead(405, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Method not allowed." },
          id: null,
        })
      );
    }
  };
}
