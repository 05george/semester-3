window.onload = function() {
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const clipDefs = mainSvg.querySelector('defs');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    let interactionEnabled = jsToggle.checked;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const TAP_THRESHOLD_MS = 300;

    const activeState = {
        rect: null, zoomPart: null, zoomText: null, baseText: null,
        animationId: null, clipPathId: null, initialScrollLeft: 0,
        isScrolling: false, touchStartTime: 0
    };

    function debounce(func, delay) {
        let timeoutId;
        return function() {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, arguments), delay);
        };
    }

    // =================== Dynamic ViewBox based on images ===================
    function updateDynamicSizes() {
        const images = mainSvg.querySelectorAll('image');
        if (!images.length) return;
        const firstImage = images[0];
        const imageWidth = parseFloat(firstImage.getAttribute('width')) || 1024;
        const imageHeight = parseFloat(firstImage.getAttribute('height')) || 2454;
        const totalWidth = images.length * imageWidth;
        mainSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${imageHeight}`);
        window.MAX_SCROLL_LEFT = totalWidth - window.innerWidth;
    }
    updateDynamicSizes();

    const debouncedCleanupHover = debounce(function() {
        if (!interactionEnabled || !activeState.rect) return;
        cleanupHover();
    }, 50);

    scrollContainer.addEventListener('scroll', function() {
        if (this.scrollLeft > window.MAX_SCROLL_LEFT) this.scrollLeft = window.MAX_SCROLL_LEFT;
        if (!interactionEnabled) return;
        if (activeState.rect && !isTouchDevice) debouncedCleanupHover();
        if (activeState.rect && isTouchDevice) {
            if (Math.abs(this.scrollLeft - activeState.initialScrollLeft) > 5) {
                activeState.isScrolling = true;
                cleanupHover();
            }
        }
    });

    function getCumulativeTranslate(element) {
        let x = 0, y = 0;
        let current = element;
        while(current && current.tagName !== 'svg') {
            const transformAttr = current.getAttribute('transform');
            if (transformAttr) {
                const match = transformAttr.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/);
                if (match) { x += parseFloat(match[1]); y += parseFloat(match[2]); }
            }
            current = current.parentNode;
        }
        return { x, y };
    }

    function getGroupImage(element) {
        let current = element;
        while(current && current.tagName !== 'svg') {
            if (current.tagName === 'g') {
                const images = [...current.children].filter(c => c.tagName === 'image');
                if (images.length) {
                    const baseImage = images[0];
                    return {
                        src: baseImage.getAttribute('data-src') || baseImage.getAttribute('href'),
                        width: parseFloat(baseImage.getAttribute('width')),
                        height: parseFloat(baseImage.getAttribute('height')),
                        group: current
                    };
                }
            }
            current = current.parentNode;
        }
        return null;
    }

    function cleanupHover() {
        if (!activeState.rect) return;
        const rect = activeState.rect;
        const clipPathId = activeState.clipPathId;
        const zoomPart = activeState.zoomPart;
        const zoomText = activeState.zoomText;
        const baseText = activeState.baseText;
        if (activeState.animationId) clearInterval(activeState.animationId);
        rect.style.filter = 'none';
        if (zoomPart) zoomPart.style.filter = 'none';
        if (zoomText) zoomText.style.opacity = '0';
        rect.style.transform = 'scale(1)';
        rect.style.strokeWidth = '2px';
        if (zoomPart) zoomPart.style.transform = 'scale(1)';
        if (baseText) baseText.style.opacity = '1';
        if (zoomPart) zoomPart.remove();
        const clip = document.getElementById(clipPathId);
        if (clip) clip.remove();
        if (zoomText) zoomText.remove();
        Object.assign(activeState, {rect:null, zoomPart:null, zoomText:null, baseText:null, animationId:null, clipPathId:null, initialScrollLeft:0, isScrolling:false, touchStartTime:0});
    }

    function startHover() {
        if (!interactionEnabled) return;
        const rect = this;
        if (activeState.rect === rect) return;
        cleanupHover();
        activeState.rect = rect;

        const scale = 1.1;
        const x = parseFloat(rect.getAttribute('x'));
        const y = parseFloat(rect.getAttribute('y'));
        const width = parseFloat(rect.getAttribute('width'));
        const height = parseFloat(rect.getAttribute('height'));
        const cumulative = getCumulativeTranslate(rect);
        const absoluteX = x + cumulative.x;
        const absoluteY = y + cumulative.y;
        const centerX = absoluteX + width / 2;
        const centerY = absoluteY + height / 2;

        rect.style.transformOrigin = `${x + width/2}px ${y + height/2}px`;
        rect.style.transform = `scale(${scale})`;
        rect.style.strokeWidth = '4px';

        const imageData = getGroupImage(rect);
        let zoomPartElement = null;
        if (imageData) {
            const clipPathId = `clip-${Date.now()}`;
            activeState.clipPathId = clipPathId;
            const clip = document.createElementNS('http://www.w3.org/2000/svg','clipPath');
            clip.setAttribute('id', clipPathId);
            const clipRect = document.createElementNS('http://www.w3.org/2000/svg','rect');
            clipRect.setAttribute('x', absoluteX);
            clipRect.setAttribute('y', absoluteY);
            clipRect.setAttribute('width', width);
            clipRect.setAttribute('height', height);
            clip.appendChild(clipRect);
            clipDefs.appendChild(clip);

            const zoomPart = document.createElementNS('http://www.w3.org/2000/svg','image');
            zoomPart.setAttribute('href', imageData.src);
            zoomPart.setAttribute('width', imageData.width);
            zoomPart.setAttribute('height', imageData.height);
            zoomPart.setAttribute('clip-path', `url(#${clipPathId})`);
            zoomPart.setAttribute('class','zoom-part');
            const groupTransform = imageData.group.getAttribute('transform');
            const match = groupTransform ? groupTransform.match(/translate\(([\d.-]+),([\d.-]+)\)/) : null;
            const groupX = match ? parseFloat(match[1]) : 0;
            const groupY = match ? parseFloat(match[2]) : 0;
            zoomPart.setAttribute('x', groupX);
            zoomPart.setAttribute('y', groupY);
            zoomPart.style.opacity = 0;
            mainSvg.appendChild(zoomPart);
            activeState.zoomPart = zoomPart;
            zoomPart.style.transformOrigin = `${centerX}px ${centerY}px`;
            zoomPart.style.transform = `scale(${scale})`;
            zoomPart.style.opacity = 1;
            zoomPartElement = zoomPart;
        }

        // =================== Text Zoom ===================
        let baseText = rect.nextElementSibling;
        if (baseText && !baseText.matches('text.rect-label')) baseText = null;
        if (baseText) {
            baseText.style.opacity = '0';
            activeState.baseText = baseText;
            const zoomText = baseText.cloneNode(true);
            zoomText.removeAttribute('data-original-text');
            zoomText.style.fontSize = (parseFloat(baseText.style.fontSize)*2)+'px';
            zoomText.style.fill='white';
            zoomText.style.pointerEvents='none';
            zoomText.style.userSelect='none';
            zoomText.style.opacity='1';
            zoomText.setAttribute('x', absoluteX + width/2);
            zoomText.setAttribute('y', absoluteY + parseFloat(baseText.style.fontSize)*1.5);
            zoomText.setAttribute('text-anchor','middle');
            mainSvg.appendChild(zoomText);
            activeState.zoomText = zoomText;
        }

        // =================== Glow Animation ===================
        let hue = 0;
        activeState.animationId = setInterval(() => {
            hue = (hue + 10) % 360;
            const glow = `drop-shadow(0 0 8px hsl(${hue},100%,55%)) drop-shadow(0 0 14px hsl(${(hue+60)%360},100%,60%))`;
            rect.style.filter = glow;
            if (zoomPartElement) zoomPartElement.style.filter = glow;
            if (activeState.zoomText) activeState.zoomText.style.filter = glow;
        }, 100);
    }

    function stopHover() { if (interactionEnabled) cleanupHover(); }

    function handleLinkOpen(event) {
        const href = event.currentTarget.getAttribute('data-href');
        if (href && href !== '#') {
            window.open(href, '_blank');
            event.preventDefault();
            event.stopPropagation();
        }
    }

    // =================== Hover & Click Attach ===================
    function attachHover(rect) {
        if (!isTouchDevice) {
            rect.addEventListener('mouseover', startHover);
            rect.addEventListener('mouseout', stopHover);
        }
        rect.addEventListener('click', handleLinkOpen);
        rect.addEventListener('touchstart', function(event) {
            activeState.touchStartTime = Date.now();
            activeState.initialScrollLeft = scrollContainer.scrollLeft;
            activeState.isScrolling = false;
            startHover.call(this);
        });
        rect.addEventListener('touchend', function(event) {
            const timeElapsed = Date.now() - activeState.touchStartTime;
            if (!activeState.isScrolling && timeElapsed < TAP_THRESHOLD_MS) handleLinkOpen(event);
            cleanupHover();
        });
    }

    // =================== Auto Width, Auto Font, Wrap ===================
    function wrapTextInSvg(textElement, maxWidth, padding = 5) {
        const text = textElement.textContent;
        const words = text.split(/\s+/).filter(w => w.length > 0);
        textElement.textContent = null;

        let tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.setAttribute('x', textElement.getAttribute('x'));
        tspan.setAttribute('dy', '0');
        textElement.appendChild(tspan);

        let currentLine = '';
        const lineHeight = parseFloat(textElement.style.fontSize) * 1.2;
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const lineTest = currentLine + (currentLine.length ? ' ' : '') + word;
            tspan.textContent = lineTest;
            if (tspan.getComputedTextLength() > maxWidth - padding*2 && currentLine.length>0) {
                tspan.textContent = currentLine;
                tspan = document.createElementNS('http://www.w3.org/2000/svg','tspan');
                tspan.setAttribute('x', textElement.getAttribute('x'));
                tspan.setAttribute('dy', `${lineHeight}px`);
                textElement.appendChild(tspan);
                currentLine = word;
                tspan.textContent = word;
            } else {
                currentLine = lineTest;
            }
        }
    }

    function processRect(rect) {
        // =================== Width based on Class ===================
        let width = 80;
        if (rect.classList.contains('w')) width = 114;
        if (rect.classList.contains('hw')) width = 57;
        rect.setAttribute('width', width);

        // =================== Add Text Label ===================
        const href = rect.getAttribute('data-href') || '';
        const fileName = href.split('/').pop().split('#')[0] || '';
        const baseName = fileName.split('.').slice(0, -1).join('.');
        const rectX = parseFloat(rect.getAttribute('x'));
        const rectY = parseFloat(rect.getAttribute('y'));
        const fontSize = Math.max(8, Math.min(16, width*0.12));
        const text = document.createElementNS('http://www.w3.org/2000/svg','text');
        text.setAttribute('x', rectX + width/2);
        text.setAttribute('y', rectY + fontSize);
        text.setAttribute('text-anchor','middle');
        text.textContent = baseName;
        text.style.fontSize = fontSize + 'px';
        text.style.fill = 'white';
        text.style.pointerEvents = 'none';
        text.setAttribute('class','rect-label');
        rect.parentNode.insertBefore(text, rect.nextSibling);
        wrapTextInSvg(text, width);

        attachHover(rect);
        rect.setAttribute('data-processed','true');
    }

    // =================== Process existing rects ===================
    const rects = Array.from(mainSvg.querySelectorAll('rect.m'));
    rects.forEach(processRect);

    // =================== Observer for future rects ===================
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1 && node.matches('rect.m') && !node.hasAttribute('data-processed')) {
                    processRect(node);
                }
                if (node.querySelector) {
                    node.querySelectorAll('rect.m:not([data-processed])').forEach(processRect);
                }
            });
        });
    });
    observer.observe(mainSvg, { childList: true, subtree: true });

    // =================== Lazy Load Images ===================
    const svgImages = Array.from(mainSvg.querySelectorAll('image.lazy-map'));
    const urls = svgImages.map(img => img.getAttribute('data-src') || img.getAttribute('href'));
    let loadedCount = 0;
    const totalCount = urls.length;
    function updateLoader() {
        const percent = Math.round((loadedCount / totalCount) * 100);
        if (loadingText) loadingText.textContent = `Preparing the environment... ${percent}%`;
        if (percent>=25) document.getElementById('bulb-1').classList.add('on');
        if (percent>=50) document.getElementById('bulb-2').classList.add('on');
        if (percent>=75) document.getElementById('bulb-3').classList.add('on');
        if (percent===100) document.getElementById('bulb-4').classList.add('on');
    }
    function finishLoading() {
        if (!loadingOverlay) return;
        setTimeout(()=>{
            loadingOverlay.style.opacity=0;
            setTimeout(()=>{
                loadingOverlay.style.display='none';
                mainSvg.style.opacity=1;
            },300);
        },0);
    }
    urls.forEach((url,i)=>{
        const img=new Image();
        img.onload=img.onerror=()=>{
            loadedCount++;
            updateLoader();
            if(loadedCount===totalCount){
                finishLoading();
                svgImages.forEach((svgImg,j)=>{svgImg.setAttribute('href', urls[j]);});
            }
        };
        img.src = url;
    });

    // =================== Toggle Interaction ===================
    jsToggle.addEventListener('change', function() {
        interactionEnabled = this.checked;
        const label = document.getElementById('toggle-label');
        label.textContent = interactionEnabled ? 'Interaction Enabled' : 'Interaction Disabled';
        if (!interactionEnabled) cleanupHover();
    });
};