window.onload = function() {
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const clipDefs = mainSvg.querySelector('defs');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    const backButtonGroup = document.getElementById('back-button-group');
    const backBtnText = document.getElementById('back-btn-text');

    let interactionEnabled = jsToggle.checked;
    let currentFolder = ""; 
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    const activeState = {
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,
        baseText: null, baseBg: null, animationId: null, clipPathId: null,
        initialScrollLeft: 0, touchStartTime: 0
    };

    function debounce(func, delay) {
        let timeoutId;
        return function() {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, arguments), delay);
        }
    }

    function updateDynamicSizes() {
        const images = mainSvg.querySelectorAll('image');
        if (!images.length) return;
        const imgW = 1024;
        const imgH = 2454;
        mainSvg.setAttribute('viewBox', `0 0 ${images.length * imgW} ${imgH}`);
    }
    updateDynamicSizes();

    // نظام المجلدات وزر الرجوع
    function updateWoodInterface() {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        if (!dynamicGroup) return;
        dynamicGroup.innerHTML = ''; 

        // تحديث نص زر الرجوع
        backBtnText.textContent = currentFolder === "" ? "إلى الخريطة ←" : "رجوع للخلف ↑";

        const allRects = Array.from(mainSvg.querySelectorAll('rect.m:not(.list-item)'));
        const folders = new Set();
        const files = [];

        allRects.forEach(r => {
            const href = r.getAttribute('data-href') || "";
            const fullText = r.getAttribute('data-full-text') || "";
            if (!href || href === "#") return;

            if (currentFolder === "") {
                if (href.includes('/')) folders.add(href.split('/')[0]);
                else files.push({ href, text: fullText || href, originalRect: r });
            } else {
                if (href.startsWith(currentFolder + '/')) {
                    const relativePath = href.replace(currentFolder + '/', '');
                    if (relativePath.includes('/')) folders.add(relativePath.split('/')[0]);
                    else files.push({ href, text: fullText || relativePath, originalRect: r });
                }
            }
        });

        let currentY = 250; 
        folders.forEach(f => { createWoodItem(f, f, true, currentY); currentY += 75; });
        files.forEach(f => { createWoodItem(f.text, f.href, false, currentY, f.originalRect); currentY += 75; });
    }

    function createWoodItem(label, path, isFolder, y, sourceRect = null) {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.style.cursor = "pointer";

        const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        r.setAttribute("x", "120"); r.setAttribute("y", y);
        r.setAttribute("width", "350"); r.setAttribute("height", "60"); r.setAttribute("rx", "12");
        r.setAttribute("class", sourceRect ? sourceRect.getAttribute('class') + " list-item" : "m list-item");
        r.style.fill = isFolder ? "#5d4037" : "rgba(0,0,0,0.7)";
        r.style.stroke = "#fff";

        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", "295"); t.setAttribute("y", y + 35);
        t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "white");
        t.style.fontWeight = "bold"; t.style.fontSize = "18px";
        t.textContent = (isFolder ? "📁 " : "📄 ") + label;

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

    backButtonGroup.onclick = function() {
        if (currentFolder !== "") {
            let parts = currentFolder.split('/');
            parts.pop();
            currentFolder = parts.join('/');
            updateWoodInterface();
        } else {
            scrollContainer.scrollTo({ left: scrollContainer.scrollWidth, behavior: 'smooth' });
        }
    };

    // ميكانيكا الـ Hover والـ Zoom
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
        if (!interactionEnabled || this.classList.contains('list-item')) return;  
        const rect = this;  
        if (activeState.rect === rect) return;  
        cleanupHover();  
        activeState.rect = rect;  

        const rW = parseFloat(rect.getAttribute('width')) || rect.getBBox().width;  
        const rH = parseFloat(rect.getAttribute('height')) || rect.getBBox().height;  
        
        // حساب الإحداثيات المطلقة داخل الـ SVG
        let x = parseFloat(rect.getAttribute('x'));
        let y = parseFloat(rect.getAttribute('y'));
        let current = rect.parentNode;
        while(current && current.tagName === 'g') {
            const trans = current.getAttribute('transform');
            if(trans) {
                const m = trans.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/);
                if(m) { x += parseFloat(m[1]); y += parseFloat(m[2]); }
            }
            current = current.parentNode;
        }

        const scaleFactor = 1.15;
        rect.style.transformOrigin = `${parseFloat(rect.getAttribute('x')) + rW/2}px ${parseFloat(rect.getAttribute('y')) + rH/2}px`;  
        rect.style.transform = `scale(${scaleFactor})`;  

        let h = 0;  
        activeState.animationId = setInterval(() => {  
            h = (h + 15) % 360;  
            rect.style.filter = `drop-shadow(0 0 10px hsl(${h},100%,60%))`;  
        }, 100);  
    }

    // معالجة العناصر
    function processRect(r) {
        if (r.hasAttribute('data-processed')) return;
        const href = r.getAttribute('data-href') || '';
        
        if (!isTouchDevice) {
            r.addEventListener('mouseover', startHover);
            r.addEventListener('mouseout', cleanupHover);
        }
        r.onclick = () => { if (href && href !== '#') window.open(href, '_blank'); };
        r.setAttribute('data-processed', 'true');
    }

    function scan() { mainSvg.querySelectorAll('rect.m').forEach(r => processRect(r)); }
    scan();

    // نظام التحميل
    const allImages = mainSvg.querySelectorAll('image');
    let loadedCount = 0;
    allImages.forEach(img => {
        const src = img.getAttribute('data-src') || img.getAttribute('href');
        const tempImg = new Image();
        tempImg.onload = () => {
            img.setAttribute('href', src);
            loadedCount++;
            updateProgress();
        };
        tempImg.src = src;
    });

    function updateProgress() {
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
                    scrollContainer.scrollLeft = scrollContainer.scrollWidth;
                }, 300);
            }, 500);
        }
    }

    searchInput.addEventListener('input', debounce(function(e) {
        const q = e.target.value.toLowerCase().trim();
        mainSvg.querySelectorAll('rect.m:not(.list-item)').forEach(rect => {
            const h = (rect.getAttribute('data-href') || '').toLowerCase();
            rect.style.opacity = (q && !h.includes(q)) ? '0.1' : '1';
        });
    }, 200));

    jsToggle.addEventListener('change', function() { interactionEnabled = this.checked; if(!interactionEnabled) cleanupHover(); });
};