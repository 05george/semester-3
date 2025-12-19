window.onload = function() {
    // 1. تعريف العناصر الأساسية
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    const searchIcon = document.getElementById('search-icon');
    const moveToggle = document.getElementById('move-toggle');
    const toggleContainer = document.getElementById('js-toggle-container');
    const backButtonGroup = document.getElementById('back-button-group');
    const backBtnText = document.getElementById('back-btn-text');

    // --- إعدادات الموقع الجديد (API) ---
    // قم بتغيير هذا الرابط إلى رابط موقعك الجديد الذي يوفر البيانات
    const NEW_API_BASE = "https://api.github.com/repos/05george/semester-3/contents";

    let activeState = {
        rect: null, zoomText: null, zoomBg: null,
        baseText: null, baseBg: null, animationId: null,
        touchStartTime: 0, initialScrollLeft: 0
    };

    let currentFolder = ""; 
    let interactionEnabled = jsToggle.checked;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    // --- 2. وظيفة الفتح الطبيعي في المتصفح ---
    function smartOpen(url) {
        if (!url || url === '#') return;
        // فتح الرابط مباشرة في لسان جديد ليعمل المتصفح تلقائياً (SVG, PDF, إلخ)
        window.open(url, '_blank');
    }

    // --- 3. إدارة واجهة الخشب (تجلب من الموقع الجديد عبر API) ---
    async function updateWoodInterface() {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        if (!dynamicGroup) return;
        dynamicGroup.innerHTML = ''; 
        backBtnText.textContent = currentFolder === "" ? "إلى الخريطة ←" : "رجوع للخلف ↑";

        try {
            // بناء رابط الطلب بناءً على المجلد الحالي
            const apiUrl = currentFolder ? `${NEW_API_BASE}/${currentFolder}` : NEW_API_BASE;
            
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('API Response Error');
            const data = await response.json();

            const items = data.filter(item => {
                const name = item.name.toLowerCase();
                return name !== 'image'; // استثناء مجلد الصور
            }).sort((a, b) => (a.type === 'dir' ? -1 : 1));

            renderWoodItems(items);
        } catch (e) { 
            console.error("خطأ في جلب البيانات من الموقع الجديد:", e);
        }
    }

    function renderWoodItems(items) {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        items.forEach((item, index) => {
            const x = (index % 2 === 0) ? 120 : 550;
            const y = 250 + (Math.floor(index / 2) * 90);
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("class", "wood-list-item-group");

            const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", "350"); r.setAttribute("height", "70"); r.setAttribute("rx", "12");
            r.setAttribute("class", "list-item");
            r.style.fill = item.type === 'dir' ? "#5d4037" : "rgba(0,0,0,0.8)";
            r.style.stroke = "#fff";

            const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
            t.setAttribute("x", x + 175); t.setAttribute("y", y + 42); t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "white");
            t.style.fontWeight = "bold"; t.style.fontSize = "17px";
            const cleanName = item.name.replace(/\.[^/.]+$/, "");
            t.textContent = (item.type === 'dir' ? "📁 " : "📄 ") + (cleanName.length > 25 ? cleanName.substring(0, 22) + "..." : cleanName);
            t.setAttribute("data-search-name", cleanName.toLowerCase());

            g.appendChild(r); g.appendChild(t);
            g.onclick = (e) => {
                e.stopPropagation();
                if (item.type === 'dir') { 
                    currentFolder = item.path; 
                    updateWoodInterface(); 
                } else { 
                    smartOpen(item.download_url || item.html_url); 
                }
            };
            dynamicGroup.appendChild(g);
        });
        applyWoodSearchFilter();
    }

    // --- 4. نظام البحث والفلترة ---
    function applyWoodSearchFilter() {
        const query = searchInput.value.toLowerCase().trim();
        mainSvg.querySelectorAll('.wood-list-item-group').forEach(group => {
            const textElement = group.querySelector('text');
            if (!textElement) return;
            const name = textElement.getAttribute('data-search-name') || "";
            if (textElement.textContent.includes("📁") || query === "" || name.includes(query)) {
                group.style.visibility = 'visible';
            } else {
                group.style.visibility = 'hidden';
            }
        });
    }

    searchInput.addEventListener('input', debounce(function(e) {
        const query = e.target.value.toLowerCase().trim();
        mainSvg.querySelectorAll('rect.m:not(.list-item)').forEach(rect => {
            const href = (rect.getAttribute('data-href') || '').toLowerCase();
            const fullText = (rect.getAttribute('data-full-text') || '').toLowerCase();
            const isMatch = href.includes(query) || fullText.includes(query);
            
            const label = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);
            const bg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);
            
            rect.style.display = (query && !isMatch) ? 'none' : '';
            if(label) label.style.display = rect.style.display;
            if(bg) bg.style.display = rect.style.display;
        });
        applyWoodSearchFilter();
    }, 150));

    // --- 5. وظائف التنقل ---
    const goToWood = () => scrollContainer.scrollTo({ left: -scrollContainer.scrollWidth, behavior: 'smooth' });
    const goToMapEnd = () => scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });

    searchIcon.onclick = (e) => { e.preventDefault(); goToWood(); };
    moveToggle.onclick = (e) => {
        e.preventDefault();
        toggleContainer.classList.contains('top') ? 
        toggleContainer.classList.replace('top', 'bottom') : toggleContainer.classList.replace('bottom', 'top');
    };
    backButtonGroup.onclick = () => { 
        if (currentFolder !== "") { 
            let parts = currentFolder.split('/'); parts.pop(); 
            currentFolder = parts.join('/'); 
            updateWoodInterface(); 
        } else { goToMapEnd(); } 
    };

    function debounce(func, delay) {
        let timeoutId;
        return function() {
            const context = this; const args = arguments;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        };
    }

    // --- 6. معالجة العناصر والرسوم (Hover) ---
    function updateDynamicSizes() {
        const images = mainSvg.querySelectorAll('image');
        if (images.length) mainSvg.setAttribute('viewBox', `0 0 ${images.length * 1024} 2454`);
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

    function cleanupHover() {
        if (!activeState.rect) return;
        if (activeState.animationId) clearInterval(activeState.animationId);
        activeState.rect.style.filter = 'none';
        activeState.rect.style.transform = 'scale(1)';
        activeState.rect.style.strokeWidth = '2px';
        if (activeState.zoomText) activeState.zoomText.remove();
        if (activeState.zoomBg) activeState.zoomBg.remove();
        if (activeState.baseText) activeState.baseText.style.opacity = '1';
        if (activeState.baseBg) activeState.baseBg.style.opacity = '1';
        Object.assign(activeState, { rect: null, zoomText: null, zoomBg: null, baseText: null, baseBg: null, animationId: null });
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

        rect.style.transformOrigin = `${parseFloat(rect.getAttribute('x')) + rW/2}px ${parseFloat(rect.getAttribute('y')) + rH/2}px`;  
        rect.style.transform = `scale(1.1)`; rect.style.strokeWidth = '4px';  

        let bText = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);  
        if (bText) {  
            bText.style.opacity = '0'; 
            let bBg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`); 
            if(bBg) bBg.style.opacity = '0'; activeState.baseText = bText; activeState.baseBg = bBg;  
            
            const zText = document.createElementNS('http://www.w3.org/2000/svg', 'text'); 
            zText.textContent = rect.getAttribute('data-full-text') || bText.getAttribute('data-original-text') || ""; 
            zText.setAttribute('x', centerX); zText.setAttribute('text-anchor', 'middle'); 
            zText.style.dominantBaseline = 'central'; zText.style.fill = 'white'; zText.style.fontWeight = 'bold'; 
            zText.style.pointerEvents = 'none'; zText.style.fontSize = (parseFloat(bText.style.fontSize || 10) * 2) + 'px'; 
            mainSvg.appendChild(zText);  
            
            const bbox = zText.getBBox(); 
            const zBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); 
            zBg.setAttribute('x', centerX - (bbox.width + 20) / 2); zBg.setAttribute('y', absY - 20); 
            zBg.setAttribute('width', bbox.width + 20); zBg.setAttribute('height', bbox.height + 10); 
            zBg.setAttribute('rx', '5'); zBg.style.fill = 'black'; zBg.style.pointerEvents = 'none'; 
            mainSvg.insertBefore(zBg, zText); zText.setAttribute('y', absY - 20 + (bbox.height + 10) / 2); 
            activeState.zoomText = zText; activeState.zoomBg = zBg;  
        }  

        let h = 0; 
        activeState.animationId = setInterval(() => { 
            h = (h + 10) % 360; const color = `hsl(${h},100%,60%)`; 
            rect.style.filter = `drop-shadow(0 0 8px ${color})`; 
            if (activeState.zoomBg) activeState.zoomBg.style.stroke = color; 
        }, 100);  
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
            txt.setAttribute('x', x + w / 2); txt.setAttribute('y', y + 2); txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('class', 'rect-label');
            txt.setAttribute('data-original-text', name); txt.setAttribute('data-original-for', href);
            txt.style.fontSize = fs + 'px'; txt.style.fill = 'white'; txt.style.pointerEvents = 'none'; txt.style.dominantBaseline = 'hanging';
            r.parentNode.appendChild(txt); 

            const words = name.split(/\s+/); txt.textContent = '';
            let ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            ts.setAttribute('x', txt.getAttribute('x')); ts.setAttribute('dy', '0');
            txt.appendChild(ts); let line = ''; const lh = fs * 1.1;
            words.forEach(word => {
                let test = line + (line ? ' ' : '') + word; ts.textContent = test;
                if (ts.getComputedTextLength() > w - 5 && line) {
                    ts.textContent = line; ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                    ts.setAttribute('x', txt.getAttribute('x')); ts.setAttribute('dy', lh + 'px'); ts.textContent = word; txt.appendChild(ts); line = word;
                } else { line = test; }
            });

            const bbox = txt.getBBox();
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('x', x); bg.setAttribute('y', y); bg.setAttribute('width', w); bg.setAttribute('height', bbox.height + 8);
            bg.setAttribute('class', 'label-bg'); bg.setAttribute('data-original-for', href);
            bg.style.fill = 'black'; bg.style.pointerEvents = 'none';
            r.parentNode.insertBefore(bg, txt);
        }

        if (!isTouchDevice) { r.addEventListener('mouseover', startHover); r.addEventListener('mouseout', cleanupHover); }
        r.onclick = () => { if (href && href !== '#') smartOpen(href); };

        r.addEventListener('touchstart', function(e) { if(!interactionEnabled) return; activeState.touchStartTime = Date.now(); activeState.initialScrollLeft = scrollContainer.scrollLeft; startHover.call(this); });
        r.addEventListener('touchend', function(e) { 
            if (!interactionEnabled) return;
            if (Math.abs(scrollContainer.scrollLeft - activeState.initialScrollLeft) < 10 && (Date.now() - activeState.touchStartTime) < TAP_THRESHOLD_MS) {
                if (href && href !== '#') smartOpen(href);
            }
            cleanupHover();
        });
        r.setAttribute('data-processed', 'true');
    }

    // --- 7. التحميل وإطلاق الواجهة ---
    const imageElements = mainSvg.querySelectorAll('image');
    const urls = Array.from(imageElements).map(img => img.getAttribute('data-src') || img.getAttribute('href'));
    let loadedCount = 0;

    if (urls.length === 0) {
        loadingOverlay.style.display = 'none';
        mainSvg.style.opacity = 1;
    }

    urls.forEach((u, idx) => {
        const img = new Image();
        img.onload = img.onerror = () => {
            loadedCount++;
            const p = (loadedCount / urls.length) * 100;
            if(p >= 25) document.getElementById('bulb-4')?.classList.add('on');
            if(p >= 50) document.getElementById('bulb-3')?.classList.add('on');
            if(p >= 75) document.getElementById('bulb-2')?.classList.add('on');
            if(loadedCount === urls.length) {
                document.getElementById('bulb-1')?.classList.add('on');
                setTimeout(() => {
                    loadingOverlay.style.opacity = 0;
                    setTimeout(() => { 
                        loadingOverlay.style.display = 'none'; 
                        mainSvg.style.opacity = 1; 
                        mainSvg.querySelectorAll('rect.m').forEach(r => processRect(r));
                        updateWoodInterface(); 
                        goToMapEnd(); 
                    }, 300);
                    // تثبيت روابط الصور الحقيقية بعد التحميل
                    imageElements.forEach((si, i) => si.setAttribute('href', urls[i]));
                }, 500);
            }
        };
        img.src = u;
    });

    jsToggle.addEventListener('change', function() { interactionEnabled = this.checked; if(!interactionEnabled) cleanupHover(); });
};