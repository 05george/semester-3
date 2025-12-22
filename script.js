// --- 1. الإعدادات والثوابت العالمية ---
const REPO_NAME = "semester-3"; 
const GITHUB_USER = "MUE24Med";
const TREE_API_URL = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/git/trees/main?recursive=1`;
const RAW_CONTENT_BASE = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/`;

let globalFileTree = []; 
let currentFolder = ""; 
let interactionEnabled = true;

// حالة الـ Hover النشطة لتخزين العناصر المؤقتة
let activeState = {
    rect: null, zoomPart: null, zoomText: null, zoomBg: null,
    baseText: null, baseBg: null, animationId: null, clipPathId: null,
    touchStartTime: 0, initialScrollLeft: 0
};

const TAP_THRESHOLD_MS = 300;
const isTouchDevice = window.matchMedia('(hover: none)').matches;

// --- 2. نظام تحميل الخرائط (الجروبات) ---
// 1. تعريف المتغيرات والصور لكل جروب
const groupLogos = {
    'A': 'image/logo-a.webp', // حط المسار الحقيقي لصور كل جروب
    'B': 'image/logo-b.webp',
    'C': 'image/logo-c.webp',
    'D': 'image/logo-d.webp',
    'default': 'image/o.webp'
};

// 2. تحديث دالة تحميل الخريطة
async function loadGroupMap(groupLetter) {
    // --- الجزء الجديد: تحديث الصور بناءً على الجروب ---
    const logoPath = groupLogos[groupLetter] || groupLogos['default'];
    
    // تحديث صورة الـ Splash
    const splashImg = document.getElementById('splash-image');
    if (splashImg) splashImg.src = logoPath;

    // تحديث أيقونة الموقع (Favicon)
    const favicon = document.getElementById('dynamic-favicon');
    if (favicon) favicon.href = logoPath;
    // -------------------------------------------

    document.getElementById('group-selector').style.display = 'none';
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.opacity = '1';

    try {
        const response = await fetch(`maps/group-${groupLetter}.svg`);
        if (!response.ok) throw new Error('File not found');
        const svgText = await response.text();

        const wrapper = document.getElementById('map-wrapper');
        wrapper.innerHTML = svgText;

        const mainSvg = wrapper.querySelector('svg');
        mainSvg.id = "main-svg"; 

        setupSiteFunctions(); 

    } catch (err) {
        alert("خطأ في تحميل خريطة الجروب.");
        document.getElementById('group-selector').style.display = 'flex';
        loadingOverlay.style.display = 'none';
    }
}

// --- 3. المحرك الرئيسي (Engine) ---
function setupSiteFunctions() {
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    if (!mainSvg) return;

    // إنشاء defs إذا لم يكن موجوداً لعمليات الـ ClipPath
    let clipDefs = mainSvg.querySelector('defs');
    if (!clipDefs) {
        clipDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        mainSvg.insertBefore(clipDefs, mainSvg.firstChild);
    }

    let loadedCount = 0;
    const images = mainSvg.querySelectorAll('image');

    // توحيد الـ ViewBox بناءً على عدد الصور
    const imgW = 1024;
    const imgH = 2454;
    mainSvg.setAttribute('viewBox', `0 0 ${images.length * imgW} ${imgH}`);

    images.forEach(si => {
        const actualSrc = si.getAttribute('data-src');
        if (actualSrc) {
            const imgObj = new Image();
            imgObj.onload = () => {
                si.setAttribute('href', actualSrc);
                loadedCount++;
                updateLoadingProgress(loadedCount, images.length);
                if (loadedCount === images.length) finishLoading();
            };
            imgObj.src = actualSrc;
        } else {
            loadedCount++;
            if (loadedCount === images.length) finishLoading();
        }
    });

    function finishLoading() {
        setTimeout(() => {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => { 
                loadingOverlay.style.display = 'none'; 
                mainSvg.style.opacity = '1'; 
                scan(); // تشغيل الماسح الضوئي للعناصر
                updateWoodInterface(); 
                // أقصى اليمين (بداية الخريطة في RTL)
                scrollContainer.scrollLeft = 0;
            }, 500);
        }, 600);
    }
}

