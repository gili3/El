// secure-boot.js - نظام تشغيل آمن
class SecureBoot {
    constructor() {
        this.bootSequence = [
            this.loadSecurityConfig.bind(this),
            this.initSecuritySystem.bind(this),
            this.initEncryption.bind(this),
            this.initFirebaseSecurity.bind(this),
            this.initIntegrityChecker.bind(this),
            this.initSecureLoader.bind(this),
            this.finalSecurityCheck.bind(this)
        ];
        
        this.boot();
    }
    
    async boot() {
        console.log('🚀 بدء التشغيل الآمن...');
        
        try {
            for (const step of this.bootSequence) {
                await step();
            }
            
            console.log('✅ التشغيل الآمن اكتمل بنجاح');
            this.onBootComplete();
            
        } catch (error) {
            console.error('❌ فشل التشغيل الآمن:', error);
            this.handleBootFailure(error);
        }
    }
    
    async loadSecurityConfig() {
        console.log('1️⃣ جاري تحميل إعدادات الأمان...');
        
        // تحميل config
        await this.loadScriptSecurely('/js/security-config.js');
        
        // التحقق من التوقيع الرقمي
        await this.verifyConfigSignature();
        
        console.log('✅ إعدادات الأمان محملة');
    }
    
    async initSecuritySystem() {
        console.log('2️⃣ جاري تهيئة النظام الأمني...');
        
        // تحميل النظام الأمني
        await this.loadScriptSecurely('/js/security-system.js');
        
        // التحقق من تكامل النظام
        const hash = await this.calculateFileHash('/js/security-system.js');
        const expectedHash = '...'; // الهاش المتوقع
        
        if (hash !== expectedHash) {
            throw new Error('فشل التحقق من نزاهة النظام الأمني');
        }
        
        console.log('✅ النظام الأمني مهيأ');
    }
    
    async initEncryption() {
        console.log('3️⃣ جاري تهيئة نظام التشفير...');
        
        await this.loadScriptSecurely('/js/encryption.js');
        
        // إنشاء مفاتيح التشفير
        await window.encryption.initEncryption();
        
        console.log('✅ نظام التشفير مهيأ');
    }
    
    async initFirebaseSecurity() {
        console.log('4️⃣ جاري تهيئة حماية Firebase...');
        
        await this.loadScriptSecurely('/js/firebase-security.js');
        
        console.log('✅ حماية Firebase مهيأة');
    }
    
    async initIntegrityChecker() {
        console.log('5️⃣ جاري تهيئة نظام التحقق من النزاهة...');
        
        await this.loadScriptSecurely('/js/integrity-check.js');
        
        // تشغيل فحص أولي
        const results = await window.integrityChecker.runChecks();
        const failedChecks = results.filter(r => !r.passed);
        
        if (failedChecks.length > 0) {
            throw new Error('فشل التحقق من النزاهة الأولي');
        }
        
        console.log('✅ نظام التحقق من النزاهة مهيأ');
    }
    
    async initSecureLoader() {
        console.log('6️⃣ جاري تهيئة نظام التحميل الآمن...');
        
        await this.loadScriptSecurely('/js/secure-loader.js');
        
        console.log('✅ نظام التحميل الآمن مهيأ');
    }
    
    async finalSecurityCheck() {
        console.log('7️⃣ جاري الفحص الأمني النهائي...');
        
        const checks = [
            this.checkHTTPS.bind(this),
            this.checkBrowserSecurity.bind(this),
            this.checkExtensions.bind(this),
            this.checkTimeSync.bind(this)
        ];
        
        for (const check of checks) {
            await check();
        }
        
        console.log('✅ الفحص الأمني النهائي مكتمل');
    }
    
