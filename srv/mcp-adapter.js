const express = require('express');
const router = express.Router();

/**
 * Definición centralizada de herramientas
 */
function getToolsDefinition() {
    return [
        {
            name: 'search_products',
            description: 'Search and filter products by category from the SAP CAP database. Returns detailed product information including name, price, and stock availability.',
            inputSchema: {
                type: 'object',
                properties: {
                    category: {
                        type: 'string',
                        description: 'Product category to filter by. Examples: "Electronics", "Clothing", "Books", "Home"'
                    }
                },
                required: ['category']
            }
        },
        {
            name: 'create_order',
            description: 'Create a new customer order in the SAP CAP system. This tool validates stock availability, calculates the total price, creates the order record, and updates inventory levels automatically.',
            inputSchema: {
                type: 'object',
                properties: {
                    customerName: {
                        type: 'string',
                        description: 'Full name of the customer placing the order'
                    },
                    productIds: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Array of product UUIDs to include in the order. Get these IDs using search_products tool first.'
                    },
                    quantities: {
                        type: 'array',
                        items: { type: 'integer', minimum: 1 },
                        description: 'Array of quantities for each product. Must have the same length as productIds array and maintain the same order.'
                    }
                },
                required: ['customerName', 'productIds', 'quantities']
            }
        }
    ];
}

/**
 * Root endpoint - MCP Discovery
 */
router.get('/', (req, res) => {
    console.log('[MCP] Root discovery request (GET)');
    
    res.json({
        jsonrpc: '2.0',
        result: {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: {}
            },
            serverInfo: {
                name: 'cap-mcp-server',
                version: '1.0.0'
            },
            instructions: 'SAP CAP MCP Server - Use search_products to find products and create_order to place orders'
        }
    });
});

/**
 * Main MCP endpoint - Maneja todas las peticiones JSON-RPC
 */
router.post('/', async (req, res) => {
    console.log('[MCP] ============================================');
    console.log('[MCP] Request received:', JSON.stringify(req.body, null, 2));
    
    const { jsonrpc = '2.0', id, method, params } = req.body;
    
    // Validar formato JSON-RPC
    if (!method) {
        console.error('[MCP] Error: method not specified');
        return res.json({
            jsonrpc: '2.0',
            id: id || null,
            error: {
                code: -32600,
                message: 'Invalid Request: method is required'
            }
        });
    }
    
    try {
        let result;
        
        switch (method) {
            case 'initialize':
                result = handleInitialize(params);
                break;
            
            case 'initialized':
            case 'notifications/initialized':
                console.log('[MCP] Received initialized notification - Client ready');
                console.log('[MCP] ============================================');
                // Para notificaciones, responder sin ID
                return res.json({ 
                    jsonrpc: '2.0'
                });
                
            case 'notifications/cancelled':
                console.log('[MCP] Received cancelled notification');
                console.log('[MCP] ============================================');
                return res.json({
                    jsonrpc: '2.0'
                });
                
            case 'tools/list':
                console.log('[MCP] Received tools/list request from client');
                result = handleToolsList();
                console.log('[MCP] Responding with', result.tools.length, 'tools');
                break;
                
            case 'tools/call':
                result = await handleToolCall(params);
                break;
                
            case 'ping':
                result = { status: 'pong' };
                break;
                
            default:
                console.warn('[MCP] Unknown method:', method);
                return res.json({
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32601,
                        message: `Method not found: ${method}`
                    }
                });
        }
        
        console.log('[MCP] Success response for', method);
        console.log('[MCP] ============================================');
        
        res.json({
            jsonrpc: '2.0',
            id,
            result
        });
        
    } catch (error) {
        console.error('[MCP] Error processing request:', error);
        console.error('[MCP] Stack:', error.stack);
        console.log('[MCP] ============================================');
        
        res.json({
            jsonrpc: '2.0',
            id,
            error: {
                code: -32603,
                message: error.message,
                data: {
                    stack: error.stack
                }
            }
        });
    }
});

/**
 * Handler: Initialize
 * CLAVE: Usar protocolVersion '2024-11-05' y capabilities.tools sin listChanged
 */
function handleInitialize(params) {
    console.log('[MCP] Initialize request:', JSON.stringify(params, null, 2));
    
    return {
        protocolVersion: '2024-11-05',
        capabilities: {
            tools: {},
            logging: {},
            prompts: {}
        },
        serverInfo: {
            name: 'cap-mcp-server',
            version: '1.0.0'
        },
        instructions: 'SAP CAP MCP Server for product search and order creation'
    };
}

/**
 * Handler: Tools List
 */
function handleToolsList() {
    console.log('[MCP] Listing available tools');
    
    const tools = getToolsDefinition();
    
    console.log('[MCP] Tools to return:', JSON.stringify(tools.map(t => t.name)));
    
    return { 
        tools: tools
    };
}

