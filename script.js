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
        rect: null,
        zoomPart: null,
        zoomText: null,
        baseText: null,
        animationId: null,
        clipPathId: null,
        initialScrollLeft: 0,
        isScrolling: false,
        touchStartTime: 0
    };

    function debounce(func, delay) {
        let timeoutId;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        }
    }

    // إعداد حجم الـ SVG تلقائياً حسب الصور
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

    // مراقبة scroll
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
        while (current && current.tagName !== 'svg') {
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
        while (current && current.tagName !== 'svg') {
            if (current.tagName === 'g') {
                const images = [...current.children].filter(c => c.tagName === 'image');
                if (images.length) {
                    const baseImage = images[0];
                    return { src: baseImage.getAttribute('data-src') || baseImage.getAttribute('href'), width: parseFloat(baseImage.getAttribute('width')), height: parseFloat(baseImage.getAttribute('height')), group: current };
                }
            }
            current = current.parentNode;
        }
        return null;
    }

    function cleanupHover() {
        if (!activeState.rect) return;
        const { rect, zoomPart, zoomText, baseText, animationId, clipPathId } = activeState;
        if (animationId) clearInterval(animationId);
        rect.style.filter = 'none';
        rect.style.transform = 'scale(1)';
        rect.style.strokeWidth = '2px';
        if (zoomPart) {
            zoomPart.style.filter = 'none';
            zoomPart.style.transform = 'scale(1)';
            zoomPart.remove();
        }
        if (zoomText) zoomText.remove();
        if (baseText) baseText.style.opacity = '1';
        const clip = document.getElementById(clipPathId);
        if (clip) clip.remove();
        Object.assign(activeState, { rect: null, zoomPart: null, zoomText: null, baseText: null, animationId: null, clipPathId: null, initialScrollLeft: 0, isScrolling: false, touchStartTime: 0 });
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
            const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
            clip.setAttribute('id', clipPathId);
            const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            clipRect.setAttribute('x', absoluteX);
            clipRect.setAttribute('y', absoluteY);
            clipRect.setAttribute('width', width);
            clipRect.setAttribute('height', height);
            clip.appendChild(clipRect);
            clipDefs.appendChild(clip);

            const zoomPart = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            zoomPart.setAttribute('href', imageData.src);
            zoomPart.setAttribute('width', imageData.width);
            zoomPart.setAttribute('height', imageData.height);
            zoomPart.setAttribute('class', 'zoom-part');
            zoomPart.setAttribute('clip-path', `url(#${clipPathId})`);
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

        // Glow animation
        let hue = 0;
        activeState.animationId = setInterval(() => {
            hue = (hue + 10) % 360;
            const glow = `drop-shadow(0 0 8px hsl(${hue},100%,55%)) drop-shadow(0 0 14px hsl(${(hue+60)%360},100%,60%))`;
            rect.style.filter = glow;
            if (zoomPartElement) zoomPartElement.style.filter = glow;
        }, 100);
    }

    function stopHover() {
        if (!interactionEnabled) return;
        if (activeState.rect === this) cleanupHover();
    }

    function handleLinkOpen(event) {
        const href = event.currentTarget.getAttribute('data-href');
        if (href && href !== '#') {
            window.open(href, '_blank');
            event.preventDefault();
            event.stopPropagation();
        }
    }

    function attachHover(rect) {
        if (!isTouchDevice) {
            rect.addEventListener('mouseover', startHover);
            rect.addEventListener('mouseout', stopHover);
        }
        rect.addEventListener('click', handleLinkOpen);

        if (isTouchDevice) {
            rect.addEventListener('touchstart', function(event) {
                activeState.touchStartTime = Date.now();
                activeState.initialScrollLeft = scrollContainer.scrollLeft;
                activeState.isScrolling = false;
                startHover.call(this);
            });
            rect.addEventListener('touchend', function(event) {
                const timeElapsed = Date.now() - activeState.touchStartTime;
                if (activeState.isScrolling === false && timeElapsed < TAP_THRESHOLD_MS) {
                    handleLinkOpen(event);
                }
                cleanupHover();
            });
        }
    }

    // ربط جميع المستطيلات
    document.querySelectorAll('rect.image-mapper-shape').forEach(rect => {
        attachHover(rect);
    });

    // Toggle التفاعل
    jsToggle.addEventListener('change', function() {
        interactionEnabled = this.checked;
        if (!interactionEnabled) cleanupHover();
    });
};