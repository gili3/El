// profile-system.js - إدارة الملف الشخصي والمستخدم
// ======================== الملف الشخصي ========================

function updateUserProfile() {
    if (!currentUser) return;
    
    const savedUser = secureRetrieve('currentUser') || {};
    const userName = currentUser.displayName || savedUser.displayName || savedUser.name || 'زائر';
    const userEmail = currentUser.email || savedUser.email || 'ليس لديك حساب';
    const userPhone = currentUser.phone || savedUser.phone || '--';
    const userAddress = currentUser.address || savedUser.address || '--';
    
    // 🔐 استخدام escapeHTML
    const elements = [
        { id: 'profileName', text: escapeHTML(userName) },
        { id: 'mobileUserName', text: escapeHTML(userName) },
        { id: 'profileEmail', text: escapeHTML(userEmail) },
        { id: 'mobileUserEmail', text: escapeHTML(userEmail) },
        { id: 'detailName', text: escapeHTML(userName) },
        { id: 'detailEmail', text: escapeHTML(userEmail) },
        { id: 'detailPhone', text: escapeHTML(userPhone) },
        { id: 'detailAddress', text: escapeHTML(userAddress) }
    ];
    
    // تحديث العناصر مع التحقق من وجودها أولاً
    elements.forEach(el => {
        const element = document.getElementById(el.id);
        if (element) {
            element.textContent = el.text;
        } else {
            console.warn(`⚠️ العنصر غير موجود: ${el.id}`);
        }
    });
    
    // تحديث الصور الشخصية مع التحقق
    if (currentUser.photoURL) {
        const images = document.querySelectorAll('#profileImage, #mobileUserImage');
        images.forEach(img => {
            if (img) {
                img.src = currentUser.photoURL;
            }
        });
    }
    
    if (typeof updateProfileStats === 'function') updateProfileStats();
}

async function updateProfileStats() {
    const favoritesCount = favorites.length;
    
    const favoritesCountElement = document.getElementById('favoritesCount');
    if (favoritesCountElement) {
        favoritesCountElement.textContent = favoritesCount;
    }
    
    let ordersCount = 0;
    let totalSpent = 0;
    
    const userId = currentUser?.uid;
    
    if (db && userId) {
        try {
            const ordersRef = window.firebaseModules.collection(db, "orders");
            const q = window.firebaseModules.query(ordersRef, window.firebaseModules.where("userId", "==", userId));
            const querySnapshot = await window.firebaseModules.getDocs(q);
            
            querySnapshot.forEach((doc) => {
                const order = doc.data();
                ordersCount++;
                if (order.status === 'delivered') {
                    totalSpent += parseFloat(order.total || 0);
                }
            });
        } catch (error) {
            console.error('خطأ في تحميل إحصائيات المستخدم من Firebase:', error);
        }
    }
    
    const ordersCountElement = document.getElementById('ordersCount');
    const totalSpentElement = document.getElementById('totalSpent');
    
    if (ordersCountElement) ordersCountElement.textContent = ordersCount;
    if (totalSpentElement) totalSpentElement.textContent = formatNumber(totalSpent) + ' SDG';
}

function editProfile() {
    const modal = document.getElementById('editProfileModal');
    if (!modal) return;
    
    const savedUser = secureRetrieve('currentUser') || {};
    
    const nameInput = document.getElementById('editName');
    const phoneInput = document.getElementById('editPhone');
    const addressInput = document.getElementById('editAddress');
    
    if (nameInput) nameInput.value = currentUser?.displayName || savedUser.displayName || '';
    if (phoneInput) phoneInput.value = currentUser?.phone || savedUser.phone || '';
    if (addressInput) addressInput.value = currentUser?.address || savedUser.address || '';
    
    modal.classList.add('active');
}

async function saveProfileChanges() {
    const nameInput = document.getElementById('editName');
    const phoneInput = document.getElementById('editPhone');
    const addressInput = document.getElementById('editAddress');
    
    if (!nameInput || !phoneInput || !addressInput) {
        if (typeof showToast === 'function') showToast('حدث خطأ في الوصول للحقول', 'error');
        return;
    }
    
    // 🔐 تطهير المدخلات
    const name = sanitizeInput(nameInput.value.trim(), 50);
    const phone = sanitizePhone(phoneInput.value.trim());
    const address = sanitizeInput(addressInput.value.trim(), 200);
    
    if (!name) {
        if (typeof showToast === 'function') showToast('يرجى إدخال الاسم', 'warning');
        return;
    }
    
    if (typeof showLoadingSpinner === 'function') showLoadingSpinner('جاري حفظ التغييرات...');
    
    try {
        if (auth.currentUser) {
            await window.firebaseModules.updateProfile(auth.currentUser, {
                displayName: name
            });
        }
        
        const userRef = window.firebaseModules.doc(db, "users", currentUser.uid);
        await window.firebaseModules.updateDoc(userRef, {
            displayName: name,
            phone: phone,
            address: address,
            updatedAt: window.firebaseModules.serverTimestamp()
        });
        
        currentUser.displayName = name;
        currentUser.phone = phone;
        currentUser.address = address;
        
        // 🔐 تخزين آمن للبيانات
        secureStore('currentUser', {
            uid: currentUser.uid,
            displayName: name,
            email: currentUser.email || '',
            photoURL: currentUser.photoURL || '',
            phone: phone,
            address: address,
            isGuest: false,
            isAdmin: isAdmin || false,
            timestamp: Date.now()
        }, 120);
        
        if (typeof updateUserProfile === 'function') updateUserProfile();
        
        const modal = document.getElementById('editProfileModal');
        if (modal) modal.classList.remove('active');
        
        // 🔐 تسجيل حدث تعديل الملف الشخصي
        logSecurityEvent('profile_updated', { 
            uid: currentUser.uid,
            fields: ['name', 'phone', 'address'] 
        });
        
        if (typeof showToast === 'function') showToast('تم تحديث الملف الشخصي بنجاح', 'success');
    } catch (error) {
        console.error('خطأ في تحديث الملف الشخصي:', error);
        logSecurityEvent('profile_update_failed', { 
            uid: currentUser?.uid,
            error: error.message 
        });
        
        if (typeof showToast === 'function') showToast('حدث خطأ أثناء التحديث', 'error');
    } finally {
        if (typeof hideLoadingSpinner === 'function') hideLoadingSpinner();
    }
}

// ======================== التصدير للاستخدام العام ========================

window.updateUserProfile = updateUserProfile;
window.updateProfileStats = updateProfileStats;
window.editProfile = editProfile;
window.saveProfileChanges = saveProfileChanges;

console.log('✅ profile-system.js loaded with secure storage');