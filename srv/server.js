const cds = require('@sap/cds');
const express = require('express');

// Bootstrap del servidor
cds.on('bootstrap', app => {
    // Middleware para parsear JSON
    app.use(express.json());
    
    // CORS para permitir llamadas desde Claude
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });
    
    // Health check
    app.get('/health', (req, res) => {
        res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });
});

// Cargar el adaptador MCP después de que los servicios estén listos
cds.on('served', () => {
    const mcpAdapter = require('./mcp-adapter');
    const app = cds.app;
    
    // Montar el adaptador MCP
    app.use('/api/mcp', mcpAdapter);
    
    console.log('[mcp] - MCP adapter mounted at /api/mcp');
});

module.exports = cds.server;