# 🔐 دليل الأمان - Eleven Store

## نظرة عامة

تم تطبيق مجموعة شاملة من الإجراءات الأمنية لحماية موقع Eleven Store من التهديدات الشائعة.

---

## 1. رؤوس الأمان (Security Headers)

### الملف: `.htaccess`

تم تكوين رؤوس الأمان التالية على مستوى الخادم:

#### Content-Security-Policy (CSP)
- حماية ضد هجمات XSS و Code Injection
- تقييد مصادر تحميل السكريبتات والأنماط
- السماح فقط بالنطاقات الموثوقة (Firebase, Google, CDN)

#### Strict-Transport-Security (HSTS)
- إجبار استخدام HTTPS لمدة سنة كاملة
- تطبيق على جميع النطاقات الفرعية
- جاهز للإدراج في قائمة HSTS Preload

#### X-Frame-Options
- منع تضمين الموقع في iframes (حماية من Clickjacking)
- القيمة: `DENY`

#### X-Content-Type-Options
- منع MIME type sniffing
- القيمة: `nosniff`

#### Referrer-Policy
- التحكم في معلومات Referrer المرسلة
- القيمة: `strict-origin-when-cross-origin`

#### Permissions-Policy
- تعطيل الوصول إلى الكاميرا، الميكروفون، الموقع الجغرافي، إلخ
- تقليل سطح الهجوم

---

## 2. حماية مفاتيح Firebase API

### المشكلة السابقة:
- مفاتيح API مكشوفة في ملفات JavaScript العامة

### الحل المطبق:

#### أ) ملف `.env.example`
- قالب لتخزين المفاتيح في متغيرات البيئة
- يجب نسخه إلى `.env` وإضافة القيم الفعلية
- `.env` مُضاف إلى `.gitignore`

#### ب) `firebase-config-secure.js`
- نظام آمن لتحميل إعدادات Firebase
- يدعم التحميل من الخادم (موصى به للإنتاج)
- Fallback للتحميل المحلي (للتطوير فقط)

#### ج) توصيات إضافية:

**1. Firebase App Check:**
```javascript
// تفعيل في Firebase Console
// يمنع الوصول غير المصرح به حتى لو كان المفتاح مكشوفاً
```

**2. Firebase Security Rules:**
```javascript
// Firestore Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // السماح بالقراءة للجميع
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // حماية بيانات المستخدمين
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // حماية الطلبات
    match /orders/{orderId} {
      allow read: if request.auth != null && 
                     (resource.data.userId == request.auth.uid || 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
                       get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

**3. تقييد النطاقات في Firebase Console:**
- الذهاب إلى Project Settings > General
- في قسم "Your apps" > Web app
- تحت "App Check" تفعيل reCAPTCHA Enterprise
- في "API restrictions" إضافة النطاقات المسموح بها فقط

---

## 3. تحديث هاشات التحقق من النزاهة

### الملف: `js/integrity-check.js`

تم تحديث الهاشات بالقيم الفعلية SHA-256:

```javascript
this.expectedHashes = {
    'app-core.js': '1cd23589136426aa8f32378da415da2ed1d57cba5078a2f04d68984b4ab778a0',
    'auth-system.js': '23b89defd5e50c02810b89163f5c93167fca81ee0012994c09a42bb9626fbefd',
    'cart-system.js': '972364c647ff20ffe91ca3eb0b5b0710f1c6a543dd11acec8b4359852aa5802e',
    'checkout-system.js': 'f832e8650bd5d97c485ec1a3a02a4b288f913f441c0b92d6ad98ab50ac096ff6',
    'firebase-security.js': '588eda05606206249346373cb2b0be81e5b4dfd4906d66f167c41bc2ae6d5d90',
    'main.js': '32be3e3710924ffa054fc209fbbd6fea41873d269a9182a203e6ef809aa972e3',
    'products-system.js': '6021b3476a350813976fc5cbef363b871b327da0fa80136dfc3dc01509687307',
    'security-system.js': 'dab16d6a5d5c8424a4f4aabbab8fc24dc8625a1dba1e40ee763607052ef488f0'
};
```

### كيفية تحديث الهاشات بعد تعديل الملفات:

```bash
# في Linux/Mac
cd js/
sha256sum filename.js

