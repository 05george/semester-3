window.onload = function() {
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const clipDefs = mainSvg.querySelector('defs');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');

    let interactionEnabled = jsToggle.checked;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    const activeState = {
        rect: null, zoomPart: null, zoomText: null, zoomBg: null, baseText: null, baseBg: null,
        animationId: null, clipPathId: null, initialScrollLeft: 0,
        touchStartTime: 0
    };

    // --- Utility Functions ---
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

    // --- Interaction Core ---
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
            rect: null, zoomPart: null, zoomText: null, zoomBg: null, baseText: null, baseBg: null,
            animationId: null, clipPathId: null
        });
    }

    function startHover() {
        if (!interactionEnabled) return;
        const rect = this;
        if (activeState.rect === rect) return;
        cleanupHover();
        activeState.rect = rect;

        const rW = parseFloat(rect.getAttribute('width'));
        const rH = parseFloat(rect.getAttribute('height'));
        const cum = getCumulativeTranslate(rect);
        const absX = parseFloat(rect.getAttribute('x')) + cum.x;
        const absY = parseFloat(rect.getAttribute('y')) + cum.y;
        const centerX = absX + rW / 2;
        const centerY = absY + rH / 2;

        // Scale Original
        rect.style.transformOrigin = `${parseFloat(rect.getAttribute('x')) + rW/2}px ${parseFloat(rect.getAttribute('y')) + rH/2}px`;
        rect.style.transform = `scale(1.1)`;
        rect.style.strokeWidth = '4px';

        // Zoom Image
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
            const mTrans = imgData.group.getAttribute('transform')?.match(/translate\(([\d.-]+),([\d.-]+)\)/);
            zPart.setAttribute('x', mTrans ? mTrans[1] : 0); zPart.setAttribute('y', mTrans ? mTrans[2] : 0);
            zPart.style.pointerEvents = 'none';
            zPart.style.transformOrigin = `${centerX}px ${centerY}px`;
            zPart.style.transform = `scale(1.1)`;
            mainSvg.appendChild(zPart);
            activeState.zoomPart = zPart;
        }

        // Zoom Label
        let bText = rect.nextElementSibling;
        while(bText && !bText.classList.contains('rect-label')) bText = bText.nextElementSibling;
        let bBg = bText ? bText.previousElementSibling : null;

        if (bText && bBg && bBg.classList.contains('label-bg')) {
            bText.style.opacity = '0';
            bBg.style.opacity = '0';
            activeState.baseText = bText;
            activeState.baseBg = bBg;

            const zText = bText.cloneNode(true);
            zText.textContent = rect.getAttribute('data-full-text') || bText.getAttribute('data-original-text');
            zText.style.fontSize = (parseFloat(bText.style.fontSize) * 2) + 'px';
            zText.style.opacity = '1';
            zText.setAttribute('x', centerX);
            zText.style.alignmentBaseline = 'central';
            zText.style.dominantBaseline = 'central';

            const zBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            mainSvg.appendChild(zBg); 
            mainSvg.appendChild(zText);

            const bbox = zText.getBBox();
            const pad = 12;
            const bgW = bbox.width + (pad * 2);
            const bgH = bbox.height + (pad * 2);

            zBg.setAttribute('x', centerX - bgW / 2);
            zBg.setAttribute('y', absY); 
            zBg.setAttribute('width', bgW);
            zBg.setAttribute('height', bgH);
            zBg.style.fill = 'black';
            zBg.style.stroke = 'white';
            zBg.style.strokeWidth = '1.5px';
            zBg.style.pointerEvents = 'none';

            zText.setAttribute('y', absY + (bgH / 2));
            activeState.zoomText = zText;
            activeState.zoomBg = zBg;
        }

        let hue = 0;
        activeState.animationId = setInterval(() => {
            hue = (hue + 10) % 360;
            const glow = `drop-shadow(0 0 8px hsl(${hue},100%,55%)) drop-shadow(0 0 15px hsl(${(hue+60)%360},100%,60%))`;
            rect.style.filter = glow;
            if (activeState.zoomPart) activeState.zoomPart.style.filter = glow;
        }, 100);
    }

    // --- Processing ---
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
        const lh = parseFloat(el.style.fontSize) * 1.2;
        words.forEach(word => {
            let test = line + (line ? ' ' : '') + word;
            ts.textContent = test;
            if (ts.getComputedTextLength() > maxW - 8 && line) {
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
        
        // Handle Logic Shortcuts
        if(r.classList.contains('w')) r.setAttribute('width', '113.5');
        if(r.classList.contains('hw')) r.setAttribute('width', '56.75');

        const href = r.getAttribute('data-href') || '';
        const name = r.getAttribute('data-full-text') || (href !== '#' ? href.split('/').pop().split('#')[0].split('.').slice(0, -1).join('.') : '');
        
        const w = parseFloat(r.getAttribute('width')) || r.getBBox().width;
        const h = parseFloat(r.getAttribute('height')) || r.getBBox().height;
        const x = parseFloat(r.getAttribute('x'));
        const y = parseFloat(r.getAttribute('y'));

        if (name && name.trim() !== '') {
            const fs = Math.max(8, Math.min(14, w * 0.12));

            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('x', x);
            bg.setAttribute('y', y);
            bg.setAttribute('width', w);
            bg.setAttribute('height', h);
            bg.setAttribute('class', 'label-bg');
            bg.style.fill = 'black';
            bg.style.pointerEvents = 'none';

            const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            txt.setAttribute('x', x + w / 2);
            txt.setAttribute('text-anchor', 'middle');
            txt.setAttribute('class', 'rect-label');
            txt.setAttribute('data-original-text', name);
            txt.style.fontSize = fs + 'px';
            txt.style.fill = 'white';
            txt.style.pointerEvents = 'none';
            txt.style.alignmentBaseline = 'central';
            txt.style.dominantBaseline = 'central';

            r.parentNode.insertBefore(bg, r.nextSibling);
            r.parentNode.insertBefore(txt, bg.nextSibling);

            wrapText(txt, w);
            const bbox = txt.getBBox();
            txt.setAttribute('y', y + (h / 2));
        }

        if (!isTouchDevice) {
            r.addEventListener('mouseover', startHover);
            r.addEventListener('mouseout', cleanupHover);
        }
        r.addEventListener('click', (e) => { 
            if (href && href !== '#') window.open(href, '_blank'); 
        });
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

    // --- Loading & Search ---
    const urls = Array.from(mainSvg.querySelectorAll('image')).map(img => img.getAttribute('data-src') || img.getAttribute('href'));
    let loaded = 0;
    urls.forEach(u => {
        const img = new Image();
        img.onload = img.onerror = () => {
            loaded++;
            const p = (loaded / urls.length) * 100;
            if(p >= 25) document.getElementById('bulb-1').classList.add('on');
            if(p >= 50) document.getElementById('bulb-2').classList.add('on');
            if(p >= 75) document.getElementById('bulb-3').classList.add('on');
            if(p === 100) {
                document.getElementById('bulb-4').classList.add('on');
                setTimeout(() => {
                    loadingOverlay.style.opacity = 0;
                    setTimeout(() => { 
                        loadingOverlay.style.display = 'none'; 
                        mainSvg.style.opacity = 1;
                        scrollContainer.scrollLeft = scrollContainer.scrollWidth;
                    }, 300);
                }, 500);
                mainSvg.querySelectorAll('image').forEach((si, idx) => si.setAttribute('href', urls[idx]));
            }
        };
        img.src = u;
    });

    searchInput.addEventListener('input', debounce((e) => {
        const q = e.target.value.toLowerCase();
        mainSvg.querySelectorAll('rect.image-mapper-shape, rect.m').forEach(r => {
            const bg = r.nextElementSibling;
            const label = bg?.classList.contains('label-bg') ? bg.nextElementSibling : null;
            const match = (r.getAttribute('data-href')||'').toLowerCase().includes(q) || (label?.getAttribute('data-original-text')||'').toLowerCase().includes(q);
            r.style.opacity = (q && !match) ? '0.1' : '1';
            if(bg) bg.style.opacity = (q && !match) ? '0.1' : '1';
            if(label) label.style.opacity = (q && !match) ? '0.1' : '1';
        });
    }, 150));

    new MutationObserver(() => scan()).observe(mainSvg, { childList: true, subtree: true });
    
    jsToggle.addEventListener('change', function() { 
        interactionEnabled = this.checked;
        document.getElementById('toggle-label').textContent = interactionEnabled ? 'Interaction Enabled' : 'Interaction Disabled';
        if(!interactionEnabled) cleanupHover();
    });

    document.getElementById('move-toggle').addEventListener('click', () => {
        const c = document.getElementById('js-toggle-container');
        c.classList.toggle('top'); c.classList.toggle('bottom');
    });
};