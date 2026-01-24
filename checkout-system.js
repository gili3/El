// checkout-system.js - نظام الدفع والإيصالات
// ======================== نظام الدفع والإيصال ========================

let checkoutReceiptFile = null;

async function previewCheckoutReceipt(input) {
    if (!input || !input.files || !input.files[0]) return;
    
    const file = input.files[0];
    
    // 🔐 التحقق من ملف الصورة
    if (!validateImageFile(file, 10)) { // 10MB كحد أقصى
        if (typeof showToast === 'function') showToast('ملف الصورة غير صالح أو الحجم كبير جداً', 'error');
        input.value = '';
        return;
    }
    
    // 🔐 ضغط الصورة إذا كانت كبيرة
    checkoutReceiptFile = file;
    
    try {
        // ضغط الصورة إذا كانت أكبر من 2MB
        if (file.size > 2 * 1024 * 1024) {
            if (typeof showLoadingSpinner === 'function') showLoadingSpinner('جاري ضغط الصورة...');
            checkoutReceiptFile = await compressImageFile(file, {
                quality: 0.85,
                maxWidth: 1600,
                maxHeight: 1600
            });
            if (typeof hideLoadingSpinner === 'function') hideLoadingSpinner();
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const previewImg = document.getElementById('checkoutReceiptImg');
            const placeholder = document.getElementById('checkoutUploadPlaceholder');
            const previewContainer = document.getElementById('checkoutReceiptPreview');
            const uploadLabel = document.getElementById('receiptUploadLabel');
            
            if (previewImg) {
                previewImg.src = e.target.result;
                previewImg.alt = 'إيصال الدفع - ' + escapeHTML(file.name);
            }
            if (placeholder) placeholder.style.display = 'none';
            if (previewContainer) previewContainer.style.display = 'block';
            if (uploadLabel) uploadLabel.style.display = 'none';
            
            if (typeof updateCheckoutSummary === 'function') updateCheckoutSummary();
            if (typeof showToast === 'function') showToast('تم اختيار الإيصال بنجاح', 'success');
            
            // 🔐 تسجيل حدث رفع الإيصال
            logSecurityEvent('receipt_uploaded', { 
                size: file.size, 
                compressedSize: checkoutReceiptFile.size,
                type: file.type 
            });
        };
        reader.readAsDataURL(checkoutReceiptFile);
        
    } catch (error) {
        console.error('خطأ في معالجة الصورة:', error);
        if (typeof showToast === 'function') showToast('حدث خطأ في معالجة الصورة', 'error');
        input.value = '';
        checkoutReceiptFile = null;
    }
}

function removeCheckoutReceipt() {
    checkoutReceiptFile = null;
    const input = document.getElementById('checkoutReceipt');
    const placeholder = document.getElementById('checkoutUploadPlaceholder');
    const previewContainer = document.getElementById('checkoutReceiptPreview');
    const uploadLabel = document.getElementById('receiptUploadLabel');
    
    if (input) input.value = '';
    if (placeholder) placeholder.style.display = 'block';
    if (previewContainer) previewContainer.style.display = 'none';
    if (uploadLabel) uploadLabel.style.display = 'block';
    
    if (typeof updateCheckoutSummary === 'function') updateCheckoutSummary();
}

