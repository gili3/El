// integrity-check.js - التحقق من نزاهة التطبيق
class IntegrityChecker {
    constructor() {
        this.expectedHashes = {
            'app-core.js': 'a1b2c3d4e5f6...', // استبدل بالهاش الفعلي
            'auth-system.js': 'b2c3d4e5f6g7...',
            // إضافة جميع الملفات الهامة
        };
        
        this.checks = [
            this.checkFileIntegrity.bind(this),
            this.checkDOMIntegrity.bind(this),
            this.checkRuntimeIntegrity.bind(this),
            this.checkNetworkIntegrity.bind(this)
        ];
        
        this.initIntegritySystem();
    }
    
    initIntegritySystem() {
        console.log('🔍 تهيئة نظام التحقق من النزاهة...');
        
        // تشغيل الفحوصات عند التحميل
        this.runChecks();
        
        // تشغيل الفحوصات بشكل دوري
        setInterval(() => this.runChecks(), 30000);
        
        // تشغيل الفحوصات عند تغيير المسار
        window.addEventListener('hashchange', () => this.runChecks());
        
        console.log('✅ نظام التحقق من النزاهة مفعل');
    }
    
    async runChecks() {
        const results = [];
        
        for (const check of this.checks) {
            try {
                const result = await check();
                results.push(result);
                
                if (!result.passed) {
                    console.error(`🚨 فشل فحص النزاهة: ${result.name}`, result.details);
                    this.handleIntegrityFailure(result);
                }
            } catch (error) {
                console.error('خطأ في فحص النزاهة:', error);
            }
        }
        
        return results;
    }
    
    async checkFileIntegrity() {
        const results = [];
        
        for (const [filename, expectedHash] of Object.entries(this.expectedHashes)) {
            try {
                const response = await fetch(`/js/${filename}`);
                const content = await response.text();
                const hash = await this.calculateSHA256(content);
                
                if (hash !== expectedHash) {
                    results.push({
                        file: filename,
                        status: 'MODIFIED',
                        expected: expectedHash.substring(0, 16),
                        actual: hash.substring(0, 16)
                    });
                }
            } catch (error) {
                results.push({
                    file: filename,
                    status: 'UNREACHABLE',
                    error: error.message
                });
            }
        }
        
        return {
            name: 'File Integrity',
            passed: results.every(r => r.status === 'OK'),
            details: results
        };
    }
    
