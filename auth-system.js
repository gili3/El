// auth-system.js - نظام المصادقة والمستخدمين
// ======================== معالجة حالة المصادقة ========================

// 🔐 Rate Limiting System
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 دقيقة

/**
 * التحقق من Rate Limiting
 */
function checkLoginRateLimit(email) {
    const now = Date.now();
    const attempts = loginAttempts.get(email) || [];
    
    // إزالة المحاولات القديمة
    const recentAttempts = attempts.filter(time => now - time < LOCKOUT_TIME);
    
    if (recentAttempts.length >= MAX_ATTEMPTS) {
        const oldestAttempt = recentAttempts[0];
        const timeLeft = LOCKOUT_TIME - (now - oldestAttempt);
        const minutesLeft = Math.ceil(timeLeft / 60000);
        
        logSecurityEvent('rate_limit_exceeded', { email, attempts: recentAttempts.length });
        
        throw new Error(`تم تجاوز الحد المسموح من المحاولات. يرجى المحاولة بعد ${minutesLeft} دقيقة`);
    }
    
    return recentAttempts.length;
}

/**
 * تسجيل محاولة الدخول
 */
function recordLoginAttempt(email, success) {
    const attempts = loginAttempts.get(email) || [];
    attempts.push(Date.now());
    
    // الحفاظ على آخر 10 محاولات فقط
    if (attempts.length > 10) {
        attempts.splice(0, attempts.length - 10);
    }
    
    loginAttempts.set(email, attempts);
    
    if (success) {
        // إعادة تعيين عند نجاح الدخول
        loginAttempts.delete(email);
        logSecurityEvent('login_success', { email });
    } else {
        logSecurityEvent('login_failed', { email, attempts: attempts.length });
    }
}

async function handleAuthStateChange(user) {
    try {
        if (user) {
            console.log('👤 مستخدم مسجل دخول:', user.uid);
            currentUser = user;
            isGuest = false;
            
            // 🔐 تسجيل حدث الدخول الناجح
            logSecurityEvent('user_logged_in', { 
                uid: user.uid,
                email: user.email,
                provider: user.providerData?.[0]?.providerId || 'email'
            });
            
            // التحقق من الصلاحيات وجلب البيانات
            await checkAdminPermissions(user.uid);
            
            // جلب بيانات المستخدم الإضافية من Firestore
            const userDoc = await window.firebaseModules.getDoc(window.firebaseModules.doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                currentUser.phone = userData.phone || '';
                currentUser.address = userData.address || '';
                currentUser.displayName = userData.name || user.displayName;
            }
            
            // تخزين آمن للبيانات
            secureStore('currentUser', {
                uid: currentUser.uid,
                displayName: currentUser.displayName || '',
                email: currentUser.email || '',
                photoURL: currentUser.photoURL || '',
                isGuest: false,
                isAdmin: isAdmin || false,
                timestamp: Date.now()
            }, 120); // صلاحية ساعتين
            
            // مزامنة البيانات من Firestore عند تسجيل الدخول
            await syncUserDataFromFirestore();
            if (typeof loadCartFromFirebase === 'function') await loadCartFromFirebase();
            
            // تحديث الواجهة
            if (typeof updateUserProfile === 'function') updateUserProfile();
            if (typeof loadProducts === 'function') await loadProducts();
            if (typeof updateCartCount === 'function') updateCartCount();
            if (typeof updateAdminButton === 'function') updateAdminButton();
            
            if (document.querySelector(".section.active")?.id === "checkout") {
                if (typeof updateCheckoutSummary === 'function') updateCheckoutSummary();
            } else {
                showMainApp();
                const currentSec = document.querySelector(".section.active");
                if (!currentSec || currentSec.id === 'authScreen') {
                    if (typeof showSection === 'function') showSection("home");
                    updateHeaderLayout();
                }
            }
            
            // تفعيل نظام الإشعارات
            if (window.setupOrderStatusListener) {
                window.setupOrderStatusListener().catch(e => console.error('Order status listener error:', e));
            }
            
            if (typeof showToast === 'function') showToast(`مرحباً بعودتك ${escapeHTML(currentUser.displayName || 'مستخدم')}!`, 'success');
        } else {
            const savedUser = secureRetrieve('currentUser');
            if (savedUser && savedUser.isGuest) {
                currentUser = savedUser;
                isGuest = true;
                isAdmin = false;
                
                showMainApp();
                if (typeof showSection === 'function') showSection('home');
                updateHeaderLayout();
                if (typeof updateUserProfile === 'function') updateUserProfile();
                if (typeof loadProducts === 'function') await loadProducts();
                if (typeof updateCartCount === 'function') updateCartCount();
                if (typeof updateAdminButton === 'function') updateAdminButton();
                
                console.log('👤 تم استعادة المستخدم الضيف');
            } else {
                showAuthScreen();
            }
        }
        
        if (typeof hideLoader === 'function') hideLoader();
        
    } catch (error) {
        console.error('❌ خطأ في معالجة حالة المصادقة:', error);
        logSecurityEvent('auth_state_error', { error: error.message });
        
        if (typeof hideLoader === 'function') hideLoader();
        showAuthScreen();
    }
}