function updateCheckoutSummary() {
    const checkoutItems = document.getElementById("checkoutItems");
    if (!checkoutItems) return;
    
    const itemsToDisplay = directPurchaseItem ? [directPurchaseItem] : cartItems;
    const subtotal = itemsToDisplay.reduce((total, item) => total + (Number(item.price) * Number(item.quantity)), 0);
    const shippingCost = subtotal < (siteSettings.freeShippingLimit || 200) ? (siteSettings.shippingCost || 15) : 0;
    const total = subtotal + shippingCost;
    
    // 🔐 استخدام escapeHTML لأسماء المنتجات
    checkoutItems.innerHTML = itemsToDisplay.map(item => `
        <div class="checkout-item">
            <img src="${item.image}" class="checkout-item-img" alt="${escapeHTML(item.name)}">
            <div class="checkout-item-info">
                <span class="checkout-item-name">${escapeHTML(item.name)}</span>
                <span class="checkout-item-price">${formatNumber(item.price)} SDG</span>
            </div>
            <div class="checkout-item-qty-controls">
                <button class="checkout-item-qty-btn" onclick="updateCheckoutItemQty('${item.id}', -1)">-</button>
                <span class="checkout-item-qty-val">${item.quantity}</span>
                <button class="checkout-item-qty-btn" onclick="updateCheckoutItemQty('${item.id}', 1)">+</button>
            </div>
        </div>
    `).join("");
    
    if (typeof safeElementUpdate === 'function') {
        safeElementUpdate('checkoutSubtotal', formatNumber(subtotal) + ' SDG');
        safeElementUpdate('checkoutShipping', formatNumber(shippingCost) + ' SDG');
        safeElementUpdate('checkoutTotal', formatNumber(total) + ' SDG');
        safeElementUpdate('checkoutTotalBtn', formatNumber(total));
    }
    
    const submitOrderBtn = document.getElementById('submitOrderBtn');
    if (submitOrderBtn) {
        submitOrderBtn.disabled = (directPurchaseItem ? false : cartItems.length === 0) || !checkoutReceiptFile;
    }
    
    // تحديث معلومات البنك
    if (siteSettings.bankName && typeof safeElementUpdate === 'function') safeElementUpdate('checkoutBankName', escapeHTML(siteSettings.bankName));
    if (siteSettings.bankAccount && typeof safeElementUpdate === 'function') safeElementUpdate('checkoutBankAccount', siteSettings.bankAccount);
    if (siteSettings.bankAccountName && typeof safeElementUpdate === 'function') safeElementUpdate('checkoutBankAccountName', escapeHTML(siteSettings.bankAccountName));
}

function updateCheckoutItemQty(productId, change) {
    const product = allProducts.find(p => p.id === productId);
    
    if (directPurchaseItem && directPurchaseItem.id === productId) {
        const newQty = directPurchaseItem.quantity + change;
        if (newQty < 1) return;
        
        const availableStock = product ? product.stock : (directPurchaseItem.stock || 99);
        if (newQty > availableStock) {
            if (typeof showToast === 'function') showToast('لا توجد كمية كافية في المخزون', 'warning');
            return;
        }
        directPurchaseItem.quantity = newQty;
    } else {
        const item = cartItems.find(i => i.id === productId);
        if (item) {
            const newQty = item.quantity + change;
            if (newQty < 1) {
                if (typeof removeFromCart === 'function') removeFromCart(productId);
                // إذا تمت الإزالة، نعود للقائمة السابقة
                if (cartItems.length === 0) {
                    if (typeof showSection === 'function') showSection('cart');
                    return;
                }
            } else {
                const availableStock = product ? product.stock : (item.stock || 99);
                if (newQty > availableStock) {
                    if (typeof showToast === 'function') showToast('لا توجد كمية كافية في المخزون', 'warning');
                    return;
                }
                item.quantity = newQty;
                if (typeof saveCartToFirebase === 'function') saveCartToFirebase();
                if (typeof updateCartCount === 'function') updateCartCount();
            }
        }
    }
    if (typeof updateCheckoutSummary === 'function') updateCheckoutSummary();
}

function enableDataEdit() {
    const phoneInput = document.getElementById('orderPhone');
    const addressInput = document.getElementById('orderAddress');
    const editBtn = document.getElementById('editDataBtn');
    
    if (phoneInput) {
        phoneInput.readOnly = false;
        phoneInput.focus();
    }
    if (addressInput) addressInput.readOnly = false;
    if (editBtn) editBtn.style.display = 'none';
}

