/* --- 1. الإعدادات والمتغيرات العالمية --- */
const REPO_NAME = "semester-3"; 
const GITHUB_USER = "MUE24Med";

const NEW_API_BASE = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents`;
const TREE_API_URL = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/git/trees/main?recursive=1`;
const RAW_CONTENT_BASE = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/`;

let globalFileTree = []; 
let currentGroup = null;
let currentFolder = ""; 
let interactionEnabled = true;
const isTouchDevice = window.matchMedia('(hover: none)').matches;
const TAP_THRESHOLD_MS = 300;

// ✅ متغيرات تتبع التحميل
let totalBytes = 0;
let loadedBytes = 0;
let imageUrlsToLoad = [];

// 💡 مصفوفة لتخزين الملفات التي فتحها المستخدم خلال الجلسة
let sessionOpenedFiles = [];

let activeState = {
    rect: null, zoomPart: null, zoomText: null, zoomBg: null,
    baseText: null, baseBg: null, animationId: null, clipPathId: null,
    touchStartTime: 0, initialScrollLeft: 0
};

// الحصول على العناصر فورًا
const mainSvg = document.getElementById('main-svg');
const scrollContainer = document.getElementById('scroll-container');
const clipDefs = mainSvg?.querySelector('defs');
const loadingOverlay = document.getElementById('loading-overlay');
const jsToggle = document.getElementById('js-toggle');
const searchInput = document.getElementById('search-input');
const searchIcon = document.getElementById('search-icon');
const moveToggle = document.getElementById('move-toggle');
const toggleContainer = document.getElementById('js-toggle-container');
const backButtonGroup = document.getElementById('back-button-group');
const backBtnText = document.getElementById('back-btn-text');
const changeGroupBtn = document.getElementById('change-group-btn');
const groupSelectionScreen = document.getElementById('group-selection-screen');
const filesListContainer = document.getElementById('files-list-container');

// تحديث حالة التفاعل
if (jsToggle) {
    interactionEnabled = jsToggle.checked;
}

/* --- 2. دوال جلب البيانات --- */
async function fetchGlobalTree() {
    if (globalFileTree.length > 0) return; 
    try {
        const response = await fetch(TREE_API_URL);
        const data = await response.json();
        globalFileTree = data.tree || [];
        console.log("✅ تم تحميل شجرة الملفات:", globalFileTree.length);
    } catch (err) {
        console.error("❌ خطأ في الاتصال بـ GitHub:", err);
    }
}

function saveSelectedGroup(group) {
    localStorage.setItem('selectedGroup', group);
    currentGroup = group;

    // 💡 إرسال حدث مخصص عند تغيير المجموعة
    window.dispatchEvent(new CustomEvent('groupChanged', { detail: group }));
}

function loadSelectedGroup() {
    const saved = localStorage.getItem('selectedGroup');
    if (saved) {
        currentGroup = saved;
        return true;
    }
    return false;
}

/* --- 3. إدارة شاشة التحميل --- */
function showLoadingScreen(groupLetter) {
    if (!loadingOverlay) return;

    const splashImage = document.getElementById('splash-image');
    if (splashImage) {
        splashImage.src = `image/logo-${groupLetter}.webp`;
    }

    // إعادة تعيين المصابيح
    document.querySelectorAll('.light-bulb').forEach(bulb => bulb.classList.remove('on'));

    // إعادة تعيين متغيرات التتبع
    totalBytes = 0;
    loadedBytes = 0;
    imageUrlsToLoad = [];

    loadingOverlay.classList.add('active');
    console.log(`🔦 شاشة التحميل نشطة للمجموعة ${groupLetter}`);

    // تحديث رسالة الترحيب في شاشة التحميل
    updateWelcomeMessages();
}

function hideLoadingScreen() {
    if (!loadingOverlay) return;
    loadingOverlay.classList.remove('active');
    console.log('✅ تم إخفاء شاشة التحميل');
}

function updateLoadProgress() {
    if (totalBytes === 0) return;

    const progress = (loadedBytes / totalBytes) * 100;
    console.log(`📊 التقدم: ${Math.round(progress)}%`);

    if (progress >= 20) document.getElementById('bulb-4')?.classList.add('on');
    if (progress >= 40) document.getElementById('bulb-3')?.classList.add('on');
    if (progress >= 60) document.getElementById('bulb-2')?.classList.add('on');
    if (progress >= 80) document.getElementById('bulb-1')?.classList.add('on');
}

function estimateFileSize(url) {
    const ext = url.split('.').pop().toLowerCase();
    const sizesMap = {
        'webp': 150000, 'jpg': 200000, 'jpeg': 200000,
        'png': 300000, 'svg': 50000, 'pdf': 500000
    };
    return sizesMap[ext] || 100000;
}

function calculateTotalSize() {
    totalBytes = 0;
    imageUrlsToLoad.forEach(url => {
        totalBytes += estimateFileSize(url);
    });
    totalBytes += 100000; // SVG
    console.log(`📦 الحجم المتوقع: ${(totalBytes/1024).toFixed(1)}KB`);
}

/* --- 4. تحميل SVG الخاص بالمجموعة --- */
async function loadGroupSVG(groupLetter) {
    const groupContainer = document.getElementById('group-specific-content');
    groupContainer.innerHTML = '';

    try {
        console.log(`🔄 تحميل: groups/group-${groupLetter}.svg`);
        const response = await fetch(`groups/group-${groupLetter}.svg`);

        if (!response.ok) {
            console.warn(`⚠️ ملف SVG للمجموعة ${groupLetter} غير موجود`);
            return;
        }

        const svgText = await response.text();
        const svgSize = new Blob([svgText]).size;
        loadedBytes += svgSize;
        updateLoadProgress();

        console.log(`✅ SVG محمّل (${(svgSize/1024).toFixed(1)}KB)`);

        const match = svgText.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);

        if (match && match[1]) {
            groupContainer.innerHTML = match[1];
            console.log(`✅ تم حقن ${groupContainer.children.length} عنصر`);

            const injectedImages = groupContainer.querySelectorAll('image[data-src]');
            console.log(`🖼️ عدد الصور: ${injectedImages.length}`);

            imageUrlsToLoad = [];
            injectedImages.forEach(img => {
                const src = img.getAttribute('data-src');
                if (src && !imageUrlsToLoad.includes(src)) {
                    imageUrlsToLoad.push(src);
                }
            });

            calculateTotalSize();
        } else {
            console.error('❌ فشل استخراج محتوى SVG');
        }

    } catch (err) {
        console.error(`❌ خطأ في loadGroupSVG:`, err);
    }
}

function updateWoodLogo(groupLetter) {
    const dynamicGroup = document.getElementById('dynamic-links-group');

    // حذف اللوجو القديم
    const oldBanner = dynamicGroup.querySelector('.wood-banner-animation');
    if (oldBanner) oldBanner.remove();

    if (currentFolder !== "") return;

    const banner = document.createElementNS("http://www.w3.org/2000/svg", "image");
    banner.setAttribute("href", `image/logo-wood-${groupLetter}.webp`); 
    banner.setAttribute("x", "186.86");
    banner.setAttribute("y", "1517.43"); 
    banner.setAttribute("width", "648.41");
    banner.setAttribute("height", "276.04"); 

    // إعدادات التصميم والأنيميشن
    banner.setAttribute("class", "wood-banner-animation");
    banner.style.mixBlendMode = "multiply";
    banner.style.opacity = "0.9";
    banner.style.pointerEvents = "auto"; 

    // إضافة وظيفة النقر
    banner.onclick = (e) => {
        e.stopPropagation();
        if (groupSelectionScreen) groupSelectionScreen.classList.remove('hidden');
        window.goToWood();
    };

    dynamicGroup.appendChild(banner);
}

/* --- 5. تهيئة المجموعة --- */
async function initializeGroup(groupLetter, isInitialLoad = false) {
    console.log(`🚀 تهيئة المجموعة: ${groupLetter}`);

    saveSelectedGroup(groupLetter);

    if (toggleContainer) toggleContainer.style.display = 'flex';
    if (scrollContainer) scrollContainer.style.display = 'block';
    if (groupSelectionScreen) groupSelectionScreen.classList.add('hidden');

    showLoadingScreen(groupLetter);

    await fetchGlobalTree();
    await loadGroupSVG(groupLetter);

    window.updateDynamicSizes();

    if (isInitialLoad) {
        window.loadImages();
    } else {
        hideLoadingScreen();
        if (mainSvg) mainSvg.style.opacity = '1';
        window.scan();
        window.updateWoodInterface();
        window.goToWood();
    }
}

/* --- 6. عارض PDF --- */
document.getElementById("closePdfBtn").onclick = () => {
    const overlay = document.getElementById("pdf-overlay");
    const pdfViewer = document.getElementById("pdfFrame");
    pdfViewer.src = "";
    overlay.classList.add("hidden");
};

document.getElementById("downloadBtn").onclick = () => {
    const iframe = document.getElementById("pdfFrame");
    let src = iframe.src;
    if (!src) return;

    const match = src.match(/file=(.+)$/);
    if (match && match[1]) {
        const fileUrl = decodeURIComponent(match[1]);
        const a = document.createElement("a");
        a.href = fileUrl;
        a.download = fileUrl.split("/").pop();
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
};

document.getElementById("shareBtn").onclick = () => {
    const iframe = document.getElementById("pdfFrame");
    let src = iframe.src;
    if (!src) return;

    const match = src.match(/file=(.+)$/);
    if (match && match[1]) {
        const fileUrl = decodeURIComponent(match[1]);
        navigator.clipboard.writeText(fileUrl)
            .then(() => alert("✅ تم نسخ الرابط"))
            .catch(() => alert("❌ فشل النسخ"));
    }
};

/* --- 7. Service Worker --- */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('✅ Service Worker مسجل'))
            .catch(err => console.log('❌ فشل Service Worker', err));
    });
}

function smartOpen(item) {
    if (!item || !item.path) return;

    // حفظ في السجل المحلي
    let history = JSON.parse(localStorage.getItem('openedFilesHistory') || "[]");
    history.push(item.path);
    localStorage.setItem('openedFilesHistory', JSON.stringify(history));

    // إرسال حدث للمتابعة
    window.dispatchEvent(new CustomEvent('fileOpened', { detail: item.path }));

    const url = `${RAW_CONTENT_BASE}${item.path}`;
    if (url.endsWith('.pdf')) {
        const overlay = document.getElementById("pdf-overlay");
        const pdfViewer = document.getElementById("pdfFrame");
        overlay.classList.remove("hidden");
        pdfViewer.src = "https://mozilla.github.io/pdf.js/web/viewer.html?file=" + 
                        encodeURIComponent(url) + "#zoom=page-width"; 
    } else {
        window.open(url, '_blank');
    }
}

/* --- 8. التنقل --- */
window.goToWood = () => {
    if (scrollContainer) {
        scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
    }
};

window.goToMapEnd = () => {
    if (!scrollContainer) return;
    const maxScrollRight = scrollContainer.scrollWidth - scrollContainer.clientWidth;
    scrollContainer.scrollTo({ left: maxScrollRight, behavior: 'smooth' });
};

function debounce(func, delay) {
    let timeoutId;
    return function() {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, arguments), delay);
    };
}

/* --- 9. تحديث الأحجام --- */
function updateDynamicSizes() {
    if (!mainSvg) return;

    const allImages = mainSvg.querySelectorAll('image[width="1024"][height="2454"]');
    console.log(`📏 عدد الصور: ${allImages.length}`);

    if (allImages.length === 0) {
        console.warn('⚠️ لم يتم العثور على صور');
        return;
    }

    const imgW = 1024;
    const imgH = 2454;
    const totalWidth = allImages.length * imgW;

    mainSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${imgH}`);
    console.log(`✅ viewBox: 0 0 ${totalWidth} ${imgH}`);
}
window.updateDynamicSizes = updateDynamicSizes;