function handleAuthError() {
    console.log('⚠️ فشل الاتصال بمصادقة Firebase');
    logSecurityEvent('firebase_auth_error', { type: 'connection_failed' });
    
    const savedUser = secureRetrieve('currentUser');
    if (savedUser && savedUser.isGuest) {
        currentUser = savedUser;
        isGuest = true;
        isAdmin = false;
        
        showMainApp();
        if (typeof showSection === 'function') showSection('home');
        updateHeaderLayout();
        if (typeof updateUserProfile === 'function') updateUserProfile();
        if (typeof loadProducts === 'function') loadProducts();
        if (typeof updateCartCount === 'function') updateCartCount();
        if (typeof updateAdminButton === 'function') updateAdminButton();
        
        if (typeof showToast === 'function') showToast('تم الاتصال في وضع عدم الاتصال', 'warning');
        if (typeof hideLoader === 'function') hideLoader();
        return;
    }
    
    if (typeof forceHideLoader === 'function') forceHideLoader();
    showAuthScreen();
    if (typeof showToast === 'function') showToast('تعذر الاتصال بالخادم. يمكنك الدخول كضيف.', 'warning');
}

// ======================== إدارة المستخدمين ========================

function signInAsGuest() {
    console.log('👤 تسجيل الدخول كضيف...');
    logSecurityEvent('guest_login');
    
    // تصفير البيانات السابقة تماماً قبل الدخول كضيف
    localStorage.removeItem('userPhone');
    localStorage.removeItem('userAddress');
    document.querySelectorAll('input').forEach(i => i.value = '');
    
    currentUser = {
        uid: generateGuestUID(),
        displayName: 'زائر',
        email: null,
        photoURL: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        isGuest: true,
        phone: '',
        address: ''
    };
    
    isGuest = true;
    isAdmin = false;
    cartItems = [];
    favorites = [];
    
    secureStore('currentUser', currentUser, 240); // صلاحية 4 ساعات للضيف
    
    showMainApp();
    if (typeof showSection === 'function') showSection('home');
    updateHeaderLayout();
    if (typeof updateUserProfile === 'function') updateUserProfile();
    if (typeof loadProducts === 'function') loadProducts();
    if (typeof updateCartCount === 'function') updateCartCount();
    if (typeof updateAdminButton === 'function') updateAdminButton();
    
    if (typeof showToast === 'function') showToast('تم الدخول كضيف بنجاح', 'success');
}