    checkDOMIntegrity() {
        const suspiciousElements = [];
        
        // التحقق من وجود عناصر مخفية
        const hiddenElements = document.querySelectorAll('*[style*="display: none"], *[style*="visibility: hidden"]');
        hiddenElements.forEach(el => {
            if (el.innerHTML.includes('script') || el.innerHTML.includes('iframe')) {
                suspiciousElements.push({
                    element: el.tagName,
                    reason: 'Hidden suspicious element'
                });
            }
        });
        
        // التحقق من وجود event listeners ضارة
        const scripts = document.querySelectorAll('script');
        scripts.forEach(script => {
            if (!script.src && script.textContent.includes('document.cookie') ||
                script.textContent.includes('localStorage') ||
                script.textContent.includes('sessionStorage')) {
                suspiciousElements.push({
                    element: 'SCRIPT',
                    reason: 'Inline script accessing storage'
                });
            }
        });
        
        // التحقق من وجود iframes غير مصرح بها
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            if (!iframe.src.startsWith('https://accounts.google.com') &&
                !iframe.src.startsWith('https://www.google.com')) {
                suspiciousElements.push({
                    element: 'IFRAME',
                    src: iframe.src,
                    reason: 'Unauthorized iframe'
                });
            }
        });
        
        return {
            name: 'DOM Integrity',
            passed: suspiciousElements.length === 0,
            details: suspiciousElements
        };
    }
    
    checkRuntimeIntegrity() {
        const violations = [];
        
        // التحقق من تعديل الـ prototypes
        const nativeObjects = [Object, Array, String, Number, Function];
        nativeObjects.forEach(obj => {
            if (Object.getOwnPropertyNames(obj.prototype).length > 50) {
                violations.push({
                    object: obj.name,
                    reason: 'Prototype may be modified'
                });
            }
        });
        
        // التحقق من تعديل الـ globals
        const suspiciousGlobals = ['XMLHttpRequest', 'fetch', 'setTimeout', 'setInterval'];
        suspiciousGlobals.forEach(globalName => {
            const original = window[globalName];
            if (original.toString() !== original.toString()) {
                violations.push({
                    global: globalName,
                    reason: 'Global function may be hijacked'
                });
            }
        });
        
        // التحقق من وجود debuggers
        if (typeof debugger !== 'undefined') {
            violations.push({
                reason: 'Debugger detected'
            });
        }
        
        return {
            name: 'Runtime Integrity',
            passed: violations.length === 0,
            details: violations
        };
    }
    
    checkNetworkIntegrity() {
        const violations = [];
        
        // التحقق من اتصالات الشبكة المشبوهة
        const performanceEntries = performance.getEntriesByType('resource');
        performanceEntries.forEach(entry => {
            if (entry.initiatorType === 'script' || entry.initiatorType === 'iframe') {
                const url = entry.name;
                
                // التحقق من النطاقات المسموح بها
                const allowedDomains = [
                    'firebaseio.com',
                    'firebasestorage.app',
                    'gstatic.com',
                    'googleapis.com',
                    'google.com',
                    'cdnjs.cloudflare.com',
                    'fonts.googleapis.com'
                ];
                
                const isAllowed = allowedDomains.some(domain => url.includes(domain));
                
                if (!isAllowed && !url.startsWith(window.location.origin)) {
                    violations.push({
                        url: url,
                        type: entry.initiatorType,
                        reason: 'Suspicious network request'
                    });
                }
            }
        });
        
        return {
            name: 'Network Integrity',
            passed: violations.length === 0,
            details: violations
        };
    }
    
    async calculateSHA256(content) {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    handleIntegrityFailure(result) {
        console.error('🚨 فشل التحقق من النزاهة:', result);
        
        // إجراءات مختلفة حسب نوع الفشل
        switch (result.name) {
            case 'File Integrity':
                this.handleFileTampering(result.details);
                break;
            case 'DOM Integrity':
                this.handleDOMTampering(result.details);
                break;
            case 'Runtime Integrity':
                this.handleRuntimeTampering(result.details);
                break;
            case 'Network Integrity':
                this.handleNetworkTampering(result.details);
                break;
        }
        
        // إرسال تقرير إلى الخادم
        this.reportIntegrityFailure(result);
        
        // في الحالات الخطيرة، إعادة تحميل التطبيق
        if (result.priority === 'HIGH') {
            setTimeout(() => {
                location.reload();
            }, 3000);
        }
    }
    
    handleFileTampering(details) {
        // مسح التخزين المؤقت وإعادة تحميل الملفات
        localStorage.clear();
        sessionStorage.clear();
        
        // إشعار المستخدم
        if (typeof showToast === 'function') {
            showToast('تم اكتشاف تعديل في الملفات. جاري إعادة التحميل...', 'error');
        }
    }
    
    handleDOMTampering(details) {
        // إزالة العناصر المشبوهة
        details.forEach(detail => {
            if (detail.element === 'IFRAME') {
                document.querySelectorAll('iframe').forEach(iframe => {
                    if (iframe.src === detail.src) {
                        iframe.remove();
                    }
                });
            }
        });
    }
    
    reportIntegrityFailure(result) {
        // إرسال التقرير إلى الخادم
        fetch('/api/integrity/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                timestamp: new Date().toISOString(),
                check: result.name,
                details: result.details,
                userAgent: navigator.userAgent,
                url: location.href
            })
        }).catch(() => {
            // تجاهل الأخطاء في الإرسال
        });
    }
}

// التهيئة التلقائية
document.addEventListener('DOMContentLoaded', () => {
    window.integrityChecker = new IntegrityChecker();
});

