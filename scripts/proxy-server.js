/**
 * Local SSL Proxy Server for VulneraX
 * 
 * Replaces Nginx for local development with:
 * - HTTPS support with custom SSL certificates
 * - Multi-tenant routing based on subdomain
 * - Proxy to Next.js dev server
 * - Security headers
 * - Rate limiting visualization
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createProxyServer } = require('http-proxy');

// Configuration
const CONFIG = {
  // Use port 3443 instead of 443 to avoid needing Administrator privileges
  httpsPort: 3443,
  httpPort: 3080,
  
  // Next.js dev server
  targetPort: 3000,
  targetHost: 'localhost',
  
  // SSL certificates path
  sslCertPath: path.join(__dirname, '..', 'nginx', 'ssl', 'vulnerax.local.crt'),
  sslKeyPath: path.join(__dirname, '..', 'nginx', 'ssl', 'vulnerax.local.key'),
  
  // Supported domains
  domains: ['vulnerax.local', 'vulnerax.test'],
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Extract tenant from hostname
function extractTenant(hostname) {
  const host = hostname.split(':')[0].toLowerCase();
  
  // Localhost fallback
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'main';
  }
  
  // Check for subdomain
  for (const domain of CONFIG.domains) {
    const regex = new RegExp(`^([^.]+)\\.${domain}$`);
    const match = host.match(regex);
    if (match) {
      const subdomain = match[1];
      return subdomain === 'www' ? 'main' : subdomain;
    }
  }
  
  // Exact domain match
  if (CONFIG.domains.some(d => host === d)) {
    return 'main';
  }
  
  return 'main';
}

// Create proxy server
const proxy = createProxyServer({
  target: `http://${CONFIG.targetHost}:${CONFIG.targetPort}`,
  changeOrigin: true,
  ws: true, // WebSocket support
});

// Error handling
proxy.on('error', (err, req, res) => {
  log(`Proxy error: ${err.message}`, 'red');
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bad Gateway', message: err.message }));
  }
});

// Request handler
function handleRequest(req, res) {
  const hostname = req.headers.host || 'localhost';
  const tenantId = extractTenant(hostname);
  
  // Add security headers
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Tenant-ID', tenantId);
  
  // Add tenant context to headers (for upstream)
  req.headers['x-tenant-id'] = tenantId;
  req.headers['x-real-ip'] = req.socket.remoteAddress;
  
  // Log request
  log(`${req.method} ${req.url} - Tenant: ${tenantId}`, 'cyan');
  
  // Proxy the request
  proxy.web(req, res);
}

// WebSocket handler
function handleUpgrade(req, socket, head) {
  const hostname = req.headers.host || 'localhost';
  const tenantId = extractTenant(hostname);
  
  req.headers['x-tenant-id'] = tenantId;
  
  proxy.ws(req, socket, head);
}

// Start HTTPS server
function startHTTPSServer() {
  try {
    // Check if certificates exist
    if (!fs.existsSync(CONFIG.sslCertPath) || !fs.existsSync(CONFIG.sslKeyPath)) {
      log('❌ SSL certificates not found!', 'red');
      log('   Please run: .\\scripts\\setup-domain.ps1', 'yellow');
      log('   Or manually create certificates at:', 'yellow');
      log(`   - ${CONFIG.sslCertPath}`, 'yellow');
      log(`   - ${CONFIG.sslKeyPath}`, 'yellow');
      process.exit(1);
    }
    
    const options = {
      key: fs.readFileSync(CONFIG.sslKeyPath),
      cert: fs.readFileSync(CONFIG.sslCertPath),
    };
    
    const server = https.createServer(options, handleRequest);
    server.on('upgrade', handleUpgrade);
    
    server.listen(CONFIG.httpsPort, () => {
      log('');
      log('╔════════════════════════════════════════════════════════╗', 'green');
      log('║     🔒 VulneraX HTTPS Proxy Server Running             ║', 'green');
      log('╚════════════════════════════════════════════════════════╝', 'green');
      log('');
      log(`📡 HTTPS Server: https://vulnerax.local:${CONFIG.httpsPort}`, 'cyan');
      log(`🎯 Proxy Target: http://${CONFIG.targetHost}:${CONFIG.targetPort}`, 'cyan');
      log('');
      log('🌐 Available URLs:', 'yellow');
      log(`   • https://vulnerax.local:${CONFIG.httpsPort}`, 'cyan');
      log(`   • https://tenant1.vulnerax.local:${CONFIG.httpsPort}`, 'cyan');
      log(`   • https://tenant2.vulnerax.local:${CONFIG.httpsPort}`, 'cyan');
      log(`   • https://admin.vulnerax.local:${CONFIG.httpsPort}`, 'cyan');
      log('');
      log('📊 Security Dashboard:', 'yellow');
      log(`   • https://admin.vulnerax.local:${CONFIG.httpsPort}/security/dashboard`, 'cyan');
      log('');
    });
    
    return server;
  } catch (error) {
    log(`❌ Failed to start HTTPS server: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Start HTTP server (redirects to HTTPS)
function startHTTPServer() {
  const server = http.createServer((req, res) => {
    const hostname = req.headers.host || 'vulnerax.local';
    const httpsUrl = `https://${hostname}${req.url}`;
    
    res.writeHead(301, { Location: httpsUrl });
    res.end();
  });
  
  server.listen(CONFIG.httpPort, () => {
    log(`🔄 HTTP Redirect: http://vulnerax.local → https`, 'blue');
  });
  
  return server;
}

// Graceful shutdown
function setupGracefulShutdown(httpsServer, httpServer) {
  const shutdown = (signal) => {
    log(`\n${signal} received. Shutting down gracefully...`, 'yellow');
    
    httpsServer.close(() => {
      log('HTTPS server closed', 'green');
    });
    
    httpServer.close(() => {
      log('HTTP server closed', 'green');
    });
    
    proxy.close();
    
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('exit', () => log('Goodbye! 👋', 'green'));
}

// Check if Next.js is running
async function checkNextJS() {
  return new Promise((resolve) => {
    const req = http.request({
      host: CONFIG.targetHost,
      port: CONFIG.targetPort,
      path: '/api/health',
      method: 'GET',
      timeout: 2000,
    }, (res) => {
      resolve(res.statusCode === 200);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// Main
async function main() {
  log('');
  log('🔧 VulneraX Local Proxy Server', 'bright');
  log('');
  
  // Check if Next.js is running
  log('⏳ Checking if Next.js is running...', 'yellow');
  const isNextJSRunning = await checkNextJS();
  
  if (!isNextJSRunning) {
    log('⚠️  Next.js dev server not detected on port 3000', 'yellow');
    log('   Please start Next.js first:', 'yellow');
    log('   npm run dev', 'cyan');
    log('');
    log('   Or use the combined start command:', 'yellow');
    log('   npm run start:local', 'cyan');
    log('');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    rl.question('Continue anyway? (y/N): ', (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'y') {
        startServers();
      } else {
        process.exit(0);
      }
    });
  } else {
    log('✅ Next.js is running!', 'green');
    startServers();
  }
}

function startServers() {
  const httpsServer = startHTTPSServer();
  const httpServer = startHTTPServer();
  setupGracefulShutdown(httpsServer, httpServer);
}

main();
