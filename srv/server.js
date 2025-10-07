const cds = require('@sap/cds');
const express = require('express');

// Bootstrap del servidor
cds.on('bootstrap', app => {
    // Middleware para parsear JSON
    app.use(express.json());
    
    // CORS para MCP
    app.use((req, res, next) => {
        const origin = req.headers.origin || '*';
        
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
        res.header('Access-Control-Allow-Credentials', 'true');
        
        // Handle preflight
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });
    
    // Request logging
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
    
    // Health check
    app.get('/health', (req, res) => {
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            service: 'SAP CAP MCP Server',
            protocol: 'HTTP'
        });
    });
});

// Cargar el adaptador MCP después de que los servicios estén listos
cds.on('served', () => {
    const mcpAdapter = require('./mcp-adapter');
    const app = cds.app;
    
    // Montar el adaptador MCP
    app.use('/api/mcp', mcpAdapter);

    console.log('═══════════════════════════════════════════════════════');
    console.log('✓ MCP HTTP Server ready');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Protocol: HTTP (no SSE)');
    console.log('Available endpoints:');
    console.log('  • MCP Root/Discovery: /api/mcp');
    console.log('  • MCP JSON-RPC:      /api/mcp (POST)');
    console.log('  • Health Check:      /api/mcp/health');
    console.log('  • Test:              /api/mcp/test');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('To configure in Claude AI:');
    console.log('  1. Settings > Add MCP Server');
    console.log('  2. Protocol: HTTP');
    console.log('  3. URL: https://mcp-server.c-7c1fc59.kyma.ondemand.com/api/mcp');
    console.log('═══════════════════════════════════════════════════════');
});

module.exports = cds.server;