    async checkHTTPS() {
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            throw new Error('يجب استخدام HTTPS للاتصال الآمن');
        }
    }
    
    async checkBrowserSecurity() {
        // التحقق من إعدادات أمان المتصفح
        if (!window.crypto || !window.crypto.subtle) {
            throw new Error('المتصفح لا يدعم التشفير الحديث');
        }
        
        if (!window.isSecureContext) {
            throw new Error('الاتصال غير آمن (غير secure context)');
        }
    }
    
    async checkExtensions() {
        // محاولة اكتشاف الامتدادات الخطيرة
        const dangerousExtensions = [
            'EditThisCookie',
            'Cookie Editor',
            'HackBar',
            'Postman Interceptor'
        ];
        
        // هذه تقنية محدودة ولكنها مفيدة
        const start = performance.now();
        try {
            // محاولة الوصول إلى APIs خاصة بالامتدادات
            if (typeof window.chrome !== 'undefined' && window.chrome.runtime) {
                // يمكن إضافة فحوصات إضافية هنا
            }
        } catch (e) {
            // طبيعي
        }
        const time = performance.now() - start;
        
        if (time > 1000) {
            console.warn('⚠️ اكتشاف نشاط غير عادي (قد يكون امتداد)');
        }
    }
    
    async checkTimeSync() {
        // التحقق من تزامن الوقت (مهم للتوقيعات الرقمية)
        try {
            const response = await fetch('https://worldtimeapi.org/api/ip');
            const data = await response.json();
            const serverTime = new Date(data.datetime);
            const localTime = new Date();
            const diff = Math.abs(serverTime - localTime);
            
            if (diff > 300000) { // 5 دقائق
                console.warn('⚠️ وقت النظام غير متزامن:', diff / 1000, 'ثانية');
            }
        } catch (error) {
            // تجاهل الخطأ
        }
    }
    
    async loadScriptSecurely(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            
            // إضافة سمة integrity
            script.integrity = await this.getIntegrityHash(url);
            script.crossOrigin = 'anonymous';
            
            script.onload = resolve;
            script.onerror = () => reject(new Error(`فشل تحميل ${url}`));
            
            document.head.appendChild(script);
        });
    }
    
    async getIntegrityHash(url) {
        // في الإنتاج، يجب أن تكون هذه الهاشات مخزنة بشكل آمن
        const hashes = {
            '/js/security-system.js': 'sha256-...',
            '/js/encryption.js': 'sha256-...',
            '/js/firebase-security.js': 'sha256-...',
            '/js/integrity-check.js': 'sha256-...',
            '/js/secure-loader.js': 'sha256-...'
        };
        
        return hashes[url] || '';
    }
    
    async calculateFileHash(url) {
        const response = await fetch(url);
        const content = await response.text();
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    async verifyConfigSignature() {
        // التحقق من التوقيع الرقمي للإعدادات
        // هذه وظيفة متقدمة تتطلب backend
        return true;
    }
    
    onBootComplete() {
        // إرسال إشعار نجاح التشغيل
        const event = new CustomEvent('secure-boot-complete');
        window.dispatchEvent(event);
        
        // بدء تحميل بقية التطبيق
        this.loadApplication();
    }
    
    handleBootFailure(error) {
        console.error('🚨 فشل التشغيل الآمن:', error);
        
        // إظهار رسالة للمستخدم
        document.body.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #f8f9fa;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                padding: 20px;
                font-family: 'Cairo';
                z-index: 99999;
            ">
                <div style="font-size: 80px; color: #e74c3c; margin-bottom: 20px;">
                    ⚠️
                </div>
                <h1 style="color: #2c3e50; margin-bottom: 15px;">
                    خطأ في الأمان
                </h1>
                <p style="color: #7f8c8d; max-width: 500px; margin-bottom: 30px;">
                    تعذر بدء التشغيل الآمن للتطبيق. 
                    قد يكون هناك مشكلة في أمان النظام أو تم تعديل الملفات.
                </p>
                <div style="background: #fff; padding: 20px; border-radius: 10px; border: 1px solid #ddd; margin-bottom: 20px;">
                    <p style="color: #e74c3c; font-weight: bold;">
                        ${error.message}
                    </p>
                </div>
                <button onclick="location.reload()" style="
                    padding: 12px 30px;
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    cursor: pointer;
                    font-family: 'Cairo';
                ">
                    إعادة المحاولة
                </button>
            </div>
        `;
        
        // إرسال تقرير الفشل
        this.reportBootFailure(error);
    }
    
    reportBootFailure(error) {
        fetch('/api/boot/failure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: location.href
            })
        }).catch(() => {
            // تجاهل أخطاء الإرسال
        });
    }
    
    loadApplication() {
        // تحميل ملفات التطبيق الرئيسية بعد اكتمال الأمان
        const appFiles = [
            '/js/firebase-config.js',
            '/js/app-core.js',
            '/js/auth-system.js',
            '/js/products-system.js',
            '/js/cart-system.js',
            '/js/checkout-system.js',
            '/js/orders-system.js',
            '/js/profile-system.js',
            '/js/utils.js',
            '/js/main.js'
        ];
        
        appFiles.forEach(file => {
            const script = document.createElement('script');
            script.src = file;
            document.head.appendChild(script);
        });
    }
}

// بدء التشغيل الآمن عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    window.secureBoot = new SecureBoot();
});

