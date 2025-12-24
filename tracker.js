const UserTracker = {
    // مصفوفة لتخزين الأنشطة (تغيير مجموعة، فتح ملفات، إلخ) وإرسالها مرة واحدة
    activities: [],

    getDisplayName() {
        // 🔥 نفس منطقك الأصلي تماماً لحماية الـ ID والاسم
        const realName = localStorage.getItem('user_real_name');
        if (realName === 'زائر مجهول' || realName === 'زائر') {
            localStorage.removeItem('user_real_name');
        }

        if (!localStorage.getItem('visitor_id')) {
            const newId = 'ID-' + Math.floor(1000 + Math.random() * 9000);
            localStorage.setItem('visitor_id', newId);
        }

        const cleanRealName = localStorage.getItem('user_real_name');
        if (cleanRealName && cleanRealName.trim()) {
            return cleanRealName.trim();
        }

        return localStorage.getItem('visitor_id');
    },

    // وظائف جلب البيانات (بقيت كما هي في كودك)
    getBrowserName() {
        const ua = navigator.userAgent;
        if (ua.includes("Samsung")) return "Samsung Internet";
        if (ua.includes("Edg")) return "Edge";
        if (ua.includes("Chrome")) return "Chrome";
        if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
        if (ua.includes("Firefox")) return "Firefox";
        return "Unknown Browser";
    },

    getOS() {
        const ua = navigator.userAgent;
        if (ua.includes("Android")) return "Android";
        if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
        if (ua.includes("Win")) return "Windows";
        return "Unknown OS";
    },

    // تسجيل النشاط داخلياً (يجمع الحركات ولا يرسلها فوراً)
    trackAction(actionName, extra = {}) {
        const timestamp = new Date().toLocaleTimeString('ar-EG');
        this.activities.push({
            action: actionName,
            time: timestamp,
            details: extra
        });
    },

    // الإرسال النهائي لـ Formspree (يُستدعى مرة واحدة فقط عند الخروج)
    sendFinalReport() {
        if (this.activities.length === 0) return;

        const data = new FormData();
        data.append("01-User", this.getDisplayName());
        data.append("02-Group", localStorage.getItem('selectedGroup') || 'لم يختر بعد');
        data.append("03-Browser", this.getBrowserName());
        data.append("04-OS", this.getOS());
        
        // هنا نضع كل الأنشطة (دخول، تغيير مجموعة، ملفات) في حقل واحد مرتب
        data.append("05-Activities_Log", JSON.stringify(this.activities, null, 2));
        
        data.append("06-Device", navigator.userAgent.includes("Mobi") ? "Mobile" : "Desktop");
        data.append("07-Screen", `${screen.width}x${screen.height}`);
        data.append("08-Final_Time", new Date().toLocaleString('ar-EG'));

        // إرسال البيانات بشكل يضمن وصولها حتى لو أغلق المتصفح فجأة
        navigator.sendBeacon("https://formspree.io/f/xzdpqrnj", data);
        
        // تفريغ المصفوفة لضمان عدم التكرار
        this.activities = [];
    }
};

// الأحداث (Events)
window.addEventListener('load', () => {
    UserTracker.trackAction("دخول الموقع");
});

window.addEventListener('groupChanged', (e) => {
    UserTracker.trackAction("تغيير المجموعة", { newGroup: e.detail });
});

// تتبع فتح الملفات (أضف هذا السطر في أي مكان تفتح فيه ملف)
function trackFileOpen(fileName) {
    UserTracker.trackAction("فتح ملف", { file: fileName });
}

// 🔥 السحر هنا: الإرسال عند الخروج أو إغلاق الصفحة
window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        UserTracker.sendFinalReport();
    }
});
window.addEventListener('pagehide', () => UserTracker.sendFinalReport());