/* --- 10. تأثيرات الهوفر --- */
function getCumulativeTranslate(element) {
    let x = 0, y = 0, current = element;
    while (current && current.tagName !== 'svg') {
        const trans = current.getAttribute('transform');
        if (trans) {
            const m = trans.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/);
            if (m) { x += parseFloat(m[1]); y += parseFloat(m[2]); }
        }
        current = current.parentNode;
    }
    return { x, y };
}

function getGroupImage(element) {
    let current = element;
    while (current && current.tagName !== 'svg') {
        if (current.tagName === 'g') {
            const imgs = [...current.children].filter(c => c.tagName === 'image');
            if (imgs.length) return {
                src: imgs[0].getAttribute('data-src') || imgs[0].getAttribute('href'),
                width: parseFloat(imgs[0].getAttribute('width')),
                height: parseFloat(imgs[0].getAttribute('height')),
                group: current
            };
        }
        current = current.parentNode;
    }
    return null;
}

function cleanupHover() {
    if (!activeState.rect) return;
    if (activeState.animationId) clearInterval(activeState.animationId);
    activeState.rect.style.filter = 'none';
    activeState.rect.style.transform = 'scale(1)';
    activeState.rect.style.strokeWidth = '2px';
    if (activeState.zoomPart) activeState.zoomPart.remove();
    if (activeState.zoomText) activeState.zoomText.remove();
    if (activeState.zoomBg) activeState.zoomBg.remove();
    if (activeState.baseText) activeState.baseText.style.opacity = '1';
    if (activeState.baseBg) activeState.baseBg.style.opacity = '1';
    const clip = document.getElementById(activeState.clipPathId);
    if (clip) clip.remove();
    Object.assign(activeState, {
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,
        baseText: null, baseBg: null, animationId: null, clipPathId: null
    });
}