async function signInWithGoogle() {
    try {
        console.log('🔑 تسجيل الدخول بـ Google...');
        
        if (!checkFirebaseSDK || !checkFirebaseSDK() || !initializeFirebase()) {
            if (typeof showToast === 'function') showToast('تعذر الاتصال بخدمة المصادقة', 'error');
            return;
        }
        
        // 🔐 تطهير الجلسات السابقة
        sessionStorage.removeItem('temp_auth_data');
        
        const provider = new window.firebaseModules.GoogleAuthProvider();
        // إضافة نطاقات إضافية للحصول على بيانات أكثر
        provider.addScope('profile');
        provider.addScope('email');
        
        const result = await window.firebaseModules.signInWithPopup(auth, provider);
        currentUser = result.user;
        isGuest = false;
        
        // تسجيل محاولة ناجحة
        recordLoginAttempt(currentUser.email, true);
        
        // جلب بيانات المستخدم أو إنشاؤها
        await checkAndUpdateUserInFirestore(currentUser);
        const isAdminUser = await checkAdminPermissions(currentUser.uid);
        
        // جلب البيانات الإضافية من Firestore
        const userDoc = await window.firebaseModules.getDoc(window.firebaseModules.doc(db, "users", currentUser.uid));
        let phone = '', address = '';
        if (userDoc.exists()) {
            const userData = userDoc.data();
            phone = userData.phone || '';
            address = userData.address || '';
            currentUser.displayName = userData.name || currentUser.displayName;
        }

        const userToSave = {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            phone: phone,
            address: address,
            isGuest: false,
            isAdmin: isAdminUser
        };
        
        secureStore('currentUser', userToSave, 120);
        
        // تصفير الحقول قبل الدخول
        document.querySelectorAll('input').forEach(i => i.value = '');
        
        showMainApp();
        if (typeof showSection === 'function') showSection('home');
        updateHeaderLayout();
        if (typeof updateUserProfile === 'function') updateUserProfile();
        if (typeof loadProducts === 'function') await loadProducts();
        if (typeof updateCartCount === 'function') updateCartCount();
        if (typeof updateAdminButton === 'function') updateAdminButton();
        
        // تفعيل نظام الإشعارات
        if (window.setupOrderStatusListener) {
            window.setupOrderStatusListener().catch(e => console.error('Order status listener error:', e));
        }
        
        if (typeof showToast === 'function') showToast(`مرحباً بك ${escapeHTML(currentUser.displayName || 'مستخدم')}!`, 'success');
        
    } catch (error) {
        console.error('❌ خطأ في تسجيل الدخول بـ Google:', error);
        
        // تسجيل محاولة فاشلة
        if (error.email) {
            recordLoginAttempt(error.email, false);
        }
        
        let errorMessage = 'حدث خطأ في تسجيل الدخول';
        
        switch (error.code) {
            case 'auth/popup-blocked':
                errorMessage = 'تم حظر نافذة الدخول. يرجى السماح بالنوافذ المنبثقة';
                break;
            case 'auth/popup-closed-by-user':
                errorMessage = 'تم إغلاق نافذة الدخول';
                break;
            case 'auth/unauthorized-domain':
                errorMessage = 'هذا النطاق غير مصرح به';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'خطأ في الاتصال بالشبكة';
                break;
        }
        
        logSecurityEvent('google_login_failed', { error: error.code });
        
        if (typeof showToast === 'function') showToast(errorMessage, 'error');
    }
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

function clearRegistrationForm() {
    const nameInput = document.getElementById('registerName');
    const emailInput = document.getElementById('registerEmail');
    const passwordInput = document.getElementById('registerPassword');
    const phoneInput = document.getElementById('registerPhone');
    
    if (nameInput) nameInput.value = '';
    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (phoneInput) phoneInput.value = '';
    
    const authMessage = document.getElementById('emailAuthMessage');
    if (authMessage) {
        authMessage.textContent = '';
        authMessage.className = 'auth-message';
    }
}

async function signUpWithEmail(email, password, name, phone = '') {
    try {
        console.log('📝 إنشاء حساب جديد...');
        
        // 🔐 تطهير المدخلات
        const cleanEmail = sanitizeEmail(email);
        const cleanName = sanitizeInput(name, 50);
        const cleanPhone = sanitizePhone(phone);
        
        if (!cleanName || !cleanEmail || !password) {
            if (typeof showToast === 'function') showToast('الرجاء ملء جميع الحقول المطلوبة', 'warning');
            return false;
        }
        
        if (password.length < 6) {
            if (typeof showToast === 'function') showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'warning');
            return false;
        }
        
        if (!validateEmail(cleanEmail)) {
            if (typeof showToast === 'function') showToast('البريد الإلكتروني غير صالح', 'warning');
            return false;
        }
        
        if (!checkFirebaseSDK || !checkFirebaseSDK() || !initializeFirebase()) {
            if (typeof showToast === 'function') showToast('تعذر الاتصال بخدمة التسجيل', 'error');
            return false;
        }
        
        // 🔐 التحقق من Rate Limiting للتسجيل
        checkLoginRateLimit(cleanEmail + '_register');
        
        const result = await window.firebaseModules.createUserWithEmailAndPassword(auth, cleanEmail, password);
        
        await window.firebaseModules.updateProfile(result.user, {
            displayName: cleanName,
            photoURL: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
        });
        
        currentUser = result.user;
        isGuest = false;
        isAdmin = false;
        
        const userData = {
            email: cleanEmail,
            name: cleanName,
            phone: cleanPhone,
            address: '',
            photoURL: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
            role: 'user',
            isAdmin: false,
            isGuest: false,
            isActive: true,
            totalOrders: 0,
            totalSpent: 0,
            favorites: [],
            createdAt: window.firebaseModules.serverTimestamp(),
            updatedAt: window.firebaseModules.serverTimestamp()
        };
        
        const userRef = window.firebaseModules.doc(db, "users", currentUser.uid);
        await window.firebaseModules.setDoc(userRef, userData);
        
        console.log('✅ تم إنشاء حساب المستخدم بنجاح في قاعدة البيانات');
        logSecurityEvent('user_registered', { uid: currentUser.uid, email: cleanEmail });
        
        showMainApp();
        if (typeof showSection === 'function') showSection('home');
        updateHeaderLayout();
        if (typeof updateUserProfile === 'function') updateUserProfile();
        if (typeof loadProducts === 'function') await loadProducts();
        if (typeof updateCartCount === 'function') updateCartCount();
        if (typeof updateAdminButton === 'function') updateAdminButton();
        
        if (typeof showToast === 'function') showToast(`تم إنشاء حسابك بنجاح ${escapeHTML(cleanName)}!`, 'success');
        hideEmailAuthForm();
        clearRegistrationForm();
        
        return true;
        
    } catch (error) {
        console.error('❌ خطأ في إنشاء الحساب:', error);
        logSecurityEvent('registration_failed', { error: error.code, email: email });
        
        let errorMessage = 'حدث خطأ في إنشاء الحساب';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
                break;
            case 'auth/invalid-email':
                errorMessage = 'البريد الإلكتروني غير صالح';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'عملية إنشاء الحساب غير مسموحة';
                break;
            case 'auth/weak-password':
                errorMessage = 'كلمة المرور ضعيفة جداً';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'خطأ في الاتصال بالشبكة';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'محاولات كثيرة جداً. يرجى المحاولة لاحقاً';
                break;
        }
        
        if (typeof showToast === 'function') showToast(errorMessage, 'error');
        return false;
    }
}

