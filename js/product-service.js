/**
 * Product Service Module
 * Handles all product-related operations
 */

const ProductService = (function() {
    'use strict';
    
    // Private variables
    let productsCache = null;
    let lastFetchTime = 0;
    let unsubscribeProducts = null;
    
    /**
     * Initialize product service
     */
    function init() {
        console.log('📦 تهيئة خدمة المنتجات...');
        // Real-time updates will be set up when needed
    }
    
    /**
     * Get all products with filters
     */
    async function getProducts(filters = {}, page = 1, pageSize = AppConstants.PRODUCTS_PER_PAGE) {
        try {
            const queryConstraints = [];
            
            // Apply filters
            if (filters.category) {
                queryConstraints.push(
                    window.firebaseModules.where('category', '==', filters.category)
                );
            }
            
            if (filters.status === 'active') {
                queryConstraints.push(
                    window.firebaseModules.where('isActive', '==', true)
                );
            } else if (filters.status === 'inactive') {
                queryConstraints.push(
                    window.firebaseModules.where('isActive', '==', false)
                );
            }
            
            if (filters.search) {
                // Note: Firestore doesn't support full-text search natively
                // This is a simple implementation - consider using Algolia or similar for production
                queryConstraints.push(
                    window.firebaseModules.where('name', '>=', filters.search),
                    window.firebaseModules.where('name', '<=', filters.search + '\uf8ff')
                );
            }
            
            // Apply sorting
            if (filters.sort) {
                switch (filters.sort) {
                    case 'newest':
                        queryConstraints.push(
                            window.firebaseModules.orderBy('createdAt', 'desc')
                        );
                        break;
                    case 'oldest':
                        queryConstraints.push(
                            window.firebaseModules.orderBy('createdAt', 'asc')
                        );
                        break;
                    case 'price-high':
                        queryConstraints.push(
                            window.firebaseModules.orderBy('price', 'desc')
                        );
                        break;
                    case 'price-low':
                        queryConstraints.push(
                            window.firebaseModules.orderBy('price', 'asc')
                        );
                        break;
                    case 'name':
                        queryConstraints.push(
                            window.firebaseModules.orderBy('name', 'asc')
                        );
                        break;
                }
            } else {
                // Default sort by creation date
                queryConstraints.push(
                    window.firebaseModules.orderBy('createdAt', 'desc')
                );
            }
            
            // Get all products first (for pagination on client side)
            // Note: For large datasets, use server-side pagination with startAfter
            const snapshot = await FirebaseService.getDocs('products', queryConstraints);
            
            const allProducts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Apply client-side pagination
            const total = allProducts.length;
            const totalPages = Math.ceil(total / pageSize);
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const products = allProducts.slice(startIndex, endIndex);
            
            return {
                products,
                pagination: {
                    currentPage: page,
                    totalPages,
                    total,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            };
            
        } catch (error) {
            console.error('❌ خطأ في جلب المنتجات:', error);
            throw error;
        }
    }
    
    /**
     * Get product by ID
     */
    async function getProductById(productId) {
        try {
            const doc = await FirebaseService.getDoc('products', productId);
            
            if (!doc.exists()) {
                throw new Error('المنتج غير موجود');
            }
            
            return {
                id: doc.id,
                ...doc.data()
            };
            
        } catch (error) {
            console.error(`❌ خطأ في جلب المنتج ${productId}:`, error);
            throw error;
        }
    }
    
    /**
     * Create new product
     */
    async function createProduct(productData, imageFile = null) {
        try {
            // Validate product data
            validateProductData(productData);
            
            let imageUrl = productData.image || '';
            
            // Upload image if provided
            if (imageFile) {
                const uploadResult = await FirebaseService.uploadFile(
                    imageFile,
                    'products'
                );
                imageUrl = uploadResult.url;
            }
            
            // Prepare product data
            const product = {
                name: productData.name.trim(),
                description: productData.description?.trim() || '',
                price: parseFloat(productData.price),
                category: productData.category,
                stock: parseInt(productData.stock) || 0,
                image: imageUrl,
                isActive: productData.isActive !== false,
                isNew: productData.isNew || false,
                isSale: productData.isSale || false,
                isBest: productData.isBest || false,
                sku: productData.sku || generateSKU(),
                weight: productData.weight ? parseFloat(productData.weight) : null,
                dimensions: productData.dimensions || null,
                tags: productData.tags || [],
                metaTitle: productData.metaTitle || productData.name.trim(),
                metaDescription: productData.metaDescription || productData.description?.trim() || '',
                createdAt: FirebaseService.serverTimestamp(),
                createdBy: FirebaseService.getCurrentUser()?.uid
            };
            
            // Add to Firestore
            const productId = await FirebaseService.addDoc('products', product);
            
            // Update stats
            await updateProductStats();
            
            console.log(`✅ تم إنشاء منتج جديد: ${productId}`);
            UIHelpers.showToast('تم إضافة المنتج بنجاح', 'success');
            
            return productId;
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء المنتج:', error);
            UIHelpers.showToast(`خطأ في إنشاء المنتج: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Update existing product
     */
    async function updateProduct(productId, productData, imageFile = null) {
        try {
            // Validate product data
            validateProductData(productData);
            
            // Get current product to preserve some data
            const currentProduct = await getProductById(productId);
            
            let imageUrl = productData.image || currentProduct.image;
            
            // Upload new image if provided
            if (imageFile) {
                // Delete old image if it exists and is not a default image
                if (currentProduct.image && 
                    !currentProduct.image.includes('default-product') &&
                    currentProduct.image.startsWith('https://firebasestorage')) {
                    try {
                        const oldPath = extractStoragePath(currentProduct.image);
                        if (oldPath) {
                            await FirebaseService.deleteFile(oldPath);
                        }
                    } catch (error) {
                        console.warn('⚠️ لا يمكن حذف الصورة القديمة:', error);
                    }
                }
                
                // Upload new image
                const uploadResult = await FirebaseService.uploadFile(
                    imageFile,
                    'products'
                );
                imageUrl = uploadResult.url;
            }
            
            // Prepare update data
            const updateData = {
                name: productData.name.trim(),
                description: productData.description?.trim() || '',
                price: parseFloat(productData.price),
                category: productData.category,
                stock: parseInt(productData.stock) || 0,
                image: imageUrl,
                isActive: productData.isActive !== false,
                isNew: productData.isNew || false,
                isSale: productData.isSale || false,
                isBest: productData.isBest || false,
                sku: productData.sku || currentProduct.sku,
                weight: productData.weight ? parseFloat(productData.weight) : currentProduct.weight,
                dimensions: productData.dimensions || currentProduct.dimensions,
                tags: productData.tags || currentProduct.tags || [],
                metaTitle: productData.metaTitle || productData.name.trim(),
                metaDescription: productData.metaDescription || productData.description?.trim() || '',
                updatedAt: FirebaseService.serverTimestamp(),
                updatedBy: FirebaseService.getCurrentUser()?.uid
            };
            
            // Update in Firestore
            await FirebaseService.updateDoc('products', productId, updateData);
            
            // Update stats
            await updateProductStats();
            
            console.log(`✅ تم تحديث المنتج: ${productId}`);
            UIHelpers.showToast('تم تحديث المنتج بنجاح', 'success');
            
            return true;
            
        } catch (error) {
            console.error(`❌ خطأ في تحديث المنتج ${productId}:`, error);
            UIHelpers.showToast(`خطأ في تحديث المنتج: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Delete product
     */
    async function deleteProduct(productId) {
        try {
            // Get product data first
            const product = await getProductById(productId);
            
            // Delete product image if exists
            if (product.image && 
                !product.image.includes('default-product') &&
                product.image.startsWith('https://firebasestorage')) {
                try {
                    const imagePath = extractStoragePath(product.image);
                    if (imagePath) {
                        await FirebaseService.deleteFile(imagePath);
                    }
                } catch (error) {
                    console.warn('⚠️ لا يمكن حذف صورة المنتج:', error);
                }
            }
            
            // Delete product from Firestore
            await FirebaseService.deleteDoc('products', productId);
            
            // Update stats
            await updateProductStats();
            
            console.log(`🗑️ تم حذف المنتج: ${productId}`);
            UIHelpers.showToast('تم حذف المنتج بنجاح', 'success');
            
            return true;
            
        } catch (error) {
            console.error(`❌ خطأ في حذف المنتج ${productId}:`, error);
            UIHelpers.showToast(`خطأ في حذف المنتج: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Toggle product status (active/inactive)
     */
    async function toggleProductStatus(productId, isActive) {
        try {
            await FirebaseService.updateDoc('products', productId, {
                isActive: isActive,
                updatedAt: FirebaseService.serverTimestamp(),
                updatedBy: FirebaseService.getCurrentUser()?.uid
            });
            
            console.log(`🔄 تم تغيير حالة المنتج ${productId} إلى ${isActive ? 'نشط' : 'غير نشط'}`);
            UIHelpers.showToast(`تم ${isActive ? 'تفعيل' : 'تعطيل'} المنتج`, 'success');
            
            return true;
            
        } catch (error) {
            console.error(`❌ خطأ في تغيير حالة المنتج ${productId}:`, error);
            UIHelpers.showToast(`خطأ في تغيير حالة المنتج: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Update product stock
     */
    async function updateProductStock(productId, newStock) {
        try {
            const stock = parseInt(newStock);
            if (isNaN(stock) || stock < 0) {
                throw new Error('الكمية غير صحيحة');
            }
            
            await FirebaseService.updateDoc('products', productId, {
                stock: stock,
                updatedAt: FirebaseService.serverTimestamp(),
                updatedBy: FirebaseService.getCurrentUser()?.uid
            });
            
            console.log(`📊 تم تحديث كمية المنتج ${productId} إلى ${stock}`);
            UIHelpers.showToast('تم تحديث الكمية بنجاح', 'success');
            
            return true;
            
        } catch (error) {
            console.error(`❌ خطأ في تحديث كمية المنتج ${productId}:`, error);
            UIHelpers.showToast(`خطأ في تحديث الكمية: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Bulk update products
     */
    async function bulkUpdateProducts(productIds, updates) {
        try {
            const batch = FirebaseService.createBatch();
            
            productIds.forEach(productId => {
                const productRef = window.firebaseModules.doc(
                    FirebaseService.db, 
                    'products', 
                    productId
                );
                
                batch.update(productRef, {
                    ...updates,
                    updatedAt: FirebaseService.serverTimestamp(),
                    updatedBy: FirebaseService.getCurrentUser()?.uid
                });
            });
            
            await FirebaseService.commitBatch(batch);
            
            // Invalidate cache
            FirebaseService.invalidateCache('products');
            
            console.log(`🔄 تم تحديث ${productIds.length} منتجات`);
            UIHelpers.showToast(`تم تحديث ${productIds.length} منتجات`, 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ خطأ في التحديث المجمع:', error);
            UIHelpers.showToast(`خطأ في التحديث المجمع: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Validate product data
     */
    function validateProductData(productData) {
        const errors = [];
        
        // Validate name
        if (!productData.name || productData.name.trim().length < 2) {
            errors.push('اسم المنتج يجب أن يكون على الأقل حرفين');
        }
        
        // Validate price
        const price = parseFloat(productData.price);
        if (isNaN(price) || price < AppConstants.MIN_PRODUCT_PRICE) {
            errors.push(`السعر يجب أن يكون رقم صحيح أكبر من ${AppConstants.MIN_PRODUCT_PRICE}`);
        }
        
        if (price > AppConstants.MAX_PRODUCT_PRICE) {
            errors.push(`السعر يجب أن يكون أقل من ${AppConstants.MAX_PRODUCT_PRICE}`);
        }
        
        // Validate category
        if (!productData.category || !AppConstants.PRODUCT_CATEGORIES[productData.category]) {
            errors.push('الفئة غير صحيحة');
        }
        
        // Validate stock
        const stock = parseInt(productData.stock);
        if (isNaN(stock) || stock < AppConstants.MIN_PRODUCT_STOCK) {
            errors.push(`الكمية يجب أن تكون رقم صحيح أكبر من ${AppConstants.MIN_PRODUCT_STOCK}`);
        }
        
        if (stock > AppConstants.MAX_PRODUCT_STOCK) {
            errors.push(`الكمية يجب أن تكون أقل من ${AppConstants.MAX_PRODUCT_STOCK}`);
        }
        
        // Validate image URL if provided
        if (productData.image && productData.image.trim() !== '') {
            if (!UIHelpers.validateUrl(productData.image)) {
                errors.push('رابط الصورة غير صالح');
            }
        }
        
        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
        
        return true;
    }
    
    /**
     * Generate SKU for product
     */
    function generateSKU() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 6).toUpperCase();
        return `QB-${timestamp}-${random}`;
    }
    
    /**
     * Extract storage path from URL
     */
    function extractStoragePath(imageUrl) {
        try {
            const url = new URL(imageUrl);
            const path = decodeURIComponent(url.pathname);
            // Extract path after /o/
            const match = path.match(/\/o\/(.+?)\?/);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }
    
    /**
     * Update product statistics
     */
    async function updateProductStats() {
        try {
            const snapshot = await FirebaseService.getDocs('products');
            
            const stats = {
                totalProducts: snapshot.size,
                activeProducts: snapshot.docs.filter(doc => doc.data().isActive !== false).length,
                outOfStock: snapshot.docs.filter(doc => (doc.data().stock || 0) <= 0).length,
                lastUpdated: FirebaseService.serverTimestamp()
            };
            
            await FirebaseService.setDoc('stats', 'products', stats);
            
        } catch (error) {
            console.error('❌ خطأ في تحديث إحصائيات المنتجات:', error);
        }
    }
    
    /**
     * Get product statistics
     */
    async function getProductStats() {
        try {
            const doc = await FirebaseService.getDoc('stats', 'products');
            
            if (doc.exists()) {
                return doc.data();
            }
            
            // Return default stats if not exists
            return {
                totalProducts: 0,
                activeProducts: 0,
                outOfStock: 0,
                lastUpdated: null
            };
            
        } catch (error) {
            console.error('❌ خطأ في جلب إحصائيات المنتجات:', error);
            throw error;
        }
    }
    
    /**
     * Export products to CSV
     */
    async function exportProducts(format = 'csv') {
        try {
            const snapshot = await FirebaseService.getDocs('products');
            const products = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            let content = '';
            
            if (format === 'csv') {
                // CSV header
                const headers = [
                    'ID',
                    'الاسم',
                    'الوصف',
                    'السعر',
                    'الفئة',
                    'الكمية',
                    'حالة',
                    'SKU',
                    'تاريخ الإنشاء'
                ];
                
                content = headers.join(',') + '\n';
                
                // CSV rows
                products.forEach(product => {
                    const row = [
                        product.id,
                        `"${product.name.replace(/"/g, '""')}"`,
                        `"${(product.description || '').replace(/"/g, '""')}"`,
                        product.price,
                        AppConstants.PRODUCT_CATEGORIES[product.category] || product.category,
                        product.stock || 0,
                        product.isActive !== false ? 'نشط' : 'غير نشط',
                        product.sku || '',
                        product.createdAt ? new Date(product.createdAt.seconds * 1000).toISOString() : ''
                    ];
                    
                    content += row.join(',') + '\n';
                });
            } else if (format === 'json') {
                content = JSON.stringify(products, null, 2);
            }
            
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `products_export_${timestamp}.${format}`;
            
            UIHelpers.downloadFile(content, filename, format === 'csv' ? 'text/csv' : 'application/json');
            
            console.log(`📥 تم تصدير ${products.length} منتجات إلى ${format}`);
            UIHelpers.showToast(`تم تصدير ${products.length} منتجات`, 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ خطأ في تصدير المنتجات:', error);
            UIHelpers.showToast(`خطأ في تصدير المنتجات: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Setup real-time updates for products
     */
    function setupRealtimeUpdates(callback) {
        if (unsubscribeProducts) {
            unsubscribeProducts();
        }
        
        unsubscribeProducts = FirebaseService.subscribeToCollection(
            'products',
            (snapshot) => {
                const products = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                if (callback && typeof callback === 'function') {
                    callback(products);
                }
            },
            [window.firebaseModules.orderBy('createdAt', 'desc')]
        );
        
        return unsubscribeProducts;
    }
    
    /**
     * Clean up resources
     */
    function cleanup() {
        if (unsubscribeProducts) {
            unsubscribeProducts();
            unsubscribeProducts = null;
        }
        
        productsCache = null;
        lastFetchTime = 0;
    }
    
    // Public API
    return {
        init,
        getProducts,
        getProductById,
        createProduct,
        updateProduct,
        deleteProduct,
        toggleProductStatus,
        updateProductStock,
        bulkUpdateProducts,
        getProductStats,
        exportProducts,
        setupRealtimeUpdates,
        cleanup
    };
})();

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    ProductService.init();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductService;
}

