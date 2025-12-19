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

    let activeState = {
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,
        baseText: null, baseBg: null, animationId: null, clipPathId: null
    };

    let currentFolder = "";
    let interactionEnabled = jsToggle.checked;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;

    // مجموعة افتراضية للملفات الديناميكية من GitHub
    const dynamicVirtualGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    dynamicVirtualGroup.id = "dynamic-github-pdfs";
    dynamicVirtualGroup.style.display = "none"; 
    mainSvg.appendChild(dynamicVirtualGroup);

    // --- [2] الدوال المساعدة للحركة ---
    const goToWood = () => scrollContainer.scrollTo({ left: -scrollContainer.scrollWidth, behavior: 'smooth' });
    const goToMapEnd = () => scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });

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
                    src: imgs[0].getAttribute('href') || imgs[0].getAttribute('data-src'),
                    width: parseFloat(imgs[0].getAttribute('width')),
                    height: parseFloat(imgs[0].getAttribute('height')),
                    group: current
                };
            }
            current = current.parentNode;
        }
        return null;
    }

    // --- [3] نظام البحث وتحديث الواجهة ---
    function performSearch() {
        const query = searchInput.value.toLowerCase().trim();
        
        // البحث في مربعات الخريطة
        mainSvg.querySelectorAll('rect.m:not(.list-item)').forEach(rect => {
            const href = (rect.getAttribute('data-href') || '').toLowerCase();
            const fullText = (rect.getAttribute('data-full-text') || '').toLowerCase();
            const isMatch = (query === "") || href.includes(query) || fullText.includes(query);

            rect.style.opacity = isMatch ? "1" : "0.1";
            const label = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);
            const bg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);
            if (label) label.style.opacity = isMatch ? "1" : "0";
            if (bg) bg.style.opacity = isMatch ? "1" : "0";
        });

        // البحث في قائمة الخشب
        document.querySelectorAll('.wood-item-group').forEach(group => {
            const key = group.getAttribute('data-search-key') || "";
            group.style.display = (query === "" || key.includes(query)) ? "" : "none";
        });
    }

    function updateWoodInterface() {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        if (!dynamicGroup) return;
        dynamicGroup.innerHTML = '';
        backBtnText.textContent = currentFolder === "" ? "إلى الخريطة ←" : "رجوع للخلف ↑";

        const allRects = Array.from(mainSvg.querySelectorAll('rect.m:not(.list-item)'));
        const folders = new Set(), files = [];

        allRects.forEach(r => {
            const href = r.getAttribute('data-href') || "";
            if (!href || href === "#") return;
            
            if (currentFolder === "") {
                if (href.includes('/')) folders.add(href.split('/')[0]);
                else files.push({ label: r.getAttribute('data-full-text') || href, path: href });
            } else if (href.startsWith(currentFolder + '/')) {
                const rel = href.replace(currentFolder + '/', '');
                if (rel.includes('/')) folders.add(rel.split('/')[0]);
                else files.push({ label: r.getAttribute('data-full-text') || rel, path: href });
            }
        });

        const items = [...Array.from(folders).map(f => ({ label: f, path: f, isFolder: true })), 
                       ...files.map(f => ({ label: f.label, path: f.path, isFolder: false }))];

        items.forEach((item, index) => {
            const col = index % 2; 
            const row = Math.floor(index / 2);
            const x = col === 0 ? 120 : 550; 
            const y = 250 + (row * 90);

            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("class", "wood-item-group");
            g.setAttribute("data-search-key", item.label.toLowerCase());

            const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", "350"); r.setAttribute("height", "70"); r.setAttribute("rx", "12");
            r.setAttribute("class", "list-item");
            r.style.fill = item.isFolder ? "#5d4037" : "rgba(0,0,0,0.8)";
            r.style.stroke = "#fff";

            const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
            t.setAttribute("x", x + 175); t.setAttribute("y", y + 42); 
            t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "white");
            t.style.fontWeight = "bold"; t.style.fontSize = "17px";

            // حذف .pdf وتقصير النص
            let cleanLabel = item.label.replace(/\.pdf$/i, "").split('/').pop();
            let displayText = cleanLabel.length > 22 ? cleanLabel.substring(0, 19) + "..." : cleanLabel;
            t.textContent = (item.isFolder ? "📁 " : "📄 ") + displayText;

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

    // --- [4] معالجة الصور والتحميل (إصلاح مشكلة الاختفاء) ---
    const allImages = mainSvg.querySelectorAll('image');
    let loadedImagesCount = 0;

    allImages.forEach(img => {
        const src = img.getAttribute('data-src') || img.getAttribute('href');
        if (!src) return;

        const tempImg = new Image();
        tempImg.onload = tempImg.onerror = () => {
            loadedImagesCount++;
            let progress = (loadedImagesCount / allImages.length) * 100;
            if(progress >= 25) document.getElementById('bulb-1')?.classList.add('on');
            if(progress >= 50) document.getElementById('bulb-2')?.classList.add('on');
            if(progress >= 75) document.getElementById('bulb-3')?.classList.add('on');
            
            if (loadedImagesCount === allImages.length) {
                document.getElementById('bulb-4')?.classList.add('on');
                setTimeout(() => {
                    loadingOverlay.style.opacity = '0';
                    setTimeout(() => {
                        loadingOverlay.style.display = 'none';
                        mainSvg.style.opacity = '1';
                        scan(); // تفعيل الأزرار بعد ظهور الصور
                        updateWoodInterface();
                        goToMapEnd();
                    }, 500);
                }, 500);
            }
        };
        tempImg.src = src;
        img.setAttribute('href', src); // التأكد من كتابة المسار في الـ SVG
    });

    // --- [5] جلب بيانات GitHub API ---
    async function loadGithubFiles() {
        try {
            const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${BRANCH}?recursive=1`);
            const data = await res.json();
            if (data.tree) {
                data.tree.forEach(item => {
                    if (item.type === "blob" && item.path.toLowerCase().endsWith(".pdf")) {
                        const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                        r.setAttribute("class", "m");
                        r.setAttribute("data-href", item.path);
                        r.setAttribute("data-full-text", item.path.split('/').pop());
                        dynamicVirtualGroup.appendChild(r);
                    }
                });
                updateWoodInterface();
            }
        } catch (e) { console.error("GitHub API Error:", e); }
    }

    function scan() {
        mainSvg.querySelectorAll('rect.m').forEach(r => {
            if (r.hasAttribute('data-processed')) return;
            const href = r.getAttribute('data-href');
            r.onclick = () => { if(href && href !== "#") window.open(href, '_blank'); };
            r.setAttribute('data-processed', 'true');
        });
    }

    // --- [6] مستمعي الأحداث ---
    searchInput.addEventListener('input', performSearch);
    searchIcon.onclick = (e) => { e.preventDefault(); goToWood(); };
    moveToggle.onclick = () => toggleContainer.classList.toggle('bottom');
    jsToggle.onchange = () => interactionEnabled = jsToggle.checked;
    
    backButtonGroup.onclick = () => {
        if (currentFolder !== "") {
            let parts = currentFolder.split('/'); parts.pop(); currentFolder = parts.join('/');
            updateWoodInterface();
        } else { goToMapEnd(); }
    };

    loadGithubFiles();
};