function startHover() {  
    if (!interactionEnabled || this.classList.contains('list-item')) return;
    if (!mainSvg || !clipDefs) return;

    const rect = this;  
    if (activeState.rect === rect) return;  
    cleanupHover();  
    activeState.rect = rect;  

    const rW = parseFloat(rect.getAttribute('width')) || rect.getBBox().width;  
    const rH = parseFloat(rect.getAttribute('height')) || rect.getBBox().height;  
    const cum = getCumulativeTranslate(rect);  
    const absX = parseFloat(rect.getAttribute('x')) + cum.x;  
    const absY = parseFloat(rect.getAttribute('y')) + cum.y;  
    const centerX = absX + rW / 2;  

    const scaleFactor = 1.1;
    const yOffset = (rH * (scaleFactor - 1)) / 2;
    const hoveredY = absY - yOffset;

    rect.style.transformOrigin = `${parseFloat(rect.getAttribute('x')) + rW/2}px ${parseFloat(rect.getAttribute('y')) + rH/2}px`;  
    rect.style.transform = `scale(${scaleFactor})`;  
    rect.style.strokeWidth = '4px';  

    const imgData = getGroupImage(rect);  
    if (imgData) {  
        const clipId = `clip-${Date.now()}`;  
        activeState.clipPathId = clipId;  
        const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');  
        clip.setAttribute('id', clipId);  
        const cRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');  
        cRect.setAttribute('x', absX); cRect.setAttribute('y', absY);  
        cRect.setAttribute('width', rW); cRect.setAttribute('height', rH);  
        clipDefs.appendChild(clip).appendChild(cRect);  

        const zPart = document.createElementNS('http://www.w3.org/2000/svg', 'image');  
        zPart.setAttribute('href', imgData.src);  
        zPart.setAttribute('width', imgData.width); zPart.setAttribute('height', imgData.height);  
        zPart.setAttribute('clip-path', `url(#${clipId})`);  
        const mTrans = imgData.group.getAttribute('transform')?.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/);  
        zPart.setAttribute('x', mTrans ? mTrans[1] : 0); zPart.setAttribute('y', mTrans ? mTrans[2] : 0);  
        zPart.style.pointerEvents = 'none';  
        zPart.style.transformOrigin = `${centerX}px ${absY + rH/2}px`;  
        zPart.style.transform = `scale(${scaleFactor})`;  
        mainSvg.appendChild(zPart);  
        activeState.zoomPart = zPart;  
    }  

    let bText = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);  
    if (bText) {  
        bText.style.opacity = '0';  
        let bBg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);  
        if (bBg) bBg.style.opacity = '0';  
        activeState.baseText = bText; activeState.baseBg = bBg;  

        const zText = document.createElementNS('http://www.w3.org/2000/svg', 'text');  
        zText.textContent = rect.getAttribute('data-full-text') || bText.getAttribute('data-original-text') || "";  
        zText.setAttribute('x', centerX); zText.setAttribute('text-anchor', 'middle');  
        zText.style.dominantBaseline = 'central'; zText.style.fill = 'white';  
        zText.style.fontWeight = 'bold'; zText.style.pointerEvents = 'none';  
        zText.style.fontSize = (parseFloat(bText.style.fontSize || 10) * 2) + 'px';  
        mainSvg.appendChild(zText);  

        const bbox = zText.getBBox();  
        const zBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');  
        zBg.setAttribute('x', centerX - (bbox.width + 20) / 2); zBg.setAttribute('y', hoveredY);  
        zBg.setAttribute('width', bbox.width + 20); zBg.setAttribute('height', bbox.height + 10);  
        zBg.setAttribute('rx', '5'); zBg.style.fill = 'black'; zBg.style.pointerEvents = 'none';  

        mainSvg.insertBefore(zBg, zText);  
        zText.setAttribute('y', hoveredY + (bbox.height + 10) / 2);
        activeState.zoomText = zText; activeState.zoomBg = zBg;  
    }  

    let h = 0;  
    let step = 0; 
    activeState.animationId = setInterval(() => {  
        h = (h + 10) % 360;  
        step += 0.2;         
        const glowPower = 10 + Math.sin(step) * 5; 
        const color = `hsl(${h},100%,60%)`;
        rect.style.filter = `drop-shadow(0 0 ${glowPower}px ${color})`;  
        if (activeState.zoomPart) activeState.zoomPart.style.filter = `drop-shadow(0 0 ${glowPower}px ${color})`;
        if (activeState.zoomBg) activeState.zoomBg.style.stroke = color;  
    }, 100);
}

