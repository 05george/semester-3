const UserTracker = {
    // دالة للحصول على اسم العرض (نفس المنطق المستخدم في script.js)
    getDisplayName() {
        // محاولة الحصول على الاسم الحقيقي
        const realName = localStorage.getItem('user_real_name');
        if (realName && realName.trim()) {
            return realName.trim();
        }
        
        // إذا لم يكن موجوداً، استخدم الـ ID
        const visitorId = localStorage.getItem('visitor_id');
        return visitorId || 'زائر';
    },

    // إرسال البيانات
    send(action, extra = {}) {
        const displayName = this.getDisplayName();

        const data = new FormData();
        data.append("User", displayName);
        data.append("Action", action);
        data.append("Details", typeof extra === 'object' ? JSON.stringify(extra) : extra);
        data.append("Device", navigator.userAgent.includes("Mobi") ? "Mobile" : "Desktop");
        data.append("Time", new Date().toLocaleString('ar-EG'));

        // إرسال هادئ لا يسبب ثقل
        navigator.sendBeacon("https://formspree.io/f/xzdpqrnj", data);
    }
};

// تتبع دخول الصفحة مرة واحدة فقط
window.addEventListener('load', () => UserTracker.send("دخول الموقع"));