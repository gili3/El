// Firebase Configuration
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyB1vNmCapPK0MI4H_Q0ilO7OnOgZa02jx0",
    authDomain: "queen-beauty-b811b.firebaseapp.com",
    projectId: "queen-beauty-b811b",
    storageBucket: "queen-beauty-b811b.firebasestorage.app",
    messagingSenderId: "418964206430",
    appId: "1:418964206430:web:8c9451fc56ca7f956bd5cf"
};

// Application Constants
const AppConstants = {
    // Pagination
    PRODUCTS_PER_PAGE: 12,
    ORDERS_PER_PAGE: 10,
    USERS_PER_PAGE: 20,
    
    // Currency
    CURRENCY: 'SDG',
    CURRENCY_SYMBOL: 'ج.س',
    
    // Image Settings
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    PRODUCT_IMAGE_ASPECT_RATIO: 1, // 1:1
    
    // Order Settings
    ORDER_NUMBER_PREFIX: 'QB',
    MIN_ORDER_NUMBER: 1000,
    
    // Validation
    MIN_PRODUCT_PRICE: 0,
    MAX_PRODUCT_PRICE: 1000000,
    MIN_PRODUCT_STOCK: 0,
    MAX_PRODUCT_STOCK: 10000,
    
    // Status Codes
    STATUS: {
        SUCCESS: 'success',
        ERROR: 'error',
        WARNING: 'warning',
        INFO: 'info'
    },
    
    // Order Status
    ORDER_STATUS: {
        PENDING: 'pending',
        CONFIRMED: 'confirmed',
        PROCESSING: 'processing',
        SHIPPED: 'shipped',
        DELIVERED: 'delivered',
        CANCELLED: 'cancelled',
        REFUNDED: 'refunded'
    },
    
    ORDER_STATUS_LABELS: {
        pending: 'قيد الانتظار',
        confirmed: 'مؤكد',
        processing: 'قيد التجهيز',
        shipped: 'تم الشحن',
        delivered: 'تم التوصيل',
        cancelled: 'ملغي',
        refunded: 'مسترجع'
    },
    
    ORDER_STATUS_COLORS: {
        pending: '#fff3cd',
        confirmed: '#cce5ff',
        processing: '#d1ecf1',
        shipped: '#d4edda',
        delivered: '#d1e7dd',
        cancelled: '#f8d7da',
        refunded: '#e2e3e5'
    },
    
    // Product Categories
    PRODUCT_CATEGORIES: {
        perfume: 'عطور',
        makeup: 'مكياج',
        skincare: 'عناية بالبشرة',
        haircare: 'عناية بالشعر'
    },
    
    // User Roles
    USER_ROLES: {
        ADMIN: 'admin',
        MANAGER: 'manager',
        EDITOR: 'editor',
        VIEWER: 'viewer'
    },
    
    // Default Settings
    DEFAULT_SETTINGS: {
        storeName: 'Queen Beauty',
        storeEmail: 'info@queenbeauty.com',
        storePhone: '+249123456789',
        storeAddress: 'السودان - الخرطوم',
        storeDescription: 'متجر متخصص في بيع العطور ومستحضرات التجميل الأصلية',
        shippingCost: 15,
        freeShippingThreshold: 200,
        workingHours: 'من الأحد إلى الخميس: 9 صباحاً - 10 مساءً',
        currency: 'SDG',
        taxRate: 0,
        theme: {
            primaryColor: '#1a1a1a',
            secondaryColor: '#555555',
            accentColor: '#d4af37',
            successColor: '#2ecc71',
            warningColor: '#f39c12',
            dangerColor: '#e74c3c',
            infoColor: '#3498db'
        }
    },
    
    // Cache TTL (Time To Live) in milliseconds
    CACHE_TTL: {
        STATS: 5 * 60 * 1000, // 5 minutes
        PRODUCTS: 2 * 60 * 1000, // 2 minutes
        ORDERS: 1 * 60 * 1000, // 1 minute
        SETTINGS: 10 * 60 * 1000 // 10 minutes
    },
    
    // API Endpoints
    API_ENDPOINTS: {
        EXPORT_ORDERS: '/api/orders/export',
        EXPORT_PRODUCTS: '/api/products/export',
        BACKUP_DATA: '/api/backup'
    },
    
    // Error Messages
    ERROR_MESSAGES: {
        NETWORK_ERROR: 'خطأ في الاتصال بالخادم',
        UNAUTHORIZED: 'غير مصرح بالدخول',
        FORBIDDEN: 'ليس لديك صلاحية للقيام بهذا الإجراء',
        NOT_FOUND: 'العنصر المطلوب غير موجود',
        VALIDATION_ERROR: 'بيانات غير صحيحة',
        SERVER_ERROR: 'خطأ في الخادم',
        TIMEOUT: 'انتهت المهلة'
    },
    
    // Success Messages
    SUCCESS_MESSAGES: {
        SAVED: 'تم الحفظ بنجاح',
        UPDATED: 'تم التحديث بنجاح',
        DELETED: 'تم الحذف بنجاح',
        ADDED: 'تم الإضافة بنجاح'
    },
    
    // Date Format
    DATE_FORMAT: {
        SHORT: 'dd/MM/yyyy',
        LONG: 'dd MMMM yyyy',
        FULL: 'EEEE, dd MMMM yyyy HH:mm'
    },
    
    // Local Storage Keys
    STORAGE_KEYS: {
        AUTH_TOKEN: 'auth_token',
        USER_DATA: 'user_data',
        THEME_PREFERENCE: 'theme_preference',
        LANGUAGE: 'language'
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FIREBASE_CONFIG, AppConstants };
}