/**
 * Handler: Tool Call
 */
async function handleToolCall(params) {
    const { name, arguments: args } = params;
    
    console.log('[MCP] Tool call:', name);
    console.log('[MCP] Arguments:', JSON.stringify(args, null, 2));
    
    const cds = require('@sap/cds');
    
    try {
        let result;
        
        switch (name) {
            case 'search_products':
                result = await searchProducts(args.category, cds);
                break;
                
            case 'create_order':
                result = await createOrder(args, cds);
                break;
                
            default:
                throw new Error(`Tool not found: ${name}`);
        }
        
        console.log('[MCP] Tool execution successful');
        
        return {
            content: [
                {
                    type: 'text',
                    text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                }
            ]
        };
        
    } catch (error) {
        console.error('[MCP] Tool execution error:', error);
        throw new Error(`Error executing ${name}: ${error.message}`);
    }
}

/**
 * Implementación: Search Products
 */
async function searchProducts(category, cds) {
    const db = await cds.connect.to('db');
    const { Products } = db.entities;
    
    console.log('[MCP] Searching products with category:', category);
    
    const products = await SELECT.from(Products).where({ category });
    
    if (products.length === 0) {
        return {
            message: `No products found in category "${category}"`,
            products: []
        };
    }
    
    return {
        message: `Found ${products.length} product(s) in category "${category}"`,
        products: products.map(p => ({
            id: p.ID,
            name: p.name,
            category: p.category,
            price: p.price,
            stock: p.stock
        }))
    };
}

/**
 * Implementación: Create Order
 */
async function createOrder(args, cds) {
    const { customerName, productIds, quantities } = args;
    const db = await cds.connect.to('db');
    const { Orders, OrderItems, Products } = db.entities;
    
    console.log('[MCP] Creating order for:', customerName);
    
    if (productIds.length !== quantities.length) {
        throw new Error('productIds and quantities arrays must have the same length');
    }
    
    const products = await SELECT.from(Products).where({ ID: { in: productIds } });
    
    if (products.length !== productIds.length) {
        throw new Error('Some products were not found');
    }
    
    for (let i = 0; i < products.length; i++) {
        const product = products.find(p => p.ID === productIds[i]);
        if (product.stock < quantities[i]) {
            throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${quantities[i]}`);
        }
    }
    
    let total = 0;
    const items = [];
    
    for (let i = 0; i < productIds.length; i++) {
        const product = products.find(p => p.ID === productIds[i]);
        const quantity = quantities[i];
        const subtotal = product.price * quantity;
        
        total += subtotal;
        items.push({
            product_ID: product.ID,
            productName: product.name,
            quantity: quantity,
            price: product.price,
            subtotal: subtotal
        });
    }
    
    const orderData = {
        customerName: customerName,
        orderDate: new Date().toISOString(),
        total: total,
        status: 'pending'
    };
    
    const order = await INSERT.into(Orders).entries(orderData);
    const orderId = order.results?.[0]?.ID || order.ID || cds.utils.uuid();
    
    const orderItems = items.map(item => ({
        ...item,
        order_ID: orderId
    }));
    
    await INSERT.into(OrderItems).entries(orderItems);
    
    for (let i = 0; i < productIds.length; i++) {
        const product = products.find(p => p.ID === productIds[i]);
        await UPDATE(Products)
            .set({ stock: product.stock - quantities[i] })
            .where({ ID: productIds[i] });
    }
    
    return {
        message: `Order created successfully for ${customerName}`,
        order: {
            id: orderId,
            customerName: customerName,
            total: total,
            items: items,
            status: 'pending'
        }
    };
}

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        protocol: 'HTTP/JSON-RPC',
        tools: getToolsDefinition().length
    });
});

/**
 * Test endpoint con instrucciones de prueba
 */
router.get('/test', (req, res) => {
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
    const host = req.get('x-forwarded-host') || req.get('host');
    const baseUrl = `${protocol}://${host}/api/mcp`;
    
    res.json({
        message: 'MCP Server Test Endpoint',
        protocol: 'HTTP with JSON-RPC 2.0',
        baseUrl: baseUrl,
        tools: getToolsDefinition(),
        testSequence: {
            step1: {
                name: 'Initialize',
                curl: `curl -X POST ${baseUrl} -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'`
            },
            step2: {
                name: 'Send initialized notification',
                curl: `curl -X POST ${baseUrl} -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'`
            },
            step3: {
                name: 'List tools',
                curl: `curl -X POST ${baseUrl} -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'`
            },
            step4: {
                name: 'Call search_products tool',
                curl: `curl -X POST ${baseUrl} -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_products","arguments":{"category":"Electronics"}}}'`
            }
        },
        claudeWebConfig: {
            protocol: 'HTTP',
            url: baseUrl,
            note: 'Add this URL in Claude AI Settings > Integrations > MCP Servers'
        }
    });
});

module.exports = router;