# في Windows (PowerShell)
Get-FileHash filename.js -Algorithm SHA256
```

---

## 4. المصادقة الثنائية (2FA)

### الملف: `js/two-factor-auth.js`

تم تطبيق نظام مصادقة ثنائية كامل باستخدام TOTP (Time-based One-Time Password).

### الميزات:

#### أ) التفعيل:
```javascript
// تفعيل 2FA للمستخدم الحالي
await window.twoFactorAuth.enable();
```

- توليد مفتاح سري فريد
- إنشاء QR Code للمسح
- توليد 10 رموز احتياطية
- حفظ الإعدادات في Firestore

#### ب) التحقق:
```javascript
// التحقق من رمز 2FA
const isValid = await window.twoFactorAuth.verify(code);
```

- دعم رموز TOTP (6 أرقام)
- دعم الرموز الاحتياطية
- نافذة زمنية 30 ثانية
- حماية من Brute Force (3 محاولات فقط)

#### ج) التطبيقات المدعومة:
- Google Authenticator
- Microsoft Authenticator
- Authy
- 1Password
- أي تطبيق يدعم TOTP

### التكامل مع تسجيل الدخول:

```javascript
// في نظام المصادقة
async function loginWithEmail(email, password) {
    // تسجيل الدخول العادي
    await signInWithEmailAndPassword(auth, email, password);
    
    // التحقق من تفعيل 2FA
    if (user.twoFactorEnabled) {
        const verified = await window.twoFactorAuth.showVerificationModal();
        if (!verified) {
            await signOut(auth);
            throw new Error('فشل التحقق الثنائي');
        }
    }
}
```

---

## 5. حماية مجلد الأدمن

### الملف: `admin/admin-protection.js`

تم تطبيق طبقات حماية متعددة:

#### أ) التحقق من الصلاحيات:
- التحقق من تسجيل الدخول
- التحقق من دور المستخدم (admin/superadmin)
- التحقق من المصادقة الثنائية
- تسجيل جميع محاولات الوصول

#### ب) حماية الجلسة:
- انتهاء الجلسة بعد 30 دقيقة من عدم النشاط
- مراقبة تغيير المستخدم
- مسح البيانات الحساسة عند الإغلاق

#### ج) حماية المحتوى:
- منع فتح أدوات المطورين (F12, Ctrl+Shift+I)
- منع القائمة السياقية (Right-click)
- منع النسخ والتحديد
- اكتشاف فتح DevTools

#### د) Rate Limiting:
- 5 محاولات تسجيل دخول فقط
- حظر لمدة 15 دقيقة بعد تجاوز الحد
- تتبع المحاولات في localStorage

#### هـ) حماية على مستوى الخادم (`.htaccess`):

```apache
<Directory "/admin">
    # منع عرض محتويات المجلد
    Options -Indexes
    
    # رؤوس أمان إضافية
    Header set X-Robots-Tag "noindex, nofollow"
    Header set Cache-Control "no-store, no-cache"
    
    # اختياري: مصادقة HTTP Basic
    # AuthType Basic
    # AuthName "Admin Area"
    # AuthUserFile /path/to/.htpasswd
    # Require valid-user
</Directory>
```

---

## 6. تحسينات أمنية إضافية

### أ) حماية الملفات الحساسة:

```apache
# في .htaccess
<FilesMatch "\.(env|config|ini|log|sh|sql|bak)$">
    Deny from all
</FilesMatch>
```

### ب) منع Hotlinking:

```apache
RewriteCond %{HTTP_REFERER} !^$
RewriteCond %{HTTP_REFERER} !^https?://(www\.)?yourdomain\.com [NC]
RewriteRule \.(jpg|jpeg|png|gif)$ - [F,L]
```

### ج) حماية من SQL Injection و XSS:

```apache
RewriteCond %{QUERY_STRING} (\<|%3C).*script.*(\>|%3E) [NC,OR]
RewriteCond %{QUERY_STRING} (javascript\:|data\:|vbscript\:) [NC]
RewriteRule ^(.*)$ - [F,L]
```

### د) ضغط وتخزين مؤقت:

```apache
# Gzip Compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css application/javascript
</IfModule>

