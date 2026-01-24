# 🔧 دليل التكامل - Eleven Store Security Updates

## نظرة عامة

هذا الدليل يشرح كيفية دمج التحديثات الأمنية الجديدة مع الموقع الحالي.

---

## 1. الملفات الجديدة المضافة

### ملفات الأمان الأساسية:

```
📁 الجذر (Root)
├── .htaccess                    ← رؤوس الأمان وحماية الخادم
├── .env.example                 ← قالب متغيرات البيئة
├── .gitignore                   ← حماية الملفات الحساسة
├── SECURITY-README.md           ← دليل الأمان الشامل
├── security-analysis.md         ← تحليل المشاكل الأمنية
└── security-test.html           ← صفحة اختبار الأمان

📁 js/
├── integrity-check.js           ← محدث بالهاشات الفعلية
├── firebase-config-secure.js    ← نظام آمن لتحميل Firebase
└── two-factor-auth.js           ← نظام المصادقة الثنائية

📁 admin/
└── admin-protection.js          ← حماية لوحة الأدمن
```

---

## 2. خطوات التكامل

### الخطوة 1: رفع ملف .htaccess

**مهم جداً:** هذا الملف يجب رفعه إلى جذر الموقع على الخادم.

```bash
# رفع عبر FTP/SFTP
# تأكد من أن الملف يبدأ بنقطة: .htaccess
# وليس htaccess.txt أو .htaccess.txt
```

**اختبار:**
```bash
# تحقق من وجود الملف
curl -I https://yourdomain.com/.htaccess
# يجب أن تحصل على 403 Forbidden (هذا صحيح!)
```

---

### الخطوة 2: إعداد متغيرات البيئة

#### أ) نسخ .env.example إلى .env:

```bash
cp .env.example .env
```

#### ب) تحرير .env وإضافة المفاتيح الفعلية:

```env
FIREBASE_API_KEY=AIzaSyB1vNmCapPK0MI4H_Q0ilO7OnOgZa02jx0
FIREBASE_AUTH_DOMAIN=queen-beauty-b811b.firebaseapp.com
FIREBASE_PROJECT_ID=queen-beauty-b811b
FIREBASE_STORAGE_BUCKET=queen-beauty-b811b.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=418964206430
FIREBASE_APP_ID=1:418964206430:web:8c9451fc56ca7f956bd5cf
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

#### ج) التأكد من حماية .env:

```bash
# تحقق من .gitignore
grep "\.env" .gitignore

# يجب أن يكون موجوداً
```

---

### الخطوة 3: تحديث index.html

أضف السكريبتات الجديدة قبل إغلاق `</body>`:

```html
<!-- في نهاية index.html قبل </body> -->

<!-- نظام Firebase الآمن -->
<script src="js/firebase-config-secure.js"></script>

<!-- نظام المصادقة الثنائية -->
<script src="js/two-factor-auth.js"></script>

<!-- ملاحظة: integrity-check.js موجود بالفعل ومحدث -->
```

---

### الخطوة 4: تحديث admin/index.html

أضف حماية الأدمن في بداية `<body>`:

```html
<!-- في بداية admin/index.html بعد <body> -->

<!-- نظام حماية الأدمن -->
<script src="admin-protection.js"></script>

<!-- نظام المصادقة الثنائية -->
<script src="../js/two-factor-auth.js"></script>
```

---

### الخطوة 5: تحديث نظام تسجيل الدخول

#### في auth-system.js أو admin.js:

```javascript
// بعد تسجيل الدخول الناجح
async function handleSuccessfulLogin(user) {
    try {
        // التحقق من تفعيل 2FA
        const db = window.firebaseModules.getFirestore(window.firebaseApp);
        const userDoc = await window.firebaseModules.getDoc(
            window.firebaseModules.doc(db, 'users', user.uid)
        );
        
        if (userDoc.exists() && userDoc.data().twoFactorEnabled) {
            // طلب رمز 2FA
            const verified = await window.twoFactorAuth.showVerificationModal();
            
            if (!verified) {
                // فشل التحقق - تسجيل الخروج
                await window.firebaseModules.signOut(window.firebaseModules.getAuth());
                throw new Error('فشل التحقق الثنائي');
            }
        }
        
        // متابعة تسجيل الدخول
        console.log('✅ تسجيل دخول ناجح');
        
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        throw error;
    }
}
```

---

### الخطوة 6: إضافة واجهة تفعيل 2FA

#### في صفحة الإعدادات أو الملف الشخصي:

```html
<!-- في صفحة الإعدادات -->
<div class="settings-section">
    <h3>🔐 المصادقة الثنائية (2FA)</h3>
    <p>أضف طبقة حماية إضافية لحسابك</p>
    
    <div id="2fa-status">
        <!-- سيتم ملؤها بواسطة JavaScript -->
    </div>
    
    <button id="toggle2FA" class="btn-primary">
        تفعيل المصادقة الثنائية
    </button>
