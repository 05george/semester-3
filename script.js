window.onload = function() {
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const clipDefs = mainSvg.querySelector('defs');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    const searchIcon = document.getElementById('search-icon');
    const backButtonGroup = document.getElementById('back-button-group');
    const backBtnText = document.getElementById('back-btn-text');

    let interactionEnabled = jsToggle.checked;
    let currentFolder = ""; 
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    const activeState = {
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,
        baseText: null, baseBg: null, animationId: null, clipPathId: null
    };

    // وظيفة التحريك لأقصى اليسار (القائمة)
    const scrollToLeft = () => scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
    // وظيفة التحريك لأقصى اليمين (آخر الخريطة)
    const scrollToRight = () => scrollContainer.scrollTo({ left: scrollContainer.scrollWidth, behavior: 'smooth' });

    function updateDynamicSizes() {
        const images = mainSvg.querySelectorAll('image');
        if (!images.length) return;
        mainSvg.setAttribute('viewBox', `0 0 ${images.length * 1024} 2454`);
    }
    updateDynamicSizes();

    // نظام المجلدات (صفين)
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
                else files.push({ href, text: r.getAttribute('data-full-text') || href, originalRect: r });
            } else if (href.startsWith(currentFolder + '/')) {
                const relativePath = href.replace(currentFolder + '/', '');
                if (relativePath.includes('/')) folders.add(relativePath.split('/')[0]);
                else files.push({ href, text: r.getAttribute('data-full-text') || relativePath, originalRect: r });
            }
        });

        const items = [
            ...Array.from(folders).map(f => ({ label: f, path: f, isFolder: true })),
            ...files.map(f => ({ label: f.text, path: f.href, isFolder: false, sourceRect: f.originalRect }))
        ];

        // ترتيب في صفين (Column 1: x=120, Column 2: x=550)
        items.forEach((item, index) => {
            const col = index % 2; 
            const row = Math.floor(index / 2);
            const x = col === 0 ? 120 : 550;
            const y = 280 + (row * 80);
            createWoodItem(item.label, item.path, item.isFolder, x, y, item.sourceRect);
        });
    }

    function createWoodItem(label, path, isFolder, x, y, sourceRect = null) {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.style.cursor = "pointer";

        const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        r.setAttribute("x", x); r.setAttribute("y", y);
        r.setAttribute("width", "350"); r.setAttribute("height", "65"); r.setAttribute("rx", "12");
        r.setAttribute("class", sourceRect ? sourceRect.getAttribute('class') + " list-item" : "m list-item");
        r.style.fill = isFolder ? "#5d4037" : "rgba(0,0,0,0.7)";
        r.style.stroke = "#fff";

        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", x + 175); t.setAttribute("y", y + 38);
        t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "white");
        t.style.fontWeight = "bold"; t.style.fontSize = "16px";
        t.textContent = (isFolder ? "📁 " : "📄 ") + (label.length > 25 ? label.substring(0,22)+"..." : label);

        g.appendChild(r); g.appendChild(t);
        g.onclick = (e) => {
            e.stopPropagation();
            if (isFolder) {
                currentFolder = currentFolder === "" ? path : currentFolder + "/" + path;
                updateWoodInterface();
            } else { window.open(path, '_blank'); }
        };
        dynamicGroup.appendChild(g);
    }

    // منطق الأزرار والبحث والحركة
    backButtonGroup.onclick = function() {
        if (currentFolder !== "") {
            let parts = currentFolder.split('/'); parts.pop();
            currentFolder = parts.join('/');
            updateWoodInterface();
        } else {
            scrollToRight(); // اذهب لليمين (الخريطة)
        }
    };

    searchIcon.onclick = () => { scrollToLeft(); searchInput.focus(); };

    searchInput.onkeydown = (e) => {
        if (e.key === "Enter") {
            scrollToLeft();
            searchInput.blur(); // إغلاق لوحة المفاتيح
        }
    };

    // الميزات القديمة (Hover & Load)
    function cleanupHover() {
        if (!activeState.rect) return;
        if (activeState.animationId) clearInterval(activeState.animationId);
        activeState.rect.style.filter = 'none';
        activeState.rect.style.transform = 'scale(1)';
        activeState.rect = null;
    }

    function startHover() {  
        if (!interactionEnabled || this.classList.contains('list-item')) return;  
        cleanupHover();  
        activeState.rect = this;  
        const rW = parseFloat(this.getAttribute('width')) || this.getBBox().width;  
        this.style.transformOrigin = `${parseFloat(this.getAttribute('x')) + rW/2}px ${parseFloat(this.getAttribute('y')) + (this.getBBox().height/2)}px`;  
        this.style.transform = `scale(1.1)`;  

        let h = 0;  
        activeState.animationId = setInterval(() => {  
            h = (h + 20) % 360;  
            this.style.filter = `drop-shadow(0 0 10px hsl(${h},100%,60%))`;  
        }, 100);  
    }

    function processRect(r) {
        if (r.hasAttribute('data-processed')) return;
        if (!isTouchDevice) {
            r.addEventListener('mouseenter', startHover);
            r.addEventListener('mouseleave', cleanupHover);
        }
        r.onclick = () => { if (r.dataset.href && r.dataset.href !== '#') window.open(r.dataset.href, '_blank'); };
        r.setAttribute('data-processed', 'true');
    }

    const allImages = mainSvg.querySelectorAll('image');
    let loadedCount = 0;
    allImages.forEach(img => {
        const src = img.getAttribute('data-src') || img.getAttribute('href');
        const tempImg = new Image();
        tempImg.onload = () => {
            img.setAttribute('href', src);
            loadedCount++;
            const p = (loadedCount / allImages.length) * 100;
            if(p >= 25) document.getElementById('bulb-1')?.classList.add('on');
            if(p >= 50) document.getElementById('bulb-2')?.classList.add('on');
            if(p >= 75) document.getElementById('bulb-3')?.classList.add('on');
            if(loadedCount >= allImages.length) {
                document.getElementById('bulb-4')?.classList.add('on');
                setTimeout(() => {
                    loadingOverlay.style.opacity = 0;
                    setTimeout(() => { 
                        loadingOverlay.style.display = 'none'; 
                        mainSvg.style.opacity = 1;
                        updateWoodInterface();
                        scrollToRight();
                    }, 300);
                }, 500);
            }
        };
        tempImg.src = src;
    });

    setInterval(() => mainSvg.querySelectorAll('rect.m').forEach(r => processRect(r)), 1000);
};
