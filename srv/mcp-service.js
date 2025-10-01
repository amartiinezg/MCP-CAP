const cds = require('@sap/cds');

module.exports = cds.service.impl(async function() {
    const { Products, Orders } = this.entities;
    
    // Tool 1: Buscar productos por categoría
    this.on('searchProductsByCategory', async (req) => {
        const { category } = req.data;
        
        if (!category) {
            req.error(400, 'Category parameter is required');
        }
        
        const products = await SELECT.from(Products)
            .where({ category: { like: `%${category}%` } })
            .columns('ID', 'name', 'price', 'stock');
        
        return products;
    });
    
    // Tool 2: Crear orden
    this.on('createOrder', async (req) => {
        const { customerName, productIds, quantities } = req.data;
        
        if (!customerName || !productIds || !quantities) {
            req.error(400, 'Missing required parameters');
        }
        
        if (productIds.length !== quantities.length) {
            req.error(400, 'Product IDs and quantities must have the same length');
        }
        
        // Calcular total y verificar stock
        let totalAmount = 0;
        const updates = [];
        
        for (let i = 0; i < productIds.length; i++) {
            const product = await SELECT.one.from(Products)
                .where({ ID: productIds[i] });
            
            if (!product) {
                req.error(404, `Product with ID ${productIds[i]} not found`);
            }
            
            if (product.stock < quantities[i]) {
                req.error(400, `Insufficient stock for product ${product.name}`);
            }
            
            totalAmount += product.price * quantities[i];
            updates.push({
                id: productIds[i],
                newStock: product.stock - quantities[i]
            });
        }
        
        // Crear orden
        const orderId = cds.utils.uuid();
        await INSERT.into(Orders).entries({
            ID: orderId,
            orderDate: new Date().toISOString(),
            customerName: customerName,
            totalAmount: totalAmount,
            status: 'CONFIRMED'
        });
        
        // Actualizar stock
        for (const update of updates) {
            await UPDATE(Products)
                .set({ stock: update.newStock })
                .where({ ID: update.id });
        }
        
        return {
            orderId: orderId,
            totalAmount: totalAmount,
            status: 'CONFIRMED',
            message: `Order created successfully for ${customerName}`
        };
    });
    
    // Función: Obtener estadísticas
    this.on('getInventoryStats', async (req) => {
        const allProducts = await SELECT.from(Products);
        
        const lowStockThreshold = 10;
        const lowStock = allProducts.filter(p => p.stock < lowStockThreshold);
        
        const totalValue = allProducts.reduce((sum, p) => 
            sum + (p.price * p.stock), 0
        );
        
        const categories = [...new Set(allProducts.map(p => p.category))];
        
        return {
            totalProducts: allProducts.length,
            lowStockProducts: lowStock.length,
            totalValue: totalValue,
            categories: categories
        };
    });
});