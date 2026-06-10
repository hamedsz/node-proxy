const express = require('express');
const http = require('http');
const httpProxy = require('http-proxy');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const TARGET_DOMAIN = process.env.TARGET_DOMAIN || 'http://tns.havinsepehr.com:8080';

const app = express();
const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true,
  secure: false,
  xfwd: true, // Forward original headers
});

// Error handler for proxy - handles both HTTP and WebSocket errors
proxy.on('error', (err, req, resOrSocket, head) => {
  console.error(`Proxy error (${err.code}):`, err.message);
  
  if (req) {
    console.error(`Failed request URL: ${req.url}`);
    console.error(`Method: ${req.method}`);
  }
  
  // Check if this is an HTTP response (has status method)
  if (resOrSocket && typeof resOrSocket.status === 'function') {
    // HTTP error - we have an Express response object
    if (!resOrSocket.headersSent) {
      resOrSocket.status(502).json({
        error: 'Bad Gateway',
        message: err.message,
        code: err.code
      });
    }
  } else if (resOrSocket && typeof resOrSocket.destroy === 'function') {
    // WebSocket error - we have a socket
    console.error('WebSocket proxy error, destroying socket');
    if (!resOrSocket.destroyed) {
      resOrSocket.destroy(err);
    }
  }
});

// Optional: Log successful proxy responses
proxy.on('proxyRes', (proxyRes, req, res) => {
  console.log(`[${new Date().toISOString()}] Proxied ${req.method} ${req.url} -> ${proxyRes.statusCode}`);
});

// Optional: Log WebSocket connections
proxy.on('open', (proxySocket) => {
  console.log('WebSocket proxy connection established');
});

proxy.on('close', (res, socket, head) => {
  console.log('WebSocket proxy connection closed');
});

// HTTP proxy middleware - catch all routes
app.use((req, res) => {
  console.log(`[${new Date().toISOString()}] HTTP ${req.method} ${req.url}`);
  proxy.web(req, res, { target: TARGET_DOMAIN });
});

// Create HTTP server
const server = http.createServer(app);

// Handle WebSocket upgrades
server.on('upgrade', (req, socket, head) => {
  console.log(`[${new Date().toISOString()}] WebSocket upgrade: ${req.url}`);
  
  // Handle socket errors
  socket.on('error', (err) => {
    console.error('Socket error:', err.message);
  });
  
  proxy.ws(req, socket, head, { target: TARGET_DOMAIN });
});

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Don't exit, just log and continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Relay server running on port ${PORT}`);
  console.log(`Proxying to: ${TARGET_DOMAIN}`);
  console.log(`WebSocket support: Enabled`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});