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

    // دالة للحصول على المجموعة الحالية
    getCurrentGroup() {
        return localStorage.getItem('selectedGroup') || 'لم يختر بعد';
    },

    // دالة لطلب الموقع الجغرافي (اختيارية)
    async getLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve("غير مدعوم");
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude.toFixed(4);
                    const lon = position.coords.longitude.toFixed(4);
                    resolve(`${lat}, ${lon}`);
                },
                () => {
                    resolve("تم الرفض");
                },
                { timeout: 5000 }
            );
        });
    },

    // إرسال البيانات
    async send(action, extra = {}) {
        const displayName = this.getDisplayName();
        const browserName = this.getBrowserName();
        const viewport = this.getViewport();
        const group = this.getCurrentGroup();
        const location = await this.getLocation();

        const data = new FormData();
        data.append("User", displayName);
        data.append("Group", group);
        data.append("Action", action);
        data.append("Browser", browserName);
        data.append("Viewport", viewport);
        data.append("Location", location);
        data.append("Details", typeof extra === 'object' ? JSON.stringify(extra) : extra);
        data.append("Device", navigator.userAgent.includes("Mobi") ? "Mobile" : "Desktop");
        data.append("Time", new Date().toLocaleString('ar-EG'));

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