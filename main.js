const express = require('express');
const http = require('http');
const httpProxy = require('http-proxy');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const TARGET_DOMAIN = process.env.TARGET_DOMAIN || 'http://aaa.me.zabanoosh.com:8080';

const app = express();
const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true,
  secure: false,
});

// Error handling
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  if (res && !res.headersSent) {
    res.status(500).send('Proxy error: ' + err.message);
  }
});

// ✅ Fixed: No '*' parameter needed
app.use((req, res) => {
  proxy.web(req, res, { target: TARGET_DOMAIN });
});

const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
  console.log('WebSocket upgrade:', req.url);
  proxy.ws(req, socket, head, { target: TARGET_DOMAIN });
});

server.listen(PORT, () => {
  console.log(`🚀 Relay server running on port ${PORT}`);
  console.log(`Proxying to: ${TARGET_DOMAIN}`);
});
