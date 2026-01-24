// firebase-security.js - حماية متقدمة لـ Firebase
class FirebaseSecurity {
    constructor() {
        this.rules = {
            maxDocumentSize: 102400, // 100KB كحد أقصى للوثيقة
            maxArraySize: 100,
            maxStringLength: 10000,
            allowedFields: [
                'name', 'email', 'phone', 'address', 'price', 'quantity',
                'description', 'image', 'category', 'stock', 'status',
                'orderId', 'total', 'notes', 'createdAt', 'updatedAt'
            ]
        };
        
        this.initFirebaseSecurity();
    }
    
    initFirebaseSecurity() {
        console.log('🔥 تهيئة حماية Firebase...');
        
        this.protectFirestore();
        this.protectStorage();
        this.protectAuth();
        
        console.log('✅ حماية Firebase مفعلة');
    }
    
    protectFirestore() {
        // التحقق من حجم البيانات قبل الإرسال
        const validateDocumentSize = (data) => {
            const size = JSON.stringify(data).length;
            if (size > this.rules.maxDocumentSize) {
                throw new Error(`حجم البيانات ${size} بايت يتجاوز الحد المسموح ${this.rules.maxDocumentSize} بايت`);
            }
            return true;
        };
        
        // التحقق من الحقول المسموح بها
        const validateFields = (data) => {
            for (const field in data) {
                if (!this.rules.allowedFields.includes(field)) {
                    console.warn(`⚠️ حقل غير مصرح به: ${field}`);
                    // يمكن حذف الحقل أو رفض العملية
                }
            }
            return true;
        };
        
        // تطبيق الحماية على جميع عمليات Firestore
        this.wrapFirestoreMethods(validateDocumentSize, validateFields);
    }
    
    wrapFirestoreMethods(sizeValidator, fieldValidator) {
        const originalSetDoc = window.firebaseModules?.setDoc;
        const originalUpdateDoc = window.firebaseModules?.updateDoc;
        const originalAddDoc = window.firebaseModules?.addDoc;
        
        if (originalSetDoc) {
            window.firebaseModules.setDoc = async function(ref, data, options) {
                sizeValidator(data);
                fieldValidator(data);
                return originalSetDoc.call(this, ref, data, options);
            };
        }
        
        if (originalUpdateDoc) {
            window.firebaseModules.updateDoc = async function(ref, data) {
                sizeValidator(data);
                fieldValidator(data);
                return originalUpdateDoc.call(this, ref, data);
            };
        }
        
        if (originalAddDoc) {
            window.firebaseModules.addDoc = async function(ref, data) {
                sizeValidator(data);
                fieldValidator(data);
                return originalAddDoc.call(this, ref, data);
            };
        }
        
        // حماية Queries من حقن NoSQL
        const originalWhere = window.firebaseModules?.where;
        if (originalWhere) {
            window.firebaseModules.where = function(fieldPath, opStr, value) {
                // تطهير القيمة
                if (typeof value === 'string') {
                    value = value.replace(/[{}[\]\\]/g, '');
                }
                return originalWhere.call(this, fieldPath, opStr, value);
            };
        }
    }
    
