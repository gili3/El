// security-system.js - النظام الأمني الشامل
// ======================== طبقات الحماية المتعددة ========================

class SecuritySystem {
    constructor() {
        this.securityLevel = 'maximum';
        this.blockedIPs = new Set();
        this.suspiciousActivities = new Map();
        this.corsWhitelist = ['https://eleven-sd.com', 'https://admin.eleven-sd.com'];
        this.rateLimitWindow = 60000; // 1 دقيقة
        this.rateLimitMax = 100; // 100 طلب لكل دقيقة
        this.requestHistory = new Map();
        
        this.initSecurity();
    }
    
    initSecurity() {
        console.log('🛡️  تهيئة النظام الأمني الشامل...');
        
        // حماية ضد XSS
        this.setupXSSChecker();
        
        // حماية ضد CSRF
        this.setupCSRFProtection();
        
        // حماية ضد SQL Injection (للـ Firestore)
        this.setupInjectionProtection();
        
        // حماية ضد Clickjacking
        this.setupClickjackingProtection();
        
        // حماية ضد Brute Force
        this.setupBruteForceProtection();
        
        // مراقبة في الوقت الحقيقي
        this.startRealtimeMonitoring();
        
        // تفعيل HSTS
        this.enforceHSTS();
        
        console.log('✅ النظام الأمني الشامل مفعل');
    }
    
    // ======================== حماية ضد XSS ========================
    
