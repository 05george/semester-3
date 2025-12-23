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

let activeState = {
    rect: null, zoomPart: null, zoomText: null, zoomBg: null,
    baseText: null, baseBg: null, animationId: null, clipPathId: null,
    touchStartTime: 0, initialScrollLeft: 0
};

// ===== نظام المراقبة الشامل للتحميل =====
const loadingMonitor = {
    total: 0,
    loaded: 0,
    resources: new Map(),
    
    init() {
        this.total = 0;
        this.loaded = 0;
        this.resources.clear();
        this.resetBulbs();
    },
    
    resetBulbs() {
        document.querySelectorAll('.light-bulb').forEach(bulb => bulb.classList.remove('on'));
    },
    
    addResource(id, type) {
        if (!this.resources.has(id)) {
            this.resources.set(id, { type, loaded: false });
            this.total++;
            console.log(`📦 تم تسجيل مورد: ${id} (${type}) - الإجمالي: ${this.total}`);
        }
    },
    
    markLoaded(id) {
        const resource = this.resources.get(id);
        if (resource && !resource.loaded) {
            resource.loaded = true;
            this.loaded++;
            this.updateProgress();
        }
    },
    
    updateProgress() {
        if (this.total === 0) return;
        
        const progress = (this.loaded / this.total) * 100;
        console.log(`📊 التقدم: ${this.loaded}/${this.total} = ${progress.toFixed(1)}%`);
        
        // إضاءة المصابيح تدريجياً
        if (progress >= 25) {
            document.getElementById('bulb-4')?.classList.add('on');
        }
        if (progress >= 50) {
            document.getElementById('bulb-3')?.classList.add('on');
        }
        if (progress >= 75) {
            document.getElementById('bulb-2')?.classList.add('on');
        }
        if (progress >= 90) {
            document.getElementById('bulb-1')?.classList.add('on');
        }
        
        // اكتمال التحميل
        if (this.loaded === this.total) {
            console.log('✅ اكتمل تحميل جميع الموارد (100%)');
            setTimeout(() => this.finishLoading(), 300);
        }
    },
    
    finishLoading() {
        hideLoadingScreen();
        if (mainSvg) mainSvg.style.opacity = '1';
        window.updateDynamicSizes();
        scan();
        updateWoodInterface();
        window.goToMapEnd();
        console.log('🎉 تم عرض الموقع بالكامل');
    }
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

// تحديث حالة التفاعل
if (jsToggle) {
    interactionEnabled = jsToggle.checked;
}

// 2. دالة جلب البيانات
async function fetchGlobalTree() {
    if (globalFileTree.length > 0) return;
    
    loadingMonitor.addResource('github-tree', 'api');
    
    try {
        const response = await fetch(TREE_API_URL);
        const data = await response.json();
        globalFileTree = data.tree || [];
        console.log("✓ تم تحميل شجرة الملفات:", globalFileTree.length);
        loadingMonitor.markLoaded('github-tree');
    } catch (err) {
        console.error("❌ خطأ في الاتصال بـ GitHub:", err);
        loadingMonitor.markLoaded('github-tree');
    }
}

function saveSelectedGroup(group) {
    localStorage.setItem('selectedGroup', group);
    currentGroup = group;
}

function loadSelectedGroup() {
    const saved = localStorage.getItem('selectedGroup');
    if (saved) {
        currentGroup = saved;
        return true;
    }
    return false;
}

function showLoadingScreen(groupLetter) {
    if (!loadingOverlay) return;

    const splashImage = document.getElementById('splash-image');
    if (splashImage) {
        splashImage.src = `image/logo-${groupLetter}.webp`;
    }

    loadingMonitor.init();
    loadingOverlay.classList.add('active');
    console.log(`🔦 شاشة التحميل نشطة للمجموعة ${groupLetter}`);
}

function hideLoadingScreen() {
    if (!loadingOverlay) return;
    loadingOverlay.classList.remove('active');
    console.log('✅ تم إخفاء شاشة التحميل');
}

// ===== دالة تحميل SVG محسّنة =====
async function loadGroupSVG(groupLetter) {
    const groupContainer = document.getElementById('group-specific-content');
    groupContainer.innerHTML = '';
    
    const svgId = `svg-group-${groupLetter}`;
    loadingMonitor.addResource(svgId, 'svg');

    try {
        console.log(`🔄 تحميل: groups/group-${groupLetter}.svg`);
        const response = await fetch(`groups/group-${groupLetter}.svg`);

        if (!response.ok) {
            console.warn(`⚠️ ملف SVG للمجموعة ${groupLetter} غير موجود`);
            loadingMonitor.markLoaded(svgId);
            return;
        }

        const svgText = await response.text();
        const match = svgText.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);

        if (match && match[1]) {
            groupContainer.innerHTML = match[1];
            console.log(`✓ تم حقن SVG: ${groupContainer.children.length} عنصر`);

            // تسجيل الصور داخل SVG
            const injectedImages = groupContainer.querySelectorAll('image[data-src]');
            injectedImages.forEach((img, idx) => {
                const src = img.getAttribute('data-src');
                if (src) {
                    const imgId = `svg-img-${groupLetter}-${idx}`;
                    loadingMonitor.addResource(imgId, 'svg-image');
                    
                    const tempImg = new Image();
                    tempImg.onload = () => {
                        img.setAttribute('href', src);
                        loadingMonitor.markLoaded(imgId);
                    };
                    tempImg.onerror = () => loadingMonitor.markLoaded(imgId);
                    tempImg.src = src;
                }
            });
        }
        
        loadingMonitor.markLoaded(svgId);
    } catch (err) {
        console.error(`❌ خطأ في loadGroupSVG:`, err);
        loadingMonitor.markLoaded(svgId);
    }
}