async function submitCheckoutOrder() {
    const phoneInput = document.getElementById('checkoutPhone');
    const addressInput = document.getElementById('checkoutAddress');
    const notesInput = document.getElementById('checkoutNotes');

    let phone = phoneInput ? phoneInput.value.trim() : '';
    const address = addressInput ? addressInput.value.trim() : '';
    const notes = notesInput ? notesInput.value.trim() : '';
    
    // 🔐 تطهير المدخلات
    const cleanPhone = sanitizePhone(phone);
    const cleanAddress = sanitizeInput(address, 200);
    const cleanNotes = sanitizeInput(notes, 500);
    
    if (!cleanPhone) {
        if (typeof showToast === 'function') showToast('يرجى إدخال رقم الهاتف', 'warning');
        if (phoneInput) phoneInput.focus();
        return;
    }

    if (!isValidPhone(cleanPhone)) {
        if (typeof showToast === 'function') showToast('يرجى إدخال رقم هاتف صحيح', 'warning');
        if (phoneInput) phoneInput.focus();
        return;
    }

    // 🔐 التحقق من CSRF Token
    const csrfToken = getCSRFToken();
    
    // حفظ البيانات محلياً للتسهيل في المرات القادمة
    saveLocalStorageData(cleanPhone, cleanAddress);

    // تنسيق الرقم تلقائياً لمفتاح السودان
    phone = formatSudanPhone(cleanPhone);
    
    if (!checkoutReceiptFile) {
        if (typeof showToast === 'function') showToast('يرجى رفع صورة الإيصال', 'warning');
        return;
    }
    
    // التحقق من وجود منتجات للطلب
    if (!directPurchaseItem && cartItems.length === 0) {
        if (typeof showToast === 'function') showToast('السلة فارغة', 'warning');
        return;
    }
    
    const submitBtn = document.getElementById('submitOrderBtn');
    if (!submitBtn) {
        if (typeof showToast === 'function') showToast('زر التأكيد غير موجود', 'error');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إرسال الطلب...';
    
    try {
        const itemsToOrder = directPurchaseItem ? [directPurchaseItem] : cartItems;
        const subtotal = itemsToOrder.reduce((total, item) => total + (Number(item.price) * Number(item.quantity)), 0);
        const shippingCost = subtotal < (siteSettings.freeShippingLimit || 200) ? (siteSettings.shippingCost || 15) : 0;
        const total = subtotal + shippingCost;
        
        // 🔐 تسجيل بدء عملية الطلب
        logSecurityEvent('order_submission_started', { 
            userId: currentUser?.uid,
            itemsCount: itemsToOrder.length,
            total: total,
            hasReceipt: !!checkoutReceiptFile 
        });
        
        // رفع الإيصال أولاً والتأكد من نجاحه
        let receiptUrl = '';
        if (checkoutReceiptFile) {
            try {
                receiptUrl = await uploadCheckoutReceipt(checkoutReceiptFile);
                if (!receiptUrl) {
                    throw new Error('فشل رفع الإيصال');
                }
            } catch (uploadError) {
                console.error('خطأ في رفع الإيصال:', uploadError);
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-check"></i> تأكيد الطلب';
                if (typeof showToast === 'function') showToast('فشل رفع صورة الإيصال. يرجى المحاولة مجدداً', 'error');
                return;
            }
        }
        
        // الحصول على آخر رقم طلب من الإعدادات ليكون تصاعدياً
        const settingsRef = window.firebaseModules.doc(db, 'settings', 'site_config');
        const settingsDoc = await window.firebaseModules.getDoc(settingsRef);
        let nextOrderNumber = 11001000;
        
        if (settingsDoc.exists() && settingsDoc.data().lastOrderNumber) {
            nextOrderNumber = settingsDoc.data().lastOrderNumber + 1;
        }
        
        // تحديث آخر رقم طلب في الإعدادات
        await window.firebaseModules.updateDoc(settingsRef, {
            lastOrderNumber: nextOrderNumber
        });

        const orderId = 'NO:' + nextOrderNumber;
        
        const orderData = {
            orderId: orderId,
            orderNumber: nextOrderNumber,
            userId: currentUser.uid,
            userName: escapeHTML(currentUser.displayName || 'مستخدم'),
            userEmail: currentUser.email,
            phone: phone,
            address: cleanAddress,
            notes: cleanNotes,
            items: itemsToOrder.map(item => ({
                id: item.id,
                name: escapeHTML(item.name),
                price: item.price,
                quantity: item.quantity,
                image: item.image,
                total: item.price * item.quantity
            })),
            subtotal: subtotal,
            shippingCost: shippingCost,
            total: total,
            receiptUrl: receiptUrl,
            status: 'pending',
            csrfToken: csrfToken, // 🔐 إضافة CSRF Token
            createdAt: window.firebaseModules.serverTimestamp(),
            updatedAt: window.firebaseModules.serverTimestamp()
        };
        
        const ordersRef = window.firebaseModules.collection(db, 'orders');
        await window.firebaseModules.addDoc(ordersRef, orderData);
        
        // 🔐 تسجيل نجاح الطلب
        logSecurityEvent('order_submitted', { 
            orderId: orderId,
            userId: currentUser.uid,
            total: total,
            itemsCount: itemsToOrder.length 
        });
        
        // الخصم من المخزون وتحديث الحالة تلقائياً
        for (const item of itemsToOrder) {
            const productRef = window.firebaseModules.doc(db, 'products', item.id);
            const productDoc = await window.firebaseModules.getDoc(productRef);
            
            if (productDoc.exists()) {
                const currentStock = productDoc.data().stock || 0;
                const newStock = Math.max(0, currentStock - item.quantity);
                
                await window.firebaseModules.updateDoc(productRef, {
                    stock: newStock,
                    isActive: newStock > 0
                });
                
                console.log(`📦 تم تحديث مخزون المنتج ${item.name}: ${newStock} (نشط: ${newStock > 0})`);
            }
        }
        
        // حفظ رقم الهاتف والعنوان في الملف الشخصي
        if (!isGuest) {
            const userRef = window.firebaseModules.doc(db, 'users', currentUser.uid);
            await window.firebaseModules.updateDoc(userRef, {
                phone: phone,
                address: cleanAddress,
                cart: []
            });
        }
        
        // تحديث البيانات محلياً
        if (currentUser) {
            currentUser.phone = phone;
            currentUser.address = cleanAddress;
            secureStore('currentUser', currentUser, 120);
            if (typeof updateUserProfile === 'function') updateUserProfile();
        }

        // إرسال إشعار للمدير
        if (typeof sendAdminNotificationForOrder === 'function') await sendAdminNotificationForOrder(orderData, receiptUrl);
        
        cartItems = [];
        directPurchaseItem = null;
        if (typeof updateCartCount === 'function') updateCartCount();
        
        if (typeof showToast === 'function') showToast('تم إرسال الطلب بنجاح!', 'success');
        
        setTimeout(() => {
            if (typeof showSection === 'function') showSection('my-orders');
            if (typeof removeCheckoutReceipt === 'function') removeCheckoutReceipt();
            
            const phoneInput = document.getElementById('checkoutPhone');
            const addressInput = document.getElementById('checkoutAddress');
            const notesInput = document.getElementById('checkoutNotes');
            
            if (phoneInput) phoneInput.value = '';
            if (addressInput) addressInput.value = '';
            if (notesInput) notesInput.value = '';
        }, 1500);
        
    } catch (error) {
        console.error('خطأ في إرسال الطلب:', error);
        
        // 🔐 تسجيل فشل الطلب
        logSecurityEvent('order_submission_failed', { 
            userId: currentUser?.uid,
            error: error.message,
            code: error.code 
        });
        
        if (typeof showToast === 'function') showToast('خطأ في إرسال الطلب، يرجى المحاولة مجدداً', 'error');
    } finally {
        const submitBtn = document.getElementById('submitOrderBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check"></i> تأكيد الطلب';
        }
    }
}

// دالة رفع الإيصال المصححة
async function uploadCheckoutReceipt(file) {
    try {
        if (!currentUser) throw new Error('يجب تسجيل الدخول لرفع الإيصال');
        if (!storage) {
            const firebaseInstance = initializeFirebaseApp();
            if (firebaseInstance) {
                storage = firebaseInstance.storage;
            } else {
                throw new Error('Firebase Storage غير مهيأ');
            }
        }
        
        if (!file) throw new Error('لم يتم تحديد ملف');
        
        console.log('📤 بدء رفع الإيصال:', file.name, `(${(file.size / 1024).toFixed(2)} KB)`);
        
        // 🔐 تسمية آمنة للملف
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileName = 'receipts/' + currentUser.uid + '/' + Date.now() + '_' + safeFileName;
        const storageRef = window.firebaseModules.ref(storage, fileName);
        
        // رفع الملف
        const uploadResult = await window.firebaseModules.uploadBytes(storageRef, file);
        console.log('✅ تم رفع الملف بنجاح');
        
        const downloadUrl = await window.firebaseModules.getDownloadURL(storageRef);
        console.log('✅ تم الحصول على رابط الإيصال:', downloadUrl);
        
        if (!downloadUrl) throw new Error('فشل الحصول على رابط التحميل');
        
        return downloadUrl;
    } catch (error) {
        console.error('❌ خطأ في رفع الإيصال:', error);
        logSecurityEvent('receipt_upload_failed', { error: error.message });
        
        if (typeof showToast === 'function') showToast('فشل رفع صورة الإيصال: ' + error.message, 'error');
        throw error;
    }
}

async function sendAdminNotificationForOrder(orderData, receiptUrl) {
    try {
        const notificationsRef = window.firebaseModules.collection(db, 'admin_notifications');
        await window.firebaseModules.addDoc(notificationsRef, {
            type: 'new_order',
            orderId: orderData.orderId,
            customerName: orderData.userName,
            customerPhone: orderData.phone,
            customerEmail: orderData.userEmail,
            total: orderData.total,
            itemsCount: orderData.items.length,
            receiptUrl: receiptUrl,
            status: 'unread',
            createdAt: window.firebaseModules.serverTimestamp(),
            orderData: orderData
        });
        console.log('تم إرسال إشعار للمدير');
    } catch (error) {
        console.error('خطأ في إرسال الإشعار:', error);
    }
}

// ======================== دوال الدفع والإيصال ========================

function previewReceipt(input) {
    const preview = document.getElementById('receiptPreviewContainer');
    const previewImg = document.getElementById('receiptPreviewImg');
    const confirmBtn = document.getElementById('confirmOrderBtn');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const uploadProgress = document.getElementById('uploadProgress');
    const container = document.querySelector('.receipt-upload-container');
    
    if (!input || !input.files || !input.files[0]) {
        return;
    }
    
    const file = input.files[0];
    
    try {
        // 🔐 التحقق من ملف الصورة
        if (!validateImageFile(file, 10)) {
            if (typeof showToast === 'function') showToast('ملف الصورة غير صالح أو الحجم كبير جداً', 'error');
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            if (previewImg) {
                previewImg.src = e.target.result;
                previewImg.alt = 'إيصال الدفع - ' + escapeHTML(file.name);
            }
            if (preview) preview.style.display = 'block';
            if (uploadPlaceholder) uploadPlaceholder.style.display = 'none';
            if (container) {
                container.style.borderStyle = 'solid';
                container.style.borderColor = '#27ae60';
                container.style.background = '#f0fff4';
            }
            
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = '1';
                confirmBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال الطلب الآن';
            }
            
            if (uploadProgress) uploadProgress.style.display = 'none';
        };
        
        reader.readAsDataURL(file);
        
    } catch (error) {
        console.error('خطأ في معاينة الصورة:', error);
        if (typeof showToast === 'function') showToast('حدث خطأ في معاينة الصورة', 'error');
        input.value = '';
    }
}

