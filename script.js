const mainSvg = document.getElementById('main-svg');
const clipDefs = mainSvg.querySelector('defs');
const scrollContainer = document.querySelector('div');
// لم نعد نحتاج لـ zoomPart أو clipPathId في activeState
const activeState = { rect: null, animationId: null }; 
const MAX_SCROLL_LEFT = 6 * 1024;
const SCALE_FACTOR = 1.1; // عامل التكبير

scrollContainer.addEventListener('scroll', function() {
    if (this.scrollLeft > MAX_SCROLL_LEFT) {
        this.scrollLeft = MAX_SCROLL_LEFT;
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

// ⚠️ لم نعد نحتاج إلى دالة getGroupImage ⚠️

function cleanupHover() {
    if (!activeState.rect) return;
    if(activeState.animationId) clearInterval(activeState.animationId);
    
    // إعادة الـ SVG لحالته الأصلية وإلغاء الزوم
    mainSvg.style.transform = 'translate(0, 0) scale(1)';

    // إزالة التوهج من المستطيل
    activeState.rect.style.filter = 'none';
    activeState.rect.style.strokeWidth = '2px';
    
    // لم نعد بحاجة إلى إزالة zoomPart أو clipPath
    
    Object.assign(activeState, { rect:null, animationId:null });
}

function attachHover(rect, i) {
    rect.setAttribute('data-index', i);

    rect.addEventListener('mouseover', startHover);
    rect.addEventListener('mouseout', stopHover);
    rect.addEventListener('touchstart', startHover);
    rect.addEventListener('touchend', cleanupHover);

    function startHover() {
        if(activeState.rect === rect) return;
        cleanupHover();
        activeState.rect = rect;

        const x = parseFloat(rect.getAttribute('x'));
        const y = parseFloat(rect.getAttribute('y'));
        const width = parseFloat(rect.getAttribute('width'));
        const height = parseFloat(rect.getAttribute('height'));

        const cumulative = getCumulativeTranslate(rect);
        const absoluteX = x + cumulative.x;
        const absoluteY = y + cumulative.y;

        // حساب مركز المستطيل (بالإحداثيات المطلقة داخل الـ SVG)
        const rectCenterX = absoluteX + width / 2;
        const rectCenterY = absoluteY + height / 2;
        
        // حساب إزاحة التحريك (Translation)
        // نريد أن يكون مركز الـ SVG الجديد (بعد التكبير) هو مكان مركز المستطيل الحالي
        // لكن يجب أن نأخذ في الاعتبار تحريك حاوية الـ Scroll (scrollContainer)

        const svgWidth = mainSvg.viewBox.baseVal.width;
        const svgHeight = mainSvg.viewBox.baseVal.height;
        const viewportWidth = scrollContainer.clientWidth;
        const viewportHeight = scrollContainer.clientHeight;
        
        // نسبة التكبير الحالية للـ SVG نسبةً لحجمه الأصلي في ViewBox
        const currentSvgScaleX = viewportWidth / svgWidth;
        const currentSvgScaleY = viewportHeight / svgHeight;

        // نحسب المركز المرئي الحالي للمستطيل بالنسبة لـ Viewport (أو حاوية الـ scroll)
        // يجب أن نأخذ scrollLeft في الحسبان
        const scrollOffset = scrollContainer.scrollLeft;
        
        // النقطة التي يجب أن يكون عندها الـ SVG (بالإحداثيات الأصلية قبل التكبير)
        // هذا يتطلب رياضيات معقدة قليلاً لتحديد التحريك المضاد لمركز المستطيل

        // حساب المسافة التي يجب أن يتحركها الـ SVG ليكون مركز المستطيل في مركز الشاشة المرئية تقريباً
        const targetX = rectCenterX;
        const targetY = rectCenterY;
        
        // X = (targetX * SCALE_FACTOR) - (ViewportWidth / 2) 
        // Y = (targetY * SCALE_FACTOR) - (ViewportHeight / 2)

        // سنقوم بتبسيط الحساب للتركيز على إبقاء المستطيل مرئياً (بدلاً من وضعه في المنتصف تماماً)
        // التحريك = - (مركز المستطيل المطلق * (عامل التكبير - 1)) + (Offset لتعديل موضع العرض)
        
        const offsetX = (rectCenterX * (SCALE_FACTOR - 1));
        const offsetY = (rectCenterY * (SCALE_FACTOR - 1));
        
        // التحريك المضاد (Negative Translation) للـ SVG الرئيسي
        mainSvg.style.transform = `scale(${SCALE_FACTOR}) translate(-${offsetX}px, -${offsetY}px) translateZ(0)`;

        // تحديد المستطيل نفسه
        rect.style.strokeWidth = '4px';

        // تأثير التوهج للحالة النشطة
        let hue = 0;
        let currentStrokeWidth = 4;
        const animationId = setInterval(() => {
            hue = (hue + 1) % 360;
            const glow = `drop-shadow(0 0 8px hsl(${hue},100%,55%)) drop-shadow(0 0 14px hsl(${(hue+60)%360},100%,60%))`;
            rect.style.filter = glow;
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