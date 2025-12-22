/* --- 1. الإعدادات والمتغيرات العالمية --- */
const GITHUB_USER = "MUE24Med";
const REPO_NAME = "semester-3";

// جلب الجروب المختار من المتصفح أو تعيين B كافتراضي
let SELECTED_GROUP = localStorage.getItem("selectedGroup") || "B"; 

// الموارد المتغيرة بناءً على الجروب
const GROUP_RESOURCES = {
    woodLogo: `image/logo-wood-${SELECTED_GROUP}.webp`,
    svgPath: `groups/group-${SELECTED_GROUP}.svg` 
};

// روابط GitHub API
const TREE_API_URL = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/git/trees/main?recursive=1`;
const RAW_CONTENT_BASE = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/`;

let globalFileTree = []; 
let currentFolder = ""; 
let interactionEnabled = true;

// حالة الهافر والزووم
let activeState = {
    rect: null, zoomPart: null, zoomText: null, zoomBg: null,
    baseText: null, baseBg: null, animationId: null, clipPathId: null,
    touchStartTime: 0, initialScrollLeft: 0
};

/* --- 2. وظائف الجلب والتحميل (Fetch & Load) --- */

// جلب شجرة ملفات المستودع بالكامل
async function fetchGlobalTree() {
    if (globalFileTree.length > 0) return; 
    try {
        const response = await fetch(TREE_API_URL);
        const data = await response.json();
        globalFileTree = data.tree || [];
        console.log("تم تحميل شجرة الملفات:", globalFileTree.length);
    } catch (err) {
        console.error("خطأ في الاتصال بـ GitHub:", err);
    }
}

// تحميل ملف الـ SVG الخاص بالجروب المختار وحقنه في الحاوية
async function loadGroupSVG() {
    const svgContainer = document.getElementById('map-content-container');
    if (!svgContainer) return;
    try {
        const response = await fetch(GROUP_RESOURCES.svgPath);
        if (!response.ok) throw new Error("SVG file not found");
        const svgText = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const importedSvg = doc.querySelector('svg');
        
        if (importedSvg) {
            svgContainer.innerHTML = ''; // تنظيف أي محتوى سابق
            while (importedSvg.firstChild) {
                svgContainer.appendChild(importedSvg.firstChild);
            }
            console.log(`تم حقن خريطة الجروب (${SELECTED_GROUP})`);
        }
    } catch (err) {
        console.error("خطأ في تحميل ملف الخريطة:", err);
    }
}

/* --- 3. وظائف التحكم في ملفات PDF والمشاركة --- */

// فتح الملفات (Smart Open)
function smartOpen(item) {
    if(!item || !item.path) return;
    const url = `${RAW_CONTENT_BASE}${item.path}`;
    if(url.toLowerCase().endsWith('.pdf')) {
        const overlay = document.getElementById("pdf-overlay");
        const pdfViewer = document.getElementById("pdfFrame");
        overlay.classList.remove("hidden");
        // استخدام viewer.html الخاص بـ pdf.js لضمان أفضل تجربة
        pdfViewer.src = "https://mozilla.github.io/pdf.js/web/viewer.html?file=" + 
                        encodeURIComponent(url) + "#zoom=page-width"; 
    } else {
        window.open(url, '_blank');
    }
}

// زر إغلاق الـ PDF
document.getElementById("closePdfBtn").onclick = () => {
    const overlay = document.getElementById("pdf-overlay");
    const pdfViewer = document.getElementById("pdfFrame");
    pdfViewer.src = "";
    overlay.classList.add("hidden");
};

// زر تحميل الـ PDF
document.getElementById("downloadBtn").onclick = () => {
    const iframe = document.getElementById("pdfFrame");
    let src = iframe.src;
    if (!src) return;
    const match = src.match(/file=(.+)$/);
    if (match && match[1]) {
        const fileUrl = decodeURIComponent(match[1].split('#')[0]);
        const a = document.createElement("a");
        a.href = fileUrl;
        a.download = fileUrl.split("/").pop();
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
        const fileUrl = decodeURIComponent(match[1].split('#')[0]);
        navigator.clipboard.writeText(fileUrl)
            .then(() => alert("تم نسخ رابط الملف!"))
            .catch(() => alert("فشل النسخ."));
    }
};

/* --- 4. إدارة اختيار الجروبات --- */

function setupGroupControls() {
    const groupSelector = document.getElementById('group-selector');
    const groupButtons = document.querySelectorAll('.group-buttons button');
    const splashImage = document.getElementById('splash-image');

    // إذا لم يكن هناك جروب مخزن، أظهر واجهة الاختيار واحبس المستخدم فيها
    if (!localStorage.getItem("selectedGroup")) {
        groupSelector.style.display = 'flex';
        if (loadingOverlay) loadingOverlay.style.display = 'none'; // إخفاء التحميل مؤقتاً لتظهر الأزرار
    } else {
        groupSelector.style.display = 'none';
        // تحديث شعار شاشة التحميل بناءً على الجروب المختار
        if (splashImage) {
            splashImage.src = `image/logo-${SELECTED_GROUP}.webp`;
        }
    }

    groupButtons.forEach(btn => {
        btn.onclick = () => {
            const g = btn.getAttribute('data-group');
            localStorage.setItem("selectedGroup", g);
            location.reload(); 
        };
    });
}


    groupButtons.forEach(btn => {
        btn.onclick = () => {
            const g = btn.getAttribute('data-group');
            localStorage.setItem("selectedGroup", g);
            location.reload(); 
        };
    });

    if (localStorage.getItem("selectedGroup")) {
        groupSelector.style.display = 'none';
    }
}

/* --- 5. تهيئة الخدمة (Service Worker) للأوفلاين --- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker Active'))
      .catch(err => console.log('Service Worker Failed', err));
  });
}

window.onload = async function() {
    setupGroupControls();
    if (localStorage.getItem("selectedGroup")) {
        await loadGroupSVG();
        await fetchGlobalTree();
        updateWoodInterface();
        scan(); 
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            setTimeout(() => {
                loadingOverlay.style.opacity = '0';
                setTimeout(() => loadingOverlay.style.display = 'none', 500);
            }, 800);
        }
        const scrollContainer = document.getElementById('scroll-container');
        scrollContainer.scrollTo({ left: 0, behavior: 'instant' });
    }
    setupGroupControls();
    await loadGroupSVG();
    await fetchGlobalTree();
    updateWoodInterface();
    scan(); 
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => loadingOverlay.style.display = 'none', 500);
    }
    const scrollContainer = document.getElementById('scroll-container');
    scrollContainer.scrollTo({ left: 0, behavior: 'instant' });
};

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
;