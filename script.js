/* --- 1. الإعدادات والمتغيرات العالمية (بكامل التعقيد) --- */
const REPO_NAME = "semester-3"; 
const GITHUB_USER = "MUE24Med";

// استخراج المجموعة المختارة أو تعيين افتراضي
let SELECTED_GROUP = localStorage.getItem("selectedGroup") || "B"; 

const GROUP_RESOURCES = {
    mainLogo: `image/logo-${SELECTED_GROUP}.webp`,
    woodLogo: `image/logo-wood-${SELECTED_GROUP}.webp`,
    svgPath: `groups/group-${SELECTED_GROUP}.svg`
};

const NEW_API_BASE = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents`;
const TREE_API_URL = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/git/trees/main?recursive=1`;
const RAW_CONTENT_BASE = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/`;

let globalFileTree = []; 

/* --- 2. وظيفة اختيار المجموعة وتفعيل التحميل --- */
// هذا الجزء هو المسؤول عن "الانتقال لشاشة التحميل"
document.querySelectorAll('.group-btn').forEach(btn => {
    btn.onclick = function() {
        const group = this.getAttribute('data-group');
        localStorage.setItem("selectedGroup", group);
        
        // إخفاء واجهة الاختيار (إن وجدت) وإظهار شاشة التحميل
        const selectionUI = document.getElementById('group-selection-overlay');
        if(selectionUI) selectionUI.style.display = 'none';
        
        const loadingOverlay = document.getElementById('loading-overlay');
        if(loadingOverlay) loadingOverlay.style.display = 'flex';
        
        // إعادة تحميل الصفحة لتطبيق الصور الجديدة للمجموعة
        location.reload();
    };
});

/* --- 3. دالة جلب البيانات --- */
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

/* --- 4. وظائف الـ PDF والأزرار (مطابق لكودك) --- */
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
            .then(() => alert("رابط الملف تم نسخه إلى الحافظة!"))
            .catch(() => alert("فشل نسخ الرابط."));
    }
};

/* --- 5. Window.Onload (نظام التحميل، الهافر، والبحث المتقدم) --- */
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

    // تحديث لوجو التحميل فوراً بناءً على المجموعة
    const splashImg = document.getElementById("splash-image");
    if(splashImg) splashImg.src = GROUP_RESOURCES.mainLogo;

    let activeState = {
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,
        baseText: null, baseBg: null, animationId: null, clipPathId: null,
        touchStartTime: 0, initialScrollLeft: 0
    };

    let currentFolder = ""; 
    let interactionEnabled = jsToggle ? jsToggle.checked : true;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    function smartOpen(item) {
        if(!item || !item.path) return;
        const url = `${RAW_CONTENT_BASE}${item.path}`;
        if(url.endsWith('.pdf')) {
            const overlay = document.getElementById("pdf-overlay");
            const pdfViewer = document.getElementById("pdfFrame");
            overlay.classList.remove("hidden");
            pdfViewer.src = "https://mozilla.github.io/pdf.js/web/viewer.html?file=" + 
                            encodeURIComponent(url) + "#zoom=page-width"; 
        } else { window.open(url, '_blank'); }
    }

    const goToWood = () => { scrollContainer.scrollTo({ left: -scrollContainer.scrollWidth, behavior: 'smooth' }); };
    const goToMapEnd = () => { scrollContainer.scrollTo({ left: 0, behavior: 'smooth' }); };

    const handleGoToWood = (e) => { e.preventDefault(); goToWood(); };
    if(searchIcon) searchIcon.onclick = handleGoToWood;

    if(searchInput) {
        searchInput.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); goToWood(); } };
    }

    if(moveToggle) {
        moveToggle.onclick = (e) => {
            e.preventDefault();
            toggleContainer.classList.contains('top') ? toggleContainer.classList.replace('top', 'bottom') : toggleContainer.classList.replace('bottom', 'top');
        };
    }

    if(backButtonGroup) {
        backButtonGroup.onclick = () => { 
            if (currentFolder !== "") { 
                let parts = currentFolder.split('/'); parts.pop(); currentFolder = parts.join('/'); 
                updateWoodInterface(); 
            } else { goToMapEnd(); } 
        };
    }

    function getCumulativeTranslate(element) {
        let x = 0, y = 0, curr = element;
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

    function getGroupImage(element) {
        let curr = element;
        while (curr && curr.tagName !== 'svg') {
            if (curr.tagName === 'g') {
                const imgs = [...curr.children].filter(c => c.tagName === 'image');
                if (imgs.length) return {
                    src: imgs[0].getAttribute('data-src') || imgs[0].getAttribute('href'),
                    width: parseFloat(imgs[0].getAttribute('width')),
                    height: parseFloat(imgs[0].getAttribute('height')),
                    group: curr
                };
            }
            curr = curr.parentNode;
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
        Object.assign(activeState, { rect: null, zoomPart: null, zoomText: null, zoomBg: null, baseText: null, baseBg: null, animationId: null, clipPathId: null });
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
        const hoveredY = absY - (rH * (scaleFactor - 1)) / 2;

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

        let h = 0; let step = 0; 
        activeState.animationId = setInterval(() => {  
            h = (h + 10) % 360; step += 0.2;         
            const glowPower = 10 + Math.sin(step) * 5; 
            const color = `hsl(${h},100%,60%)`;
            rect.style.filter = `drop-shadow(0 0 ${glowPower}px ${color})`;  
            if (activeState.zoomPart) activeState.zoomPart.style.filter = `drop-shadow(0 0 ${glowPower}px ${color})`;
            if (activeState.zoomBg) activeState.zoomBg.style.stroke = color;  
        }, 100);
    }

    async function updateWoodInterface() {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        if (!dynamicGroup) return;
        dynamicGroup.innerHTML = ''; 
        await fetchGlobalTree();

        // لوجو الخشب الديناميكي (B)
        const banner = document.createElementNS("http://www.w3.org/2000/svg", "image");
        banner.setAttribute("href", GROUP_RESOURCES.woodLogo); 
        banner.setAttribute("x", "186.86"); banner.setAttribute("y", "1517.43"); 
        banner.setAttribute("width", "648.41"); banner.setAttribute("height", "276.04"); 
        banner.style.mixBlendMode = "multiply"; banner.style.opacity = "0.9"; banner.style.pointerEvents = "none";
        dynamicGroup.appendChild(banner);

        if (currentFolder === "") { backBtnText.textContent = "إلى الخريطة ←"; } 
        else { backBtnText.textContent = `🔙 ${currentFolder.split('/').pop()}`; }

        const folderPrefix = currentFolder ? currentFolder + '/' : '';
        const itemsMap = new Map();
        globalFileTree.forEach(item => {
            if (item.path.startsWith(folderPrefix)) {
                const relativePath = item.path.substring(folderPrefix.length);
                const pathParts = relativePath.split('/');
                const name = pathParts[0];
                if (!itemsMap.has(name) && name !== 'image') {
                    const isDir = pathParts.length > 1 || item.type === 'tree';
                    if (isDir) itemsMap.set(name, { name, type: 'dir', path: folderPrefix + name });
                    else if (item.path.toLowerCase().endsWith('.pdf')) itemsMap.set(name, { name, type: 'file', path: item.path });
                }
            }
        });

        Array.from(itemsMap.values()).forEach((item, index) => {
            const x = (index % 2 === 0) ? 120 : 550;
            const y = 250 + (Math.floor(index / 2) * 90);
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", "350"); r.setAttribute("height", "70"); r.setAttribute("rx", "12");
            r.setAttribute("class", "list-item");
            r.style.fill = item.type === 'dir' ? "#5d4037" : "rgba(0,0,0,0.8)";
            r.style.stroke = "#fff";
            const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
            t.setAttribute("x", x + 175); t.setAttribute("y", y + 42); t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "white");
            t.style.fontWeight = "bold"; t.style.fontSize = "17px";
            t.textContent = (item.type === 'dir' ? "📁 " : "📄 ") + item.name.replace(/\.[^/.]+$/, "");
            g.appendChild(r); g.appendChild(t);
            g.onclick = (e) => { e.stopPropagation(); if (item.type === 'dir') { currentFolder = item.path; updateWoodInterface(); } else { smartOpen(item); } };
            dynamicGroup.appendChild(g);
        });
    }

    function scan() { mainSvg.querySelectorAll('rect.image-mapper-shape, rect.m').forEach(r => processRect(r)); }

    function processRect(r) {
        if (r.hasAttribute('data-processed')) return;
        const href = r.getAttribute('data-href') || '';
        if (!isTouchDevice) { r.addEventListener('mouseover', startHover); r.addEventListener('mouseout', cleanupHover); }
        r.onclick = () => { if (href && href !== '#') window.open(href, '_blank'); };
        r.setAttribute('data-processed', 'true');
    }

    // منطق التحميل واللمبات
    const urls = Array.from(mainSvg.querySelectorAll('image')).map(img => img.getAttribute('data-src')).filter(s => s);
    urls.forEach(u => {
        const img = new Image();
        img.onload = img.onerror = () => {
            loadedCount++;
            const p = (loadedCount / urls.length) * 100;
            if(p >= 25) document.getElementById('bulb-4')?.classList.add('on');
            if(p >= 50) document.getElementById('bulb-3')?.classList.add('on');
            if(p >= 75) document.getElementById('bulb-2')?.classList.add('on');
            if(loadedCount === urls.length) {
                document.getElementById('bulb-1')?.classList.add('on');
                mainSvg.querySelectorAll('image').forEach(si => { if(si.dataset.src) si.setAttribute('href', si.dataset.src); });
                setTimeout(() => {
                    loadingOverlay.style.opacity = '0';
                    setTimeout(() => { loadingOverlay.style.display = 'none'; scan(); updateWoodInterface(); goToMapEnd(); }, 500);
                }, 600);
            }
        };
        img.src = u;
    });

    function debounce(func, delay) { let t; return function() { clearTimeout(t); t = setTimeout(() => func.apply(this, arguments), delay); } }
};