# Browser Caching
<IfModule mod_expires.c>
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType text/css "access plus 1 month"
</IfModule>
```

---

## 7. قائمة التحقق (Checklist)

### قبل النشر:

- [ ] نسخ `.env.example` إلى `.env` وإضافة المفاتيح الفعلية
- [ ] التأكد من إضافة `.env` إلى `.gitignore`
- [ ] تفعيل Firebase App Check
- [ ] تطبيق Firebase Security Rules
- [ ] تقييد API Key على النطاقات المسموح بها
- [ ] رفع ملف `.htaccess` إلى الخادم
- [ ] التأكد من تفعيل HTTPS
- [ ] اختبار رؤوس الأمان باستخدام [SecurityHeaders.com](https://securityheaders.com)
- [ ] تفعيل 2FA لجميع حسابات الأدمن
- [ ] إنشاء نسخة احتياطية من قاعدة البيانات
- [ ] مراجعة سجلات الوصول بشكل دوري

### بعد النشر:

- [ ] اختبار تسجيل الدخول مع 2FA
- [ ] التحقق من عمل حماية الأدمن
- [ ] اختبار integrity checks
- [ ] مراقبة سجلات Firebase
- [ ] إعداد تنبيهات للأنشطة المشبوهة

---

## 8. الصيانة الدورية

### يومياً:
- مراجعة سجلات الوصول إلى لوحة الأدمن
- التحقق من محاولات تسجيل الدخول الفاشلة

### أسبوعياً:
- مراجعة Firebase Security Rules
- التحقق من تحديثات الأمان للمكتبات المستخدمة
- اختبار نظام النسخ الاحتياطي

### شهرياً:
- تحديث هاشات integrity-check.js بعد أي تعديلات
- مراجعة صلاحيات المستخدمين
- تدوير المفاتيح السرية (إن أمكن)
- اختبار اختراق أساسي

---

## 9. التعامل مع الحوادث الأمنية

### في حالة اكتشاف اختراق:

1. **العزل الفوري:**
   - تعطيل الموقع مؤقتاً
   - تغيير جميع كلمات المرور
   - إلغاء جميع الجلسات النشطة

2. **التحقيق:**
   - مراجعة سجلات Firebase
   - فحص ملفات الموقع للتعديلات
   - تحديد نقطة الاختراق

3. **الإصلاح:**
   - إصلاح الثغرة الأمنية
   - استعادة من نسخة احتياطية نظيفة
   - تحديث جميع المفاتيح والأسرار

4. **الوقاية:**
   - تطبيق إجراءات أمنية إضافية
   - تحديث جميع المكتبات
   - تدريب الفريق

---

## 10. موارد إضافية

### أدوات الاختبار:
- [SecurityHeaders.com](https://securityheaders.com) - اختبار رؤوس الأمان
- [SSL Labs](https://www.ssllabs.com/ssltest/) - اختبار SSL/TLS
- [Observatory by Mozilla](https://observatory.mozilla.org) - تقييم أمني شامل
- [OWASP ZAP](https://www.zaproxy.org) - اختبار الاختراق

### مراجع:
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Firebase Security Documentation](https://firebase.google.com/docs/rules)
- [Content Security Policy Reference](https://content-security-policy.com)
- [Web Security Academy](https://portswigger.net/web-security)

---

## 11. الاتصال

في حالة اكتشاف ثغرة أمنية، يرجى الإبلاغ فوراً:
- البريد الإلكتروني: security@elevenstore.com
- لا تنشر الثغرات علناً قبل الإصلاح

---

**آخر تحديث:** 24 يناير 2026  
**الإصدار:** 1.0  
**الحالة:** ✅ جاهز للإنتاج
