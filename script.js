let SELECTED_GROUP = null;
let globalFileTree = [];
let currentFolder = ""; 

const GROUP_CONFIG = {
    B: { svg: "groups/group-B.svg", logo: "image/logo-B.webp" },
    A: { svg: "groups/group-A.svg", logo: "image/logo-A.webp" },
    D: { svg: "groups/group-D.svg", logo: "image/logo-D.webp" },
    C: { svg: "groups/group-C.svg", logo: "image/logo-C.webp" }
};

let activeState = {
    rect: null, zoomPart: null, zoomText: null, zoomBg: null,
    baseText: null, baseBg: null, animationId: null, clipPathId: null,
    touchStartTime: 0, initialScrollLeft: 0
};

const REPO_NAME = "semester-3";
const GITHUB_USER = "MUE24Med";
const TREE_API_URL = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/git/trees/main?recursive=1`;
const RAW_CONTENT_BASE = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/`;
const TAP_THRESHOLD_MS = 300;

/* --- 2. وظائف النظام الأساسية --- */

async function fetchGlobalTree() {
    if (globalFileTree.length > 0) return;
    try {
        const response = await fetch(TREE_API_URL);
        const data = await response.json();
        globalFileTree = data.tree || [];
    } catch (err) { console.error("GitHub Error:", err); }
}

async function loadGroupSVG(groupKey) {
    const cfg = GROUP_CONFIG[groupKey];
    if (!cfg) return;
    const splashImg = document.getElementById("splash-image");
    if (splashImg) splashImg.src = cfg.logo;
    const res = await fetch(cfg.svg);
    const svgText = await res.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
    const mainSvg = document.getElementById("main-svg");
    const defs = mainSvg.querySelector("defs")?.outerHTML || "<defs></defs>";
    mainSvg.innerHTML = `${defs}${svgDoc.documentElement.innerHTML}`;
}

async function autoLoadGroup() {
    const saved = localStorage.getItem("selectedGroup");
    if (!saved || !GROUP_CONFIG[saved]) return false;
    const selector = document.getElementById("group-selector");
    if (selector) selector.remove();
    SELECTED_GROUP = saved;
    await loadGroupSVG(saved);
    return true;
}

function initGroupSelector() {
    const selector = document.getElementById("group-selector");
    if (!selector) return;
    selector.querySelectorAll("button[data-group]").forEach(btn => {
        btn.onclick = async () => {
            SELECTED_GROUP = btn.dataset.group;
            localStorage.setItem("selectedGroup", SELECTED_GROUP);
            selector.remove();
            await loadGroupSVG(SELECTED_GROUP);
            location.reload(); 
        };
    });
}

function addChangeGroupButton() {
    const btn = document.createElement("button");
    btn.textContent = "Change Group";
    btn.style.cssText = `position:fixed;bottom:20px;right:20px;z-index:99999;padding:10px 16px;border-radius:10px;border:none;font-weight:bold;background:#222;color:#fff;cursor:pointer;`;
    btn.onclick = () => { localStorage.removeItem("selectedGroup"); location.reload(); };
    document.body.appendChild(btn);
}

/* --- 3. دالة window.onload الشاملة (بدون تبسيط) --- */

