const express = require('express');
const cds = require('@sap/cds');

const router = express.Router();

// MCP Server Info
router.get('/info', (req, res) => {
    res.json({
        name: "SAP CAP MCP Server",
        version: "1.0.0",
        description: "MCP Server for product and order management",
        protocol_version: "1.0"
    });
});

// List available tools (MCP format)
router.get('/tools', (req, res) => {
    res.json({
        tools: [
            {
                name: "search_products",
                description: "Search products by category. Returns a list of products matching the category.",
                inputSchema: {
                    type: "object",
                    properties: {
                        category: {
                            type: "string",
                            description: "Product category to search for (e.g., 'Electronics', 'Clothing')"
                        }
                    },
                    required: ["category"]
                }
            },
            {
                name: "create_order",
                description: "Create a new order for a customer. Calculates total and updates inventory.",
                inputSchema: {
                    type: "object",
                    properties: {
                        customerName: {
                            type: "string",
                            description: "Name of the customer placing the order"
                        },
                        productIds: {
                            type: "array",
                            items: { type: "string" },
                            description: "Array of product UUIDs to order"
                        },
                        quantities: {
                            type: "array",
                            items: { type: "integer" },
                            description: "Array of quantities for each product (same order as productIds)"
                        }
                    },
                    required: ["customerName", "productIds", "quantities"]
                }
            }
        ]
    });
});

// Execute tool (MCP format)
router.post('/tools/execute', async (req, res) => {
    try {
        const { name, arguments: args } = req.body;
        
        // Acceder directamente a las entidades
        const { Products, Orders } = cds.entities('mcp.server');
        const db = await cds.connect.to('db');
        
        let result;
        
        switch(name) {
            case 'search_products': {
                const { category } = args;
                
                if (!category) {
                    return res.status(400).json({
                        error: 'Category parameter is required'
                    });
                }
                
                result = await db.run(
                    SELECT.from(Products)
                        .where`category like ${`%${category}%`}`
                        .columns('ID', 'name', 'price', 'stock')
                );
                break;
            }
                
            case 'create_order': {
                const { customerName, productIds, quantities } = args;
                
                if (!customerName || !productIds || !quantities) {
                    return res.status(400).json({
                        error: 'Missing required parameters'
                    });
                }
                
                if (productIds.length !== quantities.length) {
                    return res.status(400).json({
                        error: 'Product IDs and quantities must have the same length'
                    });
                }
                
                // Calcular total y verificar stock
                let totalAmount = 0;
                const updates = [];
                
                for (let i = 0; i < productIds.length; i++) {
                    const [product] = await db.run(
                        SELECT.from(Products).where({ ID: productIds[i] })
                    );
                    
                    if (!product) {
                        return res.status(404).json({
                            error: `Product with ID ${productIds[i]} not found`
                        });
                    }
                    
                    if (product.stock < quantities[i]) {
                        return res.status(400).json({
                            error: `Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${quantities[i]}`
                        });
                    }
                    
                    totalAmount += product.price * quantities[i];
                    updates.push({
                        id: productIds[i],
                        newStock: product.stock - quantities[i]
                    });
                }
                
                // Crear orden
                const orderId = cds.utils.uuid();
                await db.run(
                    INSERT.into(Orders).entries({
                        ID: orderId,
                        orderDate: new Date().toISOString(),
                        customerName: customerName,
                        totalAmount: totalAmount,
                        status: 'CONFIRMED'
                    })
                );
                
                // Actualizar stock
                for (const update of updates) {
                    await db.run(
                        UPDATE(Products)
                            .set({ stock: update.newStock })
                            .where({ ID: update.id })
                    );
                }
                
                result = {
                    orderId: orderId,
                    totalAmount: totalAmount,
                    status: 'CONFIRMED',
                    message: `Order created successfully for ${customerName}`
                };
                break;
            }
                
            default:
                return res.status(400).json({
                    error: `Unknown tool: ${name}`
                });
        }
        
        res.json({
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result, null, 2)
                }
            ]
        });
        
    } catch (error) {
        console.error('Error executing tool:', error);
        res.status(500).json({
            error: error.message,
            details: error.stack
        });
    }
});

module.exports = router;