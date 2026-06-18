import * as http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import handler from './api/server';

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
  try {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Health endpoint for Kubernetes liveness/readiness probes. Must precede the
    // MCP handler, which only serves POST /mcp and 404s every other path — so
    // probes would otherwise have no 2xx target and pods come up 0/1.
    const path = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`).pathname;
    if (req.method === 'GET' && (path === '/health' || path === '/healthz')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // Call the Vercel handler
    await handler(req, res);
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  - POST /mcp - MCP Streamable HTTP endpoint`);
  console.log(`  - GET  /health - Liveness/readiness probe`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 