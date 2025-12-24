(function() {
    // دالة الإرسال الموحدة
    function sendTrackingData(extraInfo = {}) {
        const ua = navigator.userAgent;
        let deviceModel = "Unknown Device";
        if (/android/i.test(ua)) deviceModel = "Android Device";
        else if (/iPad|iPhone|iPod/.test(ua)) deviceModel = "iOS Device";
        else if (/Windows/i.test(ua)) deviceModel = "Windows PC";

        // تجهيز البيانات الأساسية
        const data = {
            device: deviceModel,
            group: localStorage.getItem('selectedGroup') || "None",
            screen: `${window.screen.width}x${window.screen.height}`,
            time: new Date().toLocaleString('ar-EG'),
            // المعلومات الإضافية (Action & Target)
            action: extraInfo.action || "Initial Visit",
            target: extraInfo.target || "Home Page",
            ...extraInfo
        };

        // تحويل لـ FormData لضمان عملها مع Formspree بدون أخطاء
        const formData = new FormData();
        for (const key in data) {
            formData.append(key, data[key]);
        }

        fetch("https://formspree.io/f/xzdpqrnj", {
            method: "POST",
            body: formData,
            headers: { 'Accept': 'application/json' }
        })
        .then(() => console.log(`✅ Tracked: ${data.action} -> ${data.target}`))
        .catch(() => {}); // صمت تام في حالة الخطأ
    }

    // 1. تتبع أول ما الصفحة تفتح
    sendTrackingData({ action: "Page Load" });

    // 2. مستمع لاختيار المجموعة (بيشتغل لما script.js يبعت الحدث)
    window.addEventListener('groupChanged', (e) => {
        sendTrackingData({ action: "Select Group", target: e.detail });
    });

    // 3. مستمع لفتح الملفات (بيشتغل لما دالة smartOpen تبعت الحدث)
    window.addEventListener('fileOpened', (e) => {
        sendTrackingData({ action: "Open File", target: e.detail });
    });
})();