/* --- 11. معالجة النصوص --- */
function wrapText(el, maxW) {
    const txt = el.getAttribute('data-original-text'); 
    if (!txt) return;
    const words = txt.split(/\s+/); 
    el.textContent = '';
    let ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    ts.setAttribute('x', el.getAttribute('x')); 
    ts.setAttribute('dy', '0');
    el.appendChild(ts); 
    let line = '';
    const lh = parseFloat(el.style.fontSize) * 1.1;
    words.forEach(word => {
        let test = line + (line ? ' ' : '') + word;
        ts.textContent = test;
        if (ts.getComputedTextLength() > maxW - 5 && line) {
            ts.textContent = line;
            ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            ts.setAttribute('x', el.getAttribute('x')); 
            ts.setAttribute('dy', lh + 'px');
            ts.textContent = word; 
            el.appendChild(ts); 
            line = word;
        } else { 
            line = test; 
        }
    });
}

/* --- 12. دوال الترحيب والأسماء --- */
function getDisplayName() {
    // محاولة الحصول على الاسم الحقيقي
    const realName = localStorage.getItem('user_real_name');
    if (realName && realName.trim()) {
        return realName.trim();
    }
    
    // إذا لم يكن موجوداً، استخدم الـ ID
    const visitorId = localStorage.getItem('visitor_id');
    return visitorId || 'زائر';
}

