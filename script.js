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

    // إعدادات GitHub
    const GITHUB_OWNER = "05george";
    const GITHUB_REPO  = "semester-3";
    const BRANCH = "main";

    // حالة التفاعل
    let activeState = {
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,
        baseText: null, baseBg: null, animationId: null, clipPathId: null,
        touchStartTime: 0, initialScrollLeft: 0
    };

    let currentFolder = "";
    let interactionEnabled = jsToggle.checked;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    // مجموعة وهمية للملفات القادمة من GitHub
    const dynamicVirtualGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    dynamicVirtualGroup.id = "dynamic-github-pdfs";
    dynamicVirtualGroup.style.display = "none";
    mainSvg.appendChild(dynamicVirtualGroup);

    // --- وظائف الحركة ---
    const goToWood = () => scrollContainer.scrollTo({ left: -scrollContainer.scrollWidth, behavior: 'smooth' });
    const goToMapEnd = () => scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });

    // --- وظيفة البحث الموحدة (إخفاء في المكان) ---
    const performSearch = () => {
        const query = searchInput.value.toLowerCase().trim();
        
        // 1. فلترة الخريطة
        mainSvg.querySelectorAll('rect.m:not(.list-item)').forEach(rect => {
            const href = (rect.getAttribute('data-href') || '').toLowerCase();
            const fullText = (rect.getAttribute('data-full-text') || '').toLowerCase();
            const isMatch = (query === "") || href.includes(query) || fullText.includes(query);
            
            rect.style.opacity = isMatch ? "1" : "0";
            rect.style.pointerEvents = isMatch ? "auto" : "none";
            
            const label = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);
            const bg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);
            if (label) label.style.display = isMatch ? "" : "none";
            if (bg) bg.style.display = isMatch ? "" : "none";
        });

        // 2. فلترة قائمة الخشب
        document.querySelectorAll('.wood-item-group').forEach(group => {
            const key = group.getAttribute('data-search-key') || "";
            const isMatch = (query === "") || key.includes(query);
            group.style.opacity = isMatch ? "1" : "0";
            group.style.pointerEvents = isMatch ? "auto" : "none";
        });
    };

    // --- بناء واجهة الخشب وزر الرجوع ---
    function updateWoodInterface() {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        if (!dynamicGroup) return;
        
        dynamicGroup.innerHTML = '';
        backBtnText.textContent = currentFolder === "" ? "إلى الخريطة ←" : "رجوع للخلف ↑";

        const allRects = Array.from(mainSvg.querySelectorAll('rect.m:not(.list-item)'));
        const folders = new Set();
        const files = [];

        allRects.forEach(r => {
            const href = r.getAttribute('data-href') || "";
            if (!href || href === "#") return;

            if (currentFolder === "") {
                if (href.includes('/')) folders.add(href.split('/')[0]);
                else files.push({ href, text: r.getAttribute('data-full-text') || href });
            } else if (href.startsWith(currentFolder + '/')) {
                const rel = href.replace(currentFolder + '/', '');
                if (rel.includes('/')) folders.add(rel.split('/')[0]);
                else files.push({ href, text: r.getAttribute('data-full-text') || rel });
            }
        });

        const items = [
            ...Array.from(folders).map(f => ({ label: f, path: f, isFolder: true })),
            ...files.map(f => ({ label: f.text, path: f.href, isFolder: false }))
        ];

        items.forEach((item, index) => {
            const col = index % 2; 
            const row = Math.floor(index / 2);
            const x = col === 0 ? 120 : 550; const y = 250 + (row * 90);

            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("class", "wood-item-group");
            g.setAttribute("data-search-key", item.label.toLowerCase());
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
            t.textContent = (item.isFolder ? "📁 " : "📄 ") + (item.label.length > 22 ? item.label.substring(0, 19) + "..." : item.label);

            g.appendChild(r); g.appendChild(t);
            g.onclick = (e) => {
                e.stopPropagation();
                if (item.isFolder) {
                    currentFolder = (currentFolder === "") ? item.path : currentFolder + "/" + item.path;
                    updateWoodInterface();
                } else { window.open(item.path, '_blank'); }
            };
            dynamicGroup.appendChild(g);
        });
        performSearch();
    }

    backButtonGroup.onclick = (e) => {
        e.preventDefault();
        if (currentFolder !== "") {
            let parts = currentFolder.split('/'); parts.pop(); currentFolder = parts.join('/');
            updateWoodInterface();
        } else { goToMapEnd(); }
    };

    // --- نظام الـ Zoom والتفاعل ---
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
        Object.assign(activeState, { rect: null, zoomPart: null, zoomText: null, zoomBg: null, animationId: null });
    }

    function startHover() {
        if (!interactionEnabled || this.style.opacity === "0" || this.classList.contains('list-item')) return;
        cleanupHover();
        activeState.rect = this;
        const rW = parseFloat(this.getAttribute('width')) || this.getBBox().width;
        const rH = parseFloat(this.getAttribute('height')) || this.getBBox().height;
        this.style.transformOrigin = `${parseFloat(this.getAttribute('x')) + rW/2}px ${parseFloat(this.getAttribute('y')) + rH/2}px`;
        this.style.transform = "scale(1.1)";

        let h = 0;
        activeState.animationId = setInterval(() => {
            h = (h + 10) % 360;
            this.style.filter = `drop-shadow(0 0 8px hsl(${h},100%,60%))`;
        }, 100);
    }

    function processRect(r) {
        if (r.hasAttribute('data-processed')) return;
        if (!isTouchDevice) {
            r.addEventListener('mouseover', startHover);
            r.addEventListener('mouseout', cleanupHover);
        }
        r.onclick = () => { if(r.style.opacity !== "0" && r.getAttribute('data-href') !== "#") window.open(r.getAttribute('data-href'), '_blank'); };
        
        r.addEventListener('touchstart', function() { if(this.style.opacity !== "0") startHover.call(this); });
        r.addEventListener('touchend', cleanupHover);
        r.setAttribute('data-processed', 'true');
    }

    async function loadAllPdfFromGithub() {
        try {
            const api = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${BRANCH}?recursive=1`;
            const res = await fetch(api);
            const data = await res.json();
            if (data.tree) {
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
                mainSvg.querySelectorAll('rect.m').forEach(processRect);
            }
        } catch (e) { console.error(e); }
    }

    // --- بدء التحميل ---
    const images = mainSvg.querySelectorAll('image');
    mainSvg.setAttribute('viewBox', `0 0 ${images.length * 1024} 2454`);
    
    let loaded = 0;
    images.forEach(img => {
        const url = img.getAttribute('data-src') || img.getAttribute('href');
        const i = new Image();
        i.onload = () => {
            loaded++;
            const p = (loaded / images.length) * 100;
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
                        goToMapEnd();
                    }, 300);
                }, 500);
            }
        };
        i.src = url;
        img.setAttribute('href', url);
    });

    searchInput.addEventListener('input', performSearch);
    searchIcon.onclick = (e) => { e.preventDefault(); goToWood(); };
    moveToggle.onclick = () => {
        if (toggleContainer.classList.contains('top')) toggleContainer.classList.replace('top', 'bottom');
        else toggleContainer.classList.replace('bottom', 'top');
    };
    jsToggle.onchange = () => { interactionEnabled = jsToggle.checked; };

    loadAllPdfFromGithub();
};