</div>

<script>
// عرض حالة 2FA
async function display2FAStatus() {
    const user = window.firebaseModules.getAuth().currentUser;
    if (!user) return;
    
    const db = window.firebaseModules.getFirestore(window.firebaseApp);
    const userDoc = await window.firebaseModules.getDoc(
        window.firebaseModules.doc(db, 'users', user.uid)
    );
    
    const is2FAEnabled = userDoc.exists() && userDoc.data().twoFactorEnabled;
    
    const statusDiv = document.getElementById('2fa-status');
    const toggleBtn = document.getElementById('toggle2FA');
    
    if (is2FAEnabled) {
        statusDiv.innerHTML = '<span style="color: green;">✅ مفعل</span>';
        toggleBtn.textContent = 'تعطيل المصادقة الثنائية';
        toggleBtn.onclick = disable2FA;
    } else {
        statusDiv.innerHTML = '<span style="color: red;">❌ غير مفعل</span>';
        toggleBtn.textContent = 'تفعيل المصادقة الثنائية';
        toggleBtn.onclick = enable2FA;
    }
}

// تفعيل 2FA
async function enable2FA() {
    try {
        await window.twoFactorAuth.enable();
        alert('✅ تم تفعيل المصادقة الثنائية بنجاح!');
        display2FAStatus();
    } catch (error) {
        alert('❌ حدث خطأ: ' + error.message);
    }
}

// تعطيل 2FA
async function disable2FA() {
    const code = prompt('أدخل رمز التحقق لتعطيل المصادقة الثنائية:');
    if (!code) return;
    
    try {
        await window.twoFactorAuth.disable(code);
        alert('✅ تم تعطيل المصادقة الثنائية');
        display2FAStatus();
    } catch (error) {
        alert('❌ حدث خطأ: ' + error.message);
    }
}

// عرض الحالة عند التحميل
display2FAStatus();
</script>
```

---

### الخطوة 7: تكوين Firebase

#### أ) Firebase Security Rules:

في Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // المنتجات - قراءة للجميع، كتابة للأدمن فقط
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'superadmin'];
    }
    
    // المستخدمين - قراءة وكتابة للمالك فقط
    match /users/{userId} {
      allow read: if request.auth != null && 
                     (request.auth.uid == userId || 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'superadmin']);
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // الطلبات
    match /orders/{orderId} {
      allow read: if request.auth != null && 
                     (resource.data.userId == request.auth.uid || 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'superadmin']);
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow update: if request.auth != null && 
                       get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'superadmin'];
      allow delete: if false; // لا يمكن حذف الطلبات
    }
    
    // سجلات وصول الأدمن - الأدمن فقط
    match /admin_access_logs/{logId} {
      allow read: if request.auth != null && 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'superadmin'];
      allow write: if request.auth != null;
    }
    
    // الإعدادات - قراءة للجميع، كتابة للأدمن فقط
    match /settings/{settingId} {
      allow read: if true;
      allow write: if request.auth != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'superadmin'];
    }
  }
}
```

#### ب) تفعيل Firebase App Check:

1. اذهب إلى Firebase Console
2. Project Settings > App Check
3. اضغط Register لتطبيق الويب
4. اختر reCAPTCHA v3 أو reCAPTCHA Enterprise
5. أضف النطاقات المسموح بها
6. انسخ Site Key

في index.html:

```html
<!-- قبل تهيئة Firebase -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js"></script>

<script>
// بعد تهيئة Firebase
const appCheck = firebase.appCheck();
appCheck.activate('YOUR_RECAPTCHA_SITE_KEY', true);
</script>
```

