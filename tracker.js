/* --- نظام التتبع المطور - Gemini Enhanced Tracking --- */
const TrackingSystem = (function() {
    let cachedTechData = null;

    // 1. دالة جلب البيانات التقنية العميقة
    async function getTechnicalInfo() {
        if (cachedTechData) return cachedTechData;

        let ipInfo = { ip: "Checking...", city: "Unknown", org: "Unknown" };
        try {
            // جلب الـ IP والموقع الجغرافي (خدمة سريعة ومجانية)
            const res = await fetch('https://ipapi.co/json/');
            if (res.ok) ipInfo = await res.json();
        } catch (e) { console.log("IP Tracking skipped or blocked"); }

        cachedTechData = {
            ip: ipInfo.ip,
            city: ipInfo.city,
            isp: ipInfo.org,
            browser: navigator.userAgentData?.brands?.map(b => b.brand).join(', ') || navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            cores: navigator.hardwareConcurrency || "N/A",
            memory: navigator.deviceMemory || "N/A",
            screen: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            pixelRatio: window.devicePixelRatio,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        return cachedTechData;
    }

    // 2. دالة الإرسال الرئيسية
    async function sendTrackingData(extraInfo = {}) {
        const isInitial = extraInfo.action === "Page Load";
        const tech = isInitial ? await getTechnicalInfo() : { ip: "cached", screen: "cached" };

        const data = {
            time: new Date().toLocaleString('ar-EG'),
            group: localStorage.getItem('selectedGroup') || "None",
            action: extraInfo.action || "Interaction",
            target: extraInfo.target || "Unknown",
            ...tech,
            ...extraInfo
        };

        const formData = new FormData();
        for (const key in data) {
            formData.append(key, typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]);
        }

        fetch("https://formspree.io/f/xzdpqrnj", {
            method: "POST",
            body: formData,
            headers: { 'Accept': 'application/json' }
        })
        .then(() => console.log(`🚀 Sent: ${data.action} -> ${data.target}`))
        .catch(() => {});
    }

    return { send: sendTrackingData };
})();

// --- تفعيل المستمعات بناءً على النظام الجديد ---

// 1. تتبع أول ما الصفحة تفتح (مع كامل البيانات التقنية والـ IP)
TrackingSystem.send({ action: "Page Load", target: "Main Entry" });

// 2. مستمع لاختيار المجموعة
window.addEventListener('groupChanged', (e) => {
    TrackingSystem.send({ action: "Select Group", target: e.detail });
});

// 3. مستمع لفتح الملفات
window.addEventListener('fileOpened', (e) => {
    TrackingSystem.send({ action: "Open File", target: e.detail });
});