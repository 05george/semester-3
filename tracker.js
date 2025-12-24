const UserTracker = {
    // دالة للحصول على اسم العرض (نفس المنطق المستخدم في script.js)
    getDisplayName() {
        // 🔥 حذف أي قيم قديمة خاطئة من النظام القديم
        const realName = localStorage.getItem('user_real_name');
        if (realName === 'زائر مجهول' || realName === 'زائر') {
            localStorage.removeItem('user_real_name');
        }

        // 🔥 التأكد من وجود ID أولاً قبل أي شيء
        if (!localStorage.getItem('visitor_id')) {
            const newId = 'ID-' + Math.floor(1000 + Math.random() * 9000);
            localStorage.setItem('visitor_id', newId);
        }

        // محاولة الحصول على الاسم الحقيقي (بعد التنظيف)
        const cleanRealName = localStorage.getItem('user_real_name');
        if (cleanRealName && cleanRealName.trim()) {
            return cleanRealName.trim();
        }
        
        // إذا لم يكن موجوداً، استخدم الـ ID
        const visitorId = localStorage.getItem('visitor_id');
        return visitorId;
    },

    // دالة للحصول على اسم المتصفح
    getBrowserName() {
        const ua = navigator.userAgent;
        if (ua.includes("Samsung")) return "Samsung Internet";
        if (ua.includes("Edg")) return "Edge";
        if (ua.includes("Chrome")) return "Chrome";
        if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
        if (ua.includes("Firefox")) return "Firefox";
        if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
        return "Unknown Browser";
    },

    // دالة للحصول على الـ Viewport
    getViewport() {
        return `${window.innerWidth}x${window.innerHeight}`;
    },

    // دالة للحصول على حجم الشاشة الفعلي
    getScreenSize() {
        return `${screen.width}x${screen.height}`;
    },

    // دالة للحصول على نسبة البكسل
    getPixelRatio() {
        return window.devicePixelRatio || 1;
    },

    // دالة للحصول على نظام التشغيل
    getOS() {
        const ua = navigator.userAgent;
        if (ua.includes("Android")) return "Android";
        if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
        if (ua.includes("Win")) return "Windows";
        if (ua.includes("Mac")) return "macOS";
        if (ua.includes("Linux")) return "Linux";
        return "Unknown OS";
    },

    // دالة للحصول على معلومات الاتصال
    getConnectionInfo() {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn) {
            return `${conn.effectiveType || 'Unknown'} (${conn.downlink || '?'}Mbps)`;
        }
        return "Unknown";
    },

    // دالة للحصول على المجموعة الحالية
    getCurrentGroup() {
        return localStorage.getItem('selectedGroup') || 'لم يختر بعد';
    },

    // دالة للحصول على اللغة
    getLanguage() {
        return navigator.language || navigator.userLanguage || 'Unknown';
    },

    // إرسال البيانات
    send(action, extra = {}) {
        const displayName = this.getDisplayName();
        const browserName = this.getBrowserName();
        const viewport = this.getViewport();
        const screenSize = this.getScreenSize();
        const pixelRatio = this.getPixelRatio();
        const os = this.getOS();
        const connection = this.getConnectionInfo();
        const group = this.getCurrentGroup();
        const language = this.getLanguage();

        const data = new FormData();
        data.append("01-User", displayName);
        data.append("02-Group", group);
        data.append("03-Action", action);
        data.append("04-Browser", browserName);
        data.append("05-OS", os);
        data.append("06-Viewport", viewport);
        data.append("07-Screen", screenSize);
        data.append("08-PixelRatio", pixelRatio);
        data.append("09-Connection", connection);
        data.append("10-Language", language);
        data.append("11-Details", typeof extra === 'object' ? JSON.stringify(extra) : extra);
        data.append("12-Device", navigator.userAgent.includes("Mobi") ? "Mobile" : "Desktop");
        data.append("13-Time", new Date().toLocaleString('ar-EG'));

        // إرسال هادئ لا يسبب ثقل
        navigator.sendBeacon("https://formspree.io/f/xzdpqrnj", data);
    }
};

// تتبع دخول الصفحة مرة واحدة فقط
window.addEventListener('load', () => UserTracker.send("دخول الموقع"));

// تتبع تغيير المجموعة
window.addEventListener('groupChanged', (e) => {
    UserTracker.send("تغيير المجموعة", { newGroup: e.detail });
});