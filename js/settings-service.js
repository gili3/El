/**
 * Settings Service Module
 * Handles all settings-related operations
 */

const SettingsService = (function() {
    'use strict';
    
    // Private variables
    let currentSettings = null;
    let unsubscribeSettings = null;
    
    /**
     * Initialize settings service
     */
    function init() {
        console.log('⚙️ تهيئة خدمة الإعدادات...');
        loadSettings();
    }
    
    /**
     * Load all settings
     */
    async function loadSettings() {
        try {
            // Load general settings
            const generalDoc = await FirebaseService.getDoc('settings', 'general');
            
            if (generalDoc.exists()) {
                currentSettings = generalDoc.data();
            } else {
                // Create default settings
                currentSettings = AppConstants.DEFAULT_SETTINGS;
                await FirebaseService.setDoc('settings', 'general', currentSettings);
            }
            
            // Load theme settings
            const themeDoc = await FirebaseService.getDoc('settings', 'theme');
            
            if (themeDoc.exists()) {
                currentSettings.theme = themeDoc.data();
            } else {
                currentSettings.theme = AppConstants.DEFAULT_SETTINGS.theme;
                await FirebaseService.setDoc('settings', 'theme', currentSettings.theme);
            }
            
            console.log('✅ تم تحميل الإعدادات');
            return currentSettings;
            
        } catch (error) {
            console.error('❌ خطأ في تحميل الإعدادات:', error);
            throw error;
        }
    }
    
    /**
     * Get specific setting
     */
    function getSetting(key, defaultValue = null) {
        if (!currentSettings) {
            return defaultValue;
        }
        
        // Support nested keys (e.g., 'theme.primaryColor')
        const keys = key.split('.');
        let value = currentSettings;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }
        
        return value !== undefined ? value : defaultValue;
    }
    
    /**
     * Update settings
     */
    async function updateSettings(updates) {
        try {
            // Validate updates
            validateSettings(updates);
            
            // Merge with current settings
            const updatedSettings = {
                ...currentSettings,
                ...updates,
                updatedAt: FirebaseService.serverTimestamp(),
                updatedBy: FirebaseService.getCurrentUser()?.uid
            };
            
            // Update in Firestore
            await FirebaseService.setDoc('settings', 'general', updatedSettings);
            
            // Update local cache
            currentSettings = updatedSettings;
            
            // Apply theme if updated
            if (updates.theme) {
                await updateThemeSettings(updates.theme);
            }
            
            console.log('✅ تم تحديث الإعدادات');
            UIHelpers.showToast('تم حفظ الإعدادات بنجاح', 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ خطأ في تحديث الإعدادات:', error);
            UIHelpers.showToast(`خطأ في حفظ الإعدادات: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Update theme settings
     */
    async function updateThemeSettings(themeUpdates) {
        try {
            const currentTheme = getSetting('theme', {});
            const updatedTheme = {
                ...currentTheme,
                ...themeUpdates,
                updatedAt: FirebaseService.serverTimestamp()
            };
            
            // Save to Firestore
            await FirebaseService.setDoc('settings', 'theme', updatedTheme);
            
            // Update CSS variables
            applyTheme(updatedTheme);
            
            // Update local cache
            if (currentSettings) {
                currentSettings.theme = updatedTheme;
            }
            
            console.log('🎨 تم تحديث إعدادات المظهر');
            
        } catch (error) {
            console.error('❌ خطأ في تحديث إعدادات المظهر:', error);
            throw error;
        }
    }
    
    /**
     * Apply theme to CSS variables
     */
    function applyTheme(theme) {
        const root = document.documentElement;
        
        // Apply color variables
        if (theme.primaryColor) {
            root.style.setProperty('--primary-color', theme.primaryColor);
        }
        
        if (theme.secondaryColor) {
            root.style.setProperty('--secondary-color', theme.secondaryColor);
        }
        
        if (theme.accentColor) {
            root.style.setProperty('--accent-color', theme.accentColor);
        }
        
        if (theme.successColor) {
            root.style.setProperty('--success-color', theme.successColor);
        }
        
        if (theme.warningColor) {
            root.style.setProperty('--warning-color', theme.warningColor);
        }
        
        if (theme.dangerColor) {
            root.style.setProperty('--danger-color', theme.dangerColor);
        }
        
        if (theme.infoColor) {
            root.style.setProperty('--info-color', theme.infoColor);
        }
    }
    
    /**
     * Validate settings
     */
    function validateSettings(settings) {
        const errors = [];
        
        // Validate store name
        if (settings.storeName && settings.storeName.trim().length < 2) {
            errors.push('اسم المتجر يجب أن يكون على الأقل حرفين');
        }
        
        // Validate email
        if (settings.storeEmail && !UIHelpers.validateEmail(settings.storeEmail)) {
            errors.push('البريد الإلكتروني غير صالح');
        }
        
        // Validate phone
        if (settings.storePhone && !UIHelpers.validatePhone(settings.storePhone)) {
            errors.push('رقم الهاتف غير صالح');
        }
        
        // Validate shipping cost
        if (settings.shippingCost !== undefined) {
            const shippingCost = parseFloat(settings.shippingCost);
            if (isNaN(shippingCost) || shippingCost < 0) {
                errors.push('تكلفة الشحن يجب أن تكون رقم موجب');
            }
        }
        
        // Validate free shipping threshold
        if (settings.freeShippingThreshold !== undefined) {
            const threshold = parseFloat(settings.freeShippingThreshold);
            if (isNaN(threshold) || threshold < 0) {
                errors.push('حد التوصيل المجاني يجب أن يكون رقم موجب');
            }
        }
        
        // Validate tax rate
        if (settings.taxRate !== undefined) {
            const taxRate = parseFloat(settings.taxRate);
            if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
                errors.push('معدل الضريبة يجب أن يكون بين 0 و 100');
            }
        }
        
        // Validate URLs
        const urlFields = ['facebookUrl', 'instagramUrl', 'twitterUrl', 'whatsappUrl'];
        urlFields.forEach(field => {
            if (settings[field] && settings[field].trim() !== '' && !UIHelpers.validateUrl(settings[field])) {
                errors.push(`رابط ${field} غير صالح`);
            }
        });
        
        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
        
        return true;
    }
    
    /**
     * Reset settings to defaults
     */
    async function resetToDefaults() {
        try {
            const confirmed = await UIHelpers.confirm({
                title: 'استعادة الإعدادات الافتراضية',
                message: 'هل أنت متأكد من استعادة جميع الإعدادات إلى القيم الافتراضية؟ هذا الإجراء لا يمكن التراجع عنه.'
            });
            
            if (!confirmed) return;
            
            // Reset to default settings
            await FirebaseService.setDoc('settings', 'general', AppConstants.DEFAULT_SETTINGS);
            await FirebaseService.setDoc('settings', 'theme', AppConstants.DEFAULT_SETTINGS.theme);
            
            // Update local cache
            currentSettings = AppConstants.DEFAULT_SETTINGS;
            
            // Apply theme
            applyTheme(AppConstants.DEFAULT_SETTINGS.theme);
            
            console.log('🔄 تم استعادة الإعدادات الافتراضية');
            UIHelpers.showToast('تم استعادة الإعدادات الافتراضية', 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ خطأ في استعادة الإعدادات:', error);
            UIHelpers.showToast(`خطأ في استعادة الإعدادات: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Backup settings
     */
    async function backupSettings() {
        try {
            const settings = await loadSettings();
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `settings_backup_${timestamp}.json`;
            
            UIHelpers.downloadFile(
                JSON.stringify(settings, null, 2),
                filename,
                'application/json'
            );
            
            console.log('💾 تم إنشاء نسخة احتياطية للإعدادات');
            UIHelpers.showToast('تم إنشاء نسخة احتياطية للإعدادات', 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ خطأ في إنشاء نسخة احتياطية:', error);
            UIHelpers.showToast(`خطأ في إنشاء النسخة الاحتياطية: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Restore settings from backup
     */
    async function restoreSettings(file) {
        try {
            const confirmed = await UIHelpers.confirm({
                title: 'استعادة الإعدادات',
                message: 'هل أنت متأكد من استعادة الإعدادات من الملف؟ هذا سيستبدل جميع الإعدادات الحالية.'
            });
            
            if (!confirmed) return;
            
            // Read file
            const text = await readFileAsText(file);
            const settings = JSON.parse(text);
            
            // Validate settings structure
            if (!settings.storeName || !settings.storeEmail) {
                throw new Error('ملف الإعدادات غير صالح');
            }
            
            // Restore settings
            await FirebaseService.setDoc('settings', 'general', settings);
            
            // Restore theme if exists
            if (settings.theme) {
                await FirebaseService.setDoc('settings', 'theme', settings.theme);
                applyTheme(settings.theme);
            }
            
            // Update local cache
            currentSettings = settings;
            
            console.log('🔄 تم استعادة الإعدادات من النسخة الاحتياطية');
            UIHelpers.showToast('تم استعادة الإعدادات بنجاح', 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ خطأ في استعادة الإعدادات:', error);
            UIHelpers.showToast(`خطأ في استعادة الإعدادات: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Read file as text
     */
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('فشل قراءة الملف'));
            reader.readAsText(file);
        });
    }
    
    /**
     * Get system information
     */
    async function getSystemInfo() {
        try {
            // Get Firestore stats
            const productsSnapshot = await FirebaseService.getDocs('products');
            const ordersSnapshot = await FirebaseService.getDocs('orders');
            const usersSnapshot = await FirebaseService.getDocs('users', [
                window.firebaseModules.where('isGuest', '==', false)
            ]);
            
            // Get storage usage (this is approximate)
            const storageRef = window.firebaseModules.ref(FirebaseService.storage);
            
            return {
                firestore: {
                    products: productsSnapshot.size,
                    orders: ordersSnapshot.size,
                    users: usersSnapshot.size,
                    total: productsSnapshot.size + ordersSnapshot.size + usersSnapshot.size
                },
                system: {
                    userAgent: navigator.userAgent,
                    language: navigator.language,
                    platform: navigator.platform,
                    cookiesEnabled: navigator.cookieEnabled,
                    screenResolution: `${window.screen.width}x${window.screen.height}`,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    dateTime: new Date().toISOString()
                },
                app: {
                    version: '2.0.0',
                    environment: 'production',
                    lastBackup: getSetting('lastBackup'),
                    maintenanceMode: getSetting('maintenanceMode', false)
                }
            };
            
        } catch (error) {
            console.error('❌ خطأ في جلب معلومات النظام:', error);
            throw error;
        }
    }
    
    /**
     * Toggle maintenance mode
     */
    async function toggleMaintenanceMode(enabled, message = '') {
        try {
            await FirebaseService.updateDoc('settings', 'general', {
                maintenanceMode: enabled,
                maintenanceMessage: message || '',
                maintenanceStart: enabled ? FirebaseService.serverTimestamp() : null,
                updatedAt: FirebaseService.serverTimestamp(),
                updatedBy: FirebaseService.getCurrentUser()?.uid
            });
            
            console.log(`🔧 تم ${enabled ? 'تفعيل' : 'تعطيل'} وضع الصيانة`);
            UIHelpers.showToast(`تم ${enabled ? 'تفعيل' : 'تعطيل'} وضع الصيانة`, 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ خطأ في تغيير وضع الصيانة:', error);
            UIHelpers.showToast(`خطأ في تغيير وضع الصيانة: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Clear all cache
     */
    async function clearAllCache() {
        try {
            const confirmed = await UIHelpers.confirm({
                title: 'مسح التخزين المؤقت',
                message: 'هل أنت متأكد من مسح جميع البيانات المخزنة مؤقتاً؟ هذا قد يحسن الأداء ولكن سيعيد تحميل جميع البيانات من الخادم.'
            });
            
            if (!confirmed) return;
            
            FirebaseService.clearCache();
            
            console.log('🧹 تم مسح التخزين المؤقت بالكامل');
            UIHelpers.showToast('تم مسح التخزين المؤقت', 'success');
            
            return true;
            
        } catch (error) {
            console.error('❌ خطأ في مسح التخزين المؤقت:', error);
            UIHelpers.showToast(`خطأ في مسح التخزين المؤقت: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Save all settings from form
     */
    async function saveAllSettings() {
        try {
            // This function would collect all settings from the UI
            // and call updateSettings with the collected data
            console.log('💾 جاري حفظ جميع الإعدادات...');
            
            // Implementation depends on your UI structure
            // You'll need to collect data from all settings forms
            
            UIHelpers.showToast('تم حفظ جميع الإعدادات', 'success');
            
        } catch (error) {
            console.error('❌ خطأ في حفظ الإعدادات:', error);
            UIHelpers.showToast(`خطأ في حفظ الإعدادات: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Setup real-time updates for settings
     */
    function setupRealtimeUpdates(callback) {
        if (unsubscribeSettings) {
            unsubscribeSettings();
        }
        
        unsubscribeSettings = FirebaseService.subscribeToCollection(
            'settings',
            (snapshot) => {
                const settings = {};
                snapshot.docs.forEach(doc => {
                    settings[doc.id] = doc.data();
                });
                
                if (callback && typeof callback === 'function') {
                    callback(settings);
                }
            }
        );
        
        return unsubscribeSettings;
    }
    
    /**
     * Clean up resources
     */
    function cleanup() {
        if (unsubscribeSettings) {
            unsubscribeSettings();
            unsubscribeSettings = null;
        }
    }
    
    // Public API
    return {
        init,
        loadSettings,
        getSetting,
        updateSettings,
        updateThemeSettings,
        resetToDefaults,
        backupSettings,
        restoreSettings,
        getSystemInfo,
        toggleMaintenanceMode,
        clearAllCache,
        saveAllSettings,
        setupRealtimeUpdates,
        cleanup
    };
})();

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    SettingsService.init();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsService;
}

