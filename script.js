/**
 * MUE Batch 24 - Interactive Map Engine
 * المتغيرات العالمية والإعدادات
 */
const REPO_NAME = "semester-3"; 
const GITHUB_USER = "MUE24Med";
const RAW_CONTENT_BASE = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/`;
const TREE_API_URL = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/git/trees/main?recursive=1`;

let globalFileTree = []; 
let currentGroup = ""; 
let currentFolder = ""; 

const groupLogos = {
    'A': 'image/logo-a.webp',
    'B': 'image/logo-b.webp',
    'C': 'image/logo-c.webp',
    'D': 'image/logo-d.webp'
};

// حالة التفاعل (Hover/Zoom)
let activeState = {
    rect: null, zoomPart: null, zoomText: null, zoomBg: null,
    baseText: null, baseBg: null, animationId: null, clipPathId: null,
    touchStartTime: 0, initialScrollLeft: 0
};

/**
 * دالة التشغيل الرئيسية عند اختيار المجموعة
 */
async function initApp(groupLetter) {
    currentGroup = groupLetter.toUpperCase();
    
    // واجهة المستخدم
    document.getElementById('group-overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.opacity = '1';

    try {
        // 1. جلب شجرة الملفات من GitHub أولاً
        await fetchGlobalTree();

        // 2. تحميل ملف SVG المجموعة
        const response = await fetch(`./maps/group-${groupLetter.toLowerCase()}.svg`);
        if (!response.ok) throw new Error("لم يتم العثور على ملف الخريطة للمجموعة المختارة");
        const svgText = await response.text();

        // 3. حقن الـ SVG في الحاوية
        const wrapper = document.getElementById('map-wrapper');
        wrapper.innerHTML = svgText;
        
        const mainSvg = wrapper.querySelector('svg');
        mainSvg.id = 'main-svg';

        // 4. تشغيل المحرك الرئيسي
        initializeMapEngine();

    } catch (err) {
        console.error(err);
        alert("حدث خطأ أثناء تحميل البيانات: " + err.message);
        document.getElementById('group-overlay').style.display = 'flex';
    }
}

async function fetchGlobalTree() {
    if (globalFileTree.length > 0) return; 
    try {
        const response = await fetch(TREE_API_URL);
        const data = await response.json();
        globalFileTree = data.tree || [];
    } catch (err) {
        console.error("خطأ في الاتصال بـ GitHub:", err);
    }
}

/**
 * المحرك الرئيسي (الذي يعمل على الـ SVG المحقون)
 */
function initializeMapEngine() {
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    const searchIcon = document.getElementById('search-icon');
    const moveToggle = document.getElementById('move-toggle');
    const toggleContainer = document.getElementById('js-toggle-container');
    
    // التأكد من وجود defs للـ ClipPath
    let clipDefs = mainSvg.querySelector('defs');
    if (!clipDefs) {
        clipDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        mainSvg.prepend(clipDefs);
    }

    let interactionEnabled = jsToggle.checked;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    // --- وظائف المساعدة ---
    
    const goToWood = () => {
        scrollContainer.scrollTo({ left: -scrollContainer.scrollWidth, behavior: 'smooth' });
    };

    const goToMapEnd = () => {
        scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
    };

    function smartOpen(item) {
        if(!item || !item.path) return;
        const url = item.path.startsWith('http') ? item.path : `${RAW_CONTENT_BASE}${item.path}`;
        if(url.toLowerCase().endsWith('.pdf')) {
            const overlay = document.getElementById("pdf-overlay");
            const pdfViewer = document.getElementById("pdfFrame");
            overlay.classList.remove("hidden");
            pdfViewer.src = "https://mozilla.github.io/pdf.js/web/viewer.html?file=" + encodeURIComponent(url) + "#zoom=page-width"; 
        } else {
            window.open(url, '_blank');
        }
    }

    // تحديث واجهة الخشب (Wood Interface)
    async function updateWoodInterface() {
        const dynamicGroup = mainSvg.getElementById('dynamic-links-group');
        const backBtnText = mainSvg.getElementById('back-btn-text');
        if (!dynamicGroup) return;
        
        dynamicGroup.innerHTML = ''; 

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
                if (!itemsMap.has(name) && !['image', 'maps', '.github'].includes(name)) {
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
        });
    }

    // إعداد الـ Rects (المحاضرات)
    function processRect(r) {
        if (r.hasAttribute('data-processed')) return;
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
            
            // Wrap Text logic
            const words = name.split(/\s+/); txt.textContent = '';
            let ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            ts.setAttribute('x', x + w / 2); ts.setAttribute('dy', '0');
            txt.appendChild(ts); let line = '';
            words.forEach(word => {
                let test = line + (line ? ' ' : '') + word;
                ts.textContent = test;
                if (ts.getComputedTextLength() > w - 5 && line) {
                    ts.textContent = line;
                    ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                    ts.setAttribute('x', x + w / 2); ts.setAttribute('dy', (fs * 1.1) + 'px');
                    ts.textContent = word; txt.appendChild(ts); line = word;
                } else { line = test; }
            });

            const bbox = txt.getBBox();
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('x', x); bg.setAttribute('y', y); bg.setAttribute('width', w); bg.setAttribute('height', bbox.height + 8);
            bg.setAttribute('class', 'label-bg'); bg.setAttribute('data-original-for', href);
            bg.style.fill = 'black'; bg.style.pointerEvents = 'none';
            r.parentNode.insertBefore(bg, txt);
        }

        if (!isTouchDevice) { 
            r.addEventListener('mouseenter', startHover); 
            r.addEventListener('mouseleave', cleanupHover); 
        }
        
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

    // تأثير الـ Hover و الزووم
    function startHover() {
        if (!interactionEnabled || this.classList.contains('list-item')) return;
        const rect = this;
        if (activeState.rect === rect) return;
        cleanupHover();
        activeState.rect = rect;

        const rW = parseFloat(rect.getAttribute('width')) || rect.getBBox().width;
        const rH = parseFloat(rect.getAttribute('height')) || rect.getBBox().height;
        
        // حساب الإحداثيات المطلقة
        let cumX = 0, cumY = 0, curr = rect;
        while(curr && curr.tagName !== 'svg') {
            const trans = curr.getAttribute('transform');
            if(trans) {
                const m = trans.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/);
                if(m) { cumX += parseFloat(m[1]); cumY += parseFloat(m[2]); }
            }
            curr = curr.parentNode;
        }

        const absX = parseFloat(rect.getAttribute('x')) + cumX;
        const absY = parseFloat(rect.getAttribute('y')) + cumY;
        const scaleFactor = 1.1;

        rect.style.transformOrigin = `${parseFloat(rect.getAttribute('x')) + rW/2}px ${parseFloat(rect.getAttribute('y')) + rH/2}px`;
        rect.style.transform = `scale(${scaleFactor})`;
        rect.style.strokeWidth = '4px';

        // البحث عن الصورة المناسبة للأسبوع
        let parentG = rect.parentNode;
        while(parentG && parentG.tagName !== 'svg') {
            const img = parentG.querySelector('image');
            if(img && img.getAttribute('width') == "1024") {
                const clipId = `clip-${Date.now()}`;
                activeState.clipPathId = clipId;
                const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
                clip.setAttribute('id', clipId);
                const cRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                cRect.setAttribute('x', absX); cRect.setAttribute('y', absY);
                cRect.setAttribute('width', rW); cRect.setAttribute('height', rH);
                clipDefs.appendChild(clip).appendChild(cRect);

                const zPart = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                zPart.setAttribute('href', img.getAttribute('href'));
                zPart.setAttribute('width', img.getAttribute('width')); zPart.setAttribute('height', img.getAttribute('height'));
                zPart.setAttribute('clip-path', `url(#${clipId})`);
                
                const mTrans = parentG.getAttribute('transform')?.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/);
                zPart.setAttribute('x', mTrans ? mTrans[1] : 0);
                zPart.setAttribute('y', mTrans ? mTrans[2] : 0);
                zPart.style.pointerEvents = 'none';
                zPart.style.transformOrigin = `${absX + rW/2}px ${absY + rH/2}px`;
                zPart.style.transform = `scale(${scaleFactor})`;
                mainSvg.appendChild(zPart);
                activeState.zoomPart = zPart;
                break;
            }
            parentG = parentG.parentNode;
        }

        // إظهار النص الكبير
        let bText = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);
        if (bText) {
            bText.style.opacity = '0';
            let bBg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);
            if(bBg) bBg.style.opacity = '0';
            activeState.baseText = bText; activeState.baseBg = bBg;

            const zText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            zText.textContent = rect.getAttribute('data-full-text') || bText.getAttribute('data-original-text');
            zText.setAttribute('x', absX + rW/2); zText.setAttribute('y', absY - 20);
            zText.setAttribute('text-anchor', 'middle'); zText.style.fill = 'white';
            zText.style.fontWeight = 'bold'; zText.style.fontSize = '24px'; zText.style.pointerEvents = 'none';
            mainSvg.appendChild(zText);
            activeState.zoomText = zText;
        }

        let h = 0;
        activeState.animationId = setInterval(() => {
            h = (h + 10) % 360;
            const color = `hsl(${h},100%,60%)`;
            rect.style.filter = `drop-shadow(0 0 10px ${color})`;
        }, 100);
    }

    function cleanupHover() {
        if (!activeState.rect) return;
        if (activeState.animationId) clearInterval(activeState.animationId);
        activeState.rect.style.filter = 'none';
        activeState.rect.style.transform = 'none';
        activeState.rect.style.strokeWidth = '2px';
        if (activeState.zoomPart) activeState.zoomPart.remove();
        if (activeState.zoomText) activeState.zoomText.remove();
        if (activeState.baseText) activeState.baseText.style.opacity = '1';
        if (activeState.baseBg) activeState.baseBg.style.opacity = '1';
        const clip = document.getElementById(activeState.clipPathId);
        if (clip) clip.remove();
        activeState.rect = null;
    }

    // --- تشغيل الواجهة النهائية ---
    
    // 1. معالجة الصور (Lazy Loading للصور داخل الـ SVG المحقون)
    const images = Array.from(mainSvg.querySelectorAll('image'));
    let loadedCount = 0;
    images.forEach(si => {
        const src = si.getAttribute('data-src');
        if(src) {
            const tempImg = new Image();
            tempImg.onload = () => {
                si.setAttribute('href', src);
                loadedCount++;
                if(loadedCount >= images.length - 1) finish();
            };
            tempImg.src = src;
        }
    });

    function finish() {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => { 
            loadingOverlay.style.display = 'none'; 
            mainSvg.style.opacity = '1';
            updateDynamicSizes(); 
            mainSvg.querySelectorAll('rect.m').forEach(processRect);
            updateWoodInterface();
            goToMapEnd();
        }, 500);
    }

    // أزرار التحكم
    searchIcon.onclick = goToWood;
    moveToggle.onclick = () => {
        toggleContainer.classList.toggle('top');
        toggleContainer.classList.toggle('bottom');
    };
    
    const backBtnGroup = mainSvg.getElementById('back-button-group');
    if(backBtnGroup) {
        backBtnGroup.onclick = () => {
            if (currentFolder !== "") {
                let parts = currentFolder.split('/'); parts.pop();
                currentFolder = parts.join('/');
                updateWoodInterface();
            } else { goToMapEnd(); }
        };
    }

    jsToggle.onchange = () => { interactionEnabled = jsToggle.checked; if(!interactionEnabled) cleanupHover(); };

    // البحث
    searchInput.oninput = (e) => {
        const q = e.target.value.toLowerCase().trim();
        mainSvg.querySelectorAll('rect.m:not(.list-item)').forEach(r => {
            const isMatch = (r.getAttribute('data-href') || '').toLowerCase().includes(q) || 
                            (r.getAttribute('data-full-text') || '').toLowerCase().includes(q);
            r.style.opacity = (q && !isMatch) ? "0.1" : "1";
        });
    };
}

/**
 * دالة لضبط مقاسات الـ SVG بناءً على عدد الأسابيع فيه
 */
function updateDynamicSizes() {
    const mainSvg = document.getElementById('main-svg');
    const images = Array.from(mainSvg.querySelectorAll('image')).filter(i => i.getAttribute('width') == "1024");
    const totalWidth = images.length * 1024;
    mainSvg.setAttribute('viewBox', `0 0 ${totalWidth} 2454`);
    mainSvg.style.width = `${totalWidth}px`;
}

// أزرار الـ PDF Overlay
document.getElementById("closePdfBtn").onclick = () => {
    document.getElementById("pdf-overlay").classList.add("hidden");
    document.getElementById("pdfFrame").src = "";
};