    protectStorage() {
        // التحقق من ملفات الرفع
        const validateUploadFile = (file) => {
            const maxSize = 10 * 1024 * 1024; // 10MB
            const allowedTypes = [
                'image/jpeg', 'image/jpg', 'image/png', 
                'image/webp', 'image/gif'
            ];
            
            if (file.size > maxSize) {
                throw new Error(`حجم الملف ${file.size} يتجاوز الحد المسموح ${maxSize}`);
            }
            
            if (!allowedTypes.includes(file.type)) {
                throw new Error(`نوع الملف ${file.type} غير مسموح`);
            }
            
            // التحقق من امتداد الملف
            const fileName = file.name.toLowerCase();
            if (!/\.(jpg|jpeg|png|webp|gif)$/.test(fileName)) {
                throw new Error('امتداد الملف غير مسموح');
            }
            
            // التحقق من اسم الملف
            if (/[<>:"/\\|?*]/.test(file.name)) {
                throw new Error('اسم الملف يحتوي على أحرف غير مسموحة');
            }
            
            return true;
        };
        
        // تطبيق التحقق على uploadBytes
        const originalUploadBytes = window.firebaseModules?.uploadBytes;
        if (originalUploadBytes) {
            window.firebaseModules.uploadBytes = async function(storageRef, file, metadata) {
                validateUploadFile(file);
                return originalUploadBytes.call(this, storageRef, file, metadata);
            };
        }
    }
    
    protectAuth() {
        // حماية عمليات المصادقة
        const originalCreateUser = window.firebaseModules?.createUserWithEmailAndPassword;
        const originalSignIn = window.firebaseModules?.signInWithEmailAndPassword;
        
        if (originalCreateUser) {
            window.firebaseModules.createUserWithEmailAndPassword = async function(auth, email, password) {
                // التحقق من قوة كلمة المرور
                if (password.length < 8) {
                    throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
                }
                
                // التحقق من تعقيد كلمة المرور
                const hasUpper = /[A-Z]/.test(password);
                const hasLower = /[a-z]/.test(password);
                const hasNumber = /\d/.test(password);
                
                if (!(hasUpper && hasLower && hasNumber)) {
                    throw new Error('كلمة المرور يجب أن تحتوي على أحرف كبيرة وصغيرة وأرقام');
                }
                
                // منع كلمات المرور الشائعة
                const commonPasswords = ['12345678', 'password', 'qwerty123', 'admin123'];
                if (commonPasswords.includes(password.toLowerCase())) {
                    throw new Error('كلمة المرور ضعيفة جداً');
                }
                
                return originalCreateUser.call(this, auth, email, password);
            };
        }
        
        if (originalSignIn) {
            window.firebaseModules.signInWithEmailAndPassword = async function(auth, email, password) {
                // تطبيق Rate Limiting
                const attempts = sessionStorage.getItem(`login_attempts_${email}`) || 0;
                if (attempts >= 5) {
                    const lastAttempt = sessionStorage.getItem(`last_attempt_${email}`);
                    if (Date.now() - lastAttempt < 900000) { // 15 دقيقة
                        throw new Error('تم تجاوز عدد المحاولات المسموح بها');
                    }
                }
                
                try {
                    const result = await originalSignIn.call(this, auth, email, password);
                    // إعادة تعيين المحاولات عند النجاح
                    sessionStorage.removeItem(`login_attempts_${email}`);
                    return result;
                } catch (error) {
                    // زيادة عدد المحاولات عند الفشل
                    const newAttempts = parseInt(attempts) + 1;
                    sessionStorage.setItem(`login_attempts_${email}`, newAttempts);
                    sessionStorage.setItem(`last_attempt_${email}`, Date.now());
                    throw error;
                }
            };
        }
    }
    
    // منع الوصول إلى بيانات Firebase الحساسة
    preventDataLeakage() {
        // إخفاء بيانات Firebase في console
        const originalLog = console.log;
        console.log = function(...args) {
            const filteredArgs = args.map(arg => {
                if (typeof arg === 'string' && 
                    (arg.includes('apiKey') || 
                     arg.includes('authDomain') || 
                     arg.includes('projectId'))) {
                    return '[Firebase Config Hidden]';
                }
                return arg;
            });
            originalLog.apply(console, filteredArgs);
        };
        
        // منع عرض الأخطاء الحساسة
        window.onerror = function(msg, url, line, col, error) {
            const safeMsg = msg.toString().replace(/apiKey=[^&]*/, 'apiKey=***');
            console.error('خطأ:', safeMsg);
            return true;
        };
    }
}

// التهيئة التلقائية
document.addEventListener('DOMContentLoaded', () => {
    new FirebaseSecurity();
});
