// script.js - الكود الكامل والنهائي
window.onload = function() {
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const clipDefs = mainSvg.querySelector('defs');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    const searchIcon = document.getElementById('search-icon');
    const backButtonGroup = document.getElementById('back-button-group');

    let interactionEnabled = jsToggle.checked;
    let currentFolder = ""; // المسار الحالي للمجلد المفتوح
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    const activeState = {
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,
        baseText: null, baseBg: null, animationId: null, clipPathId: null,
        initialScrollLeft: 0, touchStartTime: 0
    };

    // --- 1. وظائف المساعدة والتحكم ---
    function debounce(func, delay) {
        let timeoutId;
        return function() {
            const context = this; const args = arguments;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        }
    }

    function scrollToTimelineEnd() {
        scrollContainer.scrollTo({
            left: scrollContainer.scrollWidth,
            behavior: 'smooth'
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

    // --- 2. نظام المجلدات التفاعلي على صورة الخشب ---
    function updateWoodInterface() {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        if (!dynamicGroup) return;

        dynamicGroup.innerHTML = ''; 
        const allRects = Array.from(mainSvg.querySelectorAll('rect.m:not(.list-item)'));
        const folders = new Set();
        const files = [];

        allRects.forEach(r => {
            const href = r.getAttribute('data-href') || "";
            const fullText = r.getAttribute('data-full-text') || "";

            if (currentFolder === "") {
                if (href.includes('/') && href !== "#") {
                    folders.add(href.split('/')[0]);
                } else if (href !== "#") {
                    files.push({ href, text: fullText || href, originalRect: r });
                }
            } else {
                if (href.startsWith(currentFolder + '/')) {
                    const relativePath = href.replace(currentFolder + '/', '');
                    if (relativePath.includes('/')) {
                        folders.add(relativePath.split('/')[0]);
                    } else {
                        files.push({ href, text: fullText || relativePath, originalRect: r });
                    }
                }
            }
        });

        let currentY = 250; 
        folders.forEach(f => { createWoodItem(f, f, true, currentY); currentY += 65; });
        files.forEach(f => { createWoodItem(f.text, f.href, false, currentY, f.originalRect); currentY += 65; });
    }

    function createWoodItem(label, path, isFolder, y, sourceRect = null) {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "list-item-group");
        g.style.cursor = "pointer";

        const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        r.setAttribute("x", "120"); r.setAttribute("y", y);
        r.setAttribute("width", "300"); r.setAttribute("height", "50"); r.setAttribute("rx", "10");
        r.setAttribute("class", sourceRect ? sourceRect.getAttribute('class') + " list-item" : "m list-item");
        r.setAttribute("data-href", path);
        r.style.fill = isFolder ? "#5d4037" : "rgba(0,0,0,0.6)";
        r.style.stroke = "#fff";

        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", "270"); t.setAttribute("y", y + 32);
        t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "white");
        t.style.fontWeight = "bold"; t.style.fontSize = "16px";
        t.textContent = (isFolder ? "📁 " : "📄 ") + label;

        g.appendChild(r); g.appendChild(t);
        g.onclick = () => {
            if (isFolder) {
                currentFolder = currentFolder === "" ? path : currentFolder + "/" + path;
                updateWoodInterface();
            } else { window.open(path, '_blank'); }
        };
        dynamicGroup.appendChild(g);
    }

    // --- 3. زر الرجوع الذكي ---
    backButtonGroup.onclick = function() {
        if (currentFolder !== "") {
            const parts = currentFolder.split('/');
            parts.pop();
            currentFolder = parts.join('/');
            updateWoodInterface();
        } else {
            scrollToTimelineEnd();
        }
    };

    // --- 4. تأثيرات Hover و Zoom ---
    function cleanupHover() {
        if (!activeState.rect) return;
        if (activeState.animationId) clearInterval(activeState.animationId);
        activeState.rect.style.filter = 'none';
        activeState.rect.style.transform = 'scale(1)';
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
        if (!interactionEnabled) return;
        const rect = this;
        if (activeState.rect === rect) return;
        cleanupHover();
        activeState.rect = rect;

        const rW = parseFloat(rect.getAttribute('width')) || rect.getBBox().width;
        const rH = parseFloat(rect.getAttribute('height')) || rect.getBBox().height;
        const cum = getCumulativeTranslate(rect);
        const absX = parseFloat(rect.getAttribute('x')) + cum.x;
        const absY = parseFloat(rect.getAttribute('y')) + cum.y;

        rect.style.transformOrigin = `${parseFloat(rect.getAttribute('x')) + rW/2}px ${parseFloat(rect.getAttribute('y')) + rH/2}px`;
        rect.style.transform = `scale(1.1)`;
        
        let h = 0;
        activeState.animationId = setInterval(() => {
            h = (h + 10) % 360;
            rect.style.filter = `drop-shadow(0 0 8px hsl(${h},100%,60%))`;
        }, 100);
    }

    // --- 5. البحث والتحميل ---
    searchInput.addEventListener('input', debounce(function(e) {
        const query = e.target.value.toLowerCase().trim();
        mainSvg.querySelectorAll('rect.m').forEach(rect => {
            const match = (rect.getAttribute('data-href') || "").toLowerCase().includes(query) || 
                          (rect.getAttribute('data-full-text') || "").toLowerCase().includes(query);
            rect.style.opacity = (query && !match) ? "0.1" : "1";
        });
    }, 150));

    // منطق عداد اللمبات
    const urls = Array.from(mainSvg.querySelectorAll('image')).map(img => img.getAttribute('data-src') || img.getAttribute('href'));
    let loadedCount = 0;
    urls.forEach((u, index) => {
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
                        updateWoodInterface();
                        scrollToTimelineEnd();
                    }, 500);
                }, 500);
            }
        };
        img.src = u;
    });

    // تعيين الأحداث للمستطيلات الأصلية
    mainSvg.querySelectorAll('rect.m').forEach(r => {
        if (!isTouchDevice) {
            r.addEventListener('mouseover', startHover);
            r.addEventListener('mouseout', cleanupHover);
        }
        r.addEventListener('click', () => {
            const h = r.getAttribute('data-href');
            if (h && h !== '#') window.open(h, '_blank');
        });
    });

    jsToggle.addEventListener('change', function() { interactionEnabled = this.checked; });
    document.getElementById('move-toggle')?.addEventListener('click', () => {
        const c = document.getElementById('js-toggle-container');
        c.classList.toggle('top'); c.classList.toggle('bottom');
    });
};
