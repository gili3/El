// encryption.js - نظام التشفير المتقدم
class EncryptionSystem {
    constructor() {
        this.algorithm = {
            name: 'AES-GCM',
            length: 256
        };
        
        this.keyStorage = 'secure_key';
        this.initEncryption();
    }
    
    async initEncryption() {
        console.log('🔐 تهيئة نظام التشفير...');
        
        // إنشاء أو استرجاع مفتاح التشفير
        await this.ensureEncryptionKey();
        
        console.log('✅ نظام التشفير جاهز');
    }
    
    async ensureEncryptionKey() {
        let key = localStorage.getItem(this.keyStorage);
        
        if (!key) {
            // إنشاء مفتاح جديد
            key = await this.generateKey();
            localStorage.setItem(this.keyStorage, key);
        }
        
        return key;
    }
    
    async generateKey() {
        const key = await crypto.subtle.generateKey(
            {
                name: this.algorithm.name,
                length: this.algorithm.length
            },
            true,
            ['encrypt', 'decrypt']
        );
        
        const exported = await crypto.subtle.exportKey('jwk', key);
        return JSON.stringify(exported);
    }
    
    async encryptData(data) {
        try {
            const key = await this.getEncryptionKey();
            const encoder = new TextEncoder();
            const encodedData = encoder.encode(JSON.stringify(data));
            
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            const encrypted = await crypto.subtle.encrypt(
                {
                    name: this.algorithm.name,
                    iv: iv
                },
                key,
                encodedData
            );
            
            return {
                iv: Array.from(iv),
                data: Array.from(new Uint8Array(encrypted))
            };
        } catch (error) {
            console.error('خطأ في التشفير:', error);
            throw error;
        }
    }
    
    async decryptData(encryptedData) {
        try {
            const key = await this.getEncryptionKey();
            const { iv, data } = encryptedData;
            
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: this.algorithm.name,
                    iv: new Uint8Array(iv)
                },
                key,
                new Uint8Array(data)
            );
            
            const decoder = new TextDecoder();
            return JSON.parse(decoder.decode(decrypted));
        } catch (error) {
            console.error('خطأ في فك التشفير:', error);
            throw error;
        }
    }
    
    async getEncryptionKey() {
        const keyData = JSON.parse(localStorage.getItem(this.keyStorage));
        return await crypto.subtle.importKey(
            'jwk',
            keyData,
            this.algorithm,
            false,
            ['encrypt', 'decrypt']
        );
    }
    
    // تشفير البيانات الحساسة قبل التخزين
    async encryptSensitiveData() {
        const sensitiveFields = ['phone', 'email', 'address', 'password', 'token'];
        
        // تشفير البيانات في localStorage
        for (const key of Object.keys(localStorage)) {
            if (sensitiveFields.some(field => key.includes(field))) {
                try {
                    const value = localStorage.getItem(key);
                    const encrypted = await this.encryptData({ data: value });
                    localStorage.setItem(key, JSON.stringify(encrypted));
                } catch (error) {
                    console.warn(`فشل تشفير ${key}:`, error);
                }
            }
        }
        
        // تشفير البيانات في sessionStorage
        for (const key of Object.keys(sessionStorage)) {
            if (sensitiveFields.some(field => key.includes(field))) {
                try {
                    const value = sessionStorage.getItem(key);
                    const encrypted = await this.encryptData({ data: value });
                    sessionStorage.setItem(key, JSON.stringify(encrypted));
                } catch (error) {
                    console.warn(`فشل تشفير ${key}:`, error);
                }
            }
        }
    }
    
    // فك تشفير البيانات عند الاسترجاع
    async decryptSensitiveData(key) {
        try {
            const encrypted = localStorage.getItem(key) || sessionStorage.getItem(key);
            if (!encrypted) return null;
            
            const parsed = JSON.parse(encrypted);
            const decrypted = await this.decryptData(parsed);
            return decrypted.data;
        } catch (error) {
            console.warn(`فشل فك تشفير ${key}:`, error);
            return null;
        }
    }
    
    // تشفير البيانات المرسلة إلى Firebase
    async encryptForFirestore(data, fieldsToEncrypt = ['phone', 'email']) {
        const encryptedData = { ...data };
        
        for (const field of fieldsToEncrypt) {
            if (encryptedData[field]) {
                try {
                    const encrypted = await this.encryptData({ data: encryptedData[field] });
                    encryptedData[field] = JSON.stringify(encrypted);
                } catch (error) {
                    console.warn(`فشل تشفير حقل ${field}:`, error);
                }
            }
        }
        
        return encryptedData;
    }
    
    // فك تشفير البيانات المستلمة من Firebase
    async decryptFromFirestore(data, fieldsToDecrypt = ['phone', 'email']) {
        const decryptedData = { ...data };
        
        for (const field of fieldsToDecrypt) {
            if (decryptedData[field] && typeof decryptedData[field] === 'string') {
                try {
                    const parsed = JSON.parse(decryptedData[field]);
                    const decrypted = await this.decryptData(parsed);
                    decryptedData[field] = decrypted.data;
                } catch (error) {
                    console.warn(`فشل فك تشفير حقل ${field}:`, error);
                }
            }
        }
        
        return decryptedData;
    }
}

// التصدير للاستخدام
window.EncryptionSystem = EncryptionSystem;

// تهيئة النظام تلقائياً
document.addEventListener('DOMContentLoaded', async () => {
    window.encryption = new EncryptionSystem();
    
    // تشفير البيانات الحساسة الموجودة
    setTimeout(() => {
        window.encryption.encryptSensitiveData();
    }, 1000);
});

