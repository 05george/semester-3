// دالة الـ Debounce لمنع تكرار التنفيذ بسرعة أثناء الكتابة
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

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

    // إعدادات الـ API الجديد
    const NEW_API_BASE = "https://api.github.com/repos/05george/semester-3/contents";

    let activeState = {
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,
        baseText: null, baseBg: null, animationId: null, clipPathId: null,
        touchStartTime: 0, initialScrollLeft: 0
    };

    let currentFolder = ""; 
    let interactionEnabled = jsToggle.checked;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    // --- وظيفة الفتح الذكي للمتصفح ---
    function smartOpen(url) {
        if (!url || url === '#') return;
        window.open(url, '_blank');
    }

    // --- وظائف الحركة RTL ---
    const goToWood = () => scrollContainer.scrollTo({ left: -scrollContainer.scrollWidth, behavior: 'smooth' });
    const goToMapEnd = () => scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });

    // --- إدارة واجهة الخشب (الفلاتر والبحث) ---
    async function updateWoodInterface() {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        if (!dynamicGroup) return;
        dynamicGroup.innerHTML = ''; 
        backBtnText.textContent = currentFolder === "" ? "إلى الخريطة ←" : "رجوع للخلف ↑";

        try {
            const apiUrl = currentFolder ? `${NEW_API_BASE}/${currentFolder}` : NEW_API_BASE;
            const response = await fetch(apiUrl);
            const data = await response.json();

            const items = data.filter(item => {
                const name = item.name.toLowerCase();
                if (name === 'image') return false; // استثناء مجلد الصور
                if (item.type === 'dir') return true; // عرض المجلدات
                return name.endsWith('.pdf') || name.endsWith('.svg'); // عرض الملفات المحددة فقط
            }).sort((a, b) => (a.type === 'dir' ? -1 : 1));

            renderWoodItems(items);
        } catch (e) { console.error("Error fetching data:", e); }
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

            // ميزة تنظيف الاسم الجديدة
            let cleanName = item.name.replace(/\.(pdf|svg)$/i, "").replace(/pdf/gi, "").trim();
            
            const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
            t.setAttribute("x", x + 175); t.setAttribute("y", y + 42); t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "white");
            t.style.fontWeight = "bold"; t.style.fontSize = "17px";
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

    function applyWoodSearchFilter() {
        const query = searchInput.value.toLowerCase().trim();
        mainSvg.querySelectorAll('.wood-list-item-group').forEach(group => {
            const textEl = group.querySelector('text');
            const name = textEl.getAttribute('data-search-name') || "";
            if (textEl.textContent.includes("📁") || query === "" || name.includes(query)) {
                group.style.visibility = 'visible';
            } else { group.style.visibility = 'hidden'; }
        });
    }

    // --- ربط البحث المزدوج ---
    searchInput.addEventListener('input', debounce(function(e) {
        const query = e.target.value.toLowerCase().trim();
        mainSvg.querySelectorAll('rect.m:not(.list-item)').forEach(rect => {
            const isMatch = (rect.getAttribute('data-href') || '').toLowerCase().includes(query) || 
                            (rect.getAttribute('data-full-text') || '').toLowerCase().includes(query);
            const label = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);
            const bg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);
            rect.style.display = (query.length > 0 && !isMatch) ? 'none' : '';
            if(label) label.style.display = rect.style.display; 
            if(bg) bg.style.display = rect.style.display;
        });
        applyWoodSearchFilter();
    }, 150));


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
    
    // --- بدء التشغيل والتحميل ---
    const urls = Array.from(mainSvg.querySelectorAll('image')).map(img => img.getAttribute('data-src') || img.getAttribute('href'));
    let loadedCount = 0;
    
    if (urls.length === 0) {
        if(loadingOverlay) loadingOverlay.style.display = 'none';
        mainSvg.style.opacity = 1;
        scan();
        updateWoodInterface();
    }

    urls.forEach(u => {
        const img = new Image();
        img.onload = img.onerror = () => {
            loadedCount++;
            const p = (loadedCount / urls.length) * 100;
            if(p >= 25) document.getElementById('bulb-4')?.classList.add('on');
            if(p >= 50) document.getElementById('bulb-3')?.classList.add('on');
            if(p >= 75) document.getElementById('bulb-2')?.classList.add('on');
            if(p === 100) {
                document.getElementById('bulb-1')?.classList.add('on');
                setTimeout(() => {
                    if(loadingOverlay) loadingOverlay.style.opacity = 0;
                    setTimeout(() => { 
                        if(loadingOverlay) loadingOverlay.style.display = 'none'; 
                        mainSvg.style.opacity = 1; 
                        scan(); 
                        updateWoodInterface(); 
                        goToMapEnd(); 
                    }, 300);
                    mainSvg.querySelectorAll('image').forEach((si, idx) => si.setAttribute('href', urls[idx]));
                }, 500);
            }
        };
        img.src = u;
    });

    // --- دمج البحث للمصادر والخريطة ---
    searchInput.addEventListener('input', debounce(function(e) {
        const query = e.target.value.toLowerCase().trim();
        
        // 1. فلترة الخريطة (الرموز)
        mainSvg.querySelectorAll('rect.m').forEach(rect => {
            const href = (rect.getAttribute('data-href') || '').toLowerCase();
            const fullText = (rect.getAttribute('data-full-text') || '').toLowerCase();
            const isMatch = href.includes(query) || fullText.includes(query);
            
            const label = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);
            const bg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);
            
            rect.style.display = (query.length > 0 && !isMatch) ? 'none' : '';
            if(label) label.style.display = rect.style.display; 
            if(bg) bg.style.display = rect.style.display;
        });

        // 2. فلترة قائمة الخشب (الروابط الديناميكية)
        applyWoodSearchFilter();
    }, 150));

    jsToggle.addEventListener('change', function() { 
        interactionEnabled = this.checked; 
        if(!interactionEnabled) cleanupHover(); 
    });
};