    setupXSSChecker() {
        // منع تنفيذ JavaScript في المدخلات
        document.addEventListener('DOMContentLoaded', () => {
            const sanitizeInputs = () => {
                document.querySelectorAll('input, textarea, select').forEach(element => {
                    if (element.getAttribute('data-sanitized') !== 'true') {
                        element.addEventListener('input', (e) => {
                            let value = e.target.value;
                            
                            // حذف جميع علامات HTML
                            value = value.replace(/<[^>]*>/g, '');
                            
                            // حذف event handlers
                            value = value.replace(/on\w+=/gi, 'blocked=');
                            
                            // حذف javascript: و data:
                            value = value.replace(/(javascript|data|vbscript):/gi, 'blocked:');
                            
                            // حذف كود SQL
                            value = value.replace(/(SELECT|INSERT|DELETE|UPDATE|DROP|UNION|OR|AND)/gi, '');
                            
                            e.target.value = value;
                        });
                        
                        element.setAttribute('data-sanitized', 'true');
                    }
                });
            };
            
            // تشغيل على الفور ثم كل 5 ثواني
            sanitizeInputs();
            setInterval(sanitizeInputs, 5000);
        });
        
        // حماية DOM من الهجمات
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
            const element = originalCreateElement.call(this, tagName);
            
            // منع innerHTML الخطير
            Object.defineProperty(element, 'innerHTML', {
                set: function(value) {
                    if (typeof value === 'string') {
                        // التحقق من وجود كود ضار
                        if (/<script|<iframe|<object|<embed|<frame|<meta|<link|<style|<form/gi.test(value)) {
                            console.warn('🚨 محاولة حقن كود ضار في innerHTML');
                            value = this.textContent = this.escapeHTML(value);
                        }
                    }
                    this.innerHTML = value;
                },
                get: function() {
                    return this.innerHTML;
                }
            });
            
            return element;
        };
    }
    
    // ======================== حماية ضد CSRF ========================
    
    setupCSRFProtection() {
        // إنشاء CSRF Token قوي
        const generateStrongToken = () => {
            const array = new Uint32Array(10);
            crypto.getRandomValues(array);
            return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
        };
        
        // حفظ الـ Token في HttpOnly Cookie
        const setCSRFCookie = () => {
            const token = generateStrongToken();
            const expires = new Date();
            expires.setHours(expires.getHours() + 2);
            
            document.cookie = `csrf_token=${token}; expires=${expires.toUTCString()}; path=/; Secure; HttpOnly; SameSite=Strict`;
            sessionStorage.setItem('csrf_token_client', token);
        };
        
        // التحقق من الـ Token في كل طلب AJAX
        const originalFetch = window.fetch;
        window.fetch = function(resource, init = {}) {
            // إضافة CSRF Token إلى الرؤوس
            const headers = new Headers(init.headers || {});
            const csrfToken = sessionStorage.getItem('csrf_token_client');
            
            if (csrfToken && !resource.toString().includes('firebase')) {
                headers.set('X-CSRF-Token', csrfToken);
                headers.set('X-Requested-With', 'XMLHttpRequest');
            }
            
            // إضافة رأس الأمان
            headers.set('X-Content-Type-Options', 'nosniff');
            headers.set('X-Frame-Options', 'DENY');
            headers.set('X-XSS-Protection', '1; mode=block');
            
            init.headers = headers;
            
            // تسجيل الطلب للمراقبة
            SecuritySystem.getInstance().logRequest(resource, init);
            
            return originalFetch.call(this, resource, init);
        };
        
        // إنشاء Token جديد عند التحميل
        setCSRFCookie();
        
        // تحديث الـ Token كل ساعة
        setInterval(setCSRFCookie, 3600000);
    }
    
    // ======================== حماية ضد SQL/NoSQL Injection ========================
    
    setupInjectionProtection() {
        // حماية مدخلات Firestore
        const firestoreSanitizer = {
            sanitizeQuery: (query) => {
                if (typeof query !== 'string') return query;
                
                // قائمة الكلمات المحظورة
                const dangerousPatterns = [
                    /\.\.\//, // Directory traversal
                    /\\x[0-9a-f]{2}/i, // Hex encoding
                    /\\u[0-9a-f]{4}/i, // Unicode encoding
                    /javascript:/i,
                    /data:/i,
                    /vbscript:/i,
                    /expression\(/i,
                    /on\w+\s*=/i,
                    /<script/i,
                    /<\/script/i,
                    /eval\(/i,
                    /setTimeout\(/i,
                    /setInterval\(/i,
                    /document\./i,
                    /window\./i,
                    /localStorage\./i,
                    /sessionStorage\./i,
                    /cookie/i,
                    /alert\(/i,
                    /confirm\(/i,
                    /prompt\(/i,
                    /\$\{.*?\}/, // Template injection
                    /`.*?`/ // Backticks
                ];
                
                dangerousPatterns.forEach(pattern => {
                    if (pattern.test(query)) {
                        console.warn('🚨 محاولة حقن كود ضار:', query);
                        throw new Error('تم رفض الطلب لأسباب أمنية');
                    }
                });
                
                return query.replace(/[{}[\]\\]/g, '');
            },
            
            sanitizeObject: (obj) => {
                if (!obj || typeof obj !== 'object') return obj;
                
                const sanitized = {};
                for (const [key, value] of Object.entries(obj)) {
                    if (typeof value === 'string') {
                        sanitized[key] = this.sanitizeQuery(value);
                    } else if (typeof value === 'object' && value !== null) {
                        sanitized[key] = this.sanitizeObject(value);
                    } else {
                        sanitized[key] = value;
                    }
                }
                
                return sanitized;
            }
        };
        
        // تطبيق الحماية على Firebase
        this.protectFirebase(firestoreSanitizer);
    }
    
    protectFirebase(sanitizer) {
        // حماية Firestore operations
        const originalSetDoc = window.firebaseModules?.setDoc;
        const originalUpdateDoc = window.firebaseModules?.updateDoc;
        const originalAddDoc = window.firebaseModules?.addDoc;
        
        if (originalSetDoc) {
            window.firebaseModules.setDoc = async function(ref, data, options) {
                const sanitizedData = sanitizer.sanitizeObject(data);
                return originalSetDoc.call(this, ref, sanitizedData, options);
            };
        }
        
        if (originalUpdateDoc) {
            window.firebaseModules.updateDoc = async function(ref, data) {
                const sanitizedData = sanitizer.sanitizeObject(data);
                return originalUpdateDoc.call(this, ref, sanitizedData);
            };
        }
        
        if (originalAddDoc) {
            window.firebaseModules.addDoc = async function(ref, data) {
                const sanitizedData = sanitizer.sanitizeObject(data);
                return originalAddDoc.call(this, ref, sanitizedData);
            };
        }
        
        // حماية Queries
        const originalQuery = window.firebaseModules?.query;
        if (originalQuery) {
            window.firebaseModules.query = function(ref, ...queryConstraints) {
                const sanitizedConstraints = queryConstraints.map(constraint => {
                    if (constraint && typeof constraint === 'object') {
                        return sanitizer.sanitizeObject(constraint);
                    }
                    return constraint;
                });
                return originalQuery.call(this, ref, ...sanitizedConstraints);
            };
        }
    }
    
    // ======================== حماية ضد Clickjacking ========================
    
    setupClickjackingProtection() {
        // إضافة رؤوس الأمان
        const securityHeaders = `
            <meta http-equiv="Content-Security-Policy" content="default-src 'self' https: 'unsafe-inline' 'unsafe-eval'; script-src 'self' https://www.gstatic.com https://apis.google.com 'unsafe-inline' 'unsafe-eval'; style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; connect-src 'self' https: wss:; frame-src 'self' https://accounts.google.com;">
            <meta http-equiv="X-Frame-Options" content="DENY">
            <meta http-equiv="X-Content-Type-Options" content="nosniff">
            <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
        `;
        
        document.head.insertAdjacentHTML('beforeend', securityHeaders);
        
        // منع فتح النوافذ المنبثقة غير المرغوب فيها
        window.addEventListener('blur', () => {
            if (document.hasFocus()) return;
            
            // إذا فقد التركيز فجأة، تحقق من النوافذ المنبثقة
            setTimeout(() => {
                if (!document.hasFocus()) {
                    console.warn('⚠️ انتباه: فقد التركيز - قد يكون هناك نافذة منبثقة');
                    // يمكن إضافة إشعار للمستخدم
                }
            }, 100);
        });
    }
    
    // ======================== حماية ضد Brute Force ========================
    
    setupBruteForceProtection() {
        const MAX_ATTEMPTS = 5;
        const LOCKOUT_TIME = 15 * 60 * 1000; // 15 دقيقة
        const DELAY_BASE = 1000; // تأخير 1 ثانية بعد كل محاولة فاشلة
        
        window.loginAttempts = new Map();
        
        // تأخير متزايد بعد كل محاولة فاشلة
        window.delayedLogin = async (email, password, loginFunction) => {
            const attempts = this.loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
            const now = Date.now();
            
            // التحقق من القفل
            if (attempts.count >= MAX_ATTEMPTS && 
                now - attempts.lastAttempt < LOCKOUT_TIME) {
                const timeLeft = Math.ceil((LOCKOUT_TIME - (now - attempts.lastAttempt)) / 60000);
                throw new Error(`تم تجاوز الحد المسموح. يرجى المحاولة بعد ${timeLeft} دقيقة`);
            }
            
            // تطبيق التأخير
            const delay = attempts.count * DELAY_BASE;
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            try {
                const result = await loginFunction(email, password);
                
                // إعادة تعيين المحاولات عند النجاح
                this.loginAttempts.delete(email);
                return result;
                
            } catch (error) {
                // تسجيل المحاولة الفاشلة
                attempts.count++;
                attempts.lastAttempt = now;
                this.loginAttempts.set(email, attempts);
                
                // تسجيل الحدث الأمني
                this.logSecurityEvent('login_bruteforce_attempt', {
                    email,
                    attemptCount: attempts.count,
                    ip: await this.getClientIP()
                });
                
                throw error;
            }
        };
        
        // تنظيف المحاولات القديمة
        setInterval(() => {
            const now = Date.now();
            for (const [email, attempts] of this.loginAttempts.entries()) {
                if (now - attempts.lastAttempt > LOCKOUT_TIME) {
                    this.loginAttempts.delete(email);
                }
            }
        }, 60000); // كل دقيقة
    }
    
    // ======================== نظام Rate Limiting ========================
    
    setupRateLimiting() {
        window.addEventListener('fetch', (event) => {
            if (!event.request.url.includes('/api/')) return;
            
            const clientId = this.getClientIdentifier();
            const now = Date.now();
            
            // الحصول على تاريخ الطلبات لهذا العميل
            const requests = this.requestHistory.get(clientId) || [];
            
            // إزالة الطلبات القديمة
            const recentRequests = requests.filter(time => now - time < this.rateLimitWindow);
            
            // التحقق من تجاوز الحد
            if (recentRequests.length >= this.rateLimitMax) {
                event.respondWith(new Response('Too Many Requests', {
                    status: 429,
                    headers: { 'Retry-After': '60' }
                }));
                return;
            }
            
            // إضافة الطلب الجديد
            recentRequests.push(now);
            this.requestHistory.set(clientId, recentRequests);
        });
        
        // تنظيف الطلبات القديمة
        setInterval(() => {
            const now = Date.now();
            for (const [clientId, requests] of this.requestHistory.entries()) {
                const recentRequests = requests.filter(time => now - time < this.rateLimitWindow);
                if (recentRequests.length === 0) {
                    this.requestHistory.delete(clientId);
                } else {
                    this.requestHistory.set(clientId, recentRequests);
                }
            }
        }, 60000);
    }
    
    // ======================== مراقبة في الوقت الحقيقي ========================
    
    startRealtimeMonitoring() {
        // مراقبة أحداث لوحة المفاتيح المشبوهة
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'I') {
                console.warn('⚠️ محاولة فتح أدوات المطور');
                this.logSecurityEvent('devtools_attempt', { keyCombo: 'Ctrl+Shift+I' });
            }
            
            if (e.key === 'F12') {
                console.warn('⚠️ محاولة فتح أدوات المطور');
                this.logSecurityEvent('devtools_attempt', { keyCombo: 'F12' });
            }
        });
        
        // منع فحص الكود
        Object.defineProperty(document, 'hidden', {
            get: function() {
                SecuritySystem.getInstance().logSecurityEvent('page_visibility_check');
                return true;
            }
        });
        
        // مراقبة تغييرات DOM المشبوهة
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element node
                            if (node.tagName === 'SCRIPT' && 
                                !node.src && 
                                node.textContent.includes('alert') ||
                                node.textContent.includes('eval')) {
                                console.warn('🚨 اكتشاف سكربت ضار!');
                                node.remove();
                                this.logSecurityEvent('malicious_script_injection');
                            }
                        }
                    });
                }
            });
        });
        
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
        
        // مراقبة إرسال النماذج
        document.addEventListener('submit', (e) => {
            const form = e.target;
            const formData = new FormData(form);
            
            // التحقق من وجود حقول مخفية
            form.querySelectorAll('input[type="hidden"]').forEach(input => {
                if (input.value.length > 1000) {
                    console.warn('🚨 قيمة مخفية كبيرة جداً:', input.name);
                    e.preventDefault();
                    this.logSecurityEvent('large_hidden_field', {
                        fieldName: input.name,
                        length: input.value.length
                    });
                }
            });
        });
    }
    
    // ======================== حماية HSTS ========================
    
    enforceHSTS() {
        // للخادم: يجب إضافة رأس HSTS
        // للعميل: نتحقق من اتصال HTTPS
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            console.error('🚨 يجب استخدام HTTPS للاتصال الآمن');
            location.replace(`https://${location.host}${location.pathname}`);
        }
    }
    
    // ======================== أدوات مساعدة ========================
    
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }
    
    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }
    
    getClientIdentifier() {
        // إنشاء معرف فريد للعميل بدون استخدام cookies
        const fingerprint = [
            navigator.userAgent,
            navigator.language,
            screen.width,
            screen.height,
            screen.colorDepth,
            new Date().getTimezoneOffset(),
            !!navigator.cookieEnabled,
            !!navigator.javaEnabled(),
            navigator.platform
        ].join('|');
        
        return btoa(fingerprint).substring(0, 32);
    }
    
    logRequest(url, init) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            url: url.toString(),
            method: init.method || 'GET',
            clientId: this.getClientIdentifier(),
            userAgent: navigator.userAgent
        };
        
        // إرسال السجلات إلى الخادم (إن أمكن)
        this.sendSecurityLog(logEntry);
        
        // تخزين محلي (محدود)
        const logs = JSON.parse(localStorage.getItem('request_logs') || '[]');
        logs.push(logEntry);
        if (logs.length > 100) logs.shift();
        localStorage.setItem('request_logs', JSON.stringify(logs));
    }
    
    logSecurityEvent(event, details = {}) {
        const logEntry = {
            event,
            details,
            timestamp: new Date().toISOString(),
            clientId: this.getClientIdentifier(),
            url: location.href,
            userAgent: navigator.userAgent
        };
        
        console.log(`🔒 Security Event: ${event}`, logEntry);
        
        // تخزين في localStorage
        const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
        logs.push(logEntry);
        if (logs.length > 500) logs.shift();
        localStorage.setItem('security_logs', JSON.stringify(logs));
        
        // إرسال إلى الخادم
        this.sendSecurityLog(logEntry);
    }
    
    async sendSecurityLog(logEntry) {
        try {
            // إرسال إلى endpoint آمن
            await fetch('/api/security/logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Security-Report': 'true'
                },
                body: JSON.stringify(logEntry)
            });
        } catch (error) {
            // تجاهل الأخطاء في الإرسال
        }
    }
    
    // ======================== Singleton Pattern ========================
    
    static getInstance() {
        if (!SecuritySystem.instance) {
            SecuritySystem.instance = new SecuritySystem();
        }
        return SecuritySystem.instance;
    }
}

// التصدير للاستخدام
window.SecuritySystem = SecuritySystem;

// بدء النظام الأمني تلقائياً
document.addEventListener('DOMContentLoaded', () => {
    SecuritySystem.getInstance();
});

console.log('🛡️  نظام الأمان الشامل جاهز للتحميل');