// --- 4. وظائف الـ Scanner والـ Rects ---
function scan() {
    const mainSvg = document.getElementById('main-svg');
    if (!mainSvg) return;
    mainSvg.querySelectorAll('rect.image-mapper-shape, rect.m').forEach(r => processRect(r));
}

function processRect(r) {
    if (r.hasAttribute('data-processed')) return;

    // ضبط العرض الافتراضي للمربعات (اختياري حسب تصميمك)
    if(r.classList.contains('w')) r.setAttribute('width', '113.5');
    if(r.classList.contains('hw')) r.setAttribute('width', '56.75');

    const href = r.getAttribute('data-href') || '';
    const name = r.getAttribute('data-full-text') || (href !== '#' ? href.split('/').pop().split('#')[0].split('.').slice(0, -1).join('.') : '');
    const w = parseFloat(r.getAttribute('width')) || r.getBBox().width;
    const x = parseFloat(r.getAttribute('x')); 
    const y = parseFloat(r.getAttribute('y'));

    if (name && name.trim() !== '') {
        const fs = Math.max(8, Math.min(12, w * 0.11));
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', x + w / 2); txt.setAttribute('y', y + 2);
        txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('class', 'rect-label');
        txt.setAttribute('data-original-text', name); txt.setAttribute('data-original-for', href);
        txt.style.fontSize = fs + 'px'; txt.style.fill = 'white'; txt.style.pointerEvents = 'none'; txt.style.dominantBaseline = 'hanging';

        r.parentNode.appendChild(txt);
        wrapText(txt, w);

        const bbox = txt.getBBox();
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', x); bg.setAttribute('y', y); bg.setAttribute('width', w); bg.setAttribute('height', bbox.height + 8);
        bg.setAttribute('class', 'label-bg'); bg.setAttribute('data-original-for', href);
        bg.style.fill = 'black'; bg.style.pointerEvents = 'none';

        r.parentNode.insertBefore(bg, txt);
    }

    if (!isTouchDevice) {
        r.addEventListener('mouseover', startHover);
        r.addEventListener('mouseout', cleanupHover);
    }

    r.onclick = () => { if (href && href !== '#') smartOpen({path: href}); };

    r.addEventListener('touchstart', function(e) {
        if(!interactionEnabled) return;
        activeState.touchStartTime = Date.now();
        activeState.initialScrollLeft = document.getElementById('scroll-container').scrollLeft;
        startHover.call(this);
    });

    r.addEventListener('touchend', function(e) { 
        if (!interactionEnabled) return;
        const scrollDiff = Math.abs(document.getElementById('scroll-container').scrollLeft - activeState.initialScrollLeft);
        if (scrollDiff < 10 && (Date.now() - activeState.touchStartTime) < TAP_THRESHOLD_MS) {
            if (href && href !== '#') smartOpen({path: href});
        }
        cleanupHover();
    });

    r.setAttribute('data-processed', 'true');
}

