window.onload = function() {
    // 1. تعريف العناصر الأساسية
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

    // إعدادات المستودع
    const repoOwner = "05george";
    const repoName = "semester-3";
    let cachedWoodItems = []; // لتخزين ملفات الـ API لغرض البحث

    let activeState = {
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,
        baseText: null, baseBg: null, animationId: null, clipPathId: null,
        touchStartTime: 0, initialScrollLeft: 0
    };

    let currentFolder = ""; 
    let interactionEnabled = jsToggle.checked;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    // --- وظائف الحركة ---
    const goToWood = () => {
        scrollContainer.scrollTo({ left: -scrollContainer.scrollWidth, behavior: 'smooth' });
    };

    const goToMapEnd = () => {
        scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
    };

    // --- ربط الأحداث ---
    searchIcon.onclick = (e) => { e.preventDefault(); goToWood(); };
    searchInput.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); goToWood(); } };
    
    moveToggle.onclick = (e) => {
        e.preventDefault();
        toggleContainer.classList.toggle('top');
        toggleContainer.classList.toggle('bottom');
    };

    backButtonGroup.onclick = () => { 
        if (currentFolder !== "") { 
            let parts = currentFolder.split('/'); 
            parts.pop(); 
            currentFolder = parts.join('/'); 
            updateWoodInterface(); 
        } else { 
            goToMapEnd(); 
        } 
    };

    // --- الدوال المساعدة ---
    function debounce(func, delay) {
        let timeoutId;
        return function() {
            const context = this; const args = arguments;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        }
    }

    // --- وظائف عرض واجهة الخشب (GitHub API) ---
    async function updateWoodInterface() {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        if (!dynamicGroup) return;
        dynamicGroup.innerHTML = ''; 

        backBtnText.textContent = currentFolder === "" ? "إلى الخريطة ←" : "رجوع للخلف ↑";

        const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${currentFolder}`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('Failed to fetch');
            const data = await response.json();

            // 1. تصفية العناصر (إخفاء image وإظهار المجلدات والـ pdf فقط)
            // 2. الترتيب (المجلدات أولاً)
            const items = data
                .filter(item => {
                    const name = item.name.toLowerCase();
                    if (name === 'image') return false; // إخفاء مجلد image
                    return item.type === 'dir' || name.endsWith('.pdf');
                })
                .map(item => ({
                    label: item.name.replace(/\.[^/.]+$/, ""),
                    path: item.path,
                    isFolder: item.type === 'dir',
                    downloadUrl: item.download_url || item.html_url
                }))
                .sort((a, b) => (b.isFolder - a.isFolder) || a.label.localeCompare(b.label));

            cachedWoodItems = items; // حفظ العناصر للبحث
            renderWoodItems(items);
        } catch (error) {
            console.error(error);
        }
    }

    function renderWoodItems(items) {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        dynamicGroup.innerHTML = ''; // مسح القديم

        items.forEach((item, index) => {
            const col = index % 2; 
            const row = Math.floor(index / 2);
            const x = col === 0 ? 120 : 550; 
            const y = 250 + (row * 90);

            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("class", "wood-item-group");
            g.style.cursor = "pointer";

            const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", "350"); r.setAttribute("height", "70"); r.setAttribute("rx", "12");
            r.setAttribute("class", "list-item");
            r.style.fill = item.isFolder ? "#5d4037" : "rgba(0,0,0,0.8)";
            r.style.stroke = "#fff";

            const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
            t.setAttribute("x", x + 175); t.setAttribute("y", y + 42);
            t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "white");
            t.style.fontWeight = "bold"; t.style.fontSize = "17px";
            t.textContent = (item.isFolder ? "📁 " : "📄 ") + (item.label.length > 25 ? item.label.substring(0, 22) + "..." : item.label);

            g.appendChild(r); g.appendChild(t);
            g.onclick = (e) => {
                e.stopPropagation();
                if (item.isFolder) { currentFolder = item.path; updateWoodInterface(); }
                else { window.open(item.downloadUrl, '_blank'); }
            };
            dynamicGroup.appendChild(g);
        });
    }

    // --- نظام البحث الموحد ---
    searchInput.addEventListener('input', debounce(function(e) {
        const query = e.target.value.toLowerCase().trim();
        
        // 1. البحث في مستطيلات الخريطة (الـ SVG الأصلي)
        mainSvg.querySelectorAll('rect.m').forEach(rect => {
            const href = (rect.getAttribute('data-href') || '').toLowerCase();
            const label = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);
            const bg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);
            
            const isMatch = href.includes(query);
            const displayStyle = (query.length > 0 && !isMatch) ? 'none' : '';
            
            rect.style.display = displayStyle;
            if(label) label.style.display = displayStyle; 
            if(bg) bg.style.display = displayStyle;
        });

        // 2. البحث في ملفات الـ API (قائمة الخشب)
        if (cachedWoodItems.length > 0) {
            const filteredWood = cachedWoodItems.filter(item => item.label.toLowerCase().includes(query));
            renderWoodItems(filteredWood);
        }
    }, 150));

    // --- وظائف التفاعل مع الخريطة (الزوم والهوفر) ---
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
        Object.assign(activeState, { rect: null, zoomPart: null, zoomText: null, zoomBg: null, baseText: null, baseBg: null, animationId: null, clipPathId: null });
    }

    function startHover() {  
        if (!interactionEnabled || this.classList.contains('list-item')) return;  
        const rect = this;  
        if (activeState.rect === rect) return;  
        cleanupHover();  
        activeState.rect = rect;  

        const rW = rect.getBBox().width;  
        const rH = rect.getBBox().height;  
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
            cRect.setAttribute('x', absX); cRect.setAttribute('y', absY); cRect.setAttribute('width', rW); cRect.setAttribute('height', rH);  
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
        activeState.animationId = setInterval(() => {  
            h = (h + 10) % 360;  
            const color = `hsl(${h},100%,60%)`;
            rect.style.filter = `drop-shadow(0 0 8px ${color})`;  
            if (activeState.zoomPart) activeState.zoomPart.style.filter = `drop-shadow(0 0 8px ${color})`;  
            if (activeState.zoomBg) activeState.zoomBg.style.stroke = color;  
        }, 100);  
    }

    function processRect(r) {
        if (r.hasAttribute('data-processed')) return;
        const href = r.getAttribute('data-href') || '';
        if (!isTouchDevice) { r.addEventListener('mouseover', startHover); r.addEventListener('mouseout', cleanupHover); }
        r.onclick = () => { if (href && href !== '#') window.open(href, '_blank'); };
        r.setAttribute('data-processed', 'true');
    }

    function scan() { mainSvg.querySelectorAll('rect.m').forEach(r => processRect(r)); }

    // --- التحميل الابتدائي ---
    const imgs = Array.from(mainSvg.querySelectorAll('image'));
    let loadedCount = 0;
    imgs.forEach(img => {
        const src = img.getAttribute('data-src') || img.getAttribute('href');
        const testImg = new Image();
        testImg.onload = testImg.onerror = () => {
            loadedCount++;
            if(loadedCount === imgs.length) {
                loadingOverlay.style.opacity = 0;
                setTimeout(() => { 
                    loadingOverlay.style.display = 'none'; 
                    mainSvg.style.opacity = 1; 
                    scan(); updateWoodInterface(); goToMapEnd(); 
                }, 300);
            }
        };
        testImg.src = src;
    });

    jsToggle.addEventListener('change', function() { 
        interactionEnabled = this.checked; 
        if(!interactionEnabled) cleanupHover(); 
    });
};
