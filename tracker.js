// ملف يجمع بيانات الجهاز التقنية بشكل تلقائي
(function() {
    // 1. استخراج معلومات نظام التشغيل والمتصفح
    const ua = navigator.userAgent;
    let deviceModel = "Unknown Device";

    // محاولة تحديد نوع الجهاز من خلال الـ User Agent
    if (/android/i.test(ua)) deviceModel = "Android Device";
    else if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) deviceModel = "Apple iOS Device";
    else if (/Windows NT/i.test(ua)) deviceModel = "Windows PC";
    else if (/Macintosh/i.test(ua)) deviceModel = "Mac PC";

    const data = {
        deviceType: deviceModel, // نوع الجهاز
        platform: navigator.platform, // المنصة
        browser: navigator.appName, // المتصفح
        screenWidth: window.screen.width, // عرض الشاشة
        screenHeight: window.screen.height, // طول الشاشة
        language: navigator.language, // لغة الجهاز
        time: new Date().toLocaleString('ar-EG'), // وقت الدخول بتوقيت مصر
        referrer: document.referrer || "Direct Link" // المصدر (من أين أتى)
    };

    // 2. إرسال البيانات إليك (باستخدام Webhook مجاني)
    // اذهب إلى موقع webhook.site وانسخ الرابط الخاص بك وضعه مكان الرابط بالأسفل
    const myEndpoint = "https://formspree.io/f/xzdpqrnj"; 

    fetch(myEndpoint, {
        method: "POST",
        mode: "no-cors", 
        body: JSON.stringify(data)
    });

    console.log("تم تسجيل بيانات الزيارة بنجاح.");
})();
