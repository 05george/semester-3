const CACHE_NAME = 'interactive-map-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './image/wood.webp',
  './image/o.webp',
  // أضف أي صور أساسية أخرى هنا
];

// 1. تثبيت وحفظ الملفات الأساسية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. استراتيجية "Network First": يحاول التحديث، وإذا فشل (أوفلاين) يستخدم المخزن
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // تحديث النسخة المخزنة في كل مرة يتوفر فيها إنترنت
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, resClone);
        });
        return response;
      })
      .catch(() => caches.match(event.request)) // إذا انقطع الإنترنت، ابحث في الكاش
  );
});
