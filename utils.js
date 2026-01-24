// utils.js - أدوات مساعدة عامة
// ======================== دوال مساعدة عامة ========================

/**
 * التحقق من صحة البريد الإلكتروني
 */
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

/**
 * تشغيل صوت تنبيه
 */
function playNotificationSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==');
        audio.volume = 0.3;
        audio.play().catch(() => {});
    } catch (e) {
        // تجاهل الأخطاء الصوتية
    }
}

/**
 * تحميل البيانات المخزنة محلياً
 */
function loadLocalStorageData() {
    try {
        const savedPhone = localStorage.getItem('userPhone');
        const savedAddress = localStorage.getItem('userAddress');
        
        return {
            phone: savedPhone || '',
            address: savedAddress || ''
        };
    } catch (e) {
        console.error('خطأ في تحميل البيانات المحلية:', e);
        return { phone: '', address: '' };
    }
}

/**
 * حفظ البيانات محلياً
 */
function saveLocalStorageData(phone, address) {
    try {
        if (phone) localStorage.setItem('userPhone', phone);
        if (address) localStorage.setItem('userAddress', address);
        return true;
    } catch (e) {
        console.error('خطأ في حفظ البيانات المحلية:', e);
        return false;
    }
}

/**
 * تحويل التاريخ إلى صيغة عربية
 */
function formatArabicDate(date) {
    if (!date) return 'غير محدد';
    
    try {
        const dateObj = date.toDate ? date.toDate() : new Date(date);
        return dateObj.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return 'تاريخ غير صالح';
    }
}

/**
 * تقصير النصوص الطويلة
 */
function truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * إنشاء معرف فريد
 */
function generateUniqueId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * تحميل الصور مع التعامل مع الأخطاء
 */
function loadImageWithFallback(imgElement, src, fallbackSrc = 'https://via.placeholder.com/300x200?text=صورة') {
    if (!imgElement) return;
    
    imgElement.src = src;
    imgElement.onerror = function() {
        this.src = fallbackSrc;
        this.onerror = null;
    };
}

/**
 * التحقق من اتصال الإنترنت
 */
function checkInternetConnection() {
    return navigator.onLine;
}

/**
 * إعادة المحاولة بعد فشل
 */
async function retryWithBackoff(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
    }
}

/**
 * تهيئة تحسينات الأداء
 */
function initPerformanceOptimizations() {
    // تفعيل خاصية التحميل الكسول للصور
    document.addEventListener('DOMContentLoaded', function() {
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
    });
}

// ======================== 🔐 دوال الأمان الجديدة ========================

/**
 * تهريب HTML للحماية من XSS
 */