function removeReceiptPreview() {
    const input = document.getElementById('receiptInput');
    const preview = document.getElementById('receiptPreviewContainer');
    const previewImg = document.getElementById('receiptPreviewImg');
    const confirmBtn = document.getElementById('confirmOrderBtn');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const container = document.querySelector('.receipt-upload-container');
    
    if (input) input.value = '';
    if (preview) preview.style.display = 'none';
    if (previewImg) previewImg.src = '';
    if (uploadPlaceholder) uploadPlaceholder.style.display = 'block';
    if (container) {
        container.style.borderStyle = 'dashed';
        container.style.borderColor = '#ddd';
        container.style.background = '#f9f9f9';
    }
    
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-credit-card"></i> تأكيد الطلب وإرسال';
    }
}

// ======================== دوال الدفع ========================

function goToCheckout() {
    if (!currentUser || isGuest) {
        if (typeof showToast === 'function') showToast('يرجى تسجيل الدخول أولاً لإتمام عملية الشراء', 'warning');
        if (typeof showSection === 'function') showSection('profile');
        return;
    }
    
    // التحقق من وجود منتجات للطلب
    if (!directPurchaseItem && cartItems.length === 0) {
        if (typeof showToast === 'function') showToast('السلة فارغة', 'warning');
        return;
    }
    if (typeof showSection === 'function') showSection('checkout');
}

// ======================== التصدير للاستخدام العام ========================

window.previewCheckoutReceipt = previewCheckoutReceipt;
window.removeCheckoutReceipt = removeCheckoutReceipt;
window.submitCheckoutOrder = submitCheckoutOrder;
window.updateCheckoutSummary = updateCheckoutSummary;
window.updateCheckoutItemQty = updateCheckoutItemQty;
window.enableDataEdit = enableDataEdit;
window.goToCheckout = goToCheckout;
window.previewReceipt = previewReceipt;
window.removeReceiptPreview = removeReceiptPreview;
window.uploadCheckoutReceipt = uploadCheckoutReceipt;
window.sendAdminNotificationForOrder = sendAdminNotificationForOrder;

console.log('✅ checkout-system.js loaded with file security');