// --- 5. منطق الـ Hover والـ Zoom والحركة ---
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
        document.getElementById('main-svg').querySelector('defs').appendChild(clip).appendChild(cRect);  

        const zPart = document.createElementNS('http://www.w3.org/2000/svg', 'image');  
        zPart.setAttribute('href', imgData.src);  
        zPart.setAttribute('width', imgData.width); zPart.setAttribute('height', imgData.height);  
        zPart.setAttribute('clip-path', `url(#${clipId})`);  
        zPart.setAttribute('x', imgData.tx); zPart.setAttribute('y', imgData.ty);  
        zPart.style.pointerEvents = 'none';  
        zPart.style.transformOrigin = `${centerX}px ${absY + rH/2}px`;  
        zPart.style.transform = `scale(${scaleFactor})`;  
        document.getElementById('main-svg').appendChild(zPart);  
        activeState.zoomPart = zPart;  
    }  

    let bText = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);  
    if (bText) {  
        bText.style.opacity = '0';  
        let bBg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);  
        if(bBg) bBg.style.opacity = '0';  
        activeState.baseText = bText; activeState.baseBg = bBg;  

        const zText = document.createElementNS('http://www.w3.org/2000/svg', 'text');  
        zText.textContent = rect.getAttribute('data-full-text') || bText.getAttribute('data-original-text');  
        zText.setAttribute('x', centerX); zText.setAttribute('text-anchor', 'middle');  
        zText.style.dominantBaseline = 'central'; zText.style.fill = 'white';  
        zText.style.fontWeight = 'bold'; zText.style.pointerEvents = 'none';  
        zText.style.fontSize = (parseFloat(bText.style.fontSize || 10) * 2) + 'px';  
        document.getElementById('main-svg').appendChild(zText);  

        const bbox = zText.getBBox();  
        const zBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');  
        zBg.setAttribute('x', centerX - (bbox.width + 20) / 2); zBg.setAttribute('y', hoveredY);  
        zBg.setAttribute('width', bbox.width + 20); zBg.setAttribute('height', bbox.height + 10);  
        zBg.setAttribute('rx', '5'); zBg.style.fill = 'black'; zBg.style.pointerEvents = 'none';  

        document.getElementById('main-svg').insertBefore(zBg, zText);  
        zText.setAttribute('y', hoveredY + (bbox.height + 10) / 2);
        activeState.zoomText = zText; activeState.zoomBg = zBg;  
    }  

    let h = 0; let step = 0; 
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

// --- 6. نظام الـ Wood (المكتبة) ---
async function updateWoodInterface() {
    const dynamicGroup = document.getElementById('dynamic-links-group');
    if (!dynamicGroup) return;
    dynamicGroup.innerHTML = ''; 
    await fetchGlobalTree();

    const backBtnText = document.getElementById('back-btn-text');
    if (currentFolder === "") {
        backBtnText.textContent = "➡️ إلى الخريطة ";
        const banner = document.createElementNS("http://www.w3.org/2000/svg", "image");
        banner.setAttribute("href", "image/logo-wood.webp"); 
        banner.setAttribute("x", "186.86"); banner.setAttribute("y", "1517.43"); 
        banner.setAttribute("width", "648.41"); banner.setAttribute("height", "276.04"); 
        banner.style.mixBlendMode = "multiply"; banner.style.opacity = "0.9";
        banner.style.pointerEvents = "none";
        dynamicGroup.appendChild(banner);
    } else {
        const pathParts = currentFolder.split('/');
        const breadcrumb = "الرئيسية > " + pathParts.join(' > ');
        backBtnText.textContent = breadcrumb.length > 35 ? `🔙 ... > ${pathParts.slice(-1)}` : `🔙 ${breadcrumb}`;
    }

    const folderPrefix = currentFolder ? currentFolder + '/' : '';
    const itemsMap = new Map();

    globalFileTree.forEach(item => {
        if (item.path.startsWith(folderPrefix)) {
            const relativePath = item.path.substring(folderPrefix.length);
            const pathParts = relativePath.split('/');
            const name = pathParts[0];

            if (!itemsMap.has(name) && name !== 'image' && name !== 'maps' && name !== '.github') {
                const isDir = pathParts.length > 1 || item.type === 'tree';
                const isPdf = item.path.toLowerCase().endsWith('.pdf');
                if (isDir) itemsMap.set(name, { name: name, type: 'dir', path: folderPrefix + name });
                else if (isPdf && pathParts.length === 1) itemsMap.set(name, { name: name, type: 'file', path: item.path });
            }
        }
    });

    const filteredData = Array.from(itemsMap.values());
    filteredData.forEach((item, index) => {
        const x = (index % 2 === 0) ? 120 : 550;
        const y = 250 + (Math.floor(index / 2) * 90);
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
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

        if (item.type === 'dir') {
            const count = globalFileTree.filter(f => f.path.startsWith(item.path + '/') && f.path.toLowerCase().endsWith('.pdf')).length;
            t.textContent = `📁 (${count}) ` + (cleanName.length > 15 ? cleanName.substring(0, 13) + ".." : cleanName);
        } else {
            t.textContent = "📄 " + (cleanName.length > 25 ? cleanName.substring(0, 22) + "..." : cleanName);
        }

        g.onclick = (e) => {
            e.stopPropagation();
            if (item.type === 'dir') { currentFolder = item.path; updateWoodInterface(); } 
            else { smartOpen(item); }
        };
        g.appendChild(r); g.appendChild(t);
        dynamicGroup.appendChild(g);
    });
}

