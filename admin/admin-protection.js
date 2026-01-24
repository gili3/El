// Eleven Store - Admin Panel Protection System
// نظام حماية لوحة تحكم الأدمن

(function() {
    'use strict';

    class AdminProtection {
        constructor() {
            this.maxLoginAttempts = 5;
            this.lockoutDuration = 15 * 60 * 1000; // 15 دقيقة
            this.sessionTimeout = 30 * 60 * 1000; // 30 دقيقة
            this.allowedRoles = ['admin', 'superadmin'];
            this.lastActivityTime = Date.now();
            
            this.init();
        }

        init() {
            console.log('🛡️ تهيئة نظام حماية الأدمن...');
            
            // التحقق من الصلاحيات فوراً
            this.checkAccess();
            
            // مراقبة النشاط
            this.monitorActivity();
            
            // حماية ضد DevTools
            this.protectAgainstDevTools();
            
            // حماية ضد النسخ واللصق
            this.protectContent();
            
            // مراقبة الجلسة
            this.monitorSession();
            
            console.log('✅ نظام حماية الأدمن مفعل');
        }

        /**
         * التحقق من صلاحيات الوصول
         */
        async checkAccess() {
            try {
                // التحقق من تسجيل الدخول
                const auth = window.firebaseModules?.getAuth?.();
                if (!auth) {
                    this.denyAccess('Firebase Auth غير متاح');
                    return;
                }

                // انتظار حالة المصادقة
                const user = await new Promise((resolve) => {
                    const unsubscribe = window.firebaseModules.onAuthStateChanged(auth, (user) => {
                        unsubscribe();
                        resolve(user);
                    });
                });

                if (!user) {
                    this.denyAccess('غير مسجل الدخول');
                    return;
                }

                // التحقق من الصلاحيات
                const hasAccess = await this.verifyAdminRole(user);
                
                if (!hasAccess) {
                    this.denyAccess('ليس لديك صلاحيات الأدمن');
                    return;
                }

                // التحقق من المصادقة الثنائية (إذا كانت مفعلة)
                await this.verify2FA(user);

                // تسجيل الوصول
                this.logAccess(user);

                console.log('✅ تم التحقق من الصلاحيات بنجاح');
            } catch (error) {
                console.error('خطأ في التحقق من الصلاحيات:', error);
                this.denyAccess('خطأ في التحقق من الصلاحيات');
            }
        }

        /**
         * التحقق من دور المستخدم
         */
        async verifyAdminRole(user) {
            try {
                const db = window.firebaseModules.getFirestore(window.firebaseApp);
                const userDoc = await window.firebaseModules.getDoc(
                    window.firebaseModules.doc(db, 'users', user.uid)
                );

                if (!userDoc.exists()) {
                    return false;
                }

                const userData = userDoc.data();
                const userRole = userData.role || 'user';

                return this.allowedRoles.includes(userRole);
            } catch (error) {
                console.error('خطأ في التحقق من الدور:', error);
                return false;
            }
        }

        /**
         * التحقق من المصادقة الثنائية
         */
        async verify2FA(user) {
            try {
                // التحقق من تفعيل 2FA
                const db = window.firebaseModules.getFirestore(window.firebaseApp);
                const userDoc = await window.firebaseModules.getDoc(
                    window.firebaseModules.doc(db, 'users', user.uid)
                );

                if (!userDoc.exists()) return;

                const userData = userDoc.data();
                
                if (userData.twoFactorEnabled) {
                    // التحقق من الجلسة الحالية
                    const verified2FA = sessionStorage.getItem('2fa_verified');
                    
                    if (!verified2FA) {
                        // طلب رمز التحقق
                        if (window.twoFactorAuth) {
                            const isVerified = await window.twoFactorAuth.showVerificationModal();
                            
                            if (!isVerified) {
                                this.denyAccess('فشل التحقق الثنائي');
                                return;
                            }
                            
                            sessionStorage.setItem('2fa_verified', 'true');
                        }
                    }
                }
            } catch (error) {
                console.error('خطأ في التحقق الثنائي:', error);
            }
        }

        /**
         * رفض الوصول
         */
        denyAccess(reason) {
            console.error('🚫 تم رفض الوصول:', reason);
            
            // عرض رسالة
            document.body.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: 'Cairo', sans-serif; text-align: center; padding: 20px;">
                    <div style="font-size: 80px; margin-bottom: 20px;">🚫</div>
                    <h1 style="color: #e74c3c; margin-bottom: 10px;">وصول مرفوض</h1>
                    <p style="color: #7f8c8d; margin-bottom: 30px;">${reason}</p>
                    <button onclick="window.location.href='/index.html'" style="padding: 12px 30px; background: #3498db; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-family: 'Cairo';">
                        العودة للصفحة الرئيسية
                    </button>
                </div>
            `;
            
            // تسجيل الخروج
            setTimeout(() => {
                if (window.firebaseModules?.getAuth) {
                    window.firebaseModules.signOut(window.firebaseModules.getAuth());
                }
                window.location.href = '/index.html';
            }, 3000);
        }

        /**
         * مراقبة النشاط
         */
        monitorActivity() {
            const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
            
            events.forEach(event => {
                document.addEventListener(event, () => {
                    this.lastActivityTime = Date.now();
                });
            });

            // التحقق من انتهاء الجلسة
            setInterval(() => {
                const inactiveTime = Date.now() - this.lastActivityTime;
                
                if (inactiveTime > this.sessionTimeout) {
                    this.handleSessionTimeout();
                }
            }, 60000); // كل دقيقة
        }

        /**
         * معالجة انتهاء الجلسة
         */
        handleSessionTimeout() {
            console.warn('⏰ انتهت مدة الجلسة بسبب عدم النشاط');
            
            alert('انتهت مدة جلستك بسبب عدم النشاط. سيتم تسجيل الخروج.');
            
            if (window.firebaseModules?.getAuth) {
                window.firebaseModules.signOut(window.firebaseModules.getAuth());
            }
            
            window.location.href = '/index.html';
        }

        /**
         * حماية ضد أدوات المطورين
         */
        protectAgainstDevTools() {
            // اكتشاف فتح DevTools
            const detectDevTools = () => {
                const threshold = 160;
                const widthThreshold = window.outerWidth - window.innerWidth > threshold;
                const heightThreshold = window.outerHeight - window.innerHeight > threshold;
                
                if (widthThreshold || heightThreshold) {
                    console.warn('⚠️ تم اكتشاف فتح أدوات المطورين');
                    // يمكن إضافة إجراءات إضافية هنا
                }
            };

            // التحقق الدوري
            setInterval(detectDevTools, 1000);

            // منع الاختصارات
            document.addEventListener('keydown', (e) => {
                // F12
                if (e.keyCode === 123) {
                    e.preventDefault();
                    return false;
                }
                
                // Ctrl+Shift+I
                if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
                    e.preventDefault();
                    return false;
                }
                
                // Ctrl+Shift+J
                if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
                    e.preventDefault();
                    return false;
                }
                
                // Ctrl+U
                if (e.ctrlKey && e.keyCode === 85) {
                    e.preventDefault();
                    return false;
                }
            });

            // منع القائمة السياقية
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                return false;
            });
        }

        /**
         * حماية المحتوى
         */
        protectContent() {
            // منع التحديد
            document.addEventListener('selectstart', (e) => {
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    return false;
                }
            });

            // منع النسخ
            document.addEventListener('copy', (e) => {
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    console.warn('⚠️ محاولة نسخ المحتوى');
                    return false;
                }
            });

            // منع السحب
            document.addEventListener('dragstart', (e) => {
                e.preventDefault();
                return false;
            });
        }

        /**
         * مراقبة الجلسة
         */
        monitorSession() {
            // التحقق من تغيير المستخدم
            if (window.firebaseModules?.getAuth) {
                window.firebaseModules.onAuthStateChanged(
                    window.firebaseModules.getAuth(),
                    (user) => {
                        if (!user) {
                            console.warn('⚠️ تم تسجيل الخروج');
                            window.location.href = '/index.html';
                        }
                    }
                );
            }

            // مسح البيانات عند إغلاق النافذة
            window.addEventListener('beforeunload', () => {
                sessionStorage.removeItem('2fa_verified');
            });
        }

        /**
         * تسجيل الوصول
         */
        async logAccess(user) {
            try {
                const db = window.firebaseModules.getFirestore(window.firebaseApp);
                
                await window.firebaseModules.addDoc(
                    window.firebaseModules.collection(db, 'admin_access_logs'),
                    {
                        userId: user.uid,
                        email: user.email,
                        timestamp: window.firebaseModules.serverTimestamp(),
                        userAgent: navigator.userAgent,
                        ip: await this.getClientIP()
                    }
                );
            } catch (error) {
                console.error('خطأ في تسجيل الوصول:', error);
            }
        }

        /**
         * الحصول على IP العميل
         */
        async getClientIP() {
            try {
                const response = await fetch('https://api.ipify.org?format=json');
                const data = await response.json();
                return data.ip;
            } catch (error) {
                return 'unknown';
            }
        }

        /**
         * التحقق من محاولات تسجيل الدخول الفاشلة
         */
        checkLoginAttempts(email) {
            const key = `login_attempts_${email}`;
            const attempts = JSON.parse(localStorage.getItem(key) || '{"count": 0, "timestamp": 0}');
            
            // التحقق من انتهاء مدة الحظر
            if (Date.now() - attempts.timestamp > this.lockoutDuration) {
                attempts.count = 0;
            }

            if (attempts.count >= this.maxLoginAttempts) {
                const remainingTime = Math.ceil((this.lockoutDuration - (Date.now() - attempts.timestamp)) / 60000);
                throw new Error(`تم تجاوز عدد المحاولات. حاول مرة أخرى بعد ${remainingTime} دقيقة`);
            }

            return attempts;
        }

        /**
         * تسجيل محاولة فاشلة
         */
        recordFailedAttempt(email) {
            const key = `login_attempts_${email}`;
            const attempts = this.checkLoginAttempts(email);
            
            attempts.count++;
            attempts.timestamp = Date.now();
            
            localStorage.setItem(key, JSON.stringify(attempts));
        }

        /**
         * مسح محاولات تسجيل الدخول
         */
        clearLoginAttempts(email) {
            const key = `login_attempts_${email}`;
            localStorage.removeItem(key);
        }
    }

    // تهيئة النظام عند تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.adminProtection = new AdminProtection();
        });
    } else {
        window.adminProtection = new AdminProtection();
    }

    console.log('🛡️ Admin Protection System Loaded');
})();
