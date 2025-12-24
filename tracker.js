(function() {
    // 1. جمع البيانات
    const ua = navigator.userAgent;
    let deviceModel = "Unknown Device";

    if (/android/i.test(ua)) deviceModel = "Android Device";
    else if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) deviceModel = "Apple iOS Device";
    else if (/Windows NT/i.test(ua)) deviceModel = "Windows PC";
    else if (/Macintosh/i.test(ua)) deviceModel = "Mac PC";

    const data = {
        deviceType: deviceModel,
        platform: navigator.platform,
        browser: navigator.appName,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language,
        time: new Date().toLocaleString('ar-EG'),
        referrer: document.referrer || "Direct Link",
        pageUrl: window.location.href
    };

    // 2. تحويل البيانات لـ FormData لضمان قبولها بدون أخطاء CORS أو 405
    const formData = new FormData();
    for (const key in data) {
        formData.append(key, data[key]);
    }

    // 3. الإرسال
    const myEndpoint = "https://formspree.io/f/xzdpqrnj"; 

    fetch(myEndpoint, {
        method: "POST",
        body: formData, // استخدام FormData بدلاً من JSON.stringify
        headers: {
            'Accept': 'application/json'
            // ملاحظة: لا تضع Content-Type يدوياً عند استخدام FormData
        }
    })
    .then(response => {
        if (response.ok) {
            console.log("✅ Device info tracked successfully.");
        }
    })
    .catch(() => {
        // فشل التتبع لا يجب أن يزعج المستخدم أو يظهر كخطأ ضخم
    });
})();