const UserTracker = {
    // إرسال البيانات
    send(action, extra = {}) {
        const savedName = localStorage.getItem('user_real_name') || "زائر مجهول";
        
        const data = new FormData();
        data.append("User", savedName);
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