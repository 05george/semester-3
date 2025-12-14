// 🛑 الجزء الأول: دالة finishLoading وخطة الطوارئ (لضمان اختفاء شاشة التحميل الأولية) 🛑

function finishLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const mainSvg = document.getElementById('main-svg');
    
    // إخفاء الشاشة
    if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 500);
    }
    // إظهار الخريطة
    if (mainSvg) {
        mainSvg.style.opacity = '1';
    }
}

// 🆕 خطة الطوارئ: لو الكود الداخلي وقف، الدالة دي هتشتغل بعد 3 ثواني لإخفاء شاشة التحميل
setTimeout(finishLoading, 3000); 


// 🛑 يبدأ الكود الرئيسي هنا (يتم تنفيذه بعد اكتمال تحميل DOM) 🛑
Document.addEventListener('DOMContentLoaded', () => {

const mainSvg = document.getElementById('main-svg');
const scrollContainer = document.getElementById('scroll-container'); 
const clipDefs = mainSvg ? mainSvg.querySelector('defs') : null;

const isTouchDevice = window.matchMedia('(hover: none)').matches;
const TAP_THRESHOLD_MS = 300;
const IMAGE_WIDTH = 1024; 

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

const loadingQueue = new Set(); 

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
    if (!mainSvg) return; 
    const images = mainSvg.querySelectorAll('image');
    if (!images.length) return; 
    const totalWeeks = mainSvg.querySelectorAll('g').length; 
    const totalWidth = totalWeeks * IMAGE_WIDTH;
    
    mainSvg.setAttribute('viewBox', `0 0 ${totalWidth} 2454`);
    window.MAX_SCROLL_LEFT = totalWidth - window.innerWidth;
}

updateDynamicSizes();

const debouncedCleanupHover = debounce(function() {
    if (activeState.rect) {
        cleanupHover();
    }
}, 50);

// 🆕 دالة التحميل مع النسبة المئوية (XHR)
function lazyLoadImageWithProgress(imgElement, weekNumber) {
    const src = imgElement.getAttribute('data-src');
    const overlay = mainSvg.querySelector(`.lazy-loading-overlay[data-loading-week="${weekNumber}"]`);
    const text = mainSvg.querySelector(`.lazy-loading-text[data-loading-week="${weekNumber}"]`);
    
    if (loadingQueue.has(weekNumber) || imgElement.getAttribute('href')) return;

    loadingQueue.add(weekNumber); 
    imgElement.setAttribute('data-loading', 'true');
    imgElement.removeAttribute('data-src'); 

    const xhr = new XMLHttpRequest();
    xhr.open('GET', src, true);
    xhr.responseType = 'blob'; 
    
    xhr.onprogress = (event) => {
        if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            if (text) {
                text.textContent = `${percentage}%`; // تحديث النسبة المئوية
            }
        }
    };

    xhr.onload = () => {
        loadingQueue.delete(weekNumber); 
        
        if (xhr.status === 200) {
            if (text) text.textContent = '100%';
            
            const blob = xhr.response;
            const objectURL = URL.createObjectURL(blob);
            
            imgElement.setAttribute('href', objectURL);
            
            if (overlay) overlay.style.opacity = '0';
            if (text) text.style.opacity = '0';
            
            setTimeout(() => {
                if (overlay) overlay.remove();
                if (text) text.remove();
                imgElement.removeAttribute('data-loading');
            }, 300);

        } else {
            if (text) text.textContent = 'Failed';
            if (overlay) overlay.style.fill = 'red';
            imgElement.setAttribute('data-src', src);
        }
    };
    
    xhr.onerror = () => { // إضافة معالجة خطأ عام لـ XHR
        loadingQueue.delete(weekNumber); 
        if (text) text.textContent = 'Error';
        if (overlay) overlay.style.fill = 'orange';
        imgElement.setAttribute('data-src', src);
    }
    
    xhr.send();
}

function checkLazyLoad() {
    const scrollLeft = scrollContainer.scrollLeft; 
    const viewportWidth = window.innerWidth;
    
    const lazyImages = mainSvg.querySelectorAll('image[data-src]:not([data-loading])'); 

    lazyImages.forEach(img => {
        const g = img.closest('g');
        const transformAttr = g.getAttribute('transform');
        const match = transformAttr ? transformAttr.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/) : null;
        const imageX = match ? parseFloat(match[1]) : 0;
        
        const LOAD_THRESHOLD = viewportWidth * 3; 
        
        if (imageX < scrollLeft + viewportWidth + LOAD_THRESHOLD) {
            const weekNumber = (imageX / IMAGE_WIDTH) + 1;
            
            if (weekNumber !== null) {
                lazyLoadImageWithProgress(img, weekNumber); // 🛑 نستخدم دالة النسبة المئوية 🛑
            }
        }
    });
}

const debouncedCheckLazyLoad = debounce(checkLazyLoad, 100);


if (scrollContainer) { 
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
        
        debouncedCheckLazyLoad();
    });
}

setTimeout(checkLazyLoad, 100); 


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
    activeState.rect.style.stroke = ''; 
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

    const g = rect.closest('g');
    const imageElement = g.querySelector('image');

    if (!imageElement) return;

    const imageSourceHref = imageElement.getAttribute('href');
    const imageDataSource = imageElement.getAttribute('data-src');

    if (!imageSourceHref && imageDataSource) {
        const transformAttr = g.getAttribute('transform');
        const match = transformAttr ? transformAttr.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/) : null;
        const imageX = match ? parseFloat(match[1]) : 0;
        const weekNumber = (imageX / IMAGE_WIDTH) + 1;

        if (weekNumber !== null) {
            lazyLoadImageWithProgress(imageElement, weekNumber); // 🛑 نستخدم دالة النسبة المئوية 🛑
        }
        rect.style.stroke = 'orange'; 
        rect.style.strokeWidth = '4px';
        return; 
    }
    
    const imageData = getGroupImage(rect);  
    if (!imageData) return;
    
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
    const matchGroup = groupTransform ? groupTransform.match(/translate\(([\d.-]+),([\d.-]+)\)/) : null;  
    const groupX = matchGroup ? parseFloat(matchGroup[1]) : 0;  
    const groupY = matchGroup ? parseFloat(matchGroup[2]) : 0;  

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
    const href = event.currentTarget.getAttribute('data-href') || event.currentTarget.getAttribute('href') || ''; 
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
            const imageElement = this.closest('g').querySelector('image');
            if (imageElement && imageElement.hasAttribute('data-src') && !imageElement.hasAttribute('href')) {
                startHover.call(this); 
            } else {
                handleLinkOpen(event);   
            }
        }  

        cleanupHover();   
    });
}

document.querySelectorAll('rect.image-mapper-shape').forEach(rect => {
    const href = rect.getAttribute('data-href') || rect.getAttribute('href') || ''; 

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
        // هنا مفيش داعي لـ finishLoading عشان هي بتنادي نفسها في الاخر
    }

});

if (mainSvg) { 
    rootObserver.observe(mainSvg, { childList: true, subtree: true });
}

// 🆕 استدعاء finishLoading() بعد الانتهاء من إعداد DOM
finishLoading(); 

}); // نهاية Document.addEventListener('DOMContentLoaded', ...