async function signInWithEmail(email, password) {
    try {
        console.log('📧 تسجيل الدخول بالبريد...');
        
        // 🔐 تطهير المدخلات
        const cleanEmail = sanitizeEmail(email);
        
        if (!cleanEmail || !password) {
            if (typeof showToast === 'function') showToast('الرجاء إدخال البريد الإلكتروني وكلمة المرور', 'error');
            return;
        }
        
        // 🔐 التحقق من Rate Limiting
        checkLoginRateLimit(cleanEmail);
        
        if (!checkFirebaseSDK || !checkFirebaseSDK() || !initializeFirebase()) {
            if (typeof showToast === 'function') showToast('تعذر الاتصال بخدمة المصادقة', 'error');
            return;
        }
        
        const result = await window.firebaseModules.signInWithEmailAndPassword(auth, cleanEmail, password);
        
        // تسجيل محاولة ناجحة
        recordLoginAttempt(cleanEmail, true);
        
        currentUser = result.user;
        isGuest = false;
        
        // جلب بيانات المستخدم أو إنشاؤها
        await checkAndUpdateUserInFirestore(currentUser);
        const isAdminUser = await checkAdminPermissions(currentUser.uid);
        
        // جلب البيانات الإضافية من Firestore
        const userDoc = await window.firebaseModules.getDoc(window.firebaseModules.doc(db, "users", currentUser.uid));
        let phone = '', address = '';
        if (userDoc.exists()) {
            const userData = userDoc.data();
            phone = userData.phone || '';
            address = userData.address || '';
            currentUser.displayName = userData.name || currentUser.displayName || currentUser.email.split('@')[0];
        }

        const userToSave = {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            email: currentUser.email,
            photoURL: currentUser.photoURL || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
            phone: phone,
            address: address,
            isGuest: false,
            isAdmin: isAdminUser
        };
        
        secureStore('currentUser', userToSave, 120);
        
        // تصفير الحقول قبل الدخول
        document.querySelectorAll('input').forEach(i => i.value = '');
        
        showMainApp();
        if (typeof showSection === 'function') showSection('home');
        updateHeaderLayout();
        if (typeof updateUserProfile === 'function') updateUserProfile();
        if (typeof loadProducts === 'function') await loadProducts();
        if (typeof updateCartCount === 'function') updateCartCount();
        if (typeof updateAdminButton === 'function') updateAdminButton();
        
        // تفعيل نظام الإشعارات
        if (window.setupOrderStatusListener) {
            window.setupOrderStatusListener().catch(e => console.error('Order status listener error:', e));
        }
        
        if (typeof showToast === 'function') showToast(`مرحباً بعودتك ${escapeHTML(currentUser.displayName)}!`, 'success');
        hideEmailAuthForm();
        
    } catch (error) {
        console.error('❌ خطأ في تسجيل الدخول:', error);
        
        // تسجيل محاولة فاشلة
        recordLoginAttempt(email, false);
        logSecurityEvent('email_login_failed', { email: email, error: error.code });
        
        let errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'المستخدم غير موجود';
                break;
            case 'auth/wrong-password':
                errorMessage = 'كلمة المرور غير صحيحة';
                break;
            case 'auth/invalid-email':
                errorMessage = 'البريد الإلكتروني غير صالح';
                break;
            case 'auth/user-disabled':
                errorMessage = 'تم تعطيل هذا الحساب';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'خطأ في الاتصال بالشبكة';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'محاولات كثيرة جداً. يرجى المحاولة لاحقاً';
                break;
        }
        
        if (typeof showToast === 'function') showToast(errorMessage, 'error');
        if (typeof showAuthMessage === 'function') showAuthMessage(errorMessage, 'error');
    }
}

