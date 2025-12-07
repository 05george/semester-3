const mainSvg = document.getElementById('main-svg');
const clipDefs = mainSvg.querySelector('defs');
const scrollContainer = document.querySelector('div');
const activeState = { rect: null, zoomPart: null, animationId: null, clipPathId: null };
const MAX_SCROLL_LEFT = mainSvg.viewBox.baseVal.width - scrollContainer.clientWidth;

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
            const images = Array.from(current.children).filter(c => c.tagName === 'image' && (c.getAttribute('href') || c.getAttribute('xlink:href')));
            if (images.length) {
                const baseImage = images[0];
                const IMAGE_SRC = baseImage.getAttribute('href') || baseImage.getAttribute('xlink:href');
                const IMAGE_WIDTH = parseFloat(baseImage.getAttribute('width'));
                const IMAGE_HEIGHT = parseFloat(baseImage.getAttribute('height'));
                if (!isNaN(IMAGE_WIDTH) && !isNaN(IMAGE_HEIGHT)) return { src: IMAGE_SRC, width: IMAGE_WIDTH, height: IMAGE_HEIGHT, group: current };
            }
        }
        current = current.parentNode;
    }
    return null;
}

function cleanupHover() {
    if (!activeState.rect) return;
    if(activeState.animationId) clearInterval(activeState.animationId);
    activeState.rect.style.transform = 'scale(1)';
    activeState.rect.style.filter = 'none';
    activeState.rect.style.strokeWidth = '2px';
    if(activeState.zoomPart) activeState.zoomPart.remove();
    const currentClip = document.getElementById(activeState.clipPathId);
    if(currentClip) currentClip.remove();
    Object.assign(activeState, { rect:null, zoomPart:null, animationId:null, clipPathId:null });
}

function attachHover(rect, i) {
    const clipPathId = `clip-${i}-${Date.now()}`;
    const scale = 1.1;
    rect.setAttribute('data-index', i);

    rect.addEventListener('mouseover', startHover);
    rect.addEventListener('mouseout', stopHover);
    rect.addEventListener('touchstart', startHover);
    rect.addEventListener('touchend', cleanupHover);
    
    function startHover() {
        if(activeState.rect === rect) return;
        cleanupHover();
        activeState.rect = rect;
        activeState.clipPathId = clipPathId;

        const x = parseFloat(rect.getAttribute('x'));
        const y = parseFloat(rect.getAttribute('y'));
        const width = parseFloat(rect.getAttribute('width'));
        const height = parseFloat(rect.getAttribute('height'));

        const cumulative = getCumulativeTranslate(rect);
        const absoluteX = x + cumulative.x;
        const absoluteY = y + cumulative.y;

        const imageData = getGroupImage(rect);
        if (!imageData) return;

        let clip = document.createElementNS('http://www.w3.org/2000/svg','clipPath');
        clip.setAttribute('id', clipPathId);
        let clipRect = document.createElementNS('http://www.w3.org/2000/svg','rect');
        clipRect.setAttribute('x', absoluteX);
        clipRect.setAttribute('y', absoluteY);
        clipRect.setAttribute('width', width);
        clipRect.setAttribute('height', height);
        clipDefs.appendChild(clip).appendChild(clipRect);

        const zoomPart = document.createElementNS('http://www.w3.org/2000/svg','image');
        zoomPart.setAttribute('href', imageData.src);
        zoomPart.setAttribute('width', imageData.width);
        zoomPart.setAttribute('height', imageData.height);
        zoomPart.setAttribute('class','zoom-part');
        zoomPart.setAttribute('clip-path', `url(#${clipPathId})`);

        const groupParentTransform = imageData.group.getAttribute('transform');
        const match = groupParentTransform ? groupParentTransform.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/) : null;
        const groupX = match ? parseFloat(match[1]) : 0;
        const groupY = match ? parseFloat(match[2]) : 0;

        zoomPart.setAttribute('x', groupX);
        zoomPart.setAttribute('y', groupY);

        zoomPart.style.opacity = 0;
        mainSvg.appendChild(zoomPart);
        activeState.zoomPart = zoomPart;

        const centerX = absoluteX + width/2;
        const centerY = absoluteY + height/2;

        rect.style.transformOrigin = `${x + width/2}px ${y + height/2}px`;
        rect.style.transform = `scale(${scale})`;
        rect.style.strokeWidth = '4px';

        zoomPart.style.transformOrigin = `${centerX}px ${centerY}px`;
        zoomPart.style.transform = `scale(${scale})`;
        zoomPart.style.opacity = 1;

        let hue = 0;
        let currentStrokeWidth = 4;
        const animationId = setInterval(() => {
            hue = (hue + 1) % 360;
            const glow = `drop-shadow(0 0 8px hsl(${hue},100%,55%)) drop-shadow(0 0 14px hsl(${(hue+60)%360},100%,60%))`;
            rect.style.filter = glow;
            if(zoomPart) zoomPart.style.filter = glow;
            currentStrokeWidth = (currentStrokeWidth === 4) ? 3.5 : 4;
            rect.style.strokeWidth = `${currentStrokeWidth}px`;
        }, 100);
        activeState.animationId = animationId;
    }

    function stopHover(e) {
        const targetRect = e ? (e.target.tagName === 'rect' ? e.target.closest('rect') : e.target.closest('a')?.querySelector('.image-mapper-shape')) : rect;
        if(targetRect === activeState.rect && e.type === 'mouseout') cleanupHover();
    }
}

document.querySelectorAll('rect.image-mapper-shape').forEach((rect, i) => {
    rect.setAttribute('data-processed', 'true');
    attachHover(rect, i);
});

const rootObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                if (node.matches('rect.image-mapper-shape') && !node.hasAttribute('data-processed')) {
                    attachHover(node, Date.now());
                    node.setAttribute('data-processed', 'true');
                }
                if (node.querySelector) {
                    node.querySelectorAll('rect.image-mapper-shape:not([data-processed])').forEach(rect => {
                        attachHover(rect, Date.now());
                        rect.setAttribute('data-processed', 'true');
                    });
                }
            }
        });
    });
});
rootObserver.observe(mainSvg, { childList: true, subtree: true });

function handleRectClick(event) {
    const targetRect = event.target.closest('.image-mapper-shape');

    if (targetRect) {
        const href = targetRect.getAttribute('data-href');
        
        if (href && href !== '#') {
            const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0) || (window.innerWidth < 800);
            
            if (isMobile) {
                window.location.href = href;
            } else {
                window.open(href, '_blank');
            }
            
            event.preventDefault();
        }
    }
}

mainSvg.addEventListener('click', handleRectClick); 