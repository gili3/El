/**
 * UI Helpers Module
 * Handles UI-related operations and DOM manipulations
 */

const UIHelpers = (function() {
    'use strict';
    
    // Private variables
    let toastContainer = null;
    let modalStack = [];
    
    /**
     * Initialize UI helpers
     */
    function init() {
        createToastContainer();
        setupGlobalEventListeners();
        updateCurrentYear();
    }
    
    /**
     * Create toast container if it doesn't exist
     */
    function createToastContainer() {
        if (!document.getElementById('toastContainer')) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container';
            toastContainer.setAttribute('aria-live', 'polite');
            toastContainer.setAttribute('aria-atomic', 'true');
            document.body.appendChild(toastContainer);
        } else {
            toastContainer = document.getElementById('toastContainer');
        }
    }
    
    /**
     * Setup global event listeners
     */
    function setupGlobalEventListeners() {
        // Handle escape key for closing modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalStack.length > 0) {
                closeTopModal();
            }
        });
        
        // Handle clicks outside modals
        document.addEventListener('click', (e) => {
            if (modalStack.length > 0 && e.target.classList.contains('modal')) {
                closeTopModal();
            }
        });
    }
    
    /**
     * Update current year in footer
     */
    function updateCurrentYear() {
        const yearElement = document.getElementById('currentYear');
        if (yearElement) {
            yearElement.textContent = new Date().getFullYear();
        }
    }
    
    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type of toast (success, error, warning, info)
     * @param {string} title - Optional title
     * @param {number} duration - Duration in milliseconds
     */
    function showToast(message, type = 'info', title = '', duration = 5000) {
        if (!toastContainer) createToastContainer();
        
        const toastId = 'toast-' + Date.now();
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        // Icon based on type
        let icon = 'info-circle';
        switch (type) {
            case 'success': icon = 'check-circle'; break;
            case 'error': icon = 'exclamation-circle'; break;
            case 'warning': icon = 'exclamation-triangle'; break;
            case 'info': icon = 'info-circle'; break;
        }
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas fa-${icon}"></i>
            </div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${escapeHtml(message)}</div>
            </div>
            <button class="toast-close" aria-label="إغلاق الإشعار">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        toastContainer.appendChild(toast);
        
        // Add close event
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => removeToast(toastId));
        
        // Auto remove after duration
        setTimeout(() => removeToast(toastId), duration);
        
        return toastId;
    }
    
    /**
     * Remove toast by ID
     */
    function removeToast(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.style.animation = 'toastSlideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }
    
    /**
     * Create and show modal
     */
    function showModal(options) {
        const modalId = 'modal-' + Date.now();
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', `${modalId}-title`);
        
        let footerButtons = '';
        if (options.buttons) {
            footerButtons = options.buttons.map(btn => `
                <button type="button" class="btn ${btn.class || 'btn-secondary'}"
                        onclick="${btn.onclick}">
                    ${btn.text}
                </button>
            `).join('');
        }
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="${modalId}-title" class="modal-title">${options.title}</h2>
                    <button type="button" class="modal-close" aria-label="إغلاق">
                        &times;
                    </button>
                </div>
                <div class="modal-body">
                    ${options.content}
                </div>
                ${options.buttons ? `
                <div class="modal-footer">
                    ${footerButtons}
                </div>
                ` : ''}
            </div>
        `;
        
        document.body.appendChild(modal);
        modalStack.push(modalId);
        
        // Add event listeners
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => closeModal(modalId));
        
        // Focus trap
        trapFocus(modal);
        
        return modalId;
    }
    
    /**
     * Close modal by ID
     */
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.animation = 'modalFadeOut 0.3s ease';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
                // Remove from stack
                const index = modalStack.indexOf(modalId);
                if (index > -1) {
                    modalStack.splice(index, 1);
                }
            }, 300);
        }
    }
    
    /**
     * Close top modal
     */
    function closeTopModal() {
        if (modalStack.length > 0) {
            closeModal(modalStack[modalStack.length - 1]);
        }
    }
    
    /**
     * Trap focus inside modal
     */
    function trapFocus(modal) {
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        });
        
        // Focus first element
        setTimeout(() => firstElement?.focus(), 100);
    }
    
    /**
     * Show confirmation dialog
     */
    function confirm(options) {
        return new Promise((resolve) => {
            const modalId = showModal({
                title: options.title || 'تأكيد العملية',
                content: options.message || 'هل أنت متأكد من المتابعة؟',
                buttons: [
                    {
                        text: options.cancelText || 'إلغاء',
                        class: 'btn-secondary',
                        onclick: `UIHelpers.closeModal('${modalId}'); resolve(false)`
                    },
                    {
                        text: options.confirmText || 'تأكيد',
                        class: 'btn-danger',
                        onclick: `UIHelpers.closeModal('${modalId}'); resolve(true)`
                    }
                ]
            });
        });
    }
    
    /**
     * Show loading overlay
     */
    function showLoading(containerId) {
        const container = containerId ? 
            document.getElementById(containerId) : 
            document.body;
        
        const loadingId = 'loading-' + Date.now();
        const loading = document.createElement('div');
        loading.id = loadingId;
        loading.className = 'loading-overlay';
        loading.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <p>جاري التحميل...</p>
            </div>
        `;
        
        container.style.position = 'relative';
        container.appendChild(loading);
        
        return loadingId;
    }
    
    /**
     * Hide loading overlay
     */
    function hideLoading(loadingId) {
        const loading = document.getElementById(loadingId);
        if (loading && loading.parentNode) {
            loading.parentNode.removeChild(loading);
        }
    }
    
    /**
     * Format number with thousands separator
     */
    function formatNumber(num, decimals = 0) {
        if (num === null || num === undefined) return '0';
        
        const number = typeof num === 'string' ? parseFloat(num) : num;
        if (isNaN(number)) return '0';
        
        return number.toLocaleString('ar-EG', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }
    
    /**
     * Format price with currency
     */
    function formatPrice(amount, currency = AppConstants.CURRENCY_SYMBOL) {
        return `${formatNumber(amount)} ${currency}`;
    }
    
    /**
     * Format date
     */
    function formatDate(date, format = 'full') {
        if (!date) return 'غير محدد';
        
        const dateObj = date.seconds ? 
            new Date(date.seconds * 1000) : 
            new Date(date);
        
        if (isNaN(dateObj.getTime())) return 'غير محدد';
        
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Africa/Cairo'
        };
        
        return dateObj.toLocaleString('ar-EG', options);
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Debounce function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Throttle function
     */
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * Validate email format
     */
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    /**
     * Validate phone number
     */
    function validatePhone(phone) {
        const re = /^[\+]?[0-9\s\-\(\)]{8,}$/;
        return re.test(phone);
    }
    
    /**
     * Validate URL
     */
    function validateUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Validate image file
     */
    function validateImageFile(file) {
        // Check file type
        if (!AppConstants.ALLOWED_IMAGE_TYPES.includes(file.type)) {
            return {
                valid: false,
                message: 'نوع الملف غير مدعوم. يُرجى اختيار صورة (JPEG, PNG, WebP, GIF)'
            };
        }
        
        // Check file size
        if (file.size > AppConstants.MAX_IMAGE_SIZE) {
            return {
                valid: false,
                message: `حجم الملف كبير جداً. الحد الأقصى: ${AppConstants.MAX_IMAGE_SIZE / 1024 / 1024}MB`
            };
        }
        
        return { valid: true };
    }
    
    /**
     * Create image preview
     */
    function createImagePreview(file, containerId) {
        return new Promise((resolve, reject) => {
            const container = document.getElementById(containerId);
            if (!container) {
                reject(new Error('Container not found'));
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'image-preview';
                img.alt = 'معاينة الصورة';
                
                // Clear container and add image
                container.innerHTML = '';
                container.appendChild(img);
                
                // Check image dimensions for 1:1 aspect ratio
                const tempImg = new Image();
                tempImg.onload = () => {
                    if (Math.abs(tempImg.width - tempImg.height) > 1) {
                        showToast('يُفضل استخدام صور مربعة (1:1) لأفضل عرض', 'warning');
                    }
                    resolve({ width: tempImg.width, height: tempImg.height });
                };
                tempImg.src = e.target.result;
            };
            
            reader.onerror = () => {
                reject(new Error('فشل قراءة الملف'));
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    /**
     * Update element text with animation
     */
    function animateNumber(element, target, duration = 500) {
        if (!element) return;
        
        const start = parseInt(element.textContent.replace(/,/g, '')) || 0;
        const increment = target > start ? 1 : -1;
        const steps = Math.abs(target - start);
        const stepTime = Math.max(duration / steps, 1);
        
        let current = start;
        const timer = setInterval(() => {
            current += increment;
            element.textContent = formatNumber(current);
            
            if (current === target) {
                clearInterval(timer);
            }
        }, stepTime);
    }
    
    /**
     * Copy text to clipboard
     */
    function copyToClipboard(text) {
        return navigator.clipboard.writeText(text)
            .then(() => showToast('تم نسخ النص', 'success'))
            .catch(() => showToast('فشل النسخ', 'error'));
    }
    
    /**
     * Download file
     */
    function downloadFile(data, filename, type = 'text/plain') {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    /**
     * Toggle element visibility
     */
    function toggleVisibility(elementId, show) {
        const element = document.getElementById(elementId);
        if (element) {
            if (show) {
                element.classList.remove('hidden');
                element.setAttribute('aria-hidden', 'false');
            } else {
                element.classList.add('hidden');
                element.setAttribute('aria-hidden', 'true');
            }
        }
    }
    
    /**
     * Set element text with i18n support
     */
    function setText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    }
    
    /**
     * Set element HTML with XSS protection
     */
    function setHtml(elementId, html) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = escapeHtml(html);
        }
    }
    
    /**
     * Create pagination
     */
    function createPagination(currentPage, totalPages, onPageChange) {
        const pagination = document.createElement('div');
        pagination.className = 'pagination';
        pagination.setAttribute('role', 'navigation');
        pagination.setAttribute('aria-label', 'تنقل بين الصفحات');
        
        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        prevBtn.setAttribute('aria-label', 'الصفحة السابقة');
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
        pagination.appendChild(prevBtn);
        
        // Page numbers
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        if (startPage > 1) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'pagination-btn';
            firstBtn.textContent = '1';
            firstBtn.addEventListener('click', () => onPageChange(1));
            pagination.appendChild(firstBtn);
            
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                pagination.appendChild(ellipsis);
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.setAttribute('aria-label', `الصفحة ${i}`);
            pageBtn.setAttribute('aria-current', i === currentPage ? 'page' : 'false');
            pageBtn.addEventListener('click', () => onPageChange(i));
            pagination.appendChild(pageBtn);
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                pagination.appendChild(ellipsis);
            }
            
            const lastBtn = document.createElement('button');
            lastBtn.className = 'pagination-btn';
            lastBtn.textContent = totalPages;
            lastBtn.addEventListener('click', () => onPageChange(totalPages));
            pagination.appendChild(lastBtn);
        }
        
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        nextBtn.setAttribute('aria-label', 'الصفحة التالية');
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
        pagination.appendChild(nextBtn);
        
        return pagination;
    }
    
    // Public API
    return {
        init,
        showToast,
        showModal,
        closeModal,
        confirm,
        showLoading,
        hideLoading,
        formatNumber,
        formatPrice,
        formatDate,
        escapeHtml,
        debounce,
        throttle,
        validateEmail,
        validatePhone,
        validateUrl,
        validateImageFile,
        createImagePreview,
        animateNumber,
        copyToClipboard,
        downloadFile,
        toggleVisibility,
        setText,
        setHtml,
        createPagination
    };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    UIHelpers.init();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIHelpers;
}

