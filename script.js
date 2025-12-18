window.onload = 
// وظيفة التمرير لأقصى اليسار
function scrollToResults() {
    scrollContainer.scrollTo({
        left: 0,
        behavior: 'smooth'
    });
}

// 1. البحث أثناء الكتابة (بدون تحريك الشاشة)
searchInput.addEventListener('input', debounce(function(e) {
    const query = e.target.value.toLowerCase().trim();
    const allRects = mainSvg.querySelectorAll('rect.image-mapper-shape, rect.m');

    allRects.forEach(rect => {
        const href = (rect.getAttribute('data-href') || '').toLowerCase();
        const fullText = (rect.getAttribute('data-full-text') || '').toLowerCase();
        const isMatch = href.includes(query) || fullText.includes(query);

        const parent = rect.parentNode;
        const label = parent.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);
        const bg = parent.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);

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

// 2. التحريك لليسار عند الضغط على Enter
searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        scrollToResults();
    }
});

// 3. التحريك لليسار عند الضغط على أيقونة البحث (العدسة)
document.getElementById('search-icon').addEventListener('click', scrollToResults);

function generateFilesList() {
    const dynamicGroup = document.getElementById('dynamic-links-group');
    const allRects = mainSvg.querySelectorAll('rect.m[data-href$=".pdf"]');
    const uniqueHrefs = new Set();
    const files = [];

    allRects.forEach(r => {
        const href = r.getAttribute('data-href');
        if (!uniqueHrefs.has(href)) {
            uniqueHrefs.add(href);
            files.push({
                href: href,
                className: r.getAttribute('class'),
                fullText: r.getAttribute('data-full-text')
            });
        }
    });

    let currentY = 100; // نقطة البداية من الأعلى
    const itemHeight = 45; // ارتفاع كل عنصر في القائمة
    const columnWidth = 250; // عرض المستطيل في القائمة

    files.forEach(file => {
        const newRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        newRect.setAttribute('x', "150"); // إزاحة عن الحافة اليسرى
        newRect.setAttribute('y', currentY);
        newRect.setAttribute('width', columnWidth);
        newRect.setAttribute('height', itemHeight);
        newRect.setAttribute('class', file.className + " list-item");
        newRect.setAttribute('data-href', file.href);
        if(file.fullText) newRect.setAttribute('data-full-text', file.fullText);
        
        dynamicGroup.appendChild(newRect);
        processRect(newRect); // تشغيل منطق النصوص والتفاعل عليه
        currentY += itemHeight + 10; // ترك مسافة بين العناصر
    });
}

// استدعاء الوظيفة بعد السحب الأولي
generateFilesList();

