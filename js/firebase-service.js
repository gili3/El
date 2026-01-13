/**
 * Firebase Service Module
 * Handles all Firebase-related operations
 */

const FirebaseService = (function() {
    'use strict';
    
    // Private variables
    let app = null;
    let db = null;
    let storage = null;
    let auth = null;
    let authUnsubscribe = null;
    let currentUser = null;
    let isInitialized = false;
    
    // Cache for Firestore queries
    const cache = new Map();
    const cacheTimestamps = new Map();
    
    /**
     * Initialize Firebase
     */
    async function initialize() {
        try {
            if (isInitialized) return true;
            
            console.log('🔥 جاري تهيئة Firebase...');
            
            // Initialize Firebase app
            try {
                app = window.firebaseModules.getApp('AdminApp');
            } catch (e) {
                app = window.firebaseModules.initializeApp(FIREBASE_CONFIG, 'AdminApp');
            }
            
            // Initialize services
            db = window.firebaseModules.getFirestore(app);
            storage = window.firebaseModules.getStorage(app);
            auth = window.firebaseModules.getAuth(app);
            
            // Configure Firestore
            await configureFirestore();
            
            // Setup auth state listener
            setupAuthListener();
            
            // Test connection
            await testConnection();
            
            isInitialized = true;
            console.log('✅ Firebase مهيأ بنجاح');
            
            return true;
            
        } catch (error) {
            console.error('❌ فشل تهيئة Firebase:', error);
            UIHelpers.showToast('فشل الاتصال بقاعدة البيانات', 'error');
            return false;
        }
    }
    
    /**
     * Configure Firestore settings
     */
    async function configureFirestore() {
        // Enable offline persistence
        try {
            // Note: In modular SDK, persistence is enabled by default
            console.log('📚 تم تمكين التخزين المؤقت المحلي');
        } catch (error) {
            console.warn('⚠️ لا يمكن تمكين التخزين المؤقت:', error);
        }
    }
    
    /**
     * Setup authentication state listener
     */
    function setupAuthListener() {
        authUnsubscribe = window.firebaseModules.onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUser = user;
                console.log('👤 المستخدم الحالي:', user.email);
                
                // Check if user is admin
                checkAdminStatus(user);
            } else {
                currentUser = null;
                console.log('👤 لا يوجد مستخدم مسجل');
                
                // Redirect to login if not on login page
                if (!window.location.pathname.includes('login.html')) {
                    window.location.href = 'login.html';
                }
            }
        });
    }
    
    /**
     * Check if user has admin privileges
     */
    async function checkAdminStatus(user) {
        try {
            const userDoc = await getDoc('users', user.uid);
            
            if (!userDoc.exists()) {
                console.warn('⚠️ ملف المستخدم غير موجود');
                await signOut();
                return;
            }
            
            const userData = userDoc.data();
            const isAdmin = userData.role === AppConstants.USER_ROLES.ADMIN || 
                          userData.role === AppConstants.USER_ROLES.MANAGER;
            
            if (!isAdmin) {
                console.warn('⚠️ المستخدم ليس مسؤولاً');
                UIHelpers.showToast('ليس لديك صلاحيات الدخول للوحة التحكم', 'error');
                await signOut();
            }
            
        } catch (error) {
            console.error('❌ خطأ في التحقق من صلاحيات المستخدم:', error);
            await signOut();
        }
    }
    
    /**
     * Test Firebase connection
     */
    async function testConnection() {
        try {
            const settingsRef = window.firebaseModules.collection(db, 'settings');
            const snapshot = await window.firebaseModules.getDocs(settingsRef);
            
            console.log('✅ اتصال Firebase ناجح');
            return true;
            
        } catch (error) {
            console.error('❌ فشل اختبار اتصال Firebase:', error);
            throw error;
        }
    }
    
    /**
     * Sign out user
     */
    async function signOut() {
        try {
            if (authUnsubscribe) {
                authUnsubscribe();
            }
            
            await window.firebaseModules.signOut(auth);
            currentUser = null;
            
            // Clear all local data
            clearCache();
            
            console.log('👋 تم تسجيل الخروج');
            
        } catch (error) {
            console.error('❌ خطأ في تسجيل الخروج:', error);
            throw error;
        }
    }
    
    /**
     * Get current user
     */
    function getCurrentUser() {
        return currentUser;
    }
    
    /**
     * Get Firestore document with caching
     */
    async function getDoc(collectionName, docId, useCache = true) {
        const cacheKey = `${collectionName}/${docId}`;
        
        // Check cache first
        if (useCache && cache.has(cacheKey)) {
            const cachedData = cache.get(cacheKey);
            const timestamp = cacheTimestamps.get(cacheKey);
            
            // Check if cache is still valid
            if (Date.now() - timestamp < getCacheTTL(collectionName)) {
                console.log(`📦 استخدام البيانات المخزنة: ${cacheKey}`);
                return cachedData;
            }
        }
        
        // Fetch from Firestore
        try {
            const docRef = window.firebaseModules.doc(db, collectionName, docId);
            const docSnap = await window.firebaseModules.getDoc(docRef);
            
            // Cache the result
            cache.set(cacheKey, docSnap);
            cacheTimestamps.set(cacheKey, Date.now());
            
            return docSnap;
            
        } catch (error) {
            console.error(`❌ خطأ في جلب المستند ${cacheKey}:`, error);
            throw error;
        }
    }
    
    /**
     * Get Firestore collection with caching
     */
    async function getDocs(collectionName, queryConstraints = [], useCache = true) {
        const queryKey = `${collectionName}_${JSON.stringify(queryConstraints)}`;
        
        // Check cache first
        if (useCache && cache.has(queryKey)) {
            const cachedData = cache.get(queryKey);
            const timestamp = cacheTimestamps.get(queryKey);
            
            // Check if cache is still valid
            if (Date.now() - timestamp < getCacheTTL(collectionName)) {
                console.log(`📦 استخدام البيانات المخزنة: ${queryKey}`);
                return cachedData;
            }
        }
        
        // Fetch from Firestore
        try {
            let queryRef = window.firebaseModules.collection(db, collectionName);
            
            // Apply query constraints
            if (queryConstraints.length > 0) {
                queryRef = window.firebaseModules.query(queryRef, ...queryConstraints);
            }
            
            const querySnap = await window.firebaseModules.getDocs(queryRef);
            
            // Cache the result
            cache.set(queryKey, querySnap);
            cacheTimestamps.set(queryKey, Date.now());
            
            return querySnap;
            
        } catch (error) {
            console.error(`❌ خطأ في جلب المجموعة ${collectionName}:`, error);
            throw error;
        }
    }
    
    /**
     * Set document with transaction
     */
    async function setDoc(collectionName, docId, data) {
        try {
            const docRef = window.firebaseModules.doc(db, collectionName, docId);
            
            // Add metadata
            const docData = {
                ...data,
                updatedAt: window.firebaseModules.serverTimestamp(),
                updatedBy: currentUser?.uid || 'system'
            };
            
            await window.firebaseModules.setDoc(docRef, docData, { merge: true });
            
            // Invalidate cache
            invalidateCache(collectionName, docId);
            
            console.log(`✅ تم حفظ المستند: ${collectionName}/${docId}`);
            return docRef.id;
            
        } catch (error) {
            console.error(`❌ خطأ في حفظ المستند ${collectionName}/${docId}:`, error);
            throw error;
        }
    }
    
    /**
     * Update document with transaction
     */
    async function updateDoc(collectionName, docId, data) {
        try {
            const docRef = window.firebaseModules.doc(db, collectionName, docId);
            
            // Add metadata
            const updateData = {
                ...data,
                updatedAt: window.firebaseModules.serverTimestamp(),
                updatedBy: currentUser?.uid || 'system'
            };
            
            await window.firebaseModules.updateDoc(docRef, updateData);
            
            // Invalidate cache
            invalidateCache(collectionName, docId);
            
            console.log(`✅ تم تحديث المستند: ${collectionName}/${docId}`);
            return true;
            
        } catch (error) {
            console.error(`❌ خطأ في تحديث المستند ${collectionName}/${docId}:`, error);
            throw error;
        }
    }
    
    /**
     * Delete document
     */
    async function deleteDoc(collectionName, docId) {
        try {
            const docRef = window.firebaseModules.doc(db, collectionName, docId);
            await window.firebaseModules.deleteDoc(docRef);
            
            // Invalidate cache
            invalidateCache(collectionName, docId);
            
            console.log(`🗑️ تم حذف المستند: ${collectionName}/${docId}`);
            return true;
            
        } catch (error) {
            console.error(`❌ خطأ في حذف المستند ${collectionName}/${docId}:`, error);
            throw error;
        }
    }
    
    /**
     * Add document
     */
    async function addDoc(collectionName, data) {
        try {
            const collectionRef = window.firebaseModules.collection(db, collectionName);
            
            // Add metadata
            const docData = {
                ...data,
                createdAt: window.firebaseModules.serverTimestamp(),
                createdBy: currentUser?.uid || 'system',
                updatedAt: window.firebaseModules.serverTimestamp(),
                updatedBy: currentUser?.uid || 'system'
            };
            
            const docRef = await window.firebaseModules.addDoc(collectionRef, docData);
            
            // Invalidate cache for the collection
            invalidateCache(collectionName);
            
            console.log(`➕ تم إضافة مستند جديد: ${collectionName}/${docRef.id}`);
            return docRef.id;
            
        } catch (error) {
            console.error(`❌ خطأ في إضافة مستند إلى ${collectionName}:`, error);
            throw error;
        }
    }
    
    /**
     * Run transaction
     */
    async function runTransaction(transactionFunction) {
        try {
            return await window.firebaseModules.runTransaction(db, transactionFunction);
        } catch (error) {
            console.error('❌ خطأ في المعاملة:', error);
            throw error;
        }
    }
    
    /**
     * Get cache TTL for collection
     */
    function getCacheTTL(collectionName) {
        switch (collectionName) {
            case 'stats': return AppConstants.CACHE_TTL.STATS;
            case 'products': return AppConstants.CACHE_TTL.PRODUCTS;
            case 'orders': return AppConstants.CACHE_TTL.ORDERS;
            case 'settings': return AppConstants.CACHE_TTL.SETTINGS;
            default: return 60000; // 1 minute default
        }
    }
    
    /**
     * Invalidate cache for specific document or collection
     */
    function invalidateCache(collectionName, docId = null) {
        const keysToDelete = [];
        
        for (const key of cache.keys()) {
            if (key.startsWith(collectionName)) {
                if (docId && key.includes(docId)) {
                    keysToDelete.push(key);
                } else if (!docId) {
                    keysToDelete.push(key);
                }
            }
        }
        
        keysToDelete.forEach(key => {
            cache.delete(key);
            cacheTimestamps.delete(key);
        });
        
        console.log(`🗑️ تم إبطال ${keysToDelete.length} عنصر من التخزين المؤقت`);
    }
    
    /**
     * Clear all cache
     */
    function clearCache() {
        cache.clear();
        cacheTimestamps.clear();
        console.log('🧹 تم مسح التخزين المؤقت بالكامل');
    }
    
    /**
     * Upload file to storage
     */
    async function uploadFile(file, path) {
        try {
            // Validate file
            const validation = UIHelpers.validateImageFile(file);
            if (!validation.valid) {
                throw new Error(validation.message);
            }
            
            // Create storage reference
            const timestamp = Date.now();
            const extension = file.name.split('.').pop();
            const filename = `${path}/${timestamp}_${Math.random().toString(36).substr(2, 9)}.${extension}`;
            const storageRef = window.firebaseModules.ref(storage, filename);
            
            // Show upload progress
            const loadingId = UIHelpers.showLoading('appContainer');
            
            // Upload file
            const uploadTask = window.firebaseModules.uploadBytesResumable(storageRef, file);
            
            // Wait for upload to complete
            await uploadTask;
            
            // Get download URL
            const downloadURL = await window.firebaseModules.getDownloadURL(uploadTask.snapshot.ref);
            
            // Hide loading
            UIHelpers.hideLoading(loadingId);
            
            console.log(`📤 تم رفع الملف: ${filename}`);
            
            return {
                url: downloadURL,
                path: filename,
                name: file.name,
                size: file.size,
                type: file.type
            };
            
        } catch (error) {
            console.error('❌ خطأ في رفع الملف:', error);
            throw error;
        }
    }
    
    /**
     * Delete file from storage
     */
    async function deleteFile(path) {
        try {
            const storageRef = window.firebaseModules.ref(storage, path);
            await window.firebaseModules.deleteObject(storageRef);
            
            console.log(`🗑️ تم حذف الملف: ${path}`);
            return true;
            
        } catch (error) {
            console.error(`❌ خطأ في حذف الملف ${path}:`, error);
            throw error;
        }
    }
    
    /**
     * Subscribe to collection changes
     */
    function subscribeToCollection(collectionName, callback, queryConstraints = []) {
        try {
            let queryRef = window.firebaseModules.collection(db, collectionName);
            
            // Apply query constraints
            if (queryConstraints.length > 0) {
                queryRef = window.firebaseModules.query(queryRef, ...queryConstraints);
            }
            
            // Set up real-time listener
            const unsubscribe = window.firebaseModules.onSnapshot(
                queryRef,
                (snapshot) => {
                    // Invalidate cache
                    invalidateCache(collectionName);
                    
                    // Call callback with snapshot
                    callback(snapshot);
                },
                (error) => {
                    console.error(`❌ خطأ في الاشتراك بـ ${collectionName}:`, error);
                    UIHelpers.showToast('فقدان الاتصال المباشر بالبيانات', 'warning');
                }
            );
            
            console.log(`👂 تم الاشتراك بالتغييرات: ${collectionName}`);
            return unsubscribe;
            
        } catch (error) {
            console.error(`❌ خطأ في إعداد الاشتراك بـ ${collectionName}:`, error);
            throw error;
        }
    }
    
    /**
     * Generate unique ID
     */
    function generateId() {
        return window.firebaseModules.collection(db, 'temp').doc().id;
    }
    
    /**
     * Get server timestamp
     */
    function serverTimestamp() {
        return window.firebaseModules.serverTimestamp();
    }
    
    /**
     * Get field value increment
     */
    function increment(value) {
        return window.firebaseModules.increment(value);
    }
    
    /**
     * Create batch operation
     */
    function createBatch() {
        return window.firebaseModules.writeBatch(db);
    }
    
    /**
     * Execute batch operation
     */
    async function commitBatch(batch) {
        try {
            await batch.commit();
            console.log('✅ تم تنفيذ العملية المجمعة');
            return true;
        } catch (error) {
            console.error('❌ خطأ في تنفيذ العملية المجمعة:', error);
            throw error;
        }
    }
    
    // Public API
    return {
        // Initialization
        initialize,
        signOut,
        
        // Authentication
        getCurrentUser,
        
        // Firestore Operations
        getDoc,
        getDocs,
        setDoc,
        updateDoc,
        deleteDoc,
        addDoc,
        runTransaction,
        createBatch,
        commitBatch,
        
        // Storage Operations
        uploadFile,
        deleteFile,
        
        // Real-time Updates
        subscribeToCollection,
        
        // Utilities
        generateId,
        serverTimestamp,
        increment,
        
        // Cache Management
        invalidateCache,
        clearCache
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FirebaseService;
}

