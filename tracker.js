const SmartTracker = {
    data: {
        startTime: new Date().toISOString(),
        group: 'None',
        openedFiles: [],
        searchCount: 0
    },

    // تحديث المجموعة المختارة
    setGroup(groupName) {
        this.data.group = groupName;
    },

    // تسجيل فتح ملف (بدون تكرار)
    logFile(fileName) {
        if (!this.data.openedFiles.includes(fileName)) {
            this.data.openedFiles.push(fileName);
        }
    },

    // إرسال البيانات النهائية عند الخروج
    sendFinalReport() {
        const report = new FormData();
        report.append("Duration_Sec", Math.round((new Date() - new Date(this.data.startTime)) / 1000));
        report.append("Selected_Group", this.data.group);
        report.append("Files_Count", this.data.openedFiles.length);
        report.append("Files_List", this.data.openedFiles.slice(0, 10).join(', ')); // أهم 10 ملفات فقط

        // استخدام sendBeacon لأنه لا يعطل المتصفح ويضمن وصول البيانات عند الإغلاق
        navigator.sendBeacon("https://formspree.io/f/xzdpqrnj", report);
    }
};

// تشغيل الإرسال عند إغلاق الصفحة فقط
window.addEventListener('beforeunload', () => SmartTracker.sendFinalReport());