async function checkAndUpdateUserInFirestore(user) {
    try {
        if (!db) return;
        
        const userRef = window.firebaseModules.doc(db, "users", user.uid);
        const userDoc = await window.firebaseModules.getDoc(userRef);
        
        if (!userDoc.exists()) {
            const userData = {
                email: user.email,
                name: user.displayName || user.email.split('@')[0],
                phone: '',
                address: '',
                photoURL: user.photoURL || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
                role: 'user',
                isAdmin: false,
                isGuest: false,
                isActive: true,
                totalOrders: 0,
                totalSpent: 0,
                favorites: [],
                createdAt: window.firebaseModules.serverTimestamp(),
                updatedAt: window.firebaseModules.serverTimestamp()
            };
            
            await window.firebaseModules.setDoc(userRef, userData);
        } else {
            await window.firebaseModules.updateDoc(userRef, {
                lastLogin: window.firebaseModules.serverTimestamp(),
                updatedAt: window.firebaseModules.serverTimestamp()
            });
        }
    } catch (error) {
        console.error('خطأ في التحقق من المستخدم:', error);
        logSecurityEvent('user_sync_error', { uid: user.uid, error: error.message });
    }
}

async function checkAndCreateUserInFirestore(user) {
    try {
        if (!db) return;
        
        const userDoc = await window.firebaseModules.getDoc(
            window.firebaseModules.doc(db, "users", user.uid)
        );
        
        if (!userDoc.exists()) {
            await window.firebaseModules.setDoc(
                window.firebaseModules.doc(db, "users", user.uid), 
                {
                    email: user.email,
                    name: user.displayName || user.email.split('@')[0],
                    phone: '',
                    address: '',
                    photoURL: user.photoURL || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
                    role: 'user',
                    isAdmin: false,
                    isGuest: false,
                    totalOrders: 0,
                    totalSpent: 0,
                    favorites: [],
                    createdAt: window.firebaseModules.serverTimestamp(),
                    updatedAt: window.firebaseModules.serverTimestamp()
                }
            );
        }
    } catch (error) {
        console.error('خطأ في التحقق من المستخدم:', error);
    }
}