window.onload = async function () {
    const loaded = await autoLoadGroup();
    if (!loaded) initGroupSelector();
    addChangeGroupButton();

    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    const searchIcon = document.getElementById('search-icon');
    const backButtonGroup = document.getElementById('back-button-group');
    const backBtnText = document.getElementById('back-btn-text');
    const changeGroupTrigger = document.getElementById('change-group-trigger');
    const clipDefs = mainSvg.querySelector('defs');

    let interactionEnabled = jsToggle ? jsToggle.checked : true;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;

    // دوال التمرير (القيم الأصلية لـ RTL)
    const goToWood = () => { scrollContainer.scrollTo({ left: -20000, behavior: 'smooth' }); };
    const goToMapEnd = () => { scrollContainer.scrollTo({ left: 10000, behavior: 'smooth' }); };

    // زر الرجوع والتبديل الذكي
    if (backButtonGroup) {
        backButtonGroup.onclick = (e) => {
            e.preventDefault();
            if (currentFolder !== "") {
                let parts = currentFolder.split('/');
                parts.pop();
                currentFolder = parts.join('/');
                updateWoodInterface();
            } else {
                goToMapEnd();
            }
        };
    }

    if (changeGroupTrigger) {
        changeGroupTrigger.onclick = (e) => {
            e.preventDefault();
            localStorage.removeItem("selectedGroup");
            location.reload();
        };
    }

    if (searchIcon) searchIcon.onclick = (e) => { e.preventDefault(); goToWood(); };

    // تحميل الصور ونظام Bulb
    let loadedCount = 0;
    const images = mainSvg.querySelectorAll('image');
    const urls = Array.from(images).map(img => img.getAttribute('data-src')).filter(src => src);

    urls.forEach((u) => {
        const img = new Image();
        img.onload = img.onerror = () => {
            loadedCount++;
            const p = (loadedCount / urls.length) * 100;
            if(p >= 25) document.getElementById('bulb-4')?.classList.add('on');
            if(p >= 50) document.getElementById('bulb-3')?.classList.add('on');
            if(p >= 75) document.getElementById('bulb-2')?.classList.add('on');
            if (loadedCount === urls.length) {
                document.getElementById('bulb-1')?.classList.add('on');
                mainSvg.querySelectorAll('image').forEach(si => {
                    const actualSrc = si.getAttribute('data-src');
                    if(actualSrc) si.setAttribute('href', actualSrc);
                });
                setTimeout(() => {
                    if (loadingOverlay) {
                        loadingOverlay.style.opacity = '0';
                        setTimeout(() => { 
                            loadingOverlay.style.display = 'none'; 
                            mainSvg.style.opacity = '1';
                            updateDynamicSizes(); scan(); updateWoodInterface(); goToMapEnd(); 
                        }, 500);
                    }
                }, 600);
            }
        };
        img.src = u;
    });

    // البحث
    searchInput.addEventListener('input', debounce(function(e) {
        const query = e.target.value.toLowerCase().trim();
        mainSvg.querySelectorAll('rect.m:not(.list-item)').forEach(rect => {
            const h = rect.getAttribute('data-href') || '';
            const t = rect.getAttribute('data-full-text') || '';
            const isMatch = h.toLowerCase().includes(query) || t.toLowerCase().includes(query);
            rect.style.display = (query.length > 0 && !isMatch) ? 'none' : '';
            const label = rect.parentNode.querySelector(`.rect-label[data-original-for='${h}']`);
            const bg = rect.parentNode.querySelector(`.label-bg[data-original-for='${h}']`);
            if(label) label.style.display = rect.style.display;
            if(bg) bg.style.display = rect.style.display;
        });
        applyWoodSearchFilter();
    }, 150));

    if (jsToggle) jsToggle.addEventListener('change', function() { interactionEnabled = this.checked; if(!interactionEnabled) cleanupHover(); });
    mainSvg.addEventListener('contextmenu', e => e.preventDefault(), false);
};

/* --- 4. الدوال المساعدة المعقدة (بدون حذف) --- */

async function updateWoodInterface() {
    const dynamicGroup = document.getElementById('dynamic-links-group');
    const backBtnText = document.getElementById('back-btn-text');
    if (!dynamicGroup) return;
    dynamicGroup.innerHTML = ''; 
    await fetchGlobalTree();

    if (currentFolder === "") {
        if (backBtnText) backBtnText.textContent = "إلى الخريطة ←";
        const banner = document.createElementNS("http://www.w3.org/2000/svg", "image");
        banner.setAttribute("href", "image/logo-wood.webp"); 
        banner.setAttribute("x", "186.86"); banner.setAttribute("y", "1517.43"); 
        banner.setAttribute("width", "648.41"); banner.setAttribute("height", "276.04"); 
        banner.style.mixBlendMode = "multiply"; banner.style.opacity = "0.9";
        banner.style.pointerEvents = "none";
        dynamicGroup.appendChild(banner);
    } else {
        const parts = currentFolder.split('/');
        if (backBtnText) backBtnText.textContent = `🔙 ... > ${parts[parts.length-1]}`;
    }

    const folderPrefix = currentFolder ? currentFolder + '/' : '';
    const itemsMap = new Map();

    globalFileTree.forEach(item => {
        if (item.path.startsWith(folderPrefix)) {
            const relativePath = item.path.substring(folderPrefix.length);
            const pathParts = relativePath.split('/');
            const name = pathParts[0];
            if (!itemsMap.has(name) && name !== 'image') {
                const isDir = pathParts.length > 1 || item.type === 'tree';
                const isPdf = item.path.toLowerCase().endsWith('.pdf');
                if (isDir) itemsMap.set(name, { name, type: 'dir', path: folderPrefix + name });
                else if (isPdf && pathParts.length === 1) itemsMap.set(name, { name, type: 'file', path: item.path });
            }
        }
    });

    Array.from(itemsMap.values()).forEach((item, index) => {
        const x = (index % 2 === 0) ? 120 : 550;
        const y = 250 + (Math.floor(index / 2) * 90);
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", item.type === 'dir' ? "wood-folder-group" : "wood-file-group");
        g.style.cursor = "pointer";

        const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", "350"); r.setAttribute("height", "70"); r.setAttribute("rx", "12");
        r.style.fill = item.type === 'dir' ? "#5d4037" : "rgba(0,0,0,0.8)";
        r.style.stroke = "#fff";

        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", x + 175); t.setAttribute("y", y + 42); t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "white");
        t.style.fontWeight = "bold"; t.style.fontSize = "17px";
        t.textContent = (item.type === 'dir' ? "📁 " : "📄 ") + (item.name.length > 20 ? item.name.substring(0, 18) + ".." : item.name);

        g.appendChild(r); g.appendChild(t);
        g.onclick = (e) => { 
            e.stopPropagation(); 
            if (item.type === 'dir') { currentFolder = item.path; updateWoodInterface(); } 
            else { smartOpen(item); }
        };
        dynamicGroup.appendChild(g);
    });
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
    
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    if (!isTouchDevice) { r.addEventListener('mouseover', startHover); r.addEventListener('mouseout', cleanupHover); }
    r.onclick = () => { if (href && href !== '#') window.open(href, '_blank'); };
    r.addEventListener('touchstart', function(e) { if(!interactionEnabled) return; activeState.touchStartTime = Date.now(); activeState.initialScrollLeft = document.getElementById('scroll-container').scrollLeft; startHover.call(this); });
    r.addEventListener('touchend', function(e) { 
        if (!interactionEnabled) return;
        const sDiff = Math.abs(document.getElementById('scroll-container').scrollLeft - activeState.initialScrollLeft);
        if (sDiff < 10 && (Date.now() - activeState.touchStartTime) < TAP_THRESHOLD_MS) { if (href && href !== '#') window.open(href, '_blank'); }
        cleanupHover();
    });
    r.setAttribute('data-processed', 'true');
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
    const hoveredY = absY - ((rH * (scaleFactor - 1)) / 2);

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
        const mTrans = imgData.group.getAttribute('transform')?.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/);
        zPart.setAttribute('x', mTrans ? mTrans[1] : 0); zPart.setAttribute('y', mTrans ? mTrans[2] : 0);
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
        zText.textContent = rect.getAttribute('data-full-text') || bText.getAttribute('data-original-text') || "";
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
        h = (h + 10) % 360; step += 0.2;
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
    Object.assign(activeState, { rect: null, zoomPart: null, zoomText: null, zoomBg: null, baseText: null, baseBg: null, animationId: null, clipPathId: null });
}