function updateWoodLogo(groupLetter) {
    const dynamicGroup = document.getElementById('dynamic-links-group');
    const oldBanner = dynamicGroup.querySelector('image[href*="logo-wood"]');
    if (oldBanner) oldBanner.remove();

    const logoId = `logo-wood-${groupLetter}`;
    loadingMonitor.addResource(logoId, 'logo');

    const banner = document.createElementNS("http://www.w3.org/2000/svg", "image");
    const logoSrc = `image/logo-wood-${groupLetter}.webp`;
    
    banner.setAttribute("x", "186.86");
    banner.setAttribute("y", "1517.43"); 
    banner.setAttribute("width", "648.41");
    banner.setAttribute("height", "276.04"); 
    banner.style.mixBlendMode = "multiply";
    banner.style.opacity = "0.9";
    banner.style.pointerEvents = "none";
    
    // تحميل اللوجو
    const tempImg = new Image();
    tempImg.onload = () => {
        banner.setAttribute("href", logoSrc);
        loadingMonitor.markLoaded(logoId);
    };
    tempImg.onerror = () => loadingMonitor.markLoaded(logoId);
    tempImg.src = logoSrc;
    
    dynamicGroup.appendChild(banner);
}

// ===== تهيئة المجموعة محسّنة =====
async function initializeGroup(groupLetter, isInitialLoad = false) {
    console.log('========================================');
    console.log(`🚀 بدء تهيئة المجموعة: ${groupLetter}`);
    console.log('========================================');

    saveSelectedGroup(groupLetter);

    if (toggleContainer) toggleContainer.style.display = 'flex';
    if (scrollContainer) scrollContainer.style.display = 'block';
    if (groupSelectionScreen) groupSelectionScreen.classList.add('hidden');
    
    showLoadingScreen(groupLetter);

    await fetchGlobalTree();
    await loadGroupSVG(groupLetter);
    
    window.updateDynamicSizes();

    if (isInitialLoad) {
        window.loadAllResources();
    } else {
        loadingMonitor.finishLoading();
    }
}

// ===== دالة تحميل جميع الموارد =====
function loadAllResources() {
    if (!mainSvg) return;

    // 1. جمع جميع الصور في الـ SVG الرئيسي
    const mainImages = Array.from(mainSvg.querySelectorAll('image[data-src]'));
    
    console.log(`📦 بدء تحميل ${mainImages.length} صورة رئيسية...`);

    mainImages.forEach((svgImg, idx) => {
        const src = svgImg.getAttribute('data-src');
        if (!src) return;

        const imgId = `main-img-${idx}`;
        loadingMonitor.addResource(imgId, 'main-image');

        const img = new Image();
        img.onload = () => {
            svgImg.setAttribute('href', src);
            loadingMonitor.markLoaded(imgId);
        };
        img.onerror = () => {
            console.warn(`⚠️ فشل تحميل: ${src}`);
            loadingMonitor.markLoaded(imgId);
        };
        img.src = src;
    });

    // 2. تسجيل أكواد JavaScript و CSS (تم تحميلها بالفعل)
    loadingMonitor.addResource('main-js', 'script');
    loadingMonitor.addResource('main-css', 'style');
    loadingMonitor.markLoaded('main-js');
    loadingMonitor.markLoaded('main-css');

    // 3. إذا لم يكن هناك موارد إضافية، إنهاء التحميل
    if (mainImages.length === 0 && loadingMonitor.total === 2) {
        console.log('⚠️ لا توجد موارد إضافية للتحميل');
        loadingMonitor.finishLoading();
    }
}
window.loadAllResources = loadAllResources;

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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker Registered'))
      .catch(err => console.log('Service Worker Failed', err));
  });
}

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

window.goToWood = () => {
    if (scrollContainer) {
        scrollContainer.scrollTo({ 
            left: 0,
            behavior: 'smooth' 
        });
    }
};

window.goToMapEnd = () => {
    if (!scrollContainer) return;
    const maxScrollRight = scrollContainer.scrollWidth - scrollContainer.clientWidth;
    scrollContainer.scrollTo({ 
        left: maxScrollRight, 
        behavior: 'smooth' 
    });
};

function debounce(func, delay) {
    let timeoutId;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(context, args), delay);
    }
}

function updateDynamicSizes() {
    if (!mainSvg) return;

    const allImages = mainSvg.querySelectorAll('image[width="1024"][height="2454"]');
    console.log(`📏 إعادة حساب viewBox: ${allImages.length} صورة`);

    if (allImages.length === 0) {
        console.warn('⚠️ لم يتم العثور على أي صور!');
        return;
    }

    const imgW = 1024;
    const imgH = 2454;
    const totalWidth = allImages.length * imgW;

    mainSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${imgH}`);
    console.log(`✓ viewBox: 0 0 ${totalWidth} ${imgH}`);
}
window.updateDynamicSizes = updateDynamicSizes;

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
    if (!dynamicGroup || !backBtnText) return;

    dynamicGroup.innerHTML = ''; 
    await fetchGlobalTree();

    if (currentFolder === "") {
        backBtnText.textContent = "➡️ إلى الخريطة";
    } else {
        const pathParts = currentFolder.split('/');
        const breadcrumb = "الرئيسية > " + pathParts.join(' > ');
        backBtnText.textContent = breadcrumb.length > 35 ? `🔙 ... > ${pathParts.slice(-1)}` : `🔙 ${breadcrumb}`;
    }

    if (currentFolder === "" && currentGroup) {
        updateWoodLogo(currentGroup);
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

                if (isDir && name !== 'image' && name !== 'groups') {
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
        }