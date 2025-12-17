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
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,
        animationId: null, initialScrollLeft: 0, touchStartTime: 0
    };

    // --- Utility ---
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

    // --- Hover ---
    function cleanupHover() {
        if (!activeState.rect) return;
        if (activeState.animationId) clearInterval(activeState.animationId);
        activeState.rect.style.filter = 'none';
        activeState.rect.style.transform = 'scale(1)';
        activeState.rect.style.strokeWidth = '2px';
        if (activeState.zoomPart) activeState.zoomPart.remove();
        if (activeState.zoomText) activeState.zoomText.remove();
        if (activeState.zoomBg) activeState.zoomBg.remove();
        Object.assign(activeState, {rect:null, zoomPart:null, zoomText:null, zoomBg:null, animationId:null});
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
        const centerY = absY + rH / 2;

        rect.style.transformOrigin = `${parseFloat(rect.getAttribute('x')) + rW/2}px ${parseFloat(rect.getAttribute('y')) + rH/2}px`;
        rect.style.transform = `scale(1.1)`;
        rect.style.strokeWidth = '4px';

        // --- جلب النص مباشرة من المستطيل ---
        const fullTitle = rect.getAttribute('data-full-text') || rect.getAttribute('data-href') || '';

        if(fullTitle) {
            const zText = document.createElementNS('http://www.w3.org/2000/svg','text');
            zText.textContent = fullTitle;
            zText.setAttribute('x', centerX);
            zText.setAttribute('y', absY - 10);
            zText.setAttribute('text-anchor', 'middle');
            zText.style.fill = 'white';
            zText.style.fontWeight = 'bold';
            zText.style.fontSize = '16px';
            zText.style.pointerEvents = 'none';
            mainSvg.appendChild(zText);
            activeState.zoomText = zText;

            const bbox = zText.getBBox();
            const pad = 10;
            const zBg = document.createElementNS('http://www.w3.org/2000/svg','rect');
            zBg.setAttribute('x', bbox.x - pad/2);
            zBg.setAttribute('y', bbox.y - pad/2);
            zBg.setAttribute('width', bbox.width + pad);
            zBg.setAttribute('height', bbox.height + pad);
            zBg.setAttribute('rx', 5);
            zBg.style.fill = 'black';
            zBg.style.stroke = 'white';
            zBg.style.strokeWidth = '1.5px';
            zBg.style.pointerEvents = 'none';
            mainSvg.insertBefore(zBg, zText);
            activeState.zoomBg = zBg;
        }

        // --- عرض صورة الزوم ---
        const imgData = getGroupImage(rect);
        if (imgData) {
            const clipId = `clip-${Date.now()}`;
            const clip = document.createElementNS('http://www.w3.org/2000/svg','clipPath');
            clip.setAttribute('id', clipId);
            const cRect = document.createElementNS('http://www.w3.org/2000/svg','rect');
            cRect.setAttribute('x', absX); cRect.setAttribute('y', absY);
            cRect.setAttribute('width', rW); cRect.setAttribute('height', rH);
            clip.appendChild(cRect);
            clipDefs.appendChild(clip);

            const zPart = document.createElementNS('http://www.w3.org/2000/svg','image');
            zPart.setAttribute('href', imgData.src);
            zPart.setAttribute('width', imgData.width); zPart.setAttribute('height', imgData.height);
            zPart.setAttribute('clip-path', `url(#${clipId})`);
            const mTrans = imgData.group.getAttribute('transform')?.match(/translate\(([\d.-]+),([\d.-]+)\)/);
            zPart.setAttribute('x', mTrans ? mTrans[1] : 0);
            zPart.setAttribute('y', mTrans ? mTrans[2] : 0);
            zPart.style.pointerEvents = 'none';
            zPart.style.transformOrigin = `${centerX}px ${centerY}px`;
            zPart.style.transform = `scale(1.1)`;
            mainSvg.appendChild(zPart);
            activeState.zoomPart = zPart;
        }

        // --- Glow effect ---
        let h = 0;
        activeState.animationId = setInterval(() => {
            h = (h + 10) % 360;
            const glow = `drop-shadow(0 0 8px hsl(${h},100%,55%))`;
            rect.style.filter = glow;
            if (activeState.zoomPart) activeState.zoomPart.style.filter = glow;
            if (activeState.zoomBg) activeState.zoomBg.style.stroke = `hsl(${h},100%,60%)`;
        }, 100);
    }

    function processRect(r) {
        if (r.hasAttribute('data-processed')) return;
        if(r.classList.contains('w')) r.setAttribute('width', '113.5');
        if(r.classList.contains('hw')) r.setAttribute('width', '56.75');
        const href = r.getAttribute('data-href') || '';
        r.addEventListener('click', () => { if(href && href!=='#') window.open(href,'_blank'); });
        if(!isTouchDevice) {
            r.addEventListener('mouseover', startHover);
            r.addEventListener('mouseout', cleanupHover);
        }
        r.addEventListener('touchstart', function() {
            if(!interactionEnabled) return;
            activeState.touchStartTime = Date.now();
            activeState.initialScrollLeft = scrollContainer.scrollLeft;
            startHover.call(this);
        });
        r.addEventListener('touchend', function() {
            if(!interactionEnabled) return;
            const moved = Math.abs(scrollContainer.scrollLeft - activeState.initialScrollLeft) > 10;
            if(!moved && (Date.now() - activeState.touchStartTime) < TAP_THRESHOLD_MS) {
                if(href && href!=='#') window.open(href,'_blank');
            }
            cleanupHover();
        });
        r.setAttribute('data-processed','true');
    }

    function scan() {
        mainSvg.querySelectorAll('rect.image-mapper-shape, rect.m').forEach(processRect);
    }
    scan();

    // --- البحث ---
    searchInput.addEventListener('input', debounce(function(e){
        const query = e.target.value.toLowerCase().trim();
        mainSvg.querySelectorAll('rect.m, rect.image-mapper-shape').forEach(rect=>{
            const href = (rect.getAttribute('data-href')||'').toLowerCase();
            const isMatch = href.includes(query);
            const label = rect.nextElementSibling;
            if(query.length>0){
                if(isMatch){ rect.style.display=''; rect.style.opacity='1'; rect.style.pointerEvents='auto'; if(label) label.style.display=''; }
                else{ rect.style.display='none'; rect.style.opacity='0'; rect.style.pointerEvents='none'; if(label) label.style.display='none'; }
            } else { rect.style.display=''; rect.style.opacity='1'; rect.style.pointerEvents='auto'; if(label) label.style.display=''; }
        });
    },150));

    // --- Loading ---
    const urls = Array.from(mainSvg.querySelectorAll('image')).map(img => img.getAttribute('data-src') || img.getAttribute('href'));
    let loadedCount = 0;
    urls.forEach(u=>{
        const img = new Image();
        img.onload = img.onerror = ()=>{
            loadedCount++;
            const p = (loadedCount/urls.length)*100;
            if(p>=25) document.getElementById('bulb-1')?.classList.add('on');
            if(p>=50) document.getElementById('bulb-2')?.classList.add('on');
            if(p>=75) document.getElementById('bulb-3')?.classList.add('on');
            if(p===100){
                document.getElementById('bulb-4')?.classList.add('on');
                setTimeout(()=>{
                    if(loadingOverlay) loadingOverlay.style.opacity=0;
                    setTimeout(()=>{ if(loadingOverlay) loadingOverlay.style.display='none'; mainSvg.style.opacity=1; scrollContainer.scrollLeft=scrollContainer.scrollWidth; },300);
                },500);
                mainSvg.querySelectorAll('image').forEach((si,idx)=>si.setAttribute('href',urls[idx]));
            }
        };
        img.src=u;
    });

    new MutationObserver(scan).observe(mainSvg,{childList:true,subtree:true});

    jsToggle.addEventListener('change', function(){ interactionEnabled=this.checked; if(!interactionEnabled) cleanupHover(); });

    document.getElementById('move-toggle')?.addEventListener('click', ()=>{
        const container = document.getElementById('js-toggle-container');
        container.classList.toggle('top'); container.classList.toggle('bottom');
    });
};