async function checkAdminPermissions(userId) {
    console.log('🔍 التحقق من صلاحيات المدير للمستخدم:', userId);
    
    try {
        if (!db) {
            isAdmin = false;
            console.log('❌ قاعدة البيانات غير متاحة');
            return false;
        }
        
        const userRef = window.firebaseModules.doc(db, "users", userId);
        const userSnap = await window.firebaseModules.getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            
            if (userData.isAdmin === true || userData.role === 'admin') {
                isAdmin = true;
                console.log('✅ المستخدم أدمن');
                logSecurityEvent('admin_login', { uid: userId });
            } else {
                isAdmin = false;
                console.log('❌ المستخدم ليس أدمن');
            }
        } else {
            console.log('⚠️ المستخدم غير موجود في قاعدة البيانات');
            isAdmin = false;
        }
        
        if (typeof updateAdminButton === 'function') updateAdminButton();
        
        return isAdmin;
        
    } catch (error) {
        console.error('❌ خطأ في التحقق من صلاحيات المستخدم:', error);
        isAdmin = false;
        if (typeof updateAdminButton === 'function') updateAdminButton();
        return false;
    }
}

function updateAdminButton() {
    const adminBtn = document.getElementById('adminBtn');
    const adminMobileLink = document.getElementById('adminMobileLink');
    
    if (adminBtn) {
        if (isAdmin && !isGuest) {
            adminBtn.style.display = 'flex';
        } else {
            adminBtn.style.display = 'none';
        }
    }
    
    if (adminMobileLink) {
        if (isAdmin && !isGuest) {
            adminMobileLink.style.display = 'block';
        } else {
            adminMobileLink.style.display = 'none';
        }
    }
}

async function signOutUser() {
    console.log('🚪 تسجيل الخروج...');
    
    try {
        if (isGuest) {
            if (!confirm('سيتم فقدان سلة التسوق والطلبات. هل تريد المتابعة؟')) {
                return;
            }
        }
        
        // 🔐 تسجيل حدث الخروج
        logSecurityEvent('user_logged_out', { 
            uid: currentUser?.uid,
            isGuest: isGuest 
        });
        
        if (!isGuest && auth) {
            await window.firebaseModules.signOut(auth);
        }
        
        // 🔐 مسح جميع بيانات الجلسة
        sessionStorage.clear();
        
        // مسح بيانات المستخدم الحساسة فقط من localStorage
        localStorage.removeItem('userPhone');
        localStorage.removeItem('userAddress');
        localStorage.removeItem('temp_auth_data');
        
        // الحفاظ على logs الأمان
        const securityLogs = localStorage.getItem('security_logs');
        localStorage.clear();
        if (securityLogs) {
            localStorage.setItem('security_logs', securityLogs);
        }
        
        currentUser = null;
        isGuest = false;
        isAdmin = false;
        cartItems = [];
        favorites = [];
        
        // تصفير جميع حقول الإدخال في التطبيق
        const allInputs = document.querySelectorAll('input, textarea, select');
        allInputs.forEach(input => {
            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = false;
            } else {
                input.value = '';
            }
        });

        // تصفير بيانات الملف الشخصي في الواجهة
        const profileElements = [
            'profileName', 'mobileUserName', 'profileEmail', 'mobileUserEmail',
            'detailName', 'detailEmail', 'detailPhone', 'detailAddress',
            'favoritesCount', 'ordersCount', 'totalSpent'
        ];
        profileElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '--';
        });

        // تصفير الصور الشخصية
        const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
        const profileImages = document.querySelectorAll('#profileImage, #mobileUserImage');
        profileImages.forEach(img => {
            if (img) img.src = defaultAvatar;
        });
        
        if (typeof updateAdminButton === 'function') updateAdminButton();
        if (typeof updateCartCount === 'function') updateCartCount();
        
        // إعادة تهيئة CSRF Token
        generateCSRFToken();
        
        showAuthScreen();
        
        // إعادة تحميل المنتجات لضمان عدم وجود بيانات معلقة
        allProducts = [];
        if (typeof displayProducts === 'function') displayProducts();
        
        if (typeof showToast === 'function') showToast('تم تسجيل الخروج بنجاح', 'success');
    } catch (error) {
        console.error('❌ خطأ في تسجيل الخروج:', error);
        logSecurityEvent('logout_error', { error: error.message });
        
        if (typeof showToast === 'function') showToast('حدث خطأ أثناء تسجيل الخروج', 'error');
    }
}

