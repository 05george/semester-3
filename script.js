const mainSvg = document.getElementById('main-svg');
const clipDefs = mainSvg.querySelector('defs');
const scrollContainer = document.querySelector('div');
const activeState = { rect: null, zoomPart: null, animationId: null, clipPathId: null };
const MAX_SCROLL_LEFT = 6 * 1024;

scrollContainer.addEventListener('scroll', function() {
    // تحديد أقصى حد للتمرير لليمين (إذا كان هذا هو المطلوب في التصميم)
    if (this.scrollLeft > MAX_SCROLL_LEFT) {
        this.scrollLeft = MAX_SCROLL_LEFT;
    }
});

/**
 * يحسب مجموع تحويلات translate لجميع المجموعات (g) الأبّية.
 * @param {Element} element
 * @returns {{x: number, y: number}}
 */
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

/**
 * يعثر على صورة الخلفية ضمن المجموعة (g) التي تحتوي العنصر.
 * @param {Element} element
 * @returns {{src: string, width: number, height: number, group: Element} | null}
 */
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

/**
 * تنظيف حالة التحويم النشطة وإزالة العناصر المؤقتة.
 */
function cleanupHover() {
    if (!activeState.rect) return;
    if(activeState.animationId) clearInterval(activeState.animationId);
    
    // إزالة التأثيرات من المستطيل
    activeState.rect.style.transform = 'scale(1)';
    activeState.rect.style.filter = 'none';
    activeState.rect.style.strokeWidth = '2px';

    // إزالة جزء التكبير
    if(activeState.zoomPart) activeState.zoomPart.remove();
    
    // إزالة مسار القص (clipPath)
    const currentClip = document.getElementById(activeState.clipPathId);
    if(currentClip) currentClip.remove();
    
    Object.assign(activeState, { rect:null, zoomPart:null, animationId:null, clipPathId:null });
}

/**
 * تبدأ تأثير التحويم (Hover).
 */
function startHover() {
    const rect = this;

    // منع تكرار التحويم لنفس العنصر
    if(activeState.rect === rect) return;
    
    cleanupHover();
    
    // حفظ الحالة الجديدة
    activeState.rect = rect;
    const i = rect.getAttribute('data-index') || Date.now();
    const clipPathId = `clip-${i}-${Date.now()}`;
    activeState.clipPathId = clipPathId;

    const scale = 1.1;
    const x = parseFloat(rect.getAttribute('x'));
    const y = parseFloat(rect.getAttribute('y'));
    const width = parseFloat(rect.getAttribute('width'));
    const height = parseFloat(rect.getAttribute('height'));

    const cumulative = getCumulativeTranslate(rect);
    const absoluteX = x + cumulative.x;
    const absoluteY = y + cumulative.y;

    const imageData = getGroupImage(rect);
    if (!imageData) return; // لا توجد صورة خلفية، نتوقف

    // 1. إنشاء مسار القص (Clip Path)
    let clip = document.createElementNS('http://www.w3.org/2000/svg','clipPath');
    clip.setAttribute('id', clipPathId);
    let clipRect = document.createElementNS('http://www.w3.org/2000/svg','rect');
    clipRect.setAttribute('x', absoluteX);
    clipRect.setAttribute('y', absoluteY);
    clipRect.setAttribute('width', width);
    clipRect.setAttribute('height', height);
    clipDefs.appendChild(clip).appendChild(clipRect);

    // 2. إنشاء جزء التكبير (Zoom Part)
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

    // 3. تطبيق التحويل (Transform)
    const centerX = absoluteX + width/2;
    const centerY = absoluteY + height/2;
    
    // تطبيق التحويل على المستطيل نفسه
    rect.style.transformOrigin = `${x + width/2}px ${y + height/2}px`;
    rect.style.transform = `scale(${scale})`;
    rect.style.strokeWidth = '4px';

    // تطبيق التحويل على جزء التكبير
    zoomPart.style.transformOrigin = `${centerX}px ${centerY}px`;
    zoomPart.style.transform = `scale(${scale})`;
    zoomPart.style.opacity = 1;

    // 4. تطبيق حركة التوهج (Glow Animation)
    let hue = 0;
    const animationId = setInterval(() => {
        hue = (hue + 10) % 360; // زيادة سرعة تغيير اللون
        const glow = `drop-shadow(0 0 8px hsl(${hue},100%,55%)) drop-shadow(0 0 14px hsl(${(hue+60)%360},100%,60%))`;
        rect.style.filter = glow;
        if(zoomPart) zoomPart.style.filter = glow;
    }, 100);
    activeState.animationId = animationId;
}

/**
 * توقف تأثير التحويم.
 */
function stopHover(e) {
    // للتأكد من أننا نوقف التحويم عند خروج الماوس من العنصر الحالي فقط
    if (activeState.rect === this) {
        // نستخدم setTimeout لمنح فرصة للانتقال بين العناصر دون اختفاء التأثير
        setTimeout(cleanupHover, 50); 
    }
}


/**
 * ربط وظيفة التحويم بعناصر المستطيل.
 * @param {Element} rect
 * @param {string | number} i
 */
function attachHover(rect, i) {
    rect.setAttribute('data-index', i);

    // التحويم للكمبيوتر
    rect.addEventListener('mouseover', startHover);
    rect.addEventListener('mouseout', stopHover);
    
    // اللمس للموبايل
    rect.addEventListener('touchstart', startHover);
    rect.addEventListener('touchend', cleanupHover);
}

// ---------------------------------------------
// تنفيذ الكود والربط المبدئي
// ---------------------------------------------

document.querySelectorAll('rect.image-mapper-shape').forEach((rect, i) => {
    rect.setAttribute('data-processed', 'true');
    attachHover(rect, i);
});

// ---------------------------------------------
// مراقب الإضافات الجديدة (MutationObserver)
// ---------------------------------------------
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

// ---------------------------------------------
// التعامل مع النقر (Click Handler)
// ---------------------------------------------
function handleRectClick(event) {
    const targetRect = event.target.closest('.image-mapper-shape');

    if (targetRect) {
        const href = targetRect.getAttribute('data-href');

        if (href && href !== '#') {
            // منطق التحقق من الموبايل
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
