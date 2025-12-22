const REPO_NAME = "semester-3"; 
const GITHUB_USER = "MUE24Med";
const RAW_CONTENT_BASE = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/`;
const TREE_API_URL = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/git/trees/main?recursive=1`;

let globalFileTree = []; 
let currentGroup = ""; 

const groupLogos = {
    'A': 'image/logo-a.webp',
    'B': 'image/logo-b.webp',
    'C': 'image/logo-c.webp',
    'D': 'image/logo-d.webp'
};

// الدالة الأساسية لبدء التطبيق
async function initApp(groupLetter) {
    currentGroup = groupLetter.toUpperCase();
    document.getElementById('group-overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    document.getElementById('loading-overlay').style.display = 'flex';

    try {
        const response = await fetch(`./maps/group-${groupLetter.toLowerCase()}.svg`);
        const svgText = await response.text();
        const wrapper = document.getElementById('map-wrapper');
        wrapper.innerHTML = svgText;
        const svgElement = wrapper.querySelector('svg');
        svgElement.id = 'main-svg';

        // تشغيل المنطق الأصلي بالكامل
        startOriginalLogic();
    } catch (err) {
        alert("خطأ في تحميل خريطة المجموعة: " + err);
    }
}

function startOriginalLogic() {
    const mainSvg = document.getElementById('main-svg');
    let loadedCount = 0;
    const scrollContainer = document.getElementById('scroll-container');
    const clipDefs = mainSvg.querySelector('defs') || mainSvg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'defs'));
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    const searchIcon = document.getElementById('search-icon');
    const moveToggle = document.getElementById('move-toggle');
    const toggleContainer = document.getElementById('js-toggle-container');

    let activeState = {
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,
        baseText: null, baseBg: null, animationId: null, clipPathId: null,
        touchStartTime: 0, initialScrollLeft: 0
    };

    let currentFolder = ""; 
    let interactionEnabled = jsToggle.checked;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    // --- 1. الدوال المساعدة الأصلية ---

    function smartOpen(item) {
        if(!item || !item.path) return;
        const url = item.path.startsWith('http') ? item.path : `${RAW_CONTENT_BASE}${item.path}`;
        const lowerUrl = url.toLowerCase();
        if(lowerUrl.endsWith('.pdf')) {
            const overlay = document.getElementById("pdf-overlay");
            const pdfViewer = document.getElementById("pdfFrame");
            overlay.classList.remove("hidden");
            pdfViewer.src = "https://mozilla.github.io/pdf.js/web/viewer.html?file=" + 
                            encodeURIComponent(url) + "#zoom=page-width"; 
        } else {
            window.open(url, '_blank');
        }
    }

    const goToWood = () => {
        scrollContainer.scrollTo({ left: -scrollContainer.scrollWidth, behavior: 'smooth' });
    };

    const goToMapEnd = () => {
        scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
    };

    // --- 2. إدارة واجهة الخشب (Wood) ---

    async function fetchGlobalTree() {
        if (globalFileTree.length > 0) return; 
        try {
            const response = await fetch(TREE_API_URL);
            const data = await response.json();
            globalFileTree = data.tree || [];
        } catch (err) { console.error(err); }
    }

    async function updateWoodInterface() {
        const dynamicGroup = mainSvg.getElementById('dynamic-links-group');
        const backBtnText = mainSvg.getElementById('back-btn-text');
        if (!dynamicGroup) return;
        dynamicGroup.innerHTML = ''; 
        await fetchGlobalTree();

        if (currentFolder === "") {
            if (backBtnText) backBtnText.textContent = `خريطة مجموعة ${currentGroup} ←`;
            const banner = document.createElementNS("http://www.w3.org/2000/svg", "image");
            banner.setAttribute("href", groupLogos[currentGroup] || "image/o.webp"); 
            banner.setAttribute("x", "186.86"); banner.setAttribute("y", "1517.43"); 
            banner.setAttribute("width", "648.41"); banner.setAttribute("height", "276.04"); 
            banner.style.mixBlendMode = "multiply"; banner.style.opacity = "0.9";
            banner.style.pointerEvents = "none";
            dynamicGroup.appendChild(banner);
        } else {
            const pathParts = currentFolder.split('/');
            if (backBtnText) backBtnText.textContent = `🔙 رجوع من (${pathParts[pathParts.length - 1]})`;
        }

        const folderPrefix = currentFolder ? currentFolder + '/' : '';
        const itemsMap = new Map();

        globalFileTree.forEach(item => {
            if (item.path.startsWith(folderPrefix)) {
                const relativePath = item.path.substring(folderPrefix.length);
                const pathParts = relativePath.split('/');
                const name = pathParts[0];
                if (!itemsMap.has(name) && name !== 'image' && name !== 'maps') {
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
                const count = globalFileTree.filter(f => f.path.startsWith(item.path + '/') && f.path.toLowerCase().endsWith('.pdf')).length;
                t.textContent = `📁 (${count}) ` + (cleanName.length > 15 ? cleanName.substring(0, 13) + ".." : cleanName);
            } else { t.textContent = "📄 " + (cleanName.length > 25 ? cleanName.substring(0, 22) + "..." : cleanName); }

            g.appendChild(r); g.appendChild(t);
            g.onclick = (e) => {
                e.stopPropagation();
                if (item.type === 'dir') { currentFolder = item.path; updateWoodInterface(); } 
                else { smartOpen(item); }
            };
            dynamicGroup.appendChild(g);
        });
    }

    // --- 3. معالجة الـ Rects وتنسيق النصوص (بدون تبسيط) ---

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
                if (imgs.length && imgs[0].getAttribute('width') == "1024") return {
                    src: imgs[0].getAttribute('href'),
                    width: parseFloat(imgs[0].getAttribute('width')),
                    height: parseFloat(imgs[0].getAttribute('height')),
                    group: current
                };
            }
            current = current.parentNode;
        }
        return null;
    }

    // --- 4. تأثيرات الـ Hover (بدون تبسيط) ---

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
            zBg.setAttribute('x', centerX - (bbox.width + 20) / 2); zBg.setAttribute('y', hoveredY - bbox.height);  
            zBg.setAttribute('width', bbox.width + 20); zBg.setAttribute('height', bbox.height + 10);  
            zBg.setAttribute('rx', '5'); zBg.style.fill = 'black'; zBg.style.pointerEvents = 'none';  

            mainSvg.insertBefore(zBg, zText);  
            zText.setAttribute('y', (hoveredY - bbox.height) + (bbox.height + 10) / 2);
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

    // --- 5. ربط العناصر (Events) ---

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
        r.onclick = () => { if (href && href !== '#') smartOpen({path: href}); };

        r.addEventListener('touchstart', function(e) { 
            if(!interactionEnabled) return; 
            activeState.touchStartTime = Date.now(); 
            activeState.initialScrollLeft = scrollContainer.scrollLeft; 
            startHover.call(this); 
        });
        r.addEventListener('touchend', function(e) { 
            if (!interactionEnabled) return;
            if (Math.abs(scrollContainer.scrollLeft - activeState.initialScrollLeft) < 10 && (Date.now() - activeState.touchStartTime) < TAP_THRESHOLD_MS) {
                if (href && href !== '#') smartOpen({path: href});
            }
            cleanupHover();
        });
        r.setAttribute('data-processed', 'true');
    }

    // --- 6. الإطلاق النهائي للـ SVG الجديد ---

    function scan() { mainSvg.querySelectorAll('rect.m').forEach(r => processRect(r)); }

    const images = Array.from(mainSvg.querySelectorAll('image'));
    const urls = images.map(img => img.getAttribute('data-src')).filter(s => s);

    if (urls.length === 0) { finishLoading(); } else {
        urls.forEach((u) => {
            const img = new Image();
            img.onload = img.onerror = () => {
                loadedCount++;
                if(loadedCount === urls.length) finishLoading();
            };
            img.src = u;
        });
    }

    function finishLoading() {
        mainSvg.querySelectorAll('image').forEach(si => {
            const actualSrc = si.getAttribute('data-src');
            if(actualSrc) si.setAttribute('href', actualSrc);
        });
        
        // تحديث مقاس الـ SVG ليدعم التمرير الأفقي بناءً على الصور
        const weeks = Array.from(mainSvg.querySelectorAll('image')).filter(i => i.getAttribute('width') == "1024").length;
        const totalWidth = weeks * 1024;
        mainSvg.setAttribute('viewBox', `0 0 ${totalWidth} 2454`);
        mainSvg.style.width = `${totalWidth}px`;

        setTimeout(() => {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => { 
                loadingOverlay.style.display = 'none'; 
                mainSvg.style.opacity = '1'; 
                scan(); updateWoodInterface(); goToMapEnd(); 
            }, 500);
        }, 600);
    }

    // التحكم بالواجهة
    searchIcon.onclick = goToWood;
    moveToggle.onclick = () => {
        toggleContainer.classList.toggle('top');
        toggleContainer.classList.toggle('bottom');
    };

    const backButtonGroup = mainSvg.getElementById('back-button-group');
    if (backButtonGroup) {
        backButtonGroup.onclick = () => { 
            if (currentFolder !== "") { 
                let parts = currentFolder.split('/'); parts.pop(); currentFolder = parts.join('/'); 
                updateWoodInterface(); 
            } else { goToMapEnd(); } 
        };
    }

    jsToggle.onchange = () => { interactionEnabled = jsToggle.checked; if(!interactionEnabled) cleanupHover(); };
    
    searchInput.oninput = (e) => {
        const query = e.target.value.toLowerCase().trim();
        mainSvg.querySelectorAll('rect.m:not(.list-item)').forEach(rect => {
            const h = (rect.getAttribute('data-href') || '').toLowerCase();
            const t = (rect.getAttribute('data-full-text') || '').toLowerCase();
            const isMatch = h.includes(query) || t.includes(query);
            rect.style.display = (query.length > 0 && !isMatch) ? 'none' : '';
        });
    };
}

// أزرار عارض PDF
document.getElementById("closePdfBtn").onclick = () => {
    document.getElementById("pdf-overlay").classList.add("hidden");
    document.getElementById("pdfFrame").src = "";
};