function updateWelcomeMessages() {
    const displayName = getDisplayName();

    // 1. تحديث النص الموجود في شاشة اختيار المجموعات (استبدال <h1>)
    const groupScreenH1 = document.querySelector('#group-selection-screen h1');
    if (groupScreenH1) {
        groupScreenH1.innerHTML = `مرحباً بك يا <span style="color: #ffca28;">${displayName}</span> إختر جروبك`;
    }

    // 2. تحديث النص الموجود في شاشة التحميل (استبدال <h1>)
    const loadingH1 = document.querySelector('#loading-content h1');
    if (loadingH1 && currentGroup) {
        loadingH1.innerHTML = `أهلاً بك يا <span style="color: #ffca28;">${displayName}</span> في INTERACTIVE COLLEGE MAP`;
    }
}

function renderNameInput() {
    const dynamicGroup = document.getElementById('dynamic-links-group');
    if (!dynamicGroup) return;

    // إزالة حقل الإدخال القديم إن وجد
    const oldInput = dynamicGroup.querySelector('.name-input-group');
    if (oldInput) oldInput.remove();

    // إنشاء مجموعة SVG للإدخال
    const inputGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    inputGroup.setAttribute("class", "name-input-group");

    // خلفية الحقل
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", "120");
    bg.setAttribute("y", "1232");
    bg.setAttribute("width", "780");
    bg.setAttribute("height", "60");
    bg.setAttribute("rx", "10");
    bg.style.fill = "rgba(0,0,0,0.7)";
    bg.style.stroke = "#ffca28";
    bg.style.strokeWidth = "2";

    // النص التوضيحي
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", "510");
    label.setAttribute("y", "1262");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("fill", "white");
    label.style.fontSize = "18px";
    label.style.fontWeight = "bold";

    // عرض الاسم الحالي أو رسالة الترحيب
    const currentName = localStorage.getItem('user_real_name');
    label.textContent = currentName ? `مرحباً ${currentName} - اضغط للتعديل` : "اضغط هنا لإدخال اسمك";

    inputGroup.appendChild(bg);
    inputGroup.appendChild(label);

    // إضافة وظيفة النقر
    inputGroup.style.cursor = "pointer";
    inputGroup.onclick = () => {
        const currentName = localStorage.getItem('user_real_name');
        const promptMessage = currentName ? `الاسم الحالي: ${currentName}\nأدخل اسم جديد أو اترك فارغاً للإلغاء:` : "ما اسمك؟";
        const name = prompt(promptMessage, currentName || "");

        if (name !== null && name.trim()) {
            localStorage.setItem('user_real_name', name.trim());
            updateWelcomeMessages();
            updateWoodInterface(); // تحديث الواجهة لإظهار الاسم الجديد
            alert("أهلاً بك يا " + name.trim());
        }
    };

    dynamicGroup.appendChild(inputGroup);
}

