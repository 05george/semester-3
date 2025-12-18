window.onload = function() {
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const clipDefs = mainSvg.querySelector('defs');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    const searchIcon = document.getElementById('search-icon');

    let interactionEnabled = jsToggle.checked;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    const activeState = {
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,
        baseText: null, baseBg: null, animationId: null, clipPathId: null,
        initialScrollLeft: 0, touchStartTime: 0
    };

    // --- وظائف المساعدة ---
    function debounce(func, delay) {
        let timeoutId;
        return function() {
            const context = this; const args = arguments;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        }
    }

    function scrollToResults() {
        scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
    }

    // --- توليد قائمة الملفات فوق صورة الخشب (تلقائياً) ---
    function generateFilesList() {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        if (!dynamicGroup) return;

        // ابحث عن كل المستطيلات التي لها رابط وغير موجودة في مجموعة الخشب نفسها
        const allRects = mainSvg.querySelectorAll('rect.m:not(.list-item)');
        const uniqueHrefs = new Set();
        const items = [];

        allRects.forEach(r => {
            const href = r.getAttribute('data-href');
            if (href && !uniqueHrefs.has(href)) {
                uniqueHrefs.add(href);
                items.push({
                    href: href,
                    className: r.getAttribute('class'),
                    fullText: r.getAttribute('data-full-text')
                });
            }
        });

        let currentY = 150; 
        const itemHeight = 40; 
        const columnWidth = 280;

        items.forEach(item => {
            const newRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            newRect.setAttribute('x', "120"); 
            newRect.setAttribute('y', currentY);
            newRect.setAttribute('width', columnWidth);
            newRect.setAttribute('height', itemHeight);
            newRect.setAttribute('class', item.className + " list-item");
            newRect.setAttribute('data-href', item.href);
            if(item.fullText) newRect.setAttribute('data-full-text', item.fullText);
            
            dynamicGroup.appendChild(newRect);
            processRect(newRect); 
            currentY += itemHeight + 10; 
        });
    }

    // --- منطق البحث ---
    searchInput.addEventListener('input', debounce(function(e) {
        const query = e.target.value.toLowerCase().trim();
        const allRects = mainSvg.querySelectorAll('rect.m, rect.image-mapper-shape');

        allRects.forEach(rect => {
            const href = (rect.getAttribute('data-href') || '').toLowerCase();
            const fullText = (rect.getAttribute('data-full-text') || '').toLowerCase();
            const isMatch = href.includes(query) || fullText.includes(query);

            const parent = rect.parentNode;
            const label = parent.querySelector(`.rect-label[data-original-for='${rect.getAttribute('data-href')}']`);
            const bg = parent.querySelector(`.label-bg[data-original-for='${rect.getAttribute('data-href')}']`);

            if(query.length > 0 && !isMatch) {
                rect.style.display = 'none';
                if(label) label.style.display = 'none';
                if(bg) bg.style.display = 'none';
            } else {
                rect.style.display = '';
                if(label) label.style.display = '';
                if(bg) bg.style.display = '';
            }
        });
    }, 150));

    searchInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') scrollToResults(); });
    searchIcon.addEventListener('click', scrollToResults);

    // --- المنطق الأساسي للـ SVG (التكبير، المعالجة، التحميل) ---
    // (بقية الدوال الأساسية التي تعمل بشكل صحيح في كودك)
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
            txt.setAttribute('x', x + w / 2);
            txt.setAttribute('y', y + 2);
            txt.setAttribute('text-anchor', 'middle');
            txt.setAttribute('class', 'rect-label');
            txt.setAttribute('data-original-text', name);
            txt.setAttribute('data-original-for', href);
            txt.style.fontSize = fs + 'px';
            txt.style.fill = 'white';
            txt.style.pointerEvents = 'none';
            txt.style.dominantBaseline = 'hanging';
            r.parentNode.appendChild(txt);
            wrapText(txt, w);

            const bbox = txt.getBBox();
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('x', x); bg.setAttribute('y', y);
            bg.setAttribute('width', w); bg.setAttribute('height', bbox.height + 8);
            bg.setAttribute('class', 'label-bg');
            bg.setAttribute('data-original-for', href);
            bg.style.fill = 'black'; bg.style.pointerEvents = 'none';
            r.parentNode.insertBefore(bg, txt);
        }

        r.addEventListener('mouseover', startHover);
        r.addEventListener('mouseout', cleanupHover);
        r.addEventListener('click', () => { if (href && href !== '#') window.open(href, '_blank'); });
        r.setAttribute('data-processed', 'true');
    }

    // (تكملة الدوال: wrapText, startHover, cleanupHover, getCumulativeTranslate, getGroupImage)
    // سأختصرها لعدم التكرار ولكنها يجب أن تظل موجودة في ملفك كما هي
    function wrapText(el, maxW) { /* نفس كودك الأصلي */ }
    function startHover() { /* نفس كودك الأصلي */ }
    function cleanupHover() { /* نفس كودك الأصلي */ }
    function getCumulativeTranslate(element) { /* نفس كودك الأصلي */ }
    function getGroupImage(element) { /* نفس كودك الأصلي */ }

    // تشغيل العمليات
    generateFilesList();
    mainSvg.querySelectorAll('rect.m').forEach(r => processRect(r));

    // منطق التحميل (Loading)
    const urls = Array.from(mainSvg.querySelectorAll('image')).map(img => img.getAttribute('data-src') || img.getAttribute('href'));
    let loadedCount = 0;
    urls.forEach(u => {
        const img = new Image();
        img.onload = img.onerror = () => {
            loadedCount++;
            const p = (loadedCount / urls.length) * 100;
            if(p >= 25) document.getElementById('bulb-1')?.classList.add('on');
            if(p >= 50) document.getElementById('bulb-2')?.classList.add('on');
            if(p >= 75) document.getElementById('bulb-3')?.classList.add('on');
            if(p === 100) {
                document.getElementById('bulb-4')?.classList.add('on');
                setTimeout(() => {
                    loadingOverlay.style.opacity = 0;
                    setTimeout(() => { 
                        loadingOverlay.style.display = 'none'; 
                        mainSvg.style.opacity = 1;
                        scrollContainer.scrollLeft = scrollContainer.scrollWidth; // ابدأ من اليمين
                    }, 300);
                }, 500);
            }
        };
        img.src = u;
    });

    document.getElementById('move-toggle')?.addEventListener('click', () => {
        const container = document.getElementById('js-toggle-container');
        container.classList.toggle('top');
        container.classList.toggle('bottom');
    });
};