function() {
    const mainSvg = document.getElementById('main-svg');
    mainSvg.style.colorScheme = 'only light'; 
    const scrollContainer = document.getElementById('scroll-container');
    const clipDefs = mainSvg.querySelector('defs');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');

    let interactionEnabled = jsToggle.checked;
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
            const context = this; const args = arguments;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        }
    }

    function updateDynamicSizes() {
        const images = mainSvg.querySelectorAll('image');
        if (!images.length) return;
        const imgW = parseFloat(images[0].getAttribute('width')) || 1024;
        const imgH = parseFloat(images[0].getAttribute('height')) || 2454;
        mainSvg.setAttribute('viewBox', `0 0 ${images.length * imgW} ${imgH}`);
    }
    updateDynamicSizes();

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
                    src: imgs[0].getAttribute('data-src') || imgs[0].getAttribute('href'),
                    width: parseFloat(imgs[0].getAttribute('width')),
                    height: parseFloat(imgs[0].getAttribute('height')),
                    group: current
                };
            }
            current = current.parentNode;
        }
        return null;
    }

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

        Object.assign(activeState, {
            rect: null, zoomPart: null, zoomText: null, zoomBg: null,
            baseText: null, baseBg: null, animationId: null, clipPathId: null
        });
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
        const centerX = absX + rW / 2;  

        // حساب Y الجديدة بعد التكبير بنسبة 1.1 لضمان المحاذاة
        const scaleFactor = 1.1;
        const yOffset = (rH * (scaleFactor - 1)) / 2;
        const hoveredY = absY - yOffset;

        rect.style.transformOrigin = `${parseFloat(rect.getAttribute('x')) + rW/2}px ${parseFloat(rect.getAttribute('y')) + rH/2}px`;  
        rect.style.transform = `scale(${scaleFactor})`;  
        rect.style.strokeWidth = '4px';  

        // 1. الجزء الخاص بتكبير صورة الخلفية
        const imgData = getGroupImage(rect);  
        if (imgData) {  
            const clipId = `clip-${Date.now()}`;  
            activeState.clipPathId = clipId;  
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
            const mTrans = imgData.group.getAttribute('transform')?.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/);  
            zPart.setAttribute('x', mTrans ? mTrans[1] : 0); zPart.setAttribute('y', mTrans ? mTrans[2] : 0);  
            zPart.style.pointerEvents = 'none';  
            zPart.style.transformOrigin = `${centerX}px ${absY + rH/2}px`;  
            zPart.style.transform = `scale(${scaleFactor})`;  
            mainSvg.appendChild(zPart);  
            activeState.zoomPart = zPart;  
        }  

        // 2. الجزء الخاص بالنص والمستطيل الأسود المكبر
        let bText = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);  
        if (bText) {  
            bText.style.opacity = '0';  
            let bBg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);  
            if(bBg) bBg.style.opacity = '0';  
            activeState.baseText = bText;  
            activeState.baseBg = bBg;  

            const zText = document.createElementNS('http://www.w3.org/2000/svg', 'text');  
            const fullTitle = rect.getAttribute('data-full-text') || bText.getAttribute('data-original-text') || "";  
            zText.textContent = fullTitle;  
            zText.setAttribute('x', centerX);  
            zText.setAttribute('text-anchor', 'middle');  
            zText.style.dominantBaseline = 'central';  
            zText.style.fill = 'white';  
            zText.style.fontWeight = 'bold';  
            zText.style.pointerEvents = 'none';  
            const baseFs = parseFloat(bText.style.fontSize) || 10;  
            zText.style.fontSize = (baseFs * 2) + 'px';  

            mainSvg.appendChild(zText);  

            const bbox = zText.getBBox();  
            const padW = 20, padH = 10;
            const zBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');  
            
            // التمركز حسب طلبك: y تطابق y المكبرة، و x في المنتصف
            zBg.setAttribute('x', centerX - (bbox.width + padW) / 2);  
            zBg.setAttribute('y', hoveredY);  
            zBg.setAttribute('width', bbox.width + padW);  
            zBg.setAttribute('height', bbox.height + padH);  
            zBg.setAttribute('rx', '5');  
            zBg.style.fill = 'black';  
            zBg.style.strokeWidth = '2px';  
            zBg.style.pointerEvents = 'none';  

            mainSvg.insertBefore(zBg, zText);  
            zText.setAttribute('y', hoveredY + (bbox.height + padH) / 2);

            activeState.zoomText = zText;  
            activeState.zoomBg = zBg;  
        }  

        let h = 0;  
        activeState.animationId = setInterval(() => {  
            h = (h + 10) % 360;  
            const color = `hsl(${h},100%,60%)`;
            rect.style.filter = `drop-shadow(0 0 8px ${color})`;  
            if (activeState.zoomPart) activeState.zoomPart.style.filter = `drop-shadow(0 0 8px ${color})`;  
            if (activeState.zoomBg) activeState.zoomBg.style.stroke = color;  
        }, 100);  
    }

    function wrapText(el, maxW) {
        const txt = el.getAttribute('data-original-text');
        if(!txt) return;
        const words = txt.split(/\s+/);
        el.textContent = '';
        let ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        ts.setAttribute('x', el.getAttribute('x'));
        ts.setAttribute('dy', '0');
        el.appendChild(ts);
        let line = '';
        const lh = parseFloat(el.style.fontSize) * 1.1;
        words.forEach(word => {
            let test = line + (line ? ' ' : '') + word;
            ts.textContent = test;
            if (ts.getComputedTextLength() > maxW - 5 && line) {
                ts.textContent = line;
                ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                ts.setAttribute('x', el.getAttribute('x'));
                ts.setAttribute('dy', lh + 'px');
                ts.textContent = word;
                el.appendChild(ts);
                line = word;
            } else { line = test; }
        });
    }

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
            bg.setAttribute('x', x);
            bg.setAttribute('y', y);
            bg.setAttribute('width', w);
            bg.setAttribute('height', bbox.height + 8); // طول ديناميكي حسب النص
            bg.setAttribute('class', 'label-bg');
            bg.setAttribute('data-original-for', href);
            bg.style.fill = 'black';
            bg.style.pointerEvents = 'none';

            r.parentNode.insertBefore(bg, txt);
        }

        if (!isTouchDevice) {
            r.addEventListener('mouseover', startHover);
            r.addEventListener('mouseout', cleanupHover);
        }

        r.addEventListener('click', () => { if (href && href !== '#') window.open(href, '_blank'); });

        r.addEventListener('touchstart', function(e) {
            if(!interactionEnabled) return;
            activeState.touchStartTime = Date.now();
            activeState.initialScrollLeft = scrollContainer.scrollLeft;
            startHover.call(this);
        });

        r.addEventListener('touchend', function(e) {
            if (!interactionEnabled) return;
            const moved = Math.abs(scrollContainer.scrollLeft - activeState.initialScrollLeft) > 10;
            if (!moved && (Date.now() - activeState.touchStartTime) < TAP_THRESHOLD_MS) {
                if (href && href !== '#') window.open(href, '_blank');
            }
            cleanupHover();
        });

        r.setAttribute('data-processed', 'true');
    }

    function scan() {
        mainSvg.querySelectorAll('rect.image-mapper-shape, rect.m').forEach(r => processRect(r));
    }
    scan();

    searchInput.addEventListener('input', debounce(function(e) {
        const query = e.target.value.toLowerCase().trim();
        const allRects = mainSvg.querySelectorAll('rect.image-mapper-shape, rect.m');

        allRects.forEach(rect => {
            const href = (rect.getAttribute('data-href') || '').toLowerCase();
            const parent = rect.parentNode;
            const label = parent.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);
            const bg = parent.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);

            const isMatch = href.includes(query);

            if(query.length > 0 && !isMatch) {
                rect.style.display = 'none'; rect.style.opacity = '0';
                if(label) { label.style.display = 'none'; }
                if(bg) { bg.style.display = 'none'; }
            } else {
                rect.style.display = ''; rect.style.opacity = '1';
                if(label) { label.style.display = ''; }
                if(bg) { bg.style.display = ''; }
            }
        });
    }, 150));

    // Loading logic
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
                    if(loadingOverlay) loadingOverlay.style.opacity = 0;
                    setTimeout(() => { 
                        if(loadingOverlay) loadingOverlay.style.display = 'none'; 
                        mainSvg.style.opacity = 1;
                        scrollContainer.scrollLeft = scrollContainer.scrollWidth;
                    }, 300);
                }, 500);
                mainSvg.querySelectorAll('image').forEach((si, idx) => si.setAttribute('href', urls[idx]));
            }
        };
        img.src = u;
    });

    new MutationObserver(() => scan()).observe(mainSvg, { childList: true, subtree: true });

    jsToggle.addEventListener('change', function() {
        interactionEnabled = this.checked;
        if(!interactionEnabled) cleanupHover();
    });

    document.getElementById('move-toggle')?.addEventListener('click', () => {
        const container = document.getElementById('js-toggle-container');
        container.classList.toggle('top');
        container.classList.toggle('bottom');
    });
};