/* --- 13. تحديث واجهة القوائم --- */
async function updateWoodInterface() {
    renderNameInput(); // إضافة حقل الإدخال
    const dynamicGroup = document.getElementById('dynamic-links-group');
    const groupBtnText = document.getElementById('group-btn-text');

    if (!dynamicGroup || !backBtnText) return;

    // تحديث نص زر تغيير المجموعة
    if (groupBtnText && currentGroup) {
        groupBtnText.textContent = `Change Group 🔄 ${currentGroup}`;
    }

    // تنظيف القائمة القديمة قبل إعادة البناء
    dynamicGroup.querySelectorAll('.wood-folder-group, .wood-file-group').forEach(el => el.remove());

    await fetchGlobalTree();

    const query = searchInput.value.toLowerCase().trim();

    // 1️⃣ تحديث زر الرجوع (Breadcrumb) مع عدد الملفات المفلترة
    if (currentFolder === "") {
        backBtnText.textContent = "➡️ إلى الخريطة ➡️";
    } else {
        const folderName = currentFolder.split('/').pop();
        // حساب الملفات داخل المجلد الحالي التي تطابق البحث
        const countInCurrent = globalFileTree.filter(f => {
            const isInside = f.path.startsWith(currentFolder + '/');
            const isPdf = f.path.toLowerCase().endsWith('.pdf');
            if (query === "") return isInside && isPdf;
            const fileName = f.path.split('/').pop().toLowerCase();
            return isInside && isPdf && fileName.includes(query);
        }).length;

        const pathParts = currentFolder.split('/');
        const breadcrumb = "الرئيسية > " + pathParts.join(' > ');
        const displayLabel = ` (${countInCurrent}) ملف`;

        backBtnText.textContent = breadcrumb.length > 30 ? 
            `🔙 ... > ${folderName} ${displayLabel}` : 
            `🔙 ${breadcrumb} ${displayLabel}`;
    }

    // إظهار اللوجو في الصفحة الرئيسية فقط
    if (currentFolder === "" && currentGroup) {
        updateWoodLogo(currentGroup);
    }

    const folderPrefix = currentFolder ? currentFolder + '/' : '';
    const itemsMap = new Map();

    // تنظيم الملفات والمجلدات في خريطة (Map)
    globalFileTree.forEach(item => {
        if (item.path.startsWith(folderPrefix)) {
            const relativePath = item.path.substring(folderPrefix.length);
            const pathParts = relativePath.split('/');
            const name = pathParts[0];

            if (!itemsMap.has(name)) {
                const isDir = pathParts.length > 1 || item.type === 'tree';
                const isPdf = item.path.toLowerCase().endsWith('.pdf');

                if (isDir && name !== 'image' && name !== 'groups') {
                    itemsMap.set(name, { name: name, type: 'dir', path: folderPrefix + name });
                } else if (isPdf && pathParts.length === 1) {
                    itemsMap.set(name, { name: name, type: 'file', path: item.path });
                }
            }
        }
    });

    // 2️⃣ بناء عناصر الـ SVG للقائمة
    const filteredData = Array.from(itemsMap.values());
    for (let [index, item] of filteredData.entries()) {
        const x = (index % 2 === 0) ? 120 : 550;
        const y = 250 + (Math.floor(index / 2) * 90);

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", item.type === 'dir' ? "wood-folder-group" : "wood-file-group");
        g.style.cursor = "pointer";

        const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        r.setAttribute("x", x); r.setAttribute("y", y); 
        r.setAttribute("width", "350"); r.setAttribute("height", "70"); 
        r.setAttribute("rx", "12");
        r.setAttribute("class", "list-item");
        r.style.fill = item.type === 'dir' ? "#5d4037" : "rgba(0,0,0,0.8)";
        r.style.stroke = "#fff";

        const cleanName = item.name.replace(/\.[^/.]+$/, "");
        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", x + 175); t.setAttribute("y", y + 42);
        t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "white");
        t.style.fontWeight = "bold"; t.style.fontSize = "17px";

        // 3️⃣ منطق الفلترة والأرقام الذكية للمجلدات والملفات
        if (item.type === 'dir') {
            const filteredCount = globalFileTree.filter(f => {
                const isInsideFolder = f.path.startsWith(item.path + '/');
                const isPdf = f.path.toLowerCase().endsWith('.pdf');
                if (query === "") return isInsideFolder && isPdf;
                const fileName = f.path.split('/').pop().toLowerCase();
                return isInsideFolder && isPdf && fileName.includes(query);
            }).length;

            t.textContent = `📁 (${filteredCount}) ` + (cleanName.length > 15 ? cleanName.substring(0, 13) + ".." : cleanName);

            // إخفاء المجلد إذا لم يحتوي على نتائج تطابق البحث
            if (query !== "" && filteredCount === 0) g.style.display = 'none';
        } else {
            t.textContent = "📄 " + (cleanName.length > 25 ? cleanName.substring(0, 22) + "..." : cleanName);
            // إخفاء الملف إذا لم يطابق البحث
            if (query !== "" && !cleanName.toLowerCase().includes(query)) g.style.display = 'none';
        }

        g.appendChild(r); 
        g.appendChild(t);

        g.onclick = (e) => {
            e.stopPropagation();
            if (item.type === 'dir') { 
                currentFolder = item.path; 
                updateWoodInterface(); 
            } else { 
                smartOpen(item); 
            }
        };
        dynamicGroup.appendChild(g);
    }
}
window.updateWoodInterface = updateWoodInterface;