function smartOpen(item) {
    if(!item || !item.path) return;
    const url = `${RAW_CONTENT_BASE}${item.path}`;
    if(url.endsWith('.pdf')) {
        const overlay = document.getElementById("pdf-overlay");
        const pdfViewer = document.getElementById("pdfFrame");
        overlay.classList.remove("hidden");
        pdfViewer.src = "https://mozilla.github.io/pdf.js/web/viewer.html?file=" + encodeURIComponent(url) + "#zoom=page-width"; 
    } else { window.open(url, '_blank'); }
}

function getGroupImage(element) {
    let current = element;
    while (current && current.tagName !== 'svg') {
        if (current.tagName === 'g') {
            const imgs = [...current.children].filter(c => c.tagName === 'image');
            if (imgs.length) return { src: imgs[0].getAttribute('data-src') || imgs[0].getAttribute('href'), width: parseFloat(imgs[0].getAttribute('width')), height: parseFloat(imgs[0].getAttribute('height')), group: current };
        }
        current = current.parentNode;
    }
    return null;
}

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

function wrapText(el, maxW) {
    const txt = el.getAttribute('data-original-text'); if(!txt) return;
    const words = txt.split(/\s+/); el.textContent = '';
    let ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    ts.setAttribute('x', el.getAttribute('x')); ts.setAttribute('dy', '0');
    el.appendChild(ts); let line = '';
    const lh = parseFloat(el.style.fontSize) * 1.1;
    words.forEach(word => {
        let test = line + (line ? ' ' : '') + word; ts.textContent = test;
        if (ts.getComputedTextLength() > maxW - 5 && line) {
            ts.textContent = line; ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            ts.setAttribute('x', el.getAttribute('x')); ts.setAttribute('dy', lh + 'px');
            ts.textContent = word; el.appendChild(ts); line = word;
        } else { line = test; }
    });
}

function applyWoodSearchFilter() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    document.querySelectorAll('.wood-file-group').forEach(group => {
        const name = group.querySelector('text').textContent.toLowerCase();
        group.style.display = (query === "" || name.includes(query)) ? 'inline' : 'none';
    });
}

function updateDynamicSizes() {
    const mainSvg = document.getElementById('main-svg');
    const images = mainSvg.querySelectorAll('image');
    if (!images.length) return;
    mainSvg.setAttribute('viewBox', `0 0 ${images.length * 1024} 2454`);
}

function scan() { document.getElementById('main-svg').querySelectorAll('rect.image-mapper-shape, rect.m').forEach(r => processRect(r)); }

function debounce(func, delay) {
    let tId; return function() { const context = this; const args = arguments; clearTimeout(tId); tId = setTimeout(() => func.apply(context, args), delay); }
}