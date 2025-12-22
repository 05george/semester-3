const REPO_NAME = "semester-3"; 
const GITHUB_USER = "MUE24Med";

// المتغيرات العالمية المبنية على اسم المستودع
const NEW_API_BASE = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents`;
const TREE_API_URL = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/git/trees/main?recursive=1`;
const RAW_CONTENT_BASE = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/`;

let globalFileTree = []; 

// 2. دالة جلب البيانات (التي تجعل الموقع يعمل أوفلاين لاحقاً)
async function fetchGlobalTree() {
    if (globalFileTree.length > 0) return; 
    try {
        const response = await fetch(TREE_API_URL);
        const data = await response.json();
        globalFileTree = data.tree || [];
        console.log("تم تحميل شجرة الملفات بنجاح:", globalFileTree.length);
    } catch (err) {
        console.error("خطأ في الاتصال بـ GitHub:", err);
    }
}

// زر الإغلاق (كما هو)
document.getElementById("closePdfBtn").onclick = () => {
    const overlay = document.getElementById("pdf-overlay");
    const pdfViewer = document.getElementById("pdfFrame");
    pdfViewer.src = "";
    overlay.classList.add("hidden");
};

// زر التحميل
document.getElementById("downloadBtn").onclick = () => {
    const iframe = document.getElementById("pdfFrame");
    let src = iframe.src;
    if (!src) return;

    const match = src.match(/file=(.+)$/);
    if (match && match[1]) {
        const fileUrl = decodeURIComponent(match[1]);
        const a = document.createElement("a");
        a.href = fileUrl;
        a.download = fileUrl.split("/").pop(); // اسم الملف
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
};

// زر المشاركة
document.getElementById("shareBtn").onclick = () => {
    const iframe = document.getElementById("pdfFrame");
    let src = iframe.src;
    if (!src) return;

    const match = src.match(/file=(.+)$/);
    if (match && match[1]) {
        const fileUrl = decodeURIComponent(match[1]);

        navigator.clipboard.writeText(fileUrl)
            .then(() => alert("رابط الملف تم نسخه إلى الحافظة!"))
            .catch(() => alert("فشل نسخ الرابط."));
    }
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker Registered'))
      .catch(err => console.log('Service Worker Failed', err));
  });
}

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

    // --- وظيفة الفتح الذكي المخصصة ---
    function smartOpen(item) {
        if(!item || !item.path) return;
        const url = `${RAW_CONTENT_BASE}${item.path}`;
        if(url.endsWith('.pdf')) {
            const overlay = document.getElementById("pdf-overlay");
            const pdfViewer = document.getElementById("pdfFrame");
            overlay.classList.remove("hidden");

            pdfViewer.src = "https://mozilla.github.io/pdf.js/web/viewer.html?file=" + 
                            encodeURIComponent(url) + "#zoom=page-width"; 
        } else {
            window.open(url, '_blank');
        }
    }

    // --- وظائف الحركة بنظام RTL (إعادة للأصل) ---
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

    // --- ربط الأحداث ---
    const handleGoToWood = (e) => {
        e.preventDefault();
        goToWood();
    };

    searchIcon.onclick = handleGoToWood;
    searchIcon.addEventListener('touchend', handleGoToWood);

    searchInput.onkeydown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            goToWood();
        }
    };

    moveToggle.onclick = (e) => {
        e.preventDefault();
        if (toggleContainer.classList.contains('top')) {
            toggleContainer.classList.replace('top', 'bottom');
        } else {
            toggleContainer.classList.replace('bottom', 'top');
        }
    };

    backButtonGroup.onclick = () => { 
        if (currentFolder !== "") { 
            let parts = currentFolder.split('/'); parts.pop(); currentFolder = parts.join('/'); 
            updateWoodInterface(); 
        } else { 
            goToMapEnd(); 
        } 
    };

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

    async function updateWoodInterface() {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        if (!dynamicGroup) return;
        dynamicGroup.innerHTML = ''; 
        await fetchGlobalTree();

        if (currentFolder === "") {
            backBtnText.textContent = "إلى الخريطة ←";
        } else {
            const pathParts = currentFolder.split('/');
            const breadcrumb = "الرئيسية > " + pathParts.join(' > ');
            backBtnText.textContent = breadcrumb.length > 35 ? `🔙 ... > ${pathParts.slice(-1)}` : `🔙 ${breadcrumb}`;
        }

        if (currentFolder === "") {
            const banner = document.createElementNS("http://www.w3.org/2000/svg", "image");
            banner.setAttribute("href", "image/logo-wood.webp"); 
            banner.setAttribute("x", "186.86"); banner.setAttribute("y", "1517.43"); 
            banner.setAttribute("width", "648.41"); banner.setAttribute("height", "276.04"); 
            banner.style.mixBlendMode = "multiply"; banner.style.opacity = "0.9";
            banner.style.pointerEvents = "none";
            dynamicGroup.appendChild(banner);
        }

        const folderPrefix = currentFolder ? currentFolder + '/' : '';
        const itemsMap = new Map();

        globalFileTree.forEach(item => {
            if (item.path.startsWith(folderPrefix)) {
                const relativePath = item.path.substring(folderPrefix.length);
                const pathParts = relativePath.split('/');
                const name = pathParts[0];

                if (!itemsMap.has(name)) {
                    const isDir = pathParts.length > 1 || item.type === 'tree';
                    const isPdf = item.path.toLowerCase().endsWith('.pdf');

                    if (isDir && name !== 'image') {
                        itemsMap.set(name, { name: name, type: 'dir', path: folderPrefix + name });
                    } else if (isPdf && pathParts.length === 1) {
                        itemsMap.set(name, { name: name, type: 'file', path: item.path });
                    }
                }
            }
        });

        const filteredData = Array.from(itemsMap.values());
        for (let [index, item] of filteredData.entries()) {
            const x = (index % 2 === 0) ? 120 : 550;
            const y = 250 + (Math.floor(index / 2) * 90);
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("class", item.type === 'dir' ? "wood-folder-group" : "wood-file-group");
            g.style.cursor = "pointer";
            const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", "350"); r.setAttribute("height", "70"); r.setAttribute("rx", "12");
            r.setAttribute("class", "list-item");
            r.style.fill = item.type === 'dir' ? "#5d4037" : "rgba(0,0,0,0.8)";
            r.style.stroke = "#fff";
            const cleanName = item.name.replace(/\.[^/.]+$/, "");
            const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
            t.setAttribute("x", x + 175); t.setAttribute("y", y + 42);
            t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "white");
            t.style.fontWeight = "bold"; t.style.fontSize = "17px";
            t.setAttribute("data-search-name", cleanName.toLowerCase());
            if (item.type === 'dir') {
                const count = globalFileTree.filter(f => 
                    f.path.startsWith(item.path + '/') && f.path.toLowerCase().endsWith('.pdf')
                ).length;
                t.textContent = `📁 (${count}) ` + (cleanName.length > 15 ? cleanName.substring(0, 13) + ".." : cleanName);
            } else {
                t.textContent = "📄 " + (cleanName.length > 25 ? cleanName.substring(0, 22) + "..." : cleanName);
            }
            g.appendChild(r); g.appendChild(t);
            g.onclick = (e) => {
                e.stopPropagation();
                if (item.type === 'dir') { currentFolder = item.path; updateWoodInterface(); } 
                else { smartOpen(item); }
            };
            dynamicGroup.appendChild(g);
        }
        applyWoodSearchFilter();
    }

    function applyWoodSearchFilter() {
        const query = searchInput.value.toLowerCase().trim();
        mainSvg.querySelectorAll('.wood-file-group').forEach(group => {
            const name = group.querySelector('text').getAttribute('data-search-name') || "";
            group.style.display = (query === "" || name.includes(query)) ? 'inline' : 'none';
        });
        mainSvg.querySelectorAll('.wood-folder-group').forEach(group => { group.style.display = 'inline'; });
    }

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

    searchInput.addEventListener('input', debounce(function(e) {
        const query = e.target.value.toLowerCase().trim();
        mainSvg.querySelectorAll('rect.m:not(.list-item)').forEach(rect => {
            const isMatch = (rect.getAttribute('data-href') || '').toLowerCase().includes(query) || (rect.getAttribute('data-full-text') || '').toLowerCase().includes(query);
            const label = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);
            const bg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);
            rect.style.display = (query.length > 0 && !isMatch) ? 'none' : '';
            if(label) label.style.display = rect.style.display; 
            if(bg) bg.style.display = rect.style.display;
        });
        applyWoodSearchFilter();
    }, 150));

    jsToggle.addEventListener('change', function() { 
        interactionEnabled = this.checked; if(!interactionEnabled) cleanupHover(); 
    });
// منع القائمة عند الضغط المطول على أي صورة داخل الـ SVG
document.getElementById('main-svg').addEventListener('contextmenu', function(e) {
    e.preventDefault();
}, false);

};<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
  <meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interactive Map</title>
  <link rel="stylesheet" href="style.css">
  <link rel="icon" type="image/webp" href="image/p.png">
</head>
<body>

<div id="js-toggle-container" class="top">
  <div id="search-container">
    <input type="text" id="search-input" placeholder="ابحث باسم الملف...">
  <span id="search-icon" class="clickable-area">🔙</span>
</div>
  <div class="controls-row">
    <span id="move-toggle" style="cursor:pointer; font-size: 18px;">↕️</span>
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 12px; opacity: 0.8;">Interaction</span>
      <label class="switch">
        <input type="checkbox" id="js-toggle" checked>
        <span class="slider round"></span>
      </label>
    </div>
  </div>
</div>

<div id="loading-overlay">
  <div id="loading-content">
    <img id="splash-image" src="image/logo-B.webp" />
    <h1>Interactive College Map</h1>
    <div id="loader-lights">
      <div class="light-bulb" id="bulb-1"></div>
      <div class="light-bulb" id="bulb-2"></div>
      <div class="light-bulb" id="bulb-3"></div>
      <div class="light-bulb" id="bulb-4"></div>
    </div>
    <div id="legend">
      <div class="legend-item red">أسئلة</div>
      <div class="legend-item yellow">محاضرات</div>
      <div class="legend-item white">مواد أخرى</div>
      <div class="legend-item purple">إجابات</div>
      <div class="legend-item green">سكاشن العملي</div>
      <div class="legend-item blue">فيديو شرح</div>
    </div>
  </div>
</div>

<div id="pdf-overlay" class="hidden">
  <div id="toolbar">
    <button id="closePdfBtn" class="toolbar-btn">❌ إغلاق</button>
    <button id="downloadBtn" class="toolbar-btn">⬇ تحميل</button>
    <button id="shareBtn" class="toolbar-btn">🔗 مشاركة</button>
  </div>
  <iframe id="pdfFrame" src="" loading="lazy"></iframe>
</div>

<div id="scroll-container">
  <svg id="main-svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" preserveAspectRatio="xMinYMin meet">
    <defs></defs>

    <g transform="translate(0,0)" id="files-list-container">
      <image data-src="image/wood.webp" x="0" y="0" width="1024" height="2454" />
      <g id="back-button-group" style="cursor: pointer;">
 <g id="back-button-group" style="cursor: pointer;">

 <g id="back-button-group" style="cursor: pointer;">
  <rect id="back-btn" x="112" y="140" width="800" height="70" rx="15" fill="#3e2723" stroke="#fff" stroke-width="2" />
  <text x="512" y="185" id="back-btn-text" text-anchor="middle" fill="white" font-size="22" font-weight="bold">➡️ إلى الخريطة </text>
</g>


      </g>
      <g id="dynamic-links-group"></g>
    </g>

<!-- الاسبوع الأول -->
<g transform="translate(1024,0)">
<image data-src="image/1.webp" width="1024" height="2454" />
</g>
<!-- الاسبوع الثاني -->
<g transform="translate(2048,0)">
<image data-src="image/2.webp" width="1024" height="2454" />
</g>
<!-- الاسبوع الثالث -->
<g transform="translate(3072,0)">
<image data-src="image/3.webp" width="1024" height="2454" />
</g>
<!-- الاسبوع الرابع -->
<g transform="translate(4096,0)">
<image data-src="image/4.webp" width="1024" height="2454" />
</g>
<!-- الاسبوع الخامس -->
<g transform="translate(5120,0)">
<image data-src="image/5.webp" width="1024" height="2454" />
</g>
<!-- الاسبوع السادس -->
<g transform="translate(6144,0)">
<image data-src="image/6.webp" width="1024" height="2454" />
</g>
<!-- الاسبوع السابع -->
<g transform="translate(7168,0)">
<image data-src="image/7.webp" width="1024" height="2454" />
</g>
<!-- الاسبوع الثامن -->
<g transform="translate(8192,0)">
<image data-src="image/8.webp" width="1024" height="2454" />

<!-- Monday 8 -->
<g transform="translate(368,0)">

<rect x="0" y="703" height="380" class="m w l" data-href="RRS/Lecture/micro-1.pdf"/>

<rect x="0" y="1083" height="253.5" class="m w l" data-href="RRS/Lecture/patho-1.pdf"/>

<rect x="0" y="1339" height="125" class="m w q" data-href="RRS/Quesion/patho-1.pdf"/>

<rect x="0" y="1465" height="378.5" class="m w l" data-href="RRS/Lecture/physio-2.pdf"/>

<rect x="0" y="1845" height="380" class="m w s" data-href="RRS/Section/anatomy-1.pdf"/>

</g>
<!-- Wednesday 8 -->
<g transform="translate(598,0)">

<rect x="0" y="366" height="315" class="m w l" data-href="RRS/Lecture/physio-1.pdf"/>

<rect x="0" y="1846" height="253.4" class="m w l" data-href="RRS/Lecture/physio-2.pdf"/>

<rect x="0" y="2100" height="127" class="m w q" data-href="RRS/Question/physio-1.pdf"/>

</g>
<!-- Thursday 8 -->
<g transform="translate(712.35,0)">

<rect x="0" y="702" height="380" class="m w l" data-href="RRS/Lecture/histo-1.pdf"/>

<rect x="0" y="1465" height="380" class="m w l" data-href="RRS/Lecture/anatomy-2.pdf"/>

</g>
</g>
<!-- الاسبوع التاسع -->
<g transform="translate(9216,0)">
    <image data-src="image/9.webp" width="1024" height="2454"/>

<!-- Saturday 9 -->
<g transform="translate(140,0)">

<rect x="0" y="309" height="340.63" class="m w l" data-href="RRS/Lecture/pharma-1.pdf"/>

<rect x="0" y="876" height="349" class="m w i" data-href="IPC/book.pdf"/>

<rect x="0" y="1225" height="121" class="m hw q" data-href="IPC/Question/9.pdf"/>

<rect x="57.5" y="1225" height="121" class="m hw a" data-href="IPC/Answer/9.pdf"/>

<rect x="0" y="1810.38" height="470.24" class="m w " data-href="#"/>

</g>
<!-- Monday 9 -->
<g transform="translate(370,0)">

<rect x="0" y="422.3" height="456.42" class="m w l" data-href="RRS/Lecture/physio-3.pdf"/>

<rect x="0" y="1369" height="450" class="m w " data-href="RRS/Lecture/histo-2.pdf"/>

<rect x="0" y="1812.1" height="471.44" class="m w " data-href="#"/>

</g>
<!-- Tuesday 9 -->
<g transform="translate(485,0)">

<rect x="0" y="1121.29" height="347.86" class="m w " data-href="#"/>

<rect x="0" y="1470.58" height="340.47" class="m w " data-href="#"/>

<rect x="0" y="1813.77" height="361.36" class="m w " data-href="#"/>

</g>
<!-- Wednesday 9 -->
<g transform="translate(600,0)">

<rect x="0" y="421.64" height="457.44" class="m w " data-href="#"/>

<rect x="0" y="1469.19" height="343.19" class="m w l" data-href="RRS/Lecture/physio-4.pdf"/>

</g>
<!-- Thursday 9 -->
<g transform="translate(715,0)">

<rect x="0" y="422.25" height="340.47" class="m w " data-href="#"/>

<rect x="0" y="877.49" height="485.43" class="m w " data-href="#"/>

<rect x="0" y="1364.73" height="447.54" class="m w " data-href="#"/>

</g>
</g>
<!-- الاسبوع العاشر -->
<g transform="translate(10240,0)">
    <image data-src="image/10.webp" width="1024" height="2454" />
</g>
<!-- الاسبوع الحادي عشر-->
<g transform="translate(11264,0)">
    <image data-src="image/11.webp" width="1024" height="2454" />
</g>
<!-- الاسبوع الثاني عشر -->
<g transform="translate(12288,0)">
<image data-src="image/12.webp" width="1024" height="2454" />

<!-- Saturday 12 -->
<g transform="translate(138.41,0)">

<rect x="0" y="557.66" height="628.7" class="m w l" data-href="URI/Lecture/pharma-1.pdf"/>

</g>
</g>
<!-- الاسبوع الثالث عشر-->
<g transform="translate(13312,0)">
    <image data-src="image/13.webp" width="1024" height="2454" />

<!-- Saturday 13 -->
<g transform="translate(139,0)">

<rect x="0" y="937.7" height="468.3" class="m w " data-href="#"/>

<rect x="0" y="1409" height="472.3" class="m w l" data-href="URI/Lecture/pharma-2.pdf"/>

<rect x="0" y="1883.5" height="395.5" class="m w s" data-href="URI/Section/micro-1.pdf"/>

</g>
<!-- Monday 13 -->
<g transform="translate(368,0)">

<rect x="0" y="415.1" height="424.1" class="m w " data-href="#"/>

<rect x="0" y="839.15" height="445" class="m w " data-href="#"/>

<rect x="0" y="1287.75" height="484.32" class="m w i" data-href="IPC/Lecture/Chest Inspection and Palpation.pdf" data-full-text="Chest Inspection and Palpation .pdf"/>

<rect x="0" y="1773.4" height="505.15" class="m w l" data-href="URI/Lecture/physio-1.pdf"/>

</g>
<!-- Tuesday 13 -->
<g transform="translate(485,0)">

<rect x="0" y="311.4" height="426.454" class="m w " data-href="#"/>

<rect x="0" y="1285.3" height="486" class="m w " data-href="#"/>

</g>
<!-- Wednesday 13 -->
<g transform="translate(598,0)">

<rect x="0" y="415.1" height="323.85" class="m w l" data-href="URI/Lecture/micro-1.pdf"/>

<rect x="0" y="841.4" height="444" class="m w l " data-href="URI/Lecture/histo-1.pdf"/>

<rect x="0" y="1286.2" height="486.5" class="m w " data-href="#"/>

</g>
<!-- Thursday 13 -->
<g transform="translate(714,0)">

<rect x="0" y="418.7" height="420" class="m w " data-href="#"/>

<rect x="0" y="1286.5" height="485" class="m w " data-href="#"/>

<rect x="0" y="1772.3" height="508.2" class="m w " data-href="#"/>
</g>
</g>
<!-- الاسبوع الرابع عشر-->
<g transform="translate(14336,0)">
    <image data-src="image/14.webp" width="1024" height="2454" />

<!-- Saturday 14 -->
<g transform="translate(138,0)">
<rect x="0" y="289" height="350.6" class="m w " data-href="#" />

<rect x="0" y="640" height="341.5" class="m w " data-href="#" />

<rect x="0" y="981.3" height="320" class="m w l" data-href="URI/Lecture/pharma-3.pdf" />
</g>
<!-- Sunday 14 -->
<g transform="translate(252.8,0)">

<rect x="0" y="1301.5" height="494" class="m w l" data-href="URI/Lecture/anatomy-2.pdf" />

<rect x="0" y="1796.5" height="496.75" class="m w q" data-href="URI/Question/pharma-Discussion-1.pdf" />
</g>
<!-- Monday 14 -->
<g transform="translate(368.5,0)">

<rect x="0" y="1301.3"  height="494.7" class="m w " data-href="#" />

<rect x="0" y="747.4" height="350" class="m w " data-href="#" />
</g>

<!-- Tuesday 14 -->
<g transform="translate(483,0)">

<rect x="0" y="1301.4"  height="495" class="m w " data-href="#" />

<rect x="0" y="864.4" height="436" class="m w " data-href="#" />

<rect x="0" y="1797.6" height="494.7" class="m w " data-href="#" />
</g>

<!-- Wednesday 14 -->
<g transform="translate(598,0)">

<rect x="0" y="864.5"  height="436.6" class="m w " data-href="#" />

<rect x="0" y="288.7"  height="350.55" class="m w " data-href="#" />

<rect x="0" y="1300.7"  height="495.8" class="m w " data-href="#" />
</g>

<!-- Thursday 14 -->
<g transform="translate(712.5,0)">

<rect x="0" y="1300.8" height="371.58" class="m w " data-href="#"/>

<rect x="0" y="863.9" height="436" class="m w " data-href="#"/>

<rect x="0" y="1673" height="620" class="m w " data-href="#" />

</g>
</g>
</svg>
</div>
<script src="script.js"></script>
</body>
</html>