/* --- 14. معالجة المستطيلات --- */
function processRect(r) {
    if (r.hasAttribute('data-processed')) return;
    if (r.classList.contains('w')) r.setAttribute('width', '113.5');
    if (r.classList.contains('hw')) r.setAttribute('width', '56.75');

    const href = r.getAttribute('data-href') || '';
    const name = r.getAttribute('data-full-text') || (href !== '#' ? href.split('/').pop().split('#')[0].split('.').slice(0, -1).join('.') : '');
    const w = parseFloat(r.getAttribute('width')) || r.getBBox().width;
    const x = parseFloat(r.getAttribute('x')); 
    const y = parseFloat(r.getAttribute('y'));

    if (name && name.trim() !== '') {
        const fs = Math.max(8, Math.min(12, w * 0.11));
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', x + w / 2); 
        txt.setAttribute('y', y + 2);
        txt.setAttribute('text-anchor', 'middle'); 
        txt.setAttribute('class', 'rect-label');
        txt.setAttribute('data-original-text', name); 
        txt.setAttribute('data-original-for', href);
        txt.style.fontSize = fs + 'px'; 
        txt.style.fill = 'white'; 
        txt.style.pointerEvents = 'none'; 
        txt.style.dominantBaseline = 'hanging';
        r.parentNode.appendChild(txt); 
        wrapText(txt, w);

        const bbox = txt.getBBox();
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', x); 
        bg.setAttribute('y', y); 
        bg.setAttribute('width', w); 
        bg.setAttribute('height', bbox.height + 8);
        bg.setAttribute('class', 'label-bg'); 
        bg.setAttribute('data-original-for', href);
        bg.style.fill = 'black'; 
        bg.style.pointerEvents = 'none';
        r.parentNode.insertBefore(bg, txt);
    }

    if (!isTouchDevice) { 
        r.addEventListener('mouseover', startHover); 
        r.addEventListener('mouseout', cleanupHover); 
    }

    r.onclick = () => { 
        if (href && href !== '#') window.open(href, '_blank'); 
    };

    if (scrollContainer) {
        r.addEventListener('touchstart', function(e) { 
            if (!interactionEnabled) return; 
            activeState.touchStartTime = Date.now(); 
            activeState.initialScrollLeft = scrollContainer.scrollLeft; 
            startHover.call(this); 
        });
        r.addEventListener('touchend', function(e) { 
            if (!interactionEnabled) return;
            if (Math.abs(scrollContainer.scrollLeft - activeState.initialScrollLeft) < 10 && 
                (Date.now() - activeState.touchStartTime) < TAP_THRESHOLD_MS) {
                if (href && href !== '#') window.open(href, '_blank');
            }
            cleanupHover();
        });
    }

    r.setAttribute('data-processed', 'true');
}

/* --- 15. فحص ومعالجة جميع المستطيلات --- */
function scan() { 
    if (!mainSvg) return;

    console.log('🔍 تشغيل scan()...');
    const rects = mainSvg.querySelectorAll('rect.image-mapper-shape, rect.m');
    console.log(`✅ تم اكتشاف ${rects.length} مستطيل`);
    rects.forEach(r => {
        processRect(r);
        
        // ✅ إخفاء العناصر ذات href="#" من البداية
        const href = r.getAttribute('data-href') || '';
        if (href === '#') {
            r.style.display = 'none';
            const label = r.parentNode.querySelector(`.rect-label[data-original-for='${r.dataset.href}']`);
            const bg = r.parentNode.querySelector(`.label-bg[data-original-for='${r.dataset.href}']`);
            if (label) label.style.display = 'none';
            if (bg) bg.style.display = 'none';
        }
    });
}
window.scan = scan;

/* --- 16. تحميل الصور مع تتبع التقدم --- */
function loadImages() {
    if (!mainSvg) return;

    // ✅ إضافة صورة الخلفية الخشبية
    const woodBackground = filesListContainer?.querySelector('image[data-src="image/wood.webp"]');
    if (woodBackground && !imageUrlsToLoad.includes('image/wood.webp')) {
        imageUrlsToLoad.unshift('image/wood.webp');
    }

    console.log(`🖼️ بدء تحميل ${imageUrlsToLoad.length} صورة...`);

    if (imageUrlsToLoad.length === 0) {
        console.warn('⚠️ لا توجد صور للتحميل!');
        finishLoading();
        return;
    }

    // ✅ إعادة حساب الحجم الإجمالي
    calculateTotalSize();

    let imagesCompleted = 0;

    imageUrlsToLoad.forEach((url) => {
        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                const contentLength = response.headers.get('content-length');
                const actualSize = contentLength ? parseInt(contentLength, 10) : estimateFileSize(url);

                console.log(`📦 ${url.split('/').pop()}: ${(actualSize/1024).toFixed(1)}KB`);

                return response.blob().then(blob => ({ blob, actualSize }));
            })
            .then(({ blob, actualSize }) => {
                loadedBytes += actualSize;
                updateLoadProgress();

                const objectUrl = URL.createObjectURL(blob);

                // ✅ تحديث جميع الصور التي لها نفس data-src
                mainSvg.querySelectorAll('image').forEach(si => {
                    const dataSrc = si.getAttribute('data-src');
                    if (dataSrc === url) {
                        si.setAttribute('href', objectUrl);
                    }
                });

                imagesCompleted++;

                if (imagesCompleted === imageUrlsToLoad.length) {
                    console.log('✅ اكتمل تحميل جميع الصور');
                    finishLoading();
                }
            })
            .catch(error => {
                console.error(`❌ خطأ في تحميل ${url}:`, error);

                const estimatedSize = estimateFileSize(url);
                loadedBytes += estimatedSize;
                updateLoadProgress();

                imagesCompleted++;

                if (imagesCompleted === imageUrlsToLoad.length) {
                    finishLoading();
                }
            });
    });
}

