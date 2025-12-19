window.onload = function() {
    // 1. التعريفات الأساسية
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

    // إعدادات GitHub
    const GITHUB_OWNER = "05george";
    const GITHUB_REPO  = "semester-3";
    const BRANCH = "main";

    // حالة التفاعل النشطة
    let activeState = {
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,
        baseText: null, baseBg: null, animationId: null, clipPathId: null,
        touchStartTime: 0, initialScrollLeft: 0
    };

    let currentFolder = "";
    let interactionEnabled = jsToggle.checked;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    // مجموعة وهمية للملفات الديناميكية
    const dynamicVirtualGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    dynamicVirtualGroup.id = "dynamic-github-pdfs";
    dynamicVirtualGroup.style.display = "none";
    mainSvg.appendChild(dynamicVirtualGroup);

    // --- وظائف الحركة ---
    const goToWood = () => {
        scrollContainer.scrollTo({ left: -scrollContainer.scrollWidth, behavior: 'smooth' });
    };

    const goToMapEnd = () => {
        scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
    };

    // --- نظام البحث الموحد ---
    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    const performSearch = debounce(function(e) {
        const query = e.target.value.toLowerCase().trim();

        // فلترة المستطيلات على الخريطة
        mainSvg.querySelectorAll('rect.m:not(.list-item)').forEach(rect => {
            const href = (rect.getAttribute('data-href') || '').toLowerCase();
            const fullText = (rect.getAttribute('data-full-text') || '').toLowerCase();
            const isMatch = href.includes(query) || fullText.includes(query);

            const label = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);
            const bg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);

            const shouldHide = query !== "" && !isMatch;
            rect.style.display = shouldHide ? 'none' : '';
            if (label) label.style.display = rect.style.display;
            if (bg) bg.style.display = rect.style.display;
        });

        // تحديث واجهة القائمة الخشبية لتناسب البحث
        updateWoodInterface();
    }, 150);

    // --- معالجة التفاعل والـ Hover ---
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
        Object.assign(activeState, { rect: null, zoomPart: null, zoomText: null, zoomBg: null, animationId: null });
    }

    function startHover() {
        if (!interactionEnabled || this.classList.contains('list-item')) return;
        const rect = this;
        if (activeState.rect === rect) return;
        cleanupHover();
        activeState.rect = rect;

        const rW = parseFloat(rect.getAttribute('width')) || rect.getBBox().width;
        const rH = parseFloat(rect.getAttribute('height')) || rect.getBBox().height;
        const x = parseFloat(rect.getAttribute('x'));
        const y = parseFloat(rect.getAttribute('y'));

        rect.style.transformOrigin = `${x + rW/2}px ${y + rH/2}px`;
        rect.style.transform = `scale(1.1)`;
        rect.style.strokeWidth = '4px';

        let h = 0;
        activeState.animationId = setInterval(() => {
            h = (h + 10) % 360;
            rect.style.filter = `drop-shadow(0 0 8px hsl(${h},100%,60%))`;
        }, 100);
    }

    // --- إدارة واجهة الخشب (Wood Interface) ---
    function updateWoodInterface() {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        if (!dynamicGroup) return;
        dynamicGroup.innerHTML = '';
        const query = searchInput.value.toLowerCase().trim();

        backBtnText.textContent = currentFolder === "" ? "إلى الخريطة ←" : "رجوع للخلف ↑";

        const allRects = Array.from(mainSvg.querySelectorAll('rect.m'));
        const folders = new Set();
        const files = [];

        allRects.forEach(r => {
            const href = r.getAttribute('data-href') || "";
            const fullText = r.getAttribute('data-full-text') || href;
            if (!href || href === "#") return;

            // منطق البحث
            if (query !== "" && !href.toLowerCase().includes(query) && !fullText.toLowerCase().includes(query)) return;

            if (currentFolder === "") {
                if (href.includes('/')) folders.add(href.split('/')[0]);
                else files.push({ href, text: fullText });
            } else if (href.startsWith(currentFolder + '/')) {
                const rel = href.replace(currentFolder + '/', '');
                if (rel.includes('/')) folders.add(rel.split('/')[0]);
                else files.push({ href, text: fullText });
            }
        });

        const items = [
            ...Array.from(folders).map(f => ({ label: f, path: f, isFolder: true })),
            ...files.map(f => ({ label: f.text, path: f.href, isFolder: false }))
        ];

        items.forEach((item, index) => {
            const col = index % 2; const row = Math.floor(index / 2);
            const x = col === 0 ? 120 : 550; const y = 250 + (row * 90);

            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.style.cursor = "pointer";

            const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", "350"); r.setAttribute("height", "70"); r.setAttribute("rx", "12");
            r.setAttribute("class", "list-item m");
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
                if (item.isFolder) {
                    currentFolder = currentFolder === "" ? item.path : currentFolder + "/" + item.path;
                    updateWoodInterface();
                } else { window.open(item.path, '_blank'); }
            };
            dynamicGroup.appendChild(g);
        });
    }

    // --- جلب الملفات من GitHub ---
    async function loadAllPdfFromGithub() {
        try {
            const api = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${BRANCH}?recursive=1`;
            const res = await fetch(api);
            const data = await res.json();
            if (!data.tree) return;

            data.tree.forEach(item => {
                if (item.type === "blob" && item.path.toLowerCase().endsWith(".pdf")) {
                    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    r.setAttribute("class", "m");
                    r.setAttribute("data-href", item.path);
                    r.setAttribute("data-full-text", item.path.split("/").pop());
                    dynamicVirtualGroup.appendChild(r);
                }
            });
            updateWoodInterface();
            scan(); // تفعيل التفاعل على العناصر الجديدة
        } catch (e) { console.error("GitHub PDF Loader Error:", e); }
    }

    // --- معالجة العناصر الرسومية (Labels) ---
    function processRect(r) {
        if (r.hasAttribute('data-processed')) return;
        const href = r.getAttribute('data-href') || '';
        if (href === "#" || r.classList.contains('list-item')) return;

        r.addEventListener('mouseover', startHover);
        r.addEventListener('mouseout', cleanupHover);
        r.onclick = () => { if (href !== '#') window.open(href, '_blank'); };

        // دعم اللمس
        r.addEventListener('touchstart', function() {
            activeState.touchStartTime = Date.now();
            activeState.initialScrollLeft = scrollContainer.scrollLeft;
            startHover.call(this);
        });
        r.addEventListener('touchend', function() {
            if (Math.abs(scrollContainer.scrollLeft - activeState.initialScrollLeft) < 10 && (Date.now() - activeState.touchStartTime) < TAP_THRESHOLD_MS) {
                if (href !== '#') window.open(href, '_blank');
            }
            cleanupHover();
        });

        r.setAttribute('data-processed', 'true');
    }

    function scan() {
        mainSvg.querySelectorAll('rect.m').forEach(r => processRect(r));
    }

    // --- التشغيل النهائي والتحميل ---
    const images = mainSvg.querySelectorAll('image');
    mainSvg.setAttribute('viewBox', `0 0 ${images.length * 1024} 2454`);
    
    let loadedCount = 0;
    images.forEach(imgEl => {
        const src = imgEl.getAttribute('data-src') || imgEl.getAttribute('href');
        const tempImg = new Image();
        tempImg.onload = tempImg.onerror = () => {
            loadedCount++;
            const p = (loadedCount / images.length) * 100;
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
                        scan();
                        updateWoodInterface();
                        goToMapEnd();
                    }, 300);
                }, 500);
            }
        };
        tempImg.src = src;
        imgEl.setAttribute('href', src);
    });

    // ربط أحداث القوائم
    searchInput.addEventListener('input', performSearch);
    searchIcon.onclick = (e) => { e.preventDefault(); goToWood(); };
    moveToggle.onclick = (e) => {
        e.preventDefault();
        toggleContainer.classList.toggle('top');
        toggleContainer.classList.toggle('bottom');
    };
    jsToggle.addEventListener('change', function() {
        interactionEnabled = this.checked;
        if(!interactionEnabled) cleanupHover();
    });

    loadAllPdfFromGithub();
};