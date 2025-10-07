#!/bin/bash

# Script de prueba para MCP Server
# Uso: ./test-mcp.sh [URL]

URL="${1:-https://mcp-server.c-7c1fc59.kyma.ondemand.com}"

echo "======================================"
echo "🧪 Probando MCP Server"
echo "🔗 URL: $URL"
echo "======================================"
echo ""

# Test 1: Health Check
echo "1️⃣  Test: Health Check"
echo "   GET $URL/health"
curl -s "$URL/health" | jq '.' || echo "❌ Error"
echo ""

# Test 2: MCP Status
echo "2️⃣  Test: MCP Status"
echo "   GET $URL/api/mcp/status"
curl -s "$URL/api/mcp/status" | jq '.' || echo "❌ Error"
echo ""

# Test 3: MCP Test Info
echo "3️⃣  Test: MCP Test Info"
echo "   GET $URL/api/mcp/test"
curl -s "$URL/api/mcp/test" | jq '.' || echo "❌ Error"
echo ""

# Test 4: SSE Endpoint (primeros 5 segundos)
echo "4️⃣  Test: SSE Endpoint (5 segundos)"
echo "   GET $URL/api/mcp/sse"
timeout 5 curl -N -s "$URL/api/mcp/sse" || echo "✅ Conexión SSE OK (timeout esperado)"
echo ""

# Test 5: Initialize
echo "5️⃣  Test: Initialize"
echo "   POST $URL/api/mcp/messages"
curl -s -X POST "$URL/api/mcp/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }' | jq '.'
echo ""

# Test 6: Tools List
echo "6️⃣  Test: Tools List"
echo "   POST $URL/api/mcp/messages"
curl -s -X POST "$URL/api/mcp/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }' | jq '.'
echo ""

# Test 7: Tool Call - Search Products
echo "7️⃣  Test: Tool Call - Search Products"
echo "   POST $URL/api/mcp/messages"
curl -s -X POST "$URL/api/mcp/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "search_products",
      "arguments": {
        "category": "Electronics"
      }
    }
  }' | jq '.'
echo ""

echo "======================================"
echo "✅ Tests completados"
echo "======================================"
echo ""
echo "📝 Para conectar con Claude.ai:"
echo "   1. Ve a claude.ai → Settings → Features"
echo "   2. Busca 'Model Context Protocol' o 'Custom Connectors'"
echo "   3. Añade: $URL/api/mcp/sse"
echo ""