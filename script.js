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

    const GITHUB_OWNER = "05george";
    const GITHUB_REPO  = "semester-3";
    const BRANCH = "main";

    let activeState = {
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,
        baseText: null, baseBg: null, animationId: null, clipPathId: null
    };

    let currentFolder = "";
    let interactionEnabled = jsToggle ? jsToggle.checked : true;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;

    // مجموعة افتراضية للملفات الديناميكية
    const dynamicVirtualGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    dynamicVirtualGroup.id = "dynamic-github-pdfs";
    dynamicVirtualGroup.style.display = "none";
    mainSvg.appendChild(dynamicVirtualGroup);

    // --- [2] الدوال المساعدة ---
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

    function wrapText(el, maxW) {
        const txt = el.getAttribute('data-original-text'); if(!txt) return;
        const words = txt.split(/\s+/); el.textContent = '';
        let ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        ts.setAttribute('x', el.getAttribute('x')); ts.setAttribute('dy', '0');
        el.appendChild(ts); let line = '';
        const fontSize = parseFloat(el.style.fontSize) || 12;
        const lh = fontSize * 1.1;
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

    // --- [3] تحديث واجهة الخشب (Wood Interface) ---
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

        const items = [
            ...Array.from(folders).map(f => ({ label: f, path: f, isFolder: true })), 
            ...files.map(f => ({ label: f.label, path: f.path, isFolder: false }))
        ];

        // تم تصحيح ترتيب البراميترز هنا لمنع خطأ NaN
        items.forEach((item, index) => {
            const col = index % 2; 
            const row = Math.floor(index / 2);
            const xPos = col === 0 ? 120 : 550; 
            const yPos = 250 + (row * 90);

            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("class", "wood-item-group");
            g.setAttribute("data-search-key", item.label.toLowerCase());
            g.style.cursor = "pointer";

            const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            r.setAttribute("x", xPos.toString()); 
            r.setAttribute("y", yPos.toString()); 
            r.setAttribute("width", "350"); 
            r.setAttribute("height", "70"); 
            r.setAttribute("rx", "12");
            r.setAttribute("class", "list-item m");
            r.style.fill = item.isFolder ? "#5d4037" : "rgba(0,0,0,0.8)";
            r.style.stroke = "#fff";

            const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
            t.setAttribute("x", (xPos + 175).toString()); 
            t.setAttribute("y", (yPos + 42).toString()); 
            t.setAttribute("text-anchor", "middle"); 
            t.setAttribute("fill", "white");
            t.style.fontWeight = "bold"; 
            t.style.fontSize = "17px";

            let cleanLabel = item.label.replace(/\.pdf$/i, "");
            let displayText = cleanLabel.length > 22 ? cleanLabel.substring(0, 19) + "..." : cleanLabel;
            t.textContent = (item.isFolder ? "📁 " : "📄 ") + displayText;

            g.appendChild(r); 
            g.appendChild(t);
            g.onclick = (e) => {
                e.stopPropagation();
                if (item.isFolder) { 
                    currentFolder = (currentFolder === "") ? item.path : currentFolder + "/" + item.path; 
                    updateWoodInterface(); 
                } else { window.open(item.path, '_blank'); }
            };
            dynamicGroup.appendChild(g);
        });
    }

    // --- [4] معالجة العناصر الرسومية ---
    function processRect(r) {
        if (r.hasAttribute('data-processed')) return;
        const href = r.getAttribute('data-href') || '';
        let fileName = (href !== '#' && href !== '') ? href.split('/').pop().split('.')[0] : '';
        const name = r.getAttribute('data-full-text') || fileName;
        
        const bbox = r.getBBox();
        const w = parseFloat(r.getAttribute('width')) || bbox.width || 100;
        const x = parseFloat(r.getAttribute('x')) || bbox.x || 0;
        const y = parseFloat(r.getAttribute('y')) || bbox.y || 0;

        if (name && name.trim() !== '' && !r.classList.contains('list-item')) {
            const fs = Math.max(8, Math.min(12, w * 0.11));
            const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            txt.setAttribute('x', (x + w / 2).toString()); 
            txt.setAttribute('y', (y + 2).toString());
            txt.setAttribute('text-anchor', 'middle'); 
            txt.setAttribute('class', 'rect-label');
            txt.setAttribute('data-original-text', name); 
            txt.setAttribute('data-original-for', href);
            txt.style.fontSize = fs + 'px'; 
            txt.style.fill = 'white'; 
            txt.style.dominantBaseline = 'hanging';
            
            r.parentNode.appendChild(txt); 
            wrapText(txt, w);

            const tBbox = txt.getBBox();
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('x', x.toString()); 
            bg.setAttribute('y', y.toString()); 
            bg.setAttribute('width', w.toString()); 
            bg.setAttribute('height', (tBbox.height + 8).toString());
            bg.setAttribute('class', 'label-bg'); 
            bg.setAttribute('data-original-for', href);
            bg.style.fill = 'black'; 
            r.parentNode.insertBefore(bg, txt);
        }
        r.setAttribute('data-processed', 'true');
    }

    async function loadAllPdfFromGithub() {
        try {
            const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${BRANCH}?recursive=1`);
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
        } catch (e) { console.error("GitHub Fetch Error:", e); }
    }

    // --- [5] التشغيل النهائي ---
    const images = mainSvg.querySelectorAll('image');
    let loaded = 0;
    if (images.length === 0) {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        mainSvg.style.opacity = "1";
    } else {
        images.forEach(img => {
            const url = img.getAttribute('data-src') || img.getAttribute('href');
            const i = new Image();
            i.onload = i.onerror = () => {
                loaded++;
                if(loaded === images.length) {
                    if (loadingOverlay) loadingOverlay.style.display = 'none';
                    mainSvg.style.opacity = "1";
                    updateWoodInterface();
                    scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
                }
            };
            i.src = url; 
            img.setAttribute('href', url);
        });
    }

    loadAllPdfFromGithub();

    // أحداث البحث والتبديل
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            mainSvg.querySelectorAll('rect.m:not(.list-item)').forEach(rect => {
                const href = (rect.getAttribute('data-href') || '').toLowerCase();
                const isMatch = (query === "") || href.includes(query);
                rect.style.opacity = isMatch ? "1" : "0";
            });
        });
    }

    if (moveToggle) {
        moveToggle.onclick = () => toggleContainer.classList.toggle('bottom');
    }
};
