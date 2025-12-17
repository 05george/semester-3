window.onload = function() {
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    const clipDefs = mainSvg.querySelector('defs');

    let interactionEnabled = true;
    const activeState = { rect: null, zoomPart: null, animationId: null, clipPathId: null };

    // 1. وظيفة حساب الموقع الحقيقي (الحل لمشكلة الهوفر)
    function getCumulativeTranslate(el) {
        let x = 0, y = 0;
        while (el && el.tagName !== 'svg') {
            const transform = el.getAttribute('transform');
            if (transform) {
                const m = transform.match(/translate\(([\d.-]+)[ ,]+([\d.-]+)\)/);
                if (m) { x += parseFloat(m[1]); y += parseFloat(m[2]); }
            }
            el = el.parentNode;
        }
        return { x, y };
    }

    // 2. تفعيل الهوفر والزوم
    function startHover() {
        if (!interactionEnabled || activeState.rect === this) return;
        cleanupHover();
        const rect = this;
        activeState.rect = rect;

        const offset = getCumulativeTranslate(rect);
        const x = parseFloat(rect.getAttribute('x')), y = parseFloat(rect.getAttribute('y'));
        const w = parseFloat(rect.getAttribute('width')), h = parseFloat(rect.getAttribute('height'));
        const absX = x + offset.x, absY = y + offset.y;

        rect.style.transform = "scale(1.1)";
        rect.style.transformOrigin = `${x + w/2}px ${y + h/2}px`;

        // إنشاء الزوم
        const group = rect.closest('g');
        const img = group.querySelector('image');
        if (img) {
            const clipId = `clip-${Date.now()}`;
            activeState.clipPathId = clipId;
            const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
            clip.setAttribute('id', clipId);
            const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            clipRect.setAttribute('x', absX); clipRect.setAttribute('y', absY);
            clipRect.setAttribute('width', w); clipRect.setAttribute('height', h);
            clipDefs.appendChild(clip).appendChild(clipRect);

            const zoomImg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            zoomImg.setAttribute('href', img.getAttribute('data-src') || img.getAttribute('href'));
            zoomImg.setAttribute('width', img.getAttribute('width'));
            zoomImg.setAttribute('height', img.getAttribute('height'));
            zoomImg.setAttribute('x', offset.x); zoomImg.setAttribute('y', offset.y);
            zoomImg.setAttribute('clip-path', `url(#${clipId})`);
            zoomImg.classList.add('zoom-part');
            
            mainSvg.appendChild(zoomImg);
            activeState.zoomPart = zoomImg;
            zoomImg.style.transformOrigin = `${absX + w/2}px ${absY + h/2}px`;
            zoomImg.style.transform = "scale(1.1)";
        }
    }

    function cleanupHover() {
        if (!activeState.rect) return;
        activeState.rect.style.transform = "scale(1)";
        activeState.rect.style.filter = "none";
        if (activeState.zoomPart) activeState.zoomPart.remove();
        const clip = document.getElementById(activeState.clipPathId);
        if (clip) clip.remove();
        activeState.rect = null;
    }

    // 3. معالجة المستطيلات والنصوص
    document.querySelectorAll('rect.m').forEach(rect => {
        const href = rect.getAttribute('data-href');
        const fileName = href.split('/').pop().split('.')[0];
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', parseFloat(rect.getAttribute('x')) + parseFloat(rect.getAttribute('width'))/2);
        text.setAttribute('y', parseFloat(rect.getAttribute('y')) + 15);
        text.classList.add('rect-label');
        text.style.fontSize = "12px";
        text.textContent = fileName === "#" ? "" : fileName;
        rect.parentNode.insertBefore(text, rect.nextSibling);

        rect.addEventListener('mouseenter', startHover);
        rect.addEventListener('mouseleave', cleanupHover);
        rect.addEventListener('click', () => href !== "#" && window.open(href, '_blank'));
    });

    // 4. نظام التحميل الذكي (Lazy Map)
    const allImages = Array.from(mainSvg.querySelectorAll('image'));
    const critical = allImages.filter(img => !img.classList.contains('lazy-map'));
    let loadedCount = 0;

    function revealSite() {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
            mainSvg.style.opacity = '1';
            scrollContainer.scrollLeft = scrollContainer.scrollWidth; // التوجه لآخر أسبوع
            // تحميل الباقي في الخلفية
            allImages.forEach(img => {
                const src = img.getAttribute('data-src');
                if (src) img.setAttribute('href', src);
            });
        }, 500);
    }

    if (critical.length === 0) revealSite();
    else {
        critical.forEach(img => {
            const temp = new Image();
            temp.onload = temp.onerror = () => {
                loadedCount++;
                if (loadedCount >= critical.length) revealSite();
            };
            temp.src = img.getAttribute('data-src') || img.getAttribute('href');
        });
    }
    setTimeout(revealSite, 5000); // أمان 5 ثواني
};