// ======================== إدارة تسجيل المستخدمين ========================

function showRegistrationForm() {
    const emailAuthForm = document.getElementById('emailAuthForm');
    if (emailAuthForm) {
        const formHeader = emailAuthForm.querySelector('.form-header h2');
        if (formHeader) formHeader.textContent = 'إنشاء حساب جديد';
        
        const loginFields = document.getElementById('loginFields');
        const registerFields = document.getElementById('registerFields');
        
        if (loginFields) loginFields.style.display = 'none';
        if (registerFields) registerFields.style.display = 'block';
        
        emailAuthForm.style.display = 'block';
        
        const registerName = document.getElementById('registerName');
        if (registerName) registerName.focus();
    }
}

function showLoginForm() {
    const emailAuthForm = document.getElementById('emailAuthForm');
    if (emailAuthForm) {
        const formHeader = emailAuthForm.querySelector('.form-header h2');
        if (formHeader) formHeader.textContent = 'تسجيل الدخول';
        
        const loginFields = document.getElementById('loginFields');
        const registerFields = document.getElementById('registerFields');
        
        if (loginFields) loginFields.style.display = 'block';
        if (registerFields) registerFields.style.display = 'none';
        
        const emailInput = document.getElementById('emailInput');
        if (emailInput) emailInput.focus();
    }
}

async function handleRegistration() {
    const name = document.getElementById('registerName')?.value || '';
    const email = document.getElementById('registerEmail')?.value || '';
    const password = document.getElementById('registerPassword')?.value || '';
    const phone = document.getElementById('registerPhone')?.value || '';
    
    if (!name || !email || !password) {
        if (typeof showAuthMessage === 'function') showAuthMessage('الرجاء ملء جميع الحقول المطلوبة', 'error');
        return;
    }
    
    if (password.length < 6) {
        if (typeof showAuthMessage === 'function') showAuthMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        if (typeof showAuthMessage === 'function') showAuthMessage('البريد الإلكتروني غير صالح', 'error');
        return;
    }
    
    if (typeof showAuthMessage === 'function') showAuthMessage('جاري إنشاء حسابك...', 'info');
    
    const success = await signUpWithEmail(email, password, name, phone);
    
    if (success) {
        if (typeof showAuthMessage === 'function') showAuthMessage('تم إنشاء حسابك بنجاح!', 'success');
    }
}

async function handleLogin() {
    const email = document.getElementById('emailInput')?.value || '';
    const password = document.getElementById('passwordInput')?.value || '';
    
    if (!email || !password) {
        if (typeof showAuthMessage === 'function') showAuthMessage('الرجاء إدخال البريد الإلكتروني وكلمة المرور', 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        if (typeof showAuthMessage === 'function') showAuthMessage('البريد الإلكتروني غير صالح', 'error');
        return;
    }
    
    if (typeof showAuthMessage === 'function') showAuthMessage('جاري تسجيل الدخول...', 'info');
    
    await signInWithEmail(email, password);
}

function showAuthMessage(message, type = 'error') {
    const authMessage = document.getElementById('emailAuthMessage');
    if (authMessage) {
        authMessage.textContent = sanitizeInput(message);
        authMessage.className = `auth-message ${type}`;
    }
}

// ======================== التصدير للاستخدام العام ========================

window.signInAsGuest = signInAsGuest;
window.signInWithGoogle = signInWithGoogle;
window.signOutUser = signOutUser;
window.signUpWithEmail = signUpWithEmail;
window.handleRegistration = handleRegistration;
window.handleLogin = handleLogin;
window.showRegistrationForm = showRegistrationForm;
window.showLoginForm = showLoginForm;
window.validateEmail = validateEmail;
window.checkLoginRateLimit = checkLoginRateLimit;
window.recordLoginAttempt = recordLoginAttempt;

console.log('✅ auth-system.js loaded with security enhancements');