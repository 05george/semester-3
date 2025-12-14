Document.addEventListener('DOMContentLoaded', () => {

const mainSvg = document.getElementById('main-svg');
const scrollContainer = document.getElementById('scroll-container');
const clipDefs = mainSvg ? mainSvg.querySelector('defs') : null;
const loadingOverlay = document.getElementById('loading-overlay');

const isTouchDevice = window.matchMedia('(hover: none)').matches;
const TAP_THRESHOLD_MS = 300;

const activeState = {
    rect: null,
    zoomPart: null,
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
    };
}

function updateDynamicSizes() {
    const images = mainSvg.querySelectorAll('image');
    if (!images.length) return;
    const firstImage = images[0];
    const imageWidth = parseFloat(firstImage.getAttribute('width')) || 1024;
    const imageHeight = parseFloat(firstImage.getAttribute('height')) || 2454;
    
    const totalWidth = images.length * imageWidth;
    mainSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${imageHeight}`);
    
    window.MAX_SCROLL_LEFT = totalWidth - (window.innerWidth || document.documentElement.clientWidth); 
}

updateDynamicSizes();

const debouncedCleanupHover = debounce(function() {
    if (activeState.rect) {
        cleanupHover();
    }
}, 50);

// الدالة المبسطة لتحميل الصورة (تعتمد على المتصفح وتزيل شاشة التحميل)
function lazyLoadImage(imgElement) {
    // لو الصورة بدأت تحميل خلاص، متعملش حاجة
    if (imgElement.hasAttribute('data-loading') || imgElement.getAttribute('href')) {
        return;
    }
    
    const src = imgElement.getAttribute('data-src');
    
    const g = imgElement.closest('g');
    const transformAttr = g.getAttribute('transform');
    const match = transformAttr ? transformAttr.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/) : null;
    const imageX = match ? parseFloat(match[1]) : 0;
    const weekNumber = (imageX / 1024) + 1; 
    
    const overlay = mainSvg.querySelector(`.lazy-loading-overlay[data-loading-week="${weekNumber}"]`);
    const text = mainSvg.querySelector(`.lazy-loading-text[data-loading-week="${weekNumber}"]`);

    imgElement.setAttribute('data-loading', 'true');
    imgElement.removeAttribute('data-src'); 

    // البدء الفعلي للتحميل عن طريق المتصفح
    imgElement.setAttribute('href', src);

    // متابعة تحميل الصورة
    imgElement.onload = () => {
        if (text) text.textContent = '100%';
        if (overlay) overlay.style.opacity = '0';
        if (text) text.style.opacity = '0';

        setTimeout(() => {
            if (overlay) overlay.remove();
            if (text) text.remove();
            imgElement.removeAttribute('data-loading');
        }, 300);
    };
    
    // في حالة فشل التحميل
    imgElement.onerror = () => {
        if (text) text.textContent = 'Failed to load';
        if (overlay) overlay.style.fill = 'red';
        imgElement.removeAttribute('data-loading');
    };
}


function checkLazyLoad() {
    const scrollLeft = scrollContainer.scrollLeft;
    const viewportWidth = window.innerWidth;
    const lazyImages = mainSvg.querySelectorAll('image[data-src]:not([data-loading])'); 
    
    // قيمة عتبة التحميل العاجل (الصور الظاهرة + شاشة إضافية)
    const HIGH_PRIORITY_THRESHOLD = viewportWidth * 2; 
    
    // --- 1. التحميل العاجل (High Priority) ---
    // تحميل الصور القريبة جدًا من الشاشة أولاً
    lazyImages.forEach(img => {
        const g = img.closest('g');
        const transformAttr = g.getAttribute('transform');
        const match = transformAttr ? transformAttr.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/) : null;
        const imageX = match ? parseFloat(match[1]) : 0;

        // الشرط: لو إحداثيات الصورة أقل من نهاية الرؤية + منطقة تحميل عاجل
        if (imageX < scrollLeft + viewportWidth + HIGH_PRIORITY_THRESHOLD) {
             lazyLoadImage(img);
        }
    });
    
    // --- 2. التحميل التدريجي في الخلفية (Low Priority / Eager Load) ---
    // يبدأ تحميل باقي الصور بمجرد تحريك بسيط للشاشة (بعد أول صورتين)
    const LOW_PRIORITY_SCROLL_TRIGGER = 5; 
    
    if (scrollLeft > LOW_PRIORITY_SCROLL_TRIGGER) {
        lazyImages.forEach(img => {
            // تحميل باقي الصور اللي لسه مابدأت
             lazyLoadImage(img);
        });
    }
}


scrollContainer.addEventListener('scroll', function () {
    if (this.scrollLeft > window.MAX_SCROLL_LEFT) {
        this.scrollLeft = window.MAX_SCROLL_LEFT;
    }

    if (activeState.rect && !isTouchDevice) {  
        debouncedCleanupHover();  
    }  

    if (activeState.rect && isTouchDevice) {  
        if (Math.abs(this.scrollLeft - activeState.initialScrollLeft) > 5) {   
             activeState.isScrolling = true;  
             cleanupHover();   
        }  
    }

    checkLazyLoad();
});

checkLazyLoad(); 


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
                const imageSource = baseImage.getAttribute('href'); 
                if (!imageSource) return null;

                return {
                    src: imageSource,
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
    if (activeState.animationId) clearInterval(activeState.animationId);
    activeState.rect.style.transform = 'scale(1)';
    activeState.rect.style.filter = 'none';
    activeState.rect.style.strokeWidth = '2px';
    if (activeState.zoomPart) activeState.zoomPart.remove();
    if (activeState.zoomText) activeState.zoomText.remove();

    if (activeState.baseText) {  
        activeState.baseText.style.opacity = '1';  
    }  

    const currentClip = document.getElementById(activeState.clipPathId);  
    if (currentClip) currentClip.remove();  

    Object.assign(activeState, { rect: null, zoomPart: null, zoomText: null, baseText: null, animationId: null, clipPathId: null, initialScrollLeft: 0, isScrolling: false, touchStartTime: 0 });

}

function startHover() {
    const rect = this;
    if (activeState.rect === rect) return;
    cleanupHover();
    activeState.rect = rect;

    const imageElement = rect.closest('g').querySelector('image');
    if (!imageElement || !imageElement.getAttribute('href')) {
        return; 
    }

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
    if (!imageData) return;  

    const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');  
    clip.setAttribute('id', clipPathId);  
    const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');  
    clipRect.setAttribute('x', absoluteX);  
    clipRect.setAttribute('y', absoluteY);  
    clipRect.setAttribute('width', width);  
    clipRect.setAttribute('height', height);  
    clipDefs.appendChild(clip).appendChild(clipRect);  

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

    const centerX = absoluteX + width / 2;  
    const centerY = absoluteY + height / 2;  

    rect.style.transformOrigin = `${x + width / 2}px ${y + height / 2}px`;  
    rect.style.transform = `scale(${scale})`;  
    rect.style.strokeWidth = '4px';  
    zoomPart.style.transformOrigin = `${centerX}px ${centerY}px`;  
    zoomPart.style.transform = `scale(${scale})`;  
    zoomPart.style.opacity = 1;  

    let hue = 0;  
    activeState.animationId = setInterval(() => {  
        hue = (hue + 10) % 360;  
        const glow = `drop-shadow(0 0 8px hsl(${hue},100%,55%)) drop-shadow(0 0 14px hsl(${(hue + 60) % 360},100%,60%))`;  
        rect.style.filter = glow;  
        zoomPart.style.filter = glow;  
        if (activeState.zoomText) activeState.zoomText.style.filter = glow;  
    }, 100);  

    let baseText = rect.nextElementSibling;  
    if (baseText && !baseText.matches('text.rect-label')) {  
        baseText = null;
    }  

    if (baseText) {  
        baseText.style.opacity = '0';  
        activeState.baseText = baseText;  

        const zoomText = baseText.cloneNode(true);  
        const baseFont = parseFloat(baseText.style.fontSize);  

        zoomText.style.fontSize = (baseFont * 2) + 'px';   

        zoomText.style.fill = 'white';  
        zoomText.style.pointerEvents = 'none';  
        zoomText.style.userSelect = 'none';  
        zoomText.style.opacity = '1';  
        zoomText.setAttribute('x', absoluteX + width / 2);  
        zoomText.setAttribute('y', absoluteY + baseFont * 1.5);  
        zoomText.setAttribute('text-anchor', 'middle');  
        mainSvg.appendChild(zoomText);  
        activeState.zoomText = zoomText;  
    }

}

function stopHover() {
    if (activeState.rect === this) cleanupHover();
}

function handleLinkOpen(event) {
    const href = event.currentTarget.getAttribute('href');
    if (href && href !== '#') {
        window.open(href, '_blank');
        event.preventDefault();
        event.stopPropagation();
    }
}

function attachHover(rect, i) {
    rect.setAttribute('data-index', i);

    if (!isTouchDevice) {  
        rect.addEventListener('mouseover', startHover);  
        rect.addEventListener('mouseout', stopHover);  
        rect.addEventListener('click', handleLinkOpen);   
    }  

    rect.addEventListener('touchstart', function(event) {  
        activeState.touchStartTime = Date.now();   
        activeState.initialScrollLeft = scrollContainer.scrollLeft;  
        activeState.isScrolling = false;  

        if (!isTouchDevice) startHover.call(this);  
    });  

    rect.addEventListener('touchend', function(event) {  
        const timeElapsed = Date.now() - activeState.touchStartTime;  

        if (activeState.isScrolling === false && timeElapsed < TAP_THRESHOLD_MS) {   
            handleLinkOpen(event);   
        }  

        cleanupHover();   
    });

}

document.querySelectorAll('rect.image-mapper-shape').forEach(rect => {
    const href = rect.getAttribute('href') || '';

    const fileName = href.split('/').pop().split('#')[0] || '';  
    const textContent = fileName;  

    const rectWidth = parseFloat(rect.getAttribute('width'));  
    const rectX = parseFloat(rect.getAttribute('x'));  
    const rectY = parseFloat(rect.getAttribute('y'));  
    const minFont = 8;  
    const maxFont = 16;  
    const scaleFactor = 0.12;  
    let fontSize = rectWidth * scaleFactor;  
    fontSize = Math.max(minFont, Math.min(maxFont, fontSize));  
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');  
    text.setAttribute('x', rectX + rectWidth / 2);  
    text.setAttribute('y', rectY + fontSize + 6);  
    text.setAttribute('text-anchor', 'middle');  
    text.textContent = textContent;  
    text.style.fontSize = fontSize + 'px';  
    text.style.fill = 'white';  
    text.style.pointerEvents = 'none';  

    text.setAttribute('class', 'rect-label');  
    rect.parentNode.insertBefore(text, rect.nextSibling);

});

document.querySelectorAll('rect.image-mapper-shape').forEach((rect, i) => {
    rect.setAttribute('data-processed', 'true');
    attachHover(rect, i);
});

function finishLoading() {
    if (loadingOverlay) {
        // حط هنا شرط بسيط عشان الدالة متشتغلش مرتين
        if (loadingOverlay.style.display === 'none') return;
        
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 500);
    }
    mainSvg.style.opacity = '1';
}

const rootObserver = new MutationObserver(mutations => {
    let newRectsFound = false;
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                if (node.matches('rect.image-mapper-shape') && !node.hasAttribute('data-processed')) {
                    attachHover(node, Date.now());
                    node.setAttribute('data-processed', 'true');
                    newRectsFound = true;
                }
                if (node.querySelector) {
                    node.querySelectorAll('rect.image-mapper-shape:not([data-processed])')
                    .forEach(rect => {
                        attachHover(rect, Date.now());
                        rect.setAttribute('data-processed', 'true');
                        newRectsFound = true;
                    });
                }
            }
        });
    });

    if (newRectsFound) {  
        // بعد ظهور الـ Rects لأول مرة، ننهي شاشة التحميل
        setTimeout(finishLoading, 100);   
    }

});

rootObserver.observe(mainSvg, { childList: true, subtree: true });

// الدالة المسؤولة عن التحميل الأولي والـ Timeout
const handleInitialLoad = () => {
    updateDynamicSizes(); 
    
    // الصور اللي ليها href مباشرة في الـ HTML (أول صورتين غالبًا)
    const mainSvgImages = document.querySelectorAll('#main-svg image[href]:not([data-src])'); 
    const totalImagesToLoad = mainSvgImages.length; 
    let loadedImagesCount = 0;
    
    // 🆕 إضافة Timeout قوي علشان يضمن إن الـ Overlay تختفي بعد زمن محدد (2 ثانية)
    let forcedTimeout = setTimeout(() => {
        // لو فات ثانيتين والصفحة معلّقة، هننطلق ونظهر الخريطة
        if (loadedImagesCount < totalImagesToLoad) {
             // console.warn("Forcing finishLoading() due to initial load delay."); // رسالة للمطور
             finishLoading();
        }
    }, 2000); // ثانيتين كحد أقصى

    function checkAllImagesLoaded() {
        loadedImagesCount++;
        const percentage = Math.round((loadedImagesCount / totalImagesToLoad) * 100);

        if (loadingOverlay) {
            loadingOverlay.textContent = `Loading Map... ${percentage}%`;
        }

        if (loadedImagesCount === totalImagesToLoad) {
            clearTimeout(forcedTimeout); // إلغاء الـ Timeout لو التحميل خلص بشكل طبيعي
            finishLoading();
        }
    }

    if (totalImagesToLoad === 0) {
        clearTimeout(forcedTimeout); 
        setTimeout(finishLoading, 100);
    } else {
        mainSvgImages.forEach(img => {
            img.addEventListener('load', checkAllImagesLoaded, { once: true });

            if (img.complete || img.naturalWidth > 0) {
                checkAllImagesLoaded();
            }
        });
    }
};

handleInitialLoad();

});
