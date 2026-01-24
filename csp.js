// csp.js - سياسة أمن المحتوى المتقدمة
const CSP_POLICY = {
    'default-src': ["'self'"],
    'script-src': [
        "'self'",
        "'unsafe-inline'", // للـ inline scripts المطلوبة
        "'unsafe-eval'", // لبعض مكتبات Firebase
        "https://www.gstatic.com",
        "https://apis.google.com",
        "https://*.firebaseapp.com",
        "https://*.firebasestorage.app"
    ],
    'style-src': [
        "'self'",
        "'unsafe-inline'", // للـ inline styles
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com"
    ],
    'img-src': [
        "'self'",
        "data:",
        "https:",
        "blob:",
        "https://*.firebasestorage.app",
        "https://via.placeholder.com",
        "https://cdn-icons-png.flaticon.com",
        "https://i.ibb.co"
    ],
    'font-src': [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
    ],
    'connect-src': [
        "'self'",
        "https://*.firebaseio.com",
        "https://*.firebasestorage.app",
        "https://identitytoolkit.googleapis.com",
        "wss://*.firebaseio.com",
        "https://api.ipify.org"
    ],
    'frame-src': [
        "'self'",
        "https://accounts.google.com",
        "https://*.firebaseapp.com"
    ],
    'media-src': ["'self'"],
    'object-src': ["'none'"], // منع جميع الكائنات
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"], // حماية ضد Clickjacking
    'block-all-mixed-content': [],
    'upgrade-insecure-requests': []
};

function applyCSP() {
    // إنشاء سلسلة CSP
    const cspString = Object.entries(CSP_POLICY)
        .map(([directive, sources]) => {
            return `${directive} ${sources.join(' ')}`;
        })
        .join('; ');
    
    // إضافة meta tag للـ CSP
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = cspString;
    document.head.appendChild(meta);
    
    console.log('🔐 تم تطبيق CSP:', cspString);
}

// تطبيق CSP فور تحميل الصفحة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCSP);
} else {
    applyCSP();
}

// مراقبة انتهاكات CSP
if ('securityPolicyViolation' in window) {
    document.addEventListener('securitypolicyviolation', (e) => {
        console.warn('🚨 CSP Violation:', {
            violatedDirective: e.violatedDirective,
            blockedURI: e.blockedURI,
            sourceFile: e.sourceFile,
            lineNumber: e.lineNumber,
            columnNumber: e.columnNumber
        });
        
        // إرسال تقرير الانتهاك
        sendViolationReport(e);
    });
}

async function sendViolationReport(violation) {
    try {
        await fetch('/api/csp/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                'csp-report': {
                    'document-uri': document.location.href,
                    'referrer': document.referrer,
                    'violated-directive': violation.violatedDirective,
                    'effective-directive': violation.effectiveDirective,
                    'original-policy': violation.originalPolicy,
                    'blocked-uri': violation.blockedURI,
                    'source-file': violation.sourceFile,
                    'line-number': violation.lineNumber,
                    'column-number': violation.columnNumber
                }
            })
        });
    } catch (error) {
        console.error('فشل إرسال تقرير CSP:', error);
    }
}