#### ج) تقييد API Key:

1. اذهب إلى Google Cloud Console
2. APIs & Services > Credentials
3. اختر API Key الخاص بـ Firebase
4. في Application restrictions:
   - اختر HTTP referrers
   - أضف: `yourdomain.com/*` و `*.yourdomain.com/*`
5. في API restrictions:
   - اختر Restrict key
   - فعّل فقط: Firebase APIs

---

## 3. الاختبار

### أ) اختبار رؤوس الأمان:

افتح: https://securityheaders.com

أدخل رابط موقعك واضغط Scan.

**النتيجة المتوقعة:** تقييم A أو A+

### ب) اختبار SSL:

افتح: https://www.ssllabs.com/ssltest/

**النتيجة المتوقعة:** تقييم A أو A+

### ج) اختبار الأمان الشامل:

افتح الملف: `security-test.html` في المتصفح

اضغط "تشغيل جميع الاختبارات"

**النتيجة المتوقعة:** معظم الاختبارات ناجحة (خضراء)

### د) اختبار 2FA:

1. سجل دخول كأدمن
2. اذهب إلى الإعدادات
3. فعّل المصادقة الثنائية
4. امسح QR Code بتطبيق Authenticator
5. سجل خروج ثم دخول مرة أخرى
6. يجب أن يطلب منك رمز التحقق

### هـ) اختبار حماية الأدمن:

1. افتح `/admin/index.html` بدون تسجيل دخول
2. يجب أن يتم رفض الوصول تلقائياً
3. سجل دخول كمستخدم عادي (ليس أدمن)
4. حاول الوصول إلى `/admin/`
5. يجب أن يتم رفض الوصول

---

## 4. التحقق من النشر

بعد رفع جميع الملفات، تحقق من:

- [ ] ملف .htaccess موجود ويعمل
- [ ] رؤوس الأمان مفعلة (اختبر على securityheaders.com)
- [ ] HTTPS مفعل وإجباري
- [ ] Firebase Security Rules محدثة
- [ ] Firebase App Check مفعل
- [ ] API Key مقيد على النطاقات المسموح بها
- [ ] نظام 2FA يعمل بشكل صحيح
- [ ] حماية الأدمن تعمل
- [ ] integrity-check.js يعمل بالهاشات الصحيحة
- [ ] ملف .env غير متاح للعامة
- [ ] ملفات .git محمية

---

## 5. الصيانة

### تحديث الهاشات بعد تعديل الملفات:

```bash
# احسب الهاش الجديد
sha256sum js/filename.js

# حدّث في js/integrity-check.js
# في expectedHashes object
```

### مراقبة السجلات:

```javascript
// في Firebase Console > Firestore
// تحقق من collection: admin_access_logs
// ابحث عن أنشطة مشبوهة
```

### تحديث الرموز الاحتياطية:

```javascript
// إذا استخدم المستخدم جميع الرموز الاحتياطية
// يجب إنشاء رموز جديدة
await window.twoFactorAuth.generateBackupCodes(10);
```

---

## 6. استكشاف الأخطاء

### مشكلة: رؤوس الأمان لا تظهر

**الحل:**
- تأكد من رفع .htaccess إلى الجذر
- تأكد من أن mod_headers مفعل على الخادم
- اتصل بالاستضافة لتفعيل mod_headers

### مشكلة: 2FA لا يعمل

**الحل:**
- تحقق من تحميل two-factor-auth.js
- افتح Console وابحث عن أخطاء
- تأكد من أن الوقت على الخادم صحيح

### مشكلة: Firebase يرفض الطلبات

**الحل:**
- تحقق من Firebase Security Rules
- تأكد من أن المستخدم مسجل دخول
- تحقق من دور المستخدم في Firestore

### مشكلة: حماية الأدمن لا تعمل

**الحل:**
- تأكد من تحميل admin-protection.js
- تحقق من أن المستخدم لديه role: 'admin'
- افتح Console وابحث عن رسائل الخطأ

---

## 7. الدعم

للمساعدة أو الإبلاغ عن مشاكل:
- راجع SECURITY-README.md للتفاصيل الكاملة
- افتح security-test.html للتشخيص
- تحقق من Console في المتصفح

---

**تم التحديث:** 24 يناير 2026  
**الإصدار:** 1.0
