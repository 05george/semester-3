/* =====================================================
   الجزء (1/4)
   الإعدادات العامة + GitHub API + PDF Controls + SW
===================================================== */

/* ===== إعدادات المستودع ===== */
const REPO_NAME = "semester-3";
const GITHUB_USER = "MUE24Med";

// الخطأ:
const NEW_API_BASE = https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents;

// الخطأ:
const NEW_API_BASE = https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents;

const NEW_API_BASE = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents`;
const TREE_API_URL = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/git/trees/main?recursive=1`;
const RAW_CONTENT_BASE = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/`;

const TREE_API_URL = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/git/trees/main?recursive=1`;
const RAW_CONTENT_BASE = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/`;

let globalFileTree = [];

/* ===== تحميل شجرة الملفات من GitHub ===== */
async function fetchGlobalTree() {
    if (globalFileTree.length > 0) return;

    try {
        const response = await fetch(TREE_API_URL);
        const data = await response.json();
        globalFileTree = data.tree || [];
        console.log("تم تحميل شجرة الملفات:", globalFileTree.length);
    } catch (err) {
        console.error("خطأ في GitHub API:", err);
    }
}

/* =====================================================
   أزرار عارض PDF
===================================================== */

// زر الإغلاق
document.getElementById("closePdfBtn").onclick = () => {
    const overlay = document.getElementById("pdf-overlay");
    const pdfViewer = document.getElementById("pdfFrame");
    pdfViewer.src = "";
    overlay.classList.add("hidden");
};

// زر التحميل
document.getElementById("downloadBtn").onclick = () => {
    const iframe = document.getElementById("pdfFrame");
    if (!iframe.src) return;

    const match = iframe.src.match(/file=(.+)$/);
    if (!match) return;

    const fileUrl = decodeURIComponent(match[1]);
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = fileUrl.split("/").pop();
    document.body.appendChild(a);
    a.click();
    a.remove();
};

// زر المشاركة
document.getElementById("shareBtn").onclick = () => {
    const iframe = document.getElementById("pdfFrame");
    if (!iframe.src) return;

    const match = iframe.src.match(/file=(.+)$/);
    if (!match) return;

    const fileUrl = decodeURIComponent(match[1]);
    navigator.clipboard.writeText(fileUrl)
        .then(() => alert("تم نسخ رابط الملف"))
        .catch(() => alert("فشل نسخ الرابط"));
};

/* =====================================================
   Service Worker (Offline Support)
===================================================== */
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("./sw.js")
            .then(() => console.log("Service Worker Registered"))
            .catch(err => console.log("Service Worker Failed", err));
    });
}
/* =====================================================
   الجزء (2/4)
   تهيئة الصفحة + فتح ذكي للملفات + الحركة + البحث
===================================================== */

window.onload = function() {
    let loadedCount = 0;
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const clipDefs = mainSvg.querySelector('defs');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    const searchIcon = document.getElementById('search-icon');
    const moveToggle = document.getElementById('move-toggle');
    const toggleContainer = document.getElementById('js-toggle-container');
    const backButtonGroup = document.getElementById('back-button-group');
    const backBtnText = document.getElementById('back-btn-text');

    let activeState = {
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,
        baseText: null, baseBg: null, animationId: null, clipPathId: null,
        touchStartTime: 0, initialScrollLeft: 0
    };

    let currentFolder = ""; 
    let interactionEnabled = jsToggle.checked;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    /* ===== الفتح الذكي للملفات ===== */
    function smartOpen(item) {
        if (!item || !item.path) return;
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

    /* ===== وظائف الحركة لنظام RTL ===== */
    const goToWood = () => {
        scrollContainer.scrollTo({ 
            left: -scrollContainer.scrollWidth, 
            behavior: 'smooth' 
        });
    };

    const goToMapEnd = () => {
        scrollContainer.scrollTo({ 
            left: 0, 
            behavior: 'smooth' 
        });
    };

    /* ===== ربط أحداث البحث والتنقل ===== */
    const handleGoToWood = (e) => { e.preventDefault(); goToWood(); };
    searchIcon.onclick = handleGoToWood;
    searchIcon.addEventListener('touchend', handleGoToWood);

    searchInput.onkeydown = (e) => {
        if (e.key === "Enter") { e.preventDefault(); goToWood(); }
    };

    moveToggle.onclick = (e) => {
        e.preventDefault();
        toggleContainer.classList.contains('top') ? 
            toggleContainer.classList.replace('top','bottom') : 
            toggleContainer.classList.replace('bottom','top');
    };

    backButtonGroup.onclick = () => { 
        if (currentFolder !== "") { 
            let parts = currentFolder.split('/'); parts.pop(); currentFolder = parts.join('/'); 
            updateWoodInterface(); 
        } else { 
            goToMapEnd(); 
        } 
    };

    /* ===== دوال مساعدة ===== */
    function debounce(func, delay) {
        let timeoutId;
        return function() {
            const context = this; const args = arguments;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        }
    }

    function updateDynamicSizes() {
        const images = mainSvg.querySelectorAll('image');
        if (!images.length) return;
        const imgW = 1024;
        const imgH = 2454;
        mainSvg.setAttribute('viewBox', `0 0 ${images.length * imgW} ${imgH}`);
    }
    updateDynamicSizes();

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
/* =====================================================
   الجزء (3/4)
   Hover Effect + Zoom + Labels + Animation
===================================================== */

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
        if(bBg) bBg.style.opacity = '0';  
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

/* ===== دوال النصوص داخل المستطيلات ===== */
function wrapText(el, maxW) {
    const txt = el.getAttribute('data-original-text'); if(!txt) return;
    const words = txt.split(/\s+/); el.textContent = '';
    let ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    ts.setAttribute('x', el.getAttribute('x')); ts.setAttribute('dy', '0');
    el.appendChild(ts); let line = '';
    const lh = parseFloat(el.style.fontSize) * 1.1;
    words.forEach(word => {
        let test = line + (line ? ' ' : '') + word;
        ts.textContent = test;
        if (ts.getComputedTextLength() > maxW - 5 && line) {
            ts.textContent = line;
            ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            ts.setAttribute('x', el.getAttribute('x')); ts.setAttribute('dy', lh + 'px');
            ts.textContent = word; el.appendChild(ts); line = word;
        } else { line = test; }
    });
}
/* =====================================================
   الجزء (4/4)
   البحث، معالجة المستطيلات، تحميل الصور وPDF، تفعيل الواجهة
===================================================== */

function processRect(r) {
    if (r.hasAttribute('data-processed')) return;
    if(r.classList.contains('w')) r.setAttribute('width', '113.5');
    if(r.classList.contains('hw')) r.setAttribute('width', '56.75');
    const href = r.getAttribute('data-href') || '';
    const name = r.getAttribute('data-full-text') || (href !== '#' ? href.split('/').pop().split('#')[0].split('.').slice(0, -1).join('.') : '');
    const w = parseFloat(r.getAttribute('width')) || r.getBBox().width;
    const x = parseFloat(r.getAttribute('x')); const y = parseFloat(r.getAttribute('y'));
    if (name && name.trim() !== '') {
        const fs = Math.max(8, Math.min(12, w * 0.11));
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', x + w / 2); txt.setAttribute('y', y + 2);
        txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('class', 'rect-label');
        txt.setAttribute('data-original-text', name); txt.setAttribute('data-original-for', href);
        txt.style.fontSize = fs + 'px'; txt.style.fill = 'white'; txt.style.pointerEvents = 'none'; txt.style.dominantBaseline = 'hanging';
        r.parentNode.appendChild(txt); wrapText(txt, w);
        const bbox = txt.getBBox();
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', x); bg.setAttribute('y', y); bg.setAttribute('width', w); bg.setAttribute('height', bbox.height + 8);
        bg.setAttribute('class', 'label-bg'); bg.setAttribute('data-original-for', href);
        bg.style.fill = 'black'; bg.style.pointerEvents = 'none';
        r.parentNode.insertBefore(bg, txt);
    }
    if (!isTouchDevice) { r.addEventListener('mouseover', startHover); r.addEventListener('mouseout', cleanupHover); }
    r.onclick = () => { if (href && href !== '#') window.open(href, '_blank'); };
    r.addEventListener('touchstart', function(e) { if(!interactionEnabled) return; activeState.touchStartTime = Date.now(); activeState.initialScrollLeft = scrollContainer.scrollLeft; startHover.call(this); });
    r.addEventListener('touchend', function(e) { 
        if (!interactionEnabled) return;
        if (Math.abs(scrollContainer.scrollLeft - activeState.initialScrollLeft) < 10 && (Date.now() - activeState.touchStartTime) < TAP_THRESHOLD_MS) {
            if (href && href !== '#') window.open(href, '_blank');
        }
        cleanupHover();
    });
    r.setAttribute('data-processed', 'true');
}

function scan() { mainSvg.querySelectorAll('rect.image-mapper-shape, rect.m').forEach(r => processRect(r)); }

/* ===== تحميل جميع الصور المستخدمة داخل SVG ===== */
const urls = Array.from(mainSvg.querySelectorAll('image'))
              .map(img => img.getAttribute('data-src'))
              .filter(src => src !== null && src !== "");

urls.forEach((u, index) => {
    const img = new Image();
    img.onload = img.onerror = () => {
        loadedCount++;
        const p = (loadedCount / urls.length) * 100;
        if(p >= 25) document.getElementById('bulb-4')?.classList.add('on');
        if(p >= 50) document.getElementById('bulb-3')?.classList.add('on');
        if(p >= 75) document.getElementById('bulb-2')?.classList.add('on');
        if(loadedCount === urls.length) {
            document.getElementById('bulb-1')?.classList.add('on');
            mainSvg.querySelectorAll('image').forEach(si => {
                const actualSrc = si.getAttribute('data-src');
                if(actualSrc) si.setAttribute('href', actualSrc);
            });
            setTimeout(() => {
                if(loadingOverlay) {
                    loadingOverlay.style.opacity = '0';
                    setTimeout(() => { 
                        loadingOverlay.style.display = 'none'; 
                        mainSvg.style.opacity = '1'; 
                        scan(); updateWoodInterface(); goToMapEnd(); 
                    }, 500);
                }
            }, 600);
        }
    };
    img.src = u;
});

/* ===== البحث داخل الـ SVG + تطبيق الفلتر على الملفات ===== */
/* الكود المصحح */
searchInput.addEventListener('input', debounce(function(e) {
    const query = e.target.value.toLowerCase().trim();
    mainSvg.querySelectorAll('rect.m:not(.list-item)').forEach(rect => {
        const isMatch = (rect.getAttribute('data-href') || '').toLowerCase().includes(query) || 
                        (rect.getAttribute('data-full-text') || '').toLowerCase().includes(query);
        
        // التصحيح هنا: استخدام الـ Backticks ` `
        const label = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);
        const bg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);
        
        rect.style.display = (query.length > 0 && !isMatch) ? 'none' : '';
        if(label) label.style.display = rect.style.display;
        if(bg) bg.style.display = rect.style.display;
    });
    applyWoodSearchFilter();
}, 150));

/* ===== تفعيل أو تعطيل التفاعل من خلال التبديل ===== */
jsToggle.addEventListener('change', function() { 
    interactionEnabled = this.checked; if(!interactionEnabled) cleanupHover(); 
});

/* ===== منع القائمة عند الضغط المطول على أي صورة داخل SVG ===== */
document.getElementById('main-svg').addEventListener('contextmenu', function(e) {
    e.preventDefault();
} false);