function finishLoading() {
    if (mainSvg) mainSvg.style.opacity = '1';

    window.updateDynamicSizes();
    scan();
    updateWoodInterface();
    window.goToWood();

    // ✅ التأكد من إضاءة جميع المصابيح
    loadedBytes = totalBytes;
    updateLoadProgress();

    hideLoadingScreen();
    console.log('🎉 اكتمل التحميل والعرض');
}
window.loadImages = loadImages;

/* --- 17. مستمعي الأحداث --- */
document.querySelectorAll('.group-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const group = this.getAttribute('data-group');
        console.log('👆 تم اختيار المجموعة:', group);
        initializeGroup(group, true);
    });
});

if (changeGroupBtn) {
    changeGroupBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (groupSelectionScreen) groupSelectionScreen.classList.remove('hidden');
        window.goToWood();
    });
}

if (searchInput) {
    searchInput.onkeydown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            window.goToWood();
        }
    };

    searchInput.addEventListener('input', debounce(function(e) {
        if (!mainSvg) return;

        const query = e.target.value.toLowerCase().trim();

        // ✅ البحث فقط في عناصر الخريطة (ليس القوائم)
        mainSvg.querySelectorAll('rect.m:not(.list-item)').forEach(rect => {
            const href = rect.getAttribute('data-href') || '';
            const label = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);
            const bg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);

            // ✅ إخفاء المستطيلات بـ data-href="#" دائماً (حتى لو البحث فارغ)
            if (href === '#') {
                rect.style.display = 'none';
                if (label) label.style.display = 'none';
                if (bg) bg.style.display = 'none';
                return;
            }

            // ✅ منطق البحث العادي للعناصر الأخرى
            if (query.length > 0) {
                const isMatch = href.toLowerCase().includes(query) || 
                              (rect.getAttribute('data-full-text') || '').toLowerCase().includes(query);
                rect.style.display = isMatch ? '' : 'none';
                if (label) label.style.display = rect.style.display; 
                if (bg) bg.style.display = rect.style.display;
            } else {
                // ✅ عند البحث الفارغ: إظهار كل شيء ماعدا "#"
                rect.style.display = '';
                if (label) label.style.display = ''; 
                if (bg) bg.style.display = '';
            }
        });

        // ✅ تحديث واجهة القوائم الخشبية مع الأرقام الذكية
        updateWoodInterface();
    }, 150));
}

if (moveToggle) {
    moveToggle.onclick = (e) => {
        e.preventDefault();
        if (toggleContainer && toggleContainer.classList.contains('top')) {
            toggleContainer.classList.replace('top', 'bottom');
        } else if (toggleContainer) {
            toggleContainer.classList.replace('bottom', 'top');
        }
    };
}

if (searchIcon) {
    searchIcon.onclick = (e) => {
        e.preventDefault();
        window.goToWood();
    };
}

if (backButtonGroup) {
    backButtonGroup.onclick = () => { 
        if (currentFolder !== "") { 
            let parts = currentFolder.split('/');
            parts.pop();
            currentFolder = parts.join('/'); 
            window.updateWoodInterface(); 
        } else { 
            console.log("🔙 العودة إلى نهاية الخريطة");
            window.goToMapEnd();
        } 
    };
}

if (jsToggle) {
    jsToggle.addEventListener('change', function() { 
        interactionEnabled = this.checked; 
        if (!interactionEnabled) cleanupHover(); 
    });
}

if (mainSvg) {
    mainSvg.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    }, false);
}

/* --- 18. البدء التلقائي --- */

// 1. تأكد أن الـ ID موجود أولاً قبل أي شيء
if (!localStorage.getItem('visitor_id')) {
    const newId = 'ID-' + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem('visitor_id', newId);
}

// 2. الآن حدث الرسائل (ستجد الـ ID جاهزاً ولن تظهر Unknown ID)
updateWelcomeMessages();

// 3. بقية الكود الخاص بتشغيل المجموعة المحفوظة
const hasSavedGroup = loadSelectedGroup();
if (hasSavedGroup) {
    initializeGroup(currentGroup, true);
} else {
    if (groupSelectionScreen) {
        groupSelectionScreen.classList.remove('hidden');
    }
}