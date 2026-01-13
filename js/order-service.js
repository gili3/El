/**
 * Order Service Module
 * Handles all order-related operations
 */

const OrderService = (function() {
    'use strict';
    
    // Private variables
    let unsubscribeOrders = null;
    let orderNumberCounter = 0;
    
    /**
     * Initialize order service
     */
    function init() {
        console.log('🛒 تهيئة خدمة الطلبات...');
        loadOrderNumberCounter();
    }
    
    /**
     * Load order number counter from settings
     */
    async function loadOrderNumberCounter() {
        try {
            const settings = await FirebaseService.getDoc('settings', 'order_counter');
            
            if (settings.exists()) {
                orderNumberCounter = settings.data().lastOrderNumber || 1000;
            } else {
                orderNumberCounter = 1000;
                await FirebaseService.setDoc('settings', 'order_counter', {
                    lastOrderNumber: orderNumberCounter
                });
            }
            
            console.log(`🔢 عداد أرقام الطلبات: ${orderNumberCounter}`);
            
        } catch (error) {
            console.error('❌ خطأ في تحميل عداد الطلبات:', error);
            orderNumberCounter = 1000;
        }
    }
    
    /**
     * Generate unique order number
     */
    async function generateOrderNumber() {
        try {
            // Use transaction to ensure uniqueness
            const newNumber = await FirebaseService.runTransaction(async (transaction) => {
                const counterRef = window.firebaseModules.doc(
                    FirebaseService.db,
                    'settings',
                    'order_counter'
                );
                
                const counterDoc = await transaction.get(counterRef);
                let lastNumber = 1000;
                
                if (counterDoc.exists()) {
                    lastNumber = counterDoc.data().lastOrderNumber || 1000;
                }
                
                const newNumber = lastNumber + 1;
                transaction.set(counterRef, {
                    lastOrderNumber: newNumber,
                    updatedAt: FirebaseService.serverTimestamp()
                }, { merge: true });
                
                return newNumber;
            });
            
            const orderNumber = `${AppConstants.ORDER_NUMBER_PREFIX}-${newNumber.toString().padStart(6, '0')}`;
            console.log(`🔢 رقم الطلب الجديد: ${orderNumber}`);
            
            return orderNumber;
            
        } catch (error) {
            console.error('❌ خطأ في توليد رقم الطلب:', error);
            // Fallback: timestamp-based number
            const timestamp = Date.now().toString().slice(-8);
            return `${AppConstants.ORDER_NUMBER_PREFIX}-${timestamp}`;
        }
    }
    
    /**
     * Get all orders with filters
     */
    async function getOrders(filters = {}, page = 1, pageSize = AppConstants.ORDERS_PER_PAGE) {
        try {
            const queryConstraints = [];
            
            // Apply filters
            if (filters.status && filters.status !== 'all') {
                queryConstraints.push(
                    window.firebaseModules.where('status', '==', filters.status)
                );
            }
            
            if (filters.search) {
                // Search by order number or customer name
                queryConstraints.push(
                    window.firebaseModules.where('orderNumber', '>=', filters.search),
                    window.firebaseModules.where('orderNumber', '<=', filters.search + '\uf8ff')
                );
            }
            
            if (filters.dateFrom || filters.dateTo) {
                // Note: You'll need to store dates in a queryable format
                // This is a simplified implementation
            }
            
            // Apply sorting by creation date (descending)
            queryConstraints.push(
                window.firebaseModules.orderBy('createdAt', 'desc')
            );
            
            // Get all orders first (for pagination on client side)
            const snapshot = await FirebaseService.getDocs('orders', queryConstraints);
            
            const allOrders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Apply client-side pagination
            const total = allOrders.length;
            const totalPages = Math.ceil(total / pageSize);
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const orders = allOrders.slice(startIndex, endIndex);
            
            return {
                orders,
                pagination: {
                    currentPage: page,
                    totalPages,
                    total,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            };
            
        } catch (error) {
            console.error('❌ خطأ في جلب الطلبات:', error);
            throw error;
        }
    }
    
    /**
     * Get order by ID
     */
    async function getOrderById(orderId) {
        try {
            const doc = await FirebaseService.getDoc('orders', orderId);
            
            if (!doc.exists()) {
                throw new Error('الطلب غير موجود');
            }
            
            return {
                id: doc.id,
                ...doc.data()
            };
            
        } catch (error) {
            console.error(`❌ خطأ في جلب الطلب ${orderId}:`, error);
            throw error;
        }
    }
    
    /**
     * Create new order
     */
    async function createOrder(orderData) {
        try {
            // Validate order data
            validateOrderData(orderData);
            
            // Generate order number
            const orderNumber = await generateOrderNumber();
            
            // Prepare order data
            const order = {
                orderNumber,
                customer: {
                    name: orderData.customerName.trim(),
                    email: orderData.customerEmail?.trim() || '',
                    phone: orderData.customerPhone.trim(),
                    address: orderData.customerAddress?.trim() || ''
                },
                items: orderData.items || [],
                subtotal: parseFloat(orderData.subtotal) || 0,
                shipping: parseFloat(orderData.shipping) || 0,
                discount: parseFloat(orderData.discount) || 0,
                tax: parseFloat(orderData.tax) || 0,
                total: parseFloat(orderData.total) || 0,
                paymentMethod: orderData.paymentMethod || 'cash',
                paymentStatus: orderData.paymentStatus || 'pending',
                status: AppConstants.ORDER_STATUS.PENDING,
                notes: orderData.notes?.trim() || '',
                shippingMethod: orderData.shippingMethod || 'standard',
                trackingNumber: orderData.trackingNumber || '',
                estimatedDelivery: orderData.estimatedDelivery || null,
                createdAt: FirebaseService.serverTimestamp(),
                createdBy: FirebaseService.getCurrentUser()?.uid,
                updatedAt: FirebaseService.serverTimestamp(),
                updatedBy: FirebaseService.getCurrentUser()?.uid
            };
            
            // Add to Firestore
            const orderId = await FirebaseService.addDoc('orders', order);
            
            // Update product stocks if items are provided
            if (orderData.items && orderData.items.length > 0) {
                await updateProductStocks(orderData.items);
            }
            
            // Update order statistics
            await updateOrderStats();
            
            console.log(`✅ تم إنشاء طلب جديد: ${orderId} (${orderNumber})`);
            UIHelpers.showToast('تم إنشاء الطلب بنجاح', 'success');
            
            return { orderId, orderNumber };
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء الطلب:', error);
            UIHelpers.showToast(`خطأ في إنشاء الطلب: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Update order status
     */
    async function updateOrderStatus(orderId, newStatus, notes = '') {
        try {
            // Validate status
            if (!Object.values(AppConstants.ORDER_STATUS).includes(newStatus)) {
                throw new Error('حالة الطلب غير صحيحة');
            }
            
            // Get current order
            const order = await getOrderById(orderId);
            
            // Prepare update data
            const updateData = {
                status: newStatus,
                updatedAt: FirebaseService.serverTimestamp(),
                updatedBy: FirebaseService.getCurrentUser()?.uid
            };
            
            // Add notes if provided
            if (notes.trim()) {
                updateData.statusNotes = notes.trim();
            }
            
            // Add status history
            if (!order.statusHistory) {
                order.statusHistory = [];
            }
            
            order.statusHistory.push({
                status: newStatus,
                timestamp: FirebaseService.serverTimestamp(),
                changedBy: FirebaseService.getCurrentUser()?.uid,
                notes: notes.trim() || undefined
            });
            
            updateData.statusHistory = order.statusHistory;
            
            // Update order
            await FirebaseService.updateDoc('orders', orderId, updateData);
            
            // If order is delivered, mark payment as completed
            if (newStatus === AppConstants.ORDER_STATUS.DELIVERED) {
                await FirebaseService.updateDoc('orders', orderId, {
                    paymentStatus: 'completed',
                    updatedAt: FirebaseService.serverTimestamp()
                });
            }
            
            // Update order statistics
            await updateOrderStats();
            
            console.log(`🔄 تم تحديث حالة الطلب ${orderId} إلى ${newStatus}`);
            UIHelpers.showToast('تم تحديث حالة الطلب بنجاح', 'success');
            
            return true;
            
        } catch (error) {
            console.error(`❌ خطأ في تحديث حالة الطلب ${orderId}:`, error);
            UIHelpers.showToast(`خطأ في تحديث حالة الطلب: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Update order
     */
    async function updateOrder(orderId, orderData) {
        try {
            // Validate order data
            validateOrderData(orderData);
            
            // Prepare update data
            const updateData = {
                customer: {
                    name: orderData.customerName.trim(),
                    email: orderData.customerEmail?.trim() || '',
                    phone: orderData.customerPhone.trim(),
                    address: orderData.customerAddress?.trim() || ''
                },
                items: orderData.items || [],
                subtotal: parseFloat(orderData.subtotal) || 0,
                shipping: parseFloat(orderData.shipping) || 0,
                discount: parseFloat(orderData.discount) || 0,
                tax: parseFloat(orderData.tax) || 0,
                total: parseFloat(orderData.total) || 0,
                paymentMethod: orderData.paymentMethod || 'cash',
                paymentStatus: orderData.paymentStatus || 'pending',
                notes: orderData.notes?.trim() || '',
                shippingMethod: orderData.shippingMethod || 'standard',
                trackingNumber: orderData.trackingNumber || '',
                estimatedDelivery: orderData.estimatedDelivery || null,
                updatedAt: FirebaseService.serverTimestamp(),
                updatedBy: FirebaseService.getCurrentUser()?.uid
            };
            
            // Update order
            await FirebaseService.updateDoc('orders', orderId, updateData);
            
            // Update product stocks if items changed
            if (orderData.items && orderData.items.length > 0) {
                await updateProductStocks(orderData.items);
            }
            
            console.log(`✅ تم تحديث الطلب: ${orderId}`);
            UIHelpers.showToast('تم تحديث الطلب بنجاح', 'success');
            
            return true;
            
        } catch (error) {
            console.error(`❌ خطأ في تحديث الطلب ${orderId}:`, error);
            UIHelpers.showToast(`خطأ في تحديث الطلب: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Delete order
     */
    async function deleteOrder(orderId) {
        try {
            // Get order data first
            const order = await getOrderById(orderId);
            
            // Restore product stocks if order was confirmed
            if (order.status !== AppConstants.ORDER_STATUS.CANCELLED && 
                order.items && order.items.length > 0) {
                await restoreProductStocks(order.items);
            }
            
            // Delete order from Firestore
            await FirebaseService.deleteDoc('orders', orderId);
            
            // Update order statistics
            await updateOrderStats();
            
            console.log(`🗑️ تم حذف الطلب: ${orderId}`);
            UIHelpers.showToast('تم حذف الطلب بنجاح', 'success');
            
            return true;
            
        } catch (error) {
            console.error(`❌ خطأ في حذف الطلب ${orderId}:`, error);
            UIHelpers.showToast(`خطأ في حذف الطلب: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Cancel order
     */
    async function cancelOrder(orderId, reason = '') {
        try {
            // Get order data first
            const order = await getOrderById(orderId);
            
            // Check if order can be cancelled
            if (order.status === AppConstants.ORDER_STATUS.DELIVERED) {
                throw new Error('لا يمكن إلغاء طلب تم توصيله');
            }
            
            if (order.status === AppConstants.ORDER_STATUS.CANCELLED) {
                throw new Error('الطلب ملغي بالفعل');
            }
            
            // Restore product stocks
            if (order.items && order.items.length > 0) {
                await restoreProductStocks(order.items);
            }
            
            // Update order status to cancelled
            await updateOrderStatus(
                orderId, 
                AppConstants.ORDER_STATUS.CANCELLED,
                reason || 'تم الإلغاء من قبل المسؤول'
            );
            
            // Update payment status
            await FirebaseService.updateDoc('orders', orderId, {
                paymentStatus: 'refunded',
                updatedAt: FirebaseService.serverTimestamp()
            });
            
            console.log(`❌ تم إلغاء الطلب: ${orderId}`);
            UIHelpers.showToast('تم إلغاء الطلب بنجاح', 'success');
            
            return true;
            
        } catch (error) {
            console.error(`❌ خطأ في إلغاء الطلب ${orderId}:`, error);
            UIHelpers.showToast(`خطأ في إلغاء الطلب: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Update product stocks when order is created
     */
    async function updateProductStocks(items) {
        try {
            const batch = FirebaseService.createBatch();
            
            for (const item of items) {
                if (item.productId && item.quantity) {
                    const productRef = window.firebaseModules.doc(
                        FirebaseService.db,
                        'products',
                        item.productId
                    );
                    
                    // Decrement stock
                    batch.update(productRef, {
                        stock: FirebaseService.increment(-item.quantity),
                        updatedAt: FirebaseService.serverTimestamp()
                    });
                }
            }
            
            await FirebaseService.commitBatch(batch);
            
            console.log(`📊 تم تحديث مخزون ${items.length} منتجات`);
            
        } catch (error) {
            console.error('❌ خطأ في تحديث المخزون:', error);
            throw error;
        }
    }
    
    /**
     * Restore product stocks when order is cancelled
     */
    async function restoreProductStocks(items) {
        try {
            const batch = FirebaseService.createBatch();
            
            for (const item of items) {
                if (item.productId && item.quantity) {
                    const productRef = window.firebaseModules.doc(
                        FirebaseService.db,
                        'products',
                        item.productId
                    );
                    
                    // Increment stock
                    batch.update(productRef, {
                        stock: FirebaseService.increment(item.quantity),
                        updatedAt: FirebaseService.serverTimestamp()
                    });
                }
            }
            
            await FirebaseService.commitBatch(batch);
            
            console.log(`📊 تم استعادة مخزون ${items.length} منتجات`);
            
        } catch (error) {
            console.error('❌ خطأ في استعادة المخزون:', error);
            throw error;
        }
    }
    
    /**
     * Validate order data
     */
    function validateOrderData(orderData) {
        const errors = [];
        
        // Validate customer name
        if (!orderData.customerName || orderData.customerName.trim().length < 2) {
            errors.push('اسم العميل يجب أن يكون على الأقل حرفين');
        }
        
        // Validate customer phone
        if (!orderData.customerPhone || !UIHelpers.validatePhone(orderData.customerPhone)) {
            errors.push('رقم الهاتف غير صالح');
        }
        
        // Validate items
        if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
            errors.push('يجب إضافة منتجات على الأقل');
        }
        
        // Validate total
        const total = parseFloat(orderData.total);
        if (isNaN(total) || total <= 0) {
            errors.push('المبلغ الإجمالي غير صالح');
        }
        
        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
        
        return true;
    }
    
    /**
     * Update order statistics
     */
    async function updateOrderStats() {
        try {
            const snapshot = await FirebaseService.getDocs('orders');
            
            const orders = snapshot.docs.map(doc => doc.data());
            
            const stats = {
                totalOrders: orders.length,
                pendingOrders: orders.filter(o => o.status === AppConstants.ORDER_STATUS.PENDING).length,
                completedOrders: orders.filter(o => o.status === AppConstants.ORDER_STATUS.DELIVERED).length,
                cancelledOrders: orders.filter(o => o.status === AppConstants.ORDER_STATUS.CANCELLED).length,
                totalRevenue: orders
                    .filter(o => o.status === AppConstants.ORDER_STATUS.DELIVERED)
                    .reduce((sum, order) => sum + (order.total || 0), 0),
                averageOrderValue: 0,
                lastUpdated: FirebaseService.serverTimestamp()
            };
            
            // Calculate average order value
            if (stats.completedOrders > 0) {
                stats.averageOrderValue = stats.totalRevenue / stats.completedOrders;
            }
            
            await FirebaseService.setDoc('stats', 'orders', stats);
            
        } catch (error) {
            console.error('❌ خطأ في تحديث إحصائيات الطلبات:', error);
        }
    }
    
    /**
     * Get order statistics
     */
    async function getOrderStats() {
        try {
            const doc = await FirebaseService.getDoc('stats', 'orders');
            
            if (doc.exists()) {
                return doc.data();
            }
            
            // Return default stats if not exists
            return {
                totalOrders: 0,
                pendingOrders: 0,
                completedOrders: 0,
                cancelledOrders: 0,
                totalRevenue: 0,
                averageOrderValue: 0,
                lastUpdated: null
            };
            
        } catch (error) {
            console.error('❌ خطأ في جلب إحصائيات الطلبات:', error);
            throw error;
        }
    }
    
    /**
     * Export orders to CSV
     */
    async function exportOrders(format = 'csv', filters = {}) {
        try {
            const { orders } = await getOrders(filters, 1, 10000); // Get all orders
            
            let content = '';
            
            if (format === 'csv') {
                // CSV header
                const headers = [
                    'رقم الطلب',
                    'اسم العميل',
                    'الهاتف',
                    'البريد الإلكتروني',
                    'العنوان',
                    'المنتجات',
                    'المجموع',
                    'حالة الطلب',
                    'طريقة الدفع',
                    'حالة الدفع',
                    'تاريخ الإنشاء',
                    'ملاحظات'
                ];
                
                content = headers.join(',') + '\n';
                
                // CSV rows
                orders.forEach(order => {
                    const products = order.items?.map(item => 
                        `${item.name} × ${item.quantity}`
                    ).join('; ') || '';
                    
                    const row = [
                        order.orderNumber,
                        `"${order.customer?.name?.replace(/"/g, '""') || ''}"`,
                        order.customer?.phone || '',
                        order.customer?.email || '',
                        `"${order.customer?.address?.replace(/"/g, '""') || ''}"`,
                        `"${products.replace(/"/g, '""')}"`,
                        order.total || 0,
                        AppConstants.ORDER_STATUS_LABELS[order.status] || order.status,
                        order.paymentMethod || '',
                        order.paymentStatus || '',
                        order.createdAt ? new Date(order.createdAt.seconds * 1000).toISOString() : '',
                        `"${(order.notes || '').replace(/"/g, '""')}"`
                    ];
                    
                    content += row.join(',') + '\n';
                });
            } else if (format === 'json') {
                content = JSON.stringify(orders, null, 2);
            }
            
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `orders_export_${timestamp}.${format}`;
            
            UIHelpers.downloadFile(content, filename, format === 'csv' ? 'text/csv' : 'application/json');
            
            console.log(`📥 تم تصدير ${orders.length} طلبات إلى ${format}`);
            UIHelpers.showToast(`تم تصدير ${orders.length} طلبات`, 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ خطأ في تصدير الطلبات:', error);
            UIHelpers.showToast(`خطأ في تصدير الطلبات: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Print order invoice
     */
    async function printOrderInvoice(orderId) {
        try {
            const order = await getOrderById(orderId);
            
            // Create print window
            const printWindow = window.open('', '_blank');
            
            // Generate HTML for invoice
            const invoiceHtml = `
                <!DOCTYPE html>
                <html dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>فاتورة طلب ${order.orderNumber}</title>
                    <style>
                        body { font-family: 'Cairo', Arial, sans-serif; padding: 20px; }
                        .invoice { max-width: 800px; margin: 0 auto; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                        .items { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                        .items th, .items td { border: 1px solid #ddd; padding: 10px; text-align: right; }
                        .items th { background: #f5f5f5; }
                        .total { text-align: left; font-size: 18px; font-weight: bold; }
                        @media print {
                            body { padding: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="invoice">
                        <div class="header">
                            <h1>فاتورة طلب</h1>
                            <h2>${order.orderNumber}</h2>
                        </div>
                        
                        <div class="details">
                            <div>
                                <h3>معلومات العميل</h3>
                                <p><strong>الاسم:</strong> ${order.customer?.name}</p>
                                <p><strong>الهاتف:</strong> ${order.customer?.phone}</p>
                                <p><strong>البريد:</strong> ${order.customer?.email || 'غير محدد'}</p>
                                <p><strong>العنوان:</strong> ${order.customer?.address || 'غير محدد'}</p>
                            </div>
                            <div>
                                <h3>معلومات الطلب</h3>
                                <p><strong>التاريخ:</strong> ${UIHelpers.formatDate(order.createdAt)}</p>
                                <p><strong>الحالة:</strong> ${AppConstants.ORDER_STATUS_LABELS[order.status]}</p>
                                <p><strong>طريقة الدفع:</strong> ${order.paymentMethod}</p>
                                <p><strong>حالة الدفع:</strong> ${order.paymentStatus}</p>
                            </div>
                        </div>
                        
                        <table class="items">
                            <thead>
                                <tr>
                                    <th>المنتج</th>
                                    <th>الكمية</th>
                                    <th>السعر</th>
                                    <th>المجموع</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.items?.map(item => `
                                    <tr>
                                        <td>${item.name}</td>
                                        <td>${item.quantity}</td>
                                        <td>${UIHelpers.formatPrice(item.price)}</td>
                                        <td>${UIHelpers.formatPrice(item.price * item.quantity)}</td>
                                    </tr>
                                `).join('') || ''}
                            </tbody>
                        </table>
                        
                        <div class="total">
                            <p>المجموع: ${UIHelpers.formatPrice(order.subtotal || 0)}</p>
                            ${order.shipping ? `<p>الشحن: ${UIHelpers.formatPrice(order.shipping)}</p>` : ''}
                            ${order.discount ? `<p>الخصم: ${UIHelpers.formatPrice(-order.discount)}</p>` : ''}
                            ${order.tax ? `<p>الضريبة: ${UIHelpers.formatPrice(order.tax)}</p>` : ''}
                            <p style="font-size: 20px;">الإجمالي: ${UIHelpers.formatPrice(order.total)}</p>
                        </div>
                        
                        ${order.notes ? `
                        <div style="margin-top: 30px;">
                            <h3>ملاحظات</h3>
                            <p>${order.notes}</p>
                        </div>
                        ` : ''}
                        
                        <div class="no-print" style="margin-top: 30px; text-align: center;">
                            <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                طباعة الفاتورة
                            </button>
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            printWindow.document.write(invoiceHtml);
            printWindow.document.close();
            
            console.log(`🖨️ تم إنشاء فاتورة للطلب: ${orderId}`);
            
        } catch (error) {
            console.error(`❌ خطأ في إنشاء فاتورة للطلب ${orderId}:`, error);
            UIHelpers.showToast(`خطأ في إنشاء الفاتورة: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Setup real-time updates for orders
     */
    function setupRealtimeUpdates(callback) {
        if (unsubscribeOrders) {
            unsubscribeOrders();
        }
        
        unsubscribeOrders = FirebaseService.subscribeToCollection(
            'orders',
            (snapshot) => {
                const orders = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                if (callback && typeof callback === 'function') {
                    callback(orders);
                }
            },
            [window.firebaseModules.orderBy('createdAt', 'desc')]
        );
        
        return unsubscribeOrders;
    }
    
    /**
     * Clean up resources
     */
    function cleanup() {
        if (unsubscribeOrders) {
            unsubscribeOrders();
            unsubscribeOrders = null;
        }
    }
    
    // Public API
    return {
        init,
        getOrders,
        getOrderById,
        createOrder,
        updateOrder,
        updateOrderStatus,
        deleteOrder,
        cancelOrder,
        getOrderStats,
        exportOrders,
        printOrderInvoice,
        setupRealtimeUpdates,
        cleanup
    };
})();

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    OrderService.init();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OrderService;
}