// --- 7. وظائف عامة (Utilities) ---

function getCumulativeTranslate(el) {
    let x = 0, y = 0, curr = el;
    while (curr && curr.tagName !== 'svg') {
        const trans = curr.getAttribute('transform');
        if (trans) {
            const m = trans.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/);
            if (m) { x += parseFloat(m[1]); y += parseFloat(m[2]); }
        }
        curr = curr.parentNode;
    }
    return { x, y };
}

function getGroupImage(el) {
    let curr = el;
    while (curr && curr.tagName !== 'svg') {
        if (curr.tagName === 'g') {
            const img = curr.querySelector('image');
            if (img) {
                const trans = curr.getAttribute('transform')?.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/);
                return {
                    src: img.getAttribute('href') || img.getAttribute('data-src'),
                    width: img.getAttribute('width'), height: img.getAttribute('height'),
                    tx: trans ? trans[1] : 0, ty: trans ? trans[2] : 0
                };
            }
        }
        curr = curr.parentNode;
    }
    return null;
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

function updateLoadingProgress(loaded, total) {
    const p = (loaded / total) * 100;
    if(p >= 25) document.getElementById('bulb-4')?.classList.add('on');
    if(p >= 50) document.getElementById('bulb-3')?.classList.add('on');
    if(p >= 75) document.getElementById('bulb-2')?.classList.add('on');
    if(p === 100) document.getElementById('bulb-1')?.classList.add('on');
}

async function fetchGlobalTree() {
    if (globalFileTree.length > 0) return; 
    try {
        const response = await fetch(TREE_API_URL);
        const data = await response.json();
        globalFileTree = data.tree || [];
    } catch (err) { console.error("GitHub Tree Fetch Error", err); }
}

function smartOpen(item) {
    if(!item || !item.path) return;
    
    // بناء الرابط الكامل
    const url = item.path.startsWith('http') ? item.path : `${RAW_CONTENT_BASE}${item.path}`;
    const lowerUrl = url.toLowerCase();

    // لو ملف PDF، افتحه في الـ Overlay بتاعنا
    if(lowerUrl.endsWith('.pdf')) {
        document.getElementById("pdf-overlay").classList.remove("hidden");
        document.getElementById("pdfFrame").src = "https://mozilla.github.io/pdf.js/web/viewer.html?file=" + encodeURIComponent(url);
    } 
    // لو ملف SVG أو أي حاجة تانية، افتحه في تاب جديدة (الوضع الافتراضي للمتصفح)
    else {
        window.open(url, '_blank');
    }
}


