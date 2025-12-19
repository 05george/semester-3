window.onload = function() {
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
    let interactionEnabled = jsToggle.checked;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;

    const dynamicVirtualGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    dynamicVirtualGroup.id = "dynamic-github-pdfs";
    dynamicVirtualGroup.style.display = "none";
    mainSvg.appendChild(dynamicVirtualGroup);

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
        return { x: isNaN(x) ? 0 : x, y: isNaN(y) ? 0 : y };
    }

    function getGroupImage(element) {
        let current = element;
        while (current && current.tagName !== 'svg') {
            if (current.tagName === 'g') {
                const imgs = [...current.children].filter(c => c.tagName === 'image');
                if (imgs.length) return {
                    src: imgs[0].getAttribute('data-src') || imgs[0].getAttribute('href'),
                    width: parseFloat(imgs[0].getAttribute('width')) || 0,
                    height: parseFloat(imgs[0].getAttribute('height')) || 0,
                    group: current
                };
            }
            current = current.parentNode;
        }
        return null;
    }

    function wrapText(el, maxW) {
        const txt = el.getAttribute('data-original-text'); if(!txt) return;
        const words = txt.split(/\s+/); el.textContent = '';
        let ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        ts.setAttribute('x', el.getAttribute('x') || 0); ts.setAttribute('dy', '0');
        el.appendChild(ts); let line = '';
        const lh = parseFloat(el.style.fontSize) * 1.1 || 12;
        words.forEach(word => {
            let test = line + (line ? ' ' : '') + word;
            ts.textContent = test;
            if (ts.getComputedTextLength() > maxW - 5 && line) {
                ts.textContent = line;
                ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                ts.setAttribute('x', el.getAttribute('x') || 0); ts.setAttribute('dy', lh + 'px');
                ts.textContent = word; el.appendChild(ts); line = word;
            } else { line = test; }
        });
    }

    const performSearch = () => {
        const query = searchInput.value.toLowerCase().trim();
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
        document.querySelectorAll('.wood-item-group').forEach(group => {
            const key = group.getAttribute('data-search-key') || "";
            const isMatch = (query === "") || key.includes(query);
            group.style.opacity = isMatch ? "1" : "0";
        });
    };

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
        activeState.rect = null;
    }

    function startHover() {
        if (!interactionEnabled || this.style.opacity === "0" || this.classList.contains('list-item')) return;
        const rect = this; cleanupHover(); activeState.rect = rect;

        const rW = parseFloat(rect.getAttribute('width')) || 0;
        const rH = parseFloat(rect.getAttribute('height')) || 0;
        const cum = getCumulativeTranslate(rect);
        const absX = (parseFloat(rect.getAttribute('x')) || 0) + cum.x;
        const absY = (parseFloat(rect.getAttribute('y')) || 0) + cum.y;
        const centerX = absX + rW / 2;
        const hoveredY = absY - (rH * 0.05);

        rect.style.transformOrigin = `${(parseFloat(rect.getAttribute('x')) || 0) + rW/2}px ${(parseFloat(rect.getAttribute('y')) || 0) + rH/2}px`;
        rect.style.transform = `scale(1.1)`;

        const imgData = getGroupImage(rect);
        if (imgData) {
            const clipId = `clip-${Date.now()}`; activeState.clipPathId = clipId;
            const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
            clip.setAttribute('id', clipId);
            const cRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            cRect.setAttribute('x', absX); cRect.setAttribute('y', absY);
            cRect.setAttribute('width', rW); cRect.setAttribute('height', rH);
            clipDefs.appendChild(clip).appendChild(cRect);

            const zPart = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            zPart.setAttribute('href', imgData.src);
            zPart.setAttribute('width', imgData.width); zPart.setAttribute('height', imgData.height);
            zPart.setAttribute('clip-path', `url(#${clipId})`);
            zPart.style.transformOrigin = `${centerX}px ${absY + rH/2}px`;
            zPart.style.transform = `scale(1.1)`;
            mainSvg.appendChild(zPart); activeState.zoomPart = zPart;
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
            zText.style.fontSize = (parseFloat(bText.style.fontSize) * 1.8) + 'px';
            zText.style.fill = 'white'; zText.style.fontWeight = 'bold';
            mainSvg.appendChild(zText);

            const bbox = zText.getBBox();
            const zBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            zBg.setAttribute('x', centerX - (bbox.width + 20) / 2); zBg.setAttribute('y', hoveredY - bbox.height);
            zBg.setAttribute('width', bbox.width + 20); zBg.setAttribute('height', bbox.height + 10);
            zBg.setAttribute('rx', '5'); zBg.style.fill = 'black';
            mainSvg.insertBefore(zBg, zText);
            zText.setAttribute('y', hoveredY - 5);
            activeState.zoomText = zText; activeState.zoomBg = zBg;
        }

        let h = 0;
        activeState.animationId = setInterval(() => {
            h = (h + 15) % 360;
            rect.style.filter = `drop-shadow(0 0 8px hsl(${h},100%,60%))`;
        }, 100);
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
                else files.push({ href, text: r.getAttribute('data-full-text') || href });
            } else if (href.startsWith(currentFolder + '/')) {
                const rel = href.replace(currentFolder + '/', '');
                if (rel.includes('/')) folders.add(rel.split('/')[0]);
                else files.push({ href, text: r.getAttribute('data-full-text') || rel });
            }
        });

        const items = [...Array.from(folders).map(f => ({ label: f, path: f, isFolder: true })), 
                       ...files.map(f => ({ label: f.text, path: f.href, isFolder: false }))];

        items.forEach((item, index) => {
            const col = index % 2, row = Math.floor(index / 2);
            const x = col === 0 ? 120 : 550, y = 250 + (row * 90);
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.setAttribute("class", "wood-item-group");
            g.setAttribute("data-search-key", item.label.toLowerCase());

            const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", "350"); r.setAttribute("height", "70"); r.setAttribute("rx", "12");
            r.setAttribute("class", "list-item m");
            r.style.fill = item.isFolder ? "#5d4037" : "rgba(0,0,0,0.8)";
            r.style.stroke = "#fff";

            // --- الإصلاح هنا: إزالة .pdf من الاسم قبل العرض ---
            let displayName = item.label.replace(/\.pdf$/i, ""); 

            const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
            t.setAttribute("x", x + 175); t.setAttribute("y", y + 42); t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "white");
            t.style.fontWeight = "bold"; t.style.fontSize = "17px";
            t.textContent = (item.isFolder ? "📁 " : "📄 ") + (displayName.length > 22 ? displayName.substring(0, 19) + "..." : displayName);
            
            g.appendChild(r); g.appendChild(t);
            g.onclick = (e) => {
                e.stopPropagation();
                if (item.isFolder) { currentFolder = currentFolder === "" ? item.path : currentFolder + "/" + item.path; updateWoodInterface(); }
                else { window.open(item.path, '_blank'); }
            };
            dynamicGroup.appendChild(g);
        });
        performSearch();
    }

    function processRect(r) {
        if (r.hasAttribute('data-processed')) return;
        const href = r.getAttribute('data-href') || '';
        const name = r.getAttribute('data-full-text') || (href !== '#' ? href.split('/').pop().split('#')[0].split('.').slice(0,-1).join('.') : '');
        const w = parseFloat(r.getAttribute('width')) || 50;
        const x = parseFloat(r.getAttribute('x')) || 0;
        const y = parseFloat(r.getAttribute('y')) || 0;

        if (name && name.trim() !== '' && !r.classList.contains('list-item')) {
            const fs = Math.max(8, Math.min(12, w * 0.11));
            const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            txt.setAttribute('x', x + w / 2); txt.setAttribute('y', y + 2);
            txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('class', 'rect-label');
            txt.setAttribute('data-original-text', name); txt.setAttribute('data-original-for', href);
            txt.style.fontSize = fs + 'px'; txt.style.fill = 'white'; txt.style.dominantBaseline = 'hanging';
            r.parentNode.appendChild(txt); wrapText(txt, w);

            const bbox = txt.getBBox();
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('x', x); bg.setAttribute('y', y); bg.setAttribute('width', w); bg.setAttribute('height', bbox.height + 8);
            bg.setAttribute('class', 'label-bg'); bg.setAttribute('data-original-for', href);
            bg.style.fill = 'black'; r.parentNode.insertBefore(bg, txt);
        }

        if (!isTouchDevice) { r.addEventListener('mouseover', startHover); r.addEventListener('mouseout', cleanupHover); }
        r.onclick = () => { if(r.style.opacity !== "0" && href !== "#") window.open(href, '_blank'); };
        r.addEventListener('touchstart', function() { if(this.style.opacity !== "0" && interactionEnabled) startHover.call(this); });
        r.addEventListener('touchend', cleanupHover);
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
                        r.setAttribute("class", "m"); r.setAttribute("data-href", item.path);
                        r.setAttribute("data-full-text", item.path.split("/").pop());
                        dynamicVirtualGroup.appendChild(r);
                    }
                });
                updateWoodInterface();
                mainSvg.querySelectorAll('rect.m').forEach(processRect);
            }
        } catch (e) { console.error(e); }
    }

    const images = mainSvg.querySelectorAll('image');
    images.forEach(img => {
        const url = img.getAttribute('data-src') || img.getAttribute('href');
        const i = new Image();
        i.onload = () => {
            loaded++;
            if((loaded/images.length)*100 === 100) {
                loadingOverlay.style.display = 'none';
                mainSvg.style.opacity = 1;
                updateWoodInterface(); goToMapEnd();
            }
        };
        i.src = url; img.setAttribute('href', url);
    });

    let loaded = 0;
    searchInput.addEventListener('input', performSearch);
    searchIcon.onclick = (e) => { e.preventDefault(); goToWood(); };
    moveToggle.onclick = () => toggleContainer.classList.toggle('bottom');
    jsToggle.onchange = () => { interactionEnabled = jsToggle.checked; if(!interactionEnabled) cleanupHover(); };
    backButtonGroup.onclick = () => {
        if (currentFolder !== "") {
            let parts = currentFolder.split('/'); parts.pop(); currentFolder = parts.join('/');
            updateWoodInterface();
        } else { goToMapEnd(); }
    };

    loadAllPdfFromGithub();
};