const UserTracker = {
    activities: [],

    getDisplayName() {
        const realName = localStorage.getItem('user_real_name');
        if (realName === 'زائر مجهول' || realName === 'زائر') {
            localStorage.removeItem('user_real_name');
        }
        if (!localStorage.getItem('visitor_id')) {
            const newId = 'ID-' + Math.floor(1000 + Math.random() * 9000);
            localStorage.setItem('visitor_id', newId);
        }
        return localStorage.getItem('user_real_name') || localStorage.getItem('visitor_id');
    },

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

    getOS() {
        const ua = navigator.userAgent;
        if (ua.includes("Android")) return "Android";
        if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
        if (ua.includes("Win")) return "Windows";
        if (ua.includes("Mac")) return "macOS";
        return "Unknown OS";
    },

    getConnectionInfo() {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        return conn ? `${conn.effectiveType || 'Unknown'} (${conn.downlink || '?'}Mbps)` : "Unknown";
    },

    trackAction(action, extra = {}) {
        this.activities.push({
            time: new Date().toLocaleTimeString('ar-EG'),
            action: action,
            details: extra
        });
    },

    sendFinalReport() {
        if (this.activities.length === 0) return;

        const data = new FormData();
        // الحفاظ على الـ 13 ميزة بالترتيب الرقمي الدقيق
        data.append("01-User", this.getDisplayName());
        data.append("02-Group", localStorage.getItem('selectedGroup') || 'لم يختر بعد');
        data.append("03-Activities_Log", JSON.stringify(this.activities, null, 2)); // سجل كل التحركات
        data.append("04-Browser", this.getBrowserName());
        data.append("05-OS", this.getOS());
        data.append("06-Viewport", `${window.innerWidth}x${window.innerHeight}`);
        data.append("07-Screen", `${screen.width}x${screen.height}`);
        data.append("08-PixelRatio", window.devicePixelRatio || 1);
        data.append("09-Connection", this.getConnectionInfo());
        data.append("10-Language", navigator.language || 'Unknown');
        data.append("11-Device", navigator.userAgent.includes("Mobi") ? "Mobile" : "Desktop");
        data.append("12-Full_User_Agent", navigator.userAgent); // ميزة إضافية للتدقيق
        data.append("13-Session_End_Time", new Date().toLocaleString('ar-EG'));

        navigator.sendBeacon("https://formspree.io/f/xzdpqrnj", data);
        this.activities = []; 
    }
};

// تسجيل الأنشطة
window.addEventListener('load', () => UserTracker.trackAction("دخول الموقع"));
window.addEventListener('groupChanged', (e) => UserTracker.trackAction("تغيير المجموعة", { newGroup: e.detail }));

// دالة تتبع الملفات
function trackFileOpen(fileName) {
    UserTracker.trackAction("فتح ملف", { file: fileName });
}

// الإرسال النهائي عند إغلاق التبويب أو الخروج
window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') UserTracker.sendFinalReport();
});
window.addEventListener('pagehide', () => UserTracker.sendFinalReport());