// --- 8. الأحداث النهائية عند تحميل الصفحة ---
window.onload = function() {
    fetchGlobalTree();

    // أزرار مشغل الـ PDF
    const closeBtn = document.getElementById("closePdfBtn");
    if (closeBtn) {
        closeBtn.onclick = () => {
            document.getElementById("pdf-overlay").classList.add("hidden");
            document.getElementById("pdfFrame").src = "";
        };
    }

    const downloadBtn = document.getElementById("downloadBtn");
    if (downloadBtn) {
        downloadBtn.onclick = () => {
            const src = document.getElementById("pdfFrame").src;
            const match = src.match(/file=(.+)$/);
            if (match) {
                const a = document.createElement("a");
                a.href = decodeURIComponent(match[1]);
                a.download = a.href.split("/").pop();
                a.click();
            }
        };
    }

    const shareBtn = document.getElementById("shareBtn");
    if (shareBtn) {
        shareBtn.onclick = () => {
            const src = document.getElementById("pdfFrame").src;
            const match = src.match(/file=(.+)$/);
            if (match) {
                navigator.clipboard.writeText(decodeURIComponent(match[1]))
                    .then(() => alert("تم نسخ رابط الملف بنجاح!"))
                    .catch(() => alert("عذراً، لم يتم النسخ."));
            }
        };
    }

    // زر تبديل مكان واجهة البحث (أعلى/أسفل)
    const moveBtn = document.getElementById('move-toggle');
    if (moveBtn) {
        moveBtn.onclick = () => {
            const c = document.getElementById('js-toggle-container');
            c.classList.toggle('top'); c.classList.toggle('bottom');
        };
    }

    // زر تفعيل التفاعل (Interaction Switch)
    const jsToggle = document.getElementById('js-toggle');
    if (jsToggle) {
        jsToggle.onchange = (e) => {
            interactionEnabled = e.target.checked;
            if(!interactionEnabled) cleanupHover();
        };
    }

    // --- إصلاحات زر الرجوع والتمرير (Crucial Fixes) ---

    // 1. زر الرجوع في الخشب
    const woodBackBtn = document.getElementById('back-button-group');
    if (woodBackBtn) {
        woodBackBtn.onclick = (e) => {
            e.preventDefault();
            if (currentFolder !== "") {
                let parts = currentFolder.split('/');
                parts.pop();
                currentFolder = parts.join('/');
                updateWoodInterface();
            } else {
                // العودة لبداية الخريطة (أقصى اليمين في RTL)
                const container = document.getElementById('scroll-container');
                container.scrollTo({ left: 0, behavior: 'smooth' });
            }
        };
    }

    // 2. سهم الرجوع في شريط البحث (يذهب لأقصى اليسار)
    const searchBackIcon = document.getElementById('search-icon');
    if (searchBackIcon) {
        searchBackIcon.onclick = () => {
            const container = document.getElementById('scroll-container');
            // في نظام RTL، أقصى اليسار يكون قيمة سالبة تساوي عرض المحتوى
            container.scrollTo({ left: -container.scrollWidth, behavior: 'smooth' });
        };
    }

    // 3. منطق البحث وتصفية العناصر
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.oninput = (e) => {
            const query = e.target.value.toLowerCase().trim();
            document.querySelectorAll('rect.m').forEach(r => {
                const h = (r.getAttribute('data-href')||"").toLowerCase();
                const t = (r.getAttribute('data-full-text')||"").toLowerCase();
                const match = h.includes(query) || t.includes(query);
                
                r.style.display = (query !== "" && !match) ? "none" : "block";
                const lbl = r.parentNode.querySelector(`.rect-label[data-original-for='${r.dataset.href}']`);
                const bg = r.parentNode.querySelector(`.label-bg[data-original-for='${r.dataset.href}']`);
                if(lbl) lbl.style.display = r.style.display;
                if(bg) bg.style.display = r.style.display;
            });
        };
    }

    // حماية الخريطة من الضغط المطول والقائمة المنبثقة
    document.addEventListener('contextmenu', e => {
        if (e.target.closest('#main-svg') || e.target.closest('image')) {
            e.preventDefault();
        }
    }, false);
};
