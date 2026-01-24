// secure-loader.js - نظام تحميل آمن للملفات
class SecureLoader {
    constructor() {
        this.loadedScripts = new Set();
        this.allowedHosts = [
            'www.gstatic.com',
            'apis.google.com',
            'cdnjs.cloudflare.com',
            'fonts.googleapis.com',
            'fonts.gstatic.com'
        ];
        
        this.initSecureLoading();
    }
    
    initSecureLoading() {
        console.log('🔄 تهيئة نظام التحميل الآمن...');
        
        // حماية document.write
        this.protectDocumentWrite();
        
        // حماية appendChild
        this.protectAppendChild();
        
        // حماية eval
        this.protectEval();
        
        // حماية Function constructor
        this.protectFunction();
        
        console.log('✅ نظام التحميل الآمن مفعل');
    }
    
    protectDocumentWrite() {
        const originalWrite = document.write;
        document.write = function(content) {
            // التحقق من وجود سكربتات ضارة
            if (typeof content === 'string' && 
                (content.includes('<script') || 
                 content.includes('javascript:') ||
                 content.includes('onload=') ||
                 content.includes('onerror='))) {
                console.warn('🚨 محاولة استخدام document.write مع محتوى خطير');
                return;
            }
            originalWrite.call(document, content);
        };
        
        const originalWriteln = document.writeln;
        document.writeln = function(content) {
            if (typeof content === 'string' && 
                content.includes('<script')) {
                console.warn('🚨 محاولة استخدام document.writeln مع سكربت');
                return;
            }
            originalWriteln.call(document, content);
        };
    }
    
    protectAppendChild() {
        const originalAppendChild = Node.prototype.appendChild;
        Node.prototype.appendChild = function(child) {
            // التحقق من العناصر المشبوهة
            if (child.tagName === 'SCRIPT') {
                const src = child.src || '';
                const text = child.textContent || '';
                
                // التحقق من السكربتات الخارجية
                if (src && !this.isAllowedHost(src)) {
                    console.warn('🚨 محاولة تحميل سكربت من مصدر غير مصرح:', src);
                    return child;
                }
                
                // التحقق من السكربتات الداخلية
                if (text && this.containsSuspiciousCode(text)) {
                    console.warn('🚨 محاولة إضافة سكربت مشبوه');
                    return child;
                }
            }
            
            // التحقق من iframes
            if (child.tagName === 'IFRAME') {
                const src = child.src || '';
                if (src && !this.isAllowedHost(src)) {
                    console.warn('🚨 محاولة إضافة iframe من مصدر غير مصرح:', src);
                    return child;
                }
            }
            
            return originalAppendChild.call(this, child);
        };
    }
    
    protectEval() {
        const originalEval = window.eval;
        window.eval = function(code) {
            // تسجيل استخدام eval (غير آمن)
            console.warn('⚠️ استخدام eval تم اكتشافه:', code.substring(0, 100));
            
            SecuritySystem.getInstance().logSecurityEvent('eval_usage', {
                codeLength: code.length,
                caller: new Error().stack.split('\n')[2]
            });
            
            // السماح فقط بالكود الضروري (مثل بعض مكتبات Firebase)
            if (code.includes('firebase') || code.includes('Firebase')) {
                return originalEval.call(window, code);
            }
            
            throw new Error('تم منع eval لأسباب أمنية');
        };
    }
    
    protectFunction() {
        const originalFunction = window.Function;
        window.Function = function(...args) {
            const body = args[args.length - 1];
            
            // التحقق من الكود الضار
            if (typeof body === 'string' && 
                (body.includes('document.cookie') ||
                 body.includes('localStorage') ||
                 body.includes('sessionStorage') ||
                 body.includes('XMLHttpRequest') ||
                 body.includes('fetch'))) {
                console.warn('🚨 محاولة استخدام Function constructor مع كود مشبوه');
                throw new Error('تم منع Function constructor لأسباب أمنية');
            }
            
            return originalFunction.apply(this, args);
        };
    }
    
    isAllowedHost(url) {
        try {
            const hostname = new URL(url).hostname;
            return this.allowedHosts.some(allowed => hostname.endsWith(allowed));
        } catch (error) {
            return false;
        }
    }
    
    containsSuspiciousCode(code) {
        const suspiciousPatterns = [
            /document\.cookie/,
            /localStorage\./,
            /sessionStorage\./,
            /XMLHttpRequest/,
            /fetch\(/,
            /eval\(/,
            /setTimeout\(/,
            /setInterval\(/,
            /Function\(/,
            /importScripts\(/,
            /WebSocket\(/,
            /postMessage\(/
        ];
        
        return suspiciousPatterns.some(pattern => pattern.test(code));
    }
    
    // تحميل آمن للـ scripts
    async loadScriptSecurely(url, options = {}) {
        return new Promise((resolve, reject) => {
            // التحقق من المصدر
            if (!this.isAllowedHost(url)) {
                reject(new Error(`المصدر ${url} غير مصرح به`));
                return;
            }
            
            // التحقق من التكرار
            if (this.loadedScripts.has(url)) {
                resolve();
                return;
            }
            
            // إنشاء عنصر script آمن
            const script = document.createElement('script');
            script.src = url;
            
            // إضافة سمة integrity إذا كانت متوفرة
            if (options.integrity) {
                script.integrity = options.integrity;
                script.crossOrigin = 'anonymous';
            }
            
            // إضافة attributes آمنة
            script.referrerPolicy = 'strict-origin-when-cross-origin';
            script.async = options.async !== false;
            script.defer = options.defer !== false;
            
            // event handlers
            script.onload = () => {
                this.loadedScripts.add(url);
                resolve();
            };
            
            script.onerror = () => {
                reject(new Error(`فشل تحميل السكربت: ${url}`));
            };
            
            // إضافة إلى DOM
            document.head.appendChild(script);
        });
    }
    
    // تحميل آمن للـ styles
    async loadStyleSecurely(url) {
        return new Promise((resolve, reject) => {
            if (!this.isAllowedHost(url)) {
                reject(new Error(`المصدر ${url} غير مصرح به`));
                return;
            }
            
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.crossOrigin = 'anonymous';
            link.referrerPolicy = 'strict-origin-when-cross-origin';
            
            link.onload = resolve;
            link.onerror = reject;
            
            document.head.appendChild(link);
        });
    }
}

// التهيئة التلقائية
document.addEventListener('DOMContentLoaded', () => {
    window.secureLoader = new SecureLoader();
});

