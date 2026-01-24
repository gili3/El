// security-config.js - إعدادات الأمان المركزية
const SECURITY_CONFIG = {
    // إعدادات عامة
    ENVIRONMENT: 'production',
    SECURITY_LEVEL: 'maximum',
    
    // CSP إعدادات
    CSP: {
        enabled: true,
        reportOnly: false,
        reportURI: '/api/csp/reports'
    },
    
    // Rate Limiting إعدادات
    RATE_LIMITING: {
        enabled: true,
        windowMs: 60000,
        maxRequests: 100,
        skipSuccessfulRequests: false
    },
    
    // إعدادات التشفير
    ENCRYPTION: {
        algorithm: 'AES-GCM-256',
        keyRotationDays: 30,
        encryptLocalStorage: true,
        encryptSessionStorage: true
    },
    
    // إعدادات Firebase
    FIREBASE: {
        maxDocumentSize: 102400, // 100KB
        allowedFields: ['name', 'email', 'phone', 'address', 'price', 'quantity'],
        blockedCollections: ['admin_secrets', 'config_secrets']
    },
    
    // إعدادات الملفات
    FILES: {
        maxUploadSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        scanForViruses: true
    },
    
    // إعدادات المصادقة
    AUTHENTICATION: {
        minPasswordLength: 8,
        requireComplexPassword: true,
        maxLoginAttempts: 5,
        lockoutMinutes: 15,
        sessionTimeout: 120, // دقيقة
        require2FA: false
    },
    
    // إعدادات المراقبة
    MONITORING: {
        logSecurityEvents: true,
        logToServer: true,
        realtimeAlerts: true,
        autoBlockSuspicious: true
    },
    
    // القوائم السوداء/البيضاء
    BLACKLIST: {
        IPs: [],
        userAgents: [],
        countries: []
    },
    
    WHITELIST: {
        IPs: [],
        domains: [
            'firebaseio.com',
            'firebasestorage.app',
            'googleapis.com',
            'gstatic.com'
        ]
    },
    
    // إعدادات الـ Headers
    SECURITY_HEADERS: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    },
    
    // إعدادات التحديث
    AUTO_UPDATE: {
        checkForUpdates: true,
        updateInterval: 3600000, // كل ساعة
        forceUpdateOnTamper: true
    }
};

// التصدير للاستخدام
window.SECURITY_CONFIG = SECURITY_CONFIG;

// التحقق من البيئة
function checkEnvironment() {
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        SECURITY_CONFIG.ENVIRONMENT = 'development';
        SECURITY_CONFIG.SECURITY_LEVEL = 'medium';
        console.log('⚙️ وضع التطوير: تم تخفيف إجراءات الأمان');
    }
    
    if (hostname.includes('test') || hostname.includes('staging')) {
        SECURITY_CONFIG.ENVIRONMENT = 'staging';
        SECURITY_CONFIG.SECURITY_LEVEL = 'high';
    }
}

// تحميل الإعدادات عند بدء التشغيل
document.addEventListener('DOMContentLoaded', () => {
    checkEnvironment();
    console.log('🔐 إعدادات الأمان المحملة:', SECURITY_CONFIG.ENVIRONMENT);
});