function escapeHTML(text) {
    if (text === null || text === undefined || text === '') return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/`/g, '&#x60;');
}

/**
 * إنشاء CSRF Token
 */
function generateCSRFToken() {
    try {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        sessionStorage.setItem('csrf_token', token);
        sessionStorage.setItem('csrf_expiry', Date.now() + 3600000); // صلاحية ساعة
        return token;
    } catch (e) {
        console.error('Error generating CSRF token:', e);
        return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

/**
 * جلب CSRF Token
 */
function getCSRFToken() {
    try {
        const token = sessionStorage.getItem('csrf_token');
        const expiry = sessionStorage.getItem('csrf_expiry');
        
        if (!token || !expiry || Date.now() > parseInt(expiry)) {
            return generateCSRFToken();
        }
        
        return token;
    } catch (e) {
        console.error('Error getting CSRF token:', e);
        return generateCSRFToken();
    }
}

/**
 * التحقق من CSRF Token
 */
function validateCSRFToken(token) {
    try {
        const storedToken = sessionStorage.getItem('csrf_token');
        return storedToken && token === storedToken;
    } catch (e) {
        console.error('Error validating CSRF token:', e);
        return false;
    }
}

/**
 * تطهير المدخلات من محاولات الحقن
 */
function sanitizeInput(input, maxLength = 200) {
    if (typeof input !== 'string') return '';
    
    return input
        .replace(/<[^>]*>/g, '') // إزالة جميع علامات HTML
        .replace(/[{}[\]\\]/g, '') // إزالة علامات Firebase الخاصة
        .replace(/javascript:/gi, 'blocked:') // إزالة javascript:
        .replace(/data:/gi, 'blocked:') // إزالة data:
        .replace(/on\w+=/gi, 'blocked=') // إزالة event handlers
        .trim()
        .substring(0, maxLength);
}

/**
 * تطهير البريد الإلكتروني
 */
function sanitizeEmail(email) {
    return sanitizeInput(email, 100)
        .toLowerCase()
        .replace(/[^a-z0-9@._-]/g, '');
}

/**
 * تطهير رقم الهاتف
 */
function sanitizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/[^\d+]/g, '').substring(0, 20);
}

/**
 * التحقق من ملف الصورة
 */
function validateImageFile(file, maxSizeMB = 10) {
    if (!file || !file.type) return false;
    
    // التحقق من نوع الملف
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type.toLowerCase())) {
        return false;
    }
    
    // التحقق من الحجم
    if (file.size > maxSizeMB * 1024 * 1024) {
        return false;
    }
    
    // التحقق من الامتداد
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    return hasValidExtension;
}

/**
 * ضغط الصورة باستخدام Canvas
 */
async function compressImageFile(file, options = {}) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            resolve(file);
            return;
        }
        
        const defaultOptions = {
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 0.8,
            mimeType: 'image/jpeg'
        };
        
        const config = { ...defaultOptions, ...options };
        
        // إذا كان الملف أقل من 500KB، لا تضغط
        if (file.size < 500 * 1024) {
            resolve(file);
            return;
        }
        
        const img = new Image();
        const reader = new FileReader();
        
        reader.onload = function(e) {
            img.src = e.target.result;
        };
        
        reader.onerror = reject;
        
        img.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                let width = img.width;
                let height = img.height;
                
                // حساب الحجم الجديد مع الحفاظ على النسبة
                if (width > height) {
                    if (width > config.maxWidth) {
                        height *= config.maxWidth / width;
                        width = config.maxWidth;
                    }
                } else {
                    if (height > config.maxHeight) {
                        width *= config.maxHeight / height;
                        height = config.maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // تعبئة الخلفية بالأبيض للصور الشفافة
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
                
                // رسم الصورة
                ctx.drawImage(img, 0, 0, width, height);
                
                // تحويل لـ Blob
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            resolve(file); // إذا فشل التحويل، نعيد الملف الأصلي
                            return;
                        }
                        
                        const compressedFile = new File(
                            [blob],
                            file.name.replace(/\.[^/.]+$/, '') + '.jpg',
                            {
                                type: config.mimeType,
                                lastModified: Date.now()
                            }
                        );
                        
                        console.log(`📊 تم ضغط الصورة: ${(file.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB`);
                        resolve(compressedFile);
                    },
                    config.mimeType,
                    config.quality
                );
            } catch (error) {
                console.error('خطأ في ضغط الصورة:', error);
                resolve(file); // إذا فشلت العملية، نعيد الملف الأصلي
            }
        };
        
        img.onerror = () => {
            console.warn('⚠️ فشل تحميل الصورة للضغط');
            resolve(file);
        };
        
        reader.readAsDataURL(file);
    });
}

/**
 * تخزين آمن للبيانات
 */
function secureStore(key, value, expiryMinutes = 60) {
    try {
        const data = {
            value: value,
            timestamp: Date.now(),
            expiry: Date.now() + (expiryMinutes * 60000),
            signature: btoa(key + Date.now()).substring(0, 10) // توقيع بسيط
        };
        sessionStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error('Secure storage error:', e);
        return false;
    }
}

/**
 * استرجاع آمن للبيانات
 */
function secureRetrieve(key) {
    try {
        const stored = sessionStorage.getItem(key);
        if (!stored) return null;
        
        const data = JSON.parse(stored);
        
        // التحقق من الصلاحية
        if (Date.now() > data.expiry) {
            sessionStorage.removeItem(key);
            return null;
        }
        
        // التحقق من التوقيع البسيط
        const expectedSignature = btoa(key + data.timestamp).substring(0, 10);
        if (data.signature !== expectedSignature) {
            sessionStorage.removeItem(key);
            return null;
        }
        
        return data.value;
    } catch (e) {
        console.error('Secure retrieve error:', e);
        sessionStorage.removeItem(key);
        return null;
    }
}

/**
 * تسجيل أحداث الأمان
 */
function logSecurityEvent(event, details = {}) {
    try {
        const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
        
        logs.push({
            event,
            details,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            userId: window.currentUser?.uid || 'guest'
        });
        
        // حفظ آخر 100 حدث فقط
        if (logs.length > 100) {
            logs.splice(0, logs.length - 100);
        }
        
        localStorage.setItem('security_logs', JSON.stringify(logs));
        console.log(`🔒 Security Event: ${event}`, details);
    } catch (e) {
        console.error('Error logging security event:', e);
    }
}

// ======================== التصدير للاستخدام العام ========================

window.validateEmail = validateEmail;
window.playNotificationSound = playNotificationSound;
window.loadLocalStorageData = loadLocalStorageData;
window.saveLocalStorageData = saveLocalStorageData;
window.formatArabicDate = formatArabicDate;
window.truncateText = truncateText;
window.generateUniqueId = generateUniqueId;
window.loadImageWithFallback = loadImageWithFallback;
window.checkInternetConnection = checkInternetConnection;
window.retryWithBackoff = retryWithBackoff;
window.initPerformanceOptimizations = initPerformanceOptimizations;

// 🔐 دوال الأمان الجديدة
window.escapeHTML = escapeHTML;
window.generateCSRFToken = generateCSRFToken;
window.getCSRFToken = getCSRFToken;
window.validateCSRFToken = validateCSRFToken;
window.sanitizeInput = sanitizeInput;
window.sanitizeEmail = sanitizeEmail;
window.sanitizePhone = sanitizePhone;
window.validateImageFile = validateImageFile;
window.compressImageFile = compressImageFile;
window.secureStore = secureStore;
window.secureRetrieve = secureRetrieve;
window.logSecurityEvent = logSecurityEvent;

console.log('✅ utils.js loaded with security features');