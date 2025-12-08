const mainSvg = document.getElementById('main-svg');  
const clipDefs = document.getElementById('clip-defs');  
// إضافة intervalId لتخزين المؤقت و currentHue لتتبع التدرج اللوني
const activeState = { rect: null, zoomPart: null, clipPathId: null, intervalId: null, currentHue: 0 }; 

function setDynamicSvgWidth() {
    const weekGroups = document.querySelectorAll('svg > g[transform*="translate"]');
    const IMAGE_WIDTH = 1024; 
    const totalWidth = weekGroups.length * IMAGE_WIDTH; 
    mainSvg.style.width = `${totalWidth}px`;
    mainSvg.setAttribute('viewBox', `0 0 ${totalWidth} 2454`); 
}
setDynamicSvgWidth();

function getTransformX(groupElement) {  
  if (!groupElement) return 0;
  const transformAttr = groupElement.getAttribute('transform');  
  if (!transformAttr) return 0;  
  const match = transformAttr.match(/translate\s*\(([\d\.-]+)\s*,\s*([\d\.-]+)\s*\)/);  
  return match ? parseFloat(match[1]) : 0;  
} 

function getTransformY(groupElement) {  
  if (!groupElement) return 0;
  const transformAttr = groupElement.getAttribute('transform');  
  if (!transformAttr) return 0;  
  const match = transformAttr.match(/translate\s*\(([\d\.-]+)\s*,\s*([\d\.-]+)\s*\)/);  
  return match ? parseFloat(match[2]) : 0;  
}

function getGroupImage(parentGroup) { 
  const baseImage = parentGroup.querySelector('image'); 
  if (!baseImage) return null;  
  const IMAGE_SRC = baseImage.getAttribute('href') || baseImage.getAttribute('xlink:href');  
  const IMAGE_WIDTH = parseFloat(baseImage.getAttribute('width'));  
  const IMAGE_HEIGHT = parseFloat(baseImage.getAttribute('height'));  
  if (isNaN(IMAGE_WIDTH) || isNaN(IMAGE_HEIGHT)) return null;  
  return { src: IMAGE_SRC, width: IMAGE_WIDTH, height: IMAGE_HEIGHT };  
} 

function cleanupHover() {  
  if (!activeState.rect) return;  

  // إيقاف المؤقت (Interval)
  if (activeState.intervalId) {
      clearInterval(activeState.intervalId);
      activeState.intervalId = null;
  }

  activeState.rect.style.transform = 'scale(1)';  
  activeState.rect.classList.remove('active-glow'); 
  activeState.rect.style.strokeWidth = '2px';
  activeState.rect.style.filter = 'none'; 
 
  if(activeState.zoomPart){ 
      activeState.zoomPart.style.filter = 'none'; 
      activeState.zoomPart.remove(); 
  }  
  const currentClip = document.getElementById(activeState.clipPathId);  
  if(currentClip) currentClip.remove();  
  activeState.rect = null;  
  activeState.zoomPart = null;  
  activeState.clipPathId = null;  
  activeState.currentHue = 0; // إعادة تعيين قيمة Hue
}

/**
 * يطبق فلتر glow بتدرج لوني محدد (hue) لانتقال لوني ناعم.
 */
function updateGlow(rect, zoomPart, hue) {
    // استخدام فلتر drop-shadow مع hue-rotate بقيمة الـ hue الممررة
    const smoothGlowFilter = `drop-shadow(0 0 10px yellow) drop-shadow(0 0 6px rgba(255, 255, 0, 0.5)) hue-rotate(${hue}deg)`;

    if (rect) rect.style.filter = smoothGlowFilter;
    if (zoomPart) zoomPart.style.filter = smoothGlowFilter;
}

function attachHover(rect, i) {  
  const anchor = rect.closest('a');  
  const clipPathId = `clip-${i}-${Date.now()}`;  
  const scale = 1.1;  

  rect.setAttribute('data-index', i);  
  rect.addEventListener('mouseover', startHover);  
  rect.addEventListener('mouseout', stopHover);  
  rect.addEventListener('touchstart', startHover);  

  rect.addEventListener('touchend', (e) => {
      cleanupHover(); 
  }); 
  if (anchor) { anchor.removeEventListener('click', cleanupHover); }  

  function startHover() {  
    if(activeState.rect === rect) return;  
    cleanupHover();  
    activeState.rect = rect;  
    activeState.clipPathId = clipPathId;  

    const x = parseFloat(rect.getAttribute('x'));  
    const y = parseFloat(rect.getAttribute('y'));  
    const width = parseFloat(rect.getAttribute('width'));  
    const height = parseFloat(rect.getAttribute('height'));

    const dayGroup = rect.closest('g[transform]'); 
    const weekGroup = rect.closest('svg > g[transform*="translate"]'); 

    const imageData = getGroupImage(weekGroup);
    if (!imageData) return;  

    const weekOffsetX = getTransformX(weekGroup);
    const dayOffsetX = getTransformX(dayGroup);
    const weekOffsetY = getTransformY(weekGroup);
    const dayOffsetY = getTransformY(dayGroup);
    const absoluteX = x + weekOffsetX + dayOffsetX;  
    const absoluteY = y + weekOffsetY + dayOffsetY;  

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

    zoomPart.setAttribute('x', weekOffsetX);  
    zoomPart.setAttribute('y', weekOffsetY);

    activeState.currentHue = 0; // ابدأ من درجة الصفر

    // تطبيق الفلتر لأول مرة
    updateGlow(rect, zoomPart, activeState.currentHue); 

    zoomPart.style.transformOrigin = `${absoluteX + width/2}px ${absoluteY + height/2}px`;  
    zoomPart.style.opacity = 0;  
    mainSvg.appendChild(zoomPart);  
    activeState.zoomPart = zoomPart; 

    rect.style.transformOrigin = `${x + width/2}px ${y + height/2}px`; 
    rect.style.transform = `scale(${scale})`;  

    rect.classList.remove('active-glow'); 

    zoomPart.style.transform = `scale(${scale})`;  
    zoomPart.style.opacity = 1;  

    // بدء المؤقت لتغيير الوهج بشكل مستمر وببطء
    activeState.intervalId = setInterval(() => {
        // زيادة قيمة الـ Hue بدرجة واحدة فقط
        activeState.currentHue = (activeState.currentHue + 1) % 360; 
        updateGlow(rect, zoomPart, activeState.currentHue);
    }, 100); // زمن التحديث 100ms
  }  

  function stopHover(e) {  
    const targetRect = e ? (e.target.tagName === 'rect' ? e.target : e.target.closest('a')?.querySelector('.image-mapper-shape')) : rect;  
    if(targetRect === activeState.rect && e.type === 'mouseout'){  
        cleanupHover();  
    }  
  }  
}  

document.querySelectorAll('rect.image-mapper-shape').forEach((rect, i) => {  
    rect.setAttribute('data-processed', 'true');  
    attachHover(rect, i);  
});  

const rootObserver = new MutationObserver(() => {  
  document  
    .querySelectorAll('rect.image-mapper-shape:not([data-processed])')  
    .forEach((rect, i) => {  
      rect.setAttribute('data-processed', 'true');  
      attachHover(rect, i);  
    });  
});  
rootObserver.observe(mainSvg, { childList: true, subtree: true });  

function setLinkTarget() {  
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0) || (window.innerWidth < 800);  
  const allLinks = document.querySelectorAll('a[xlink\\:href], a[href]');  
  allLinks.forEach(link => {  
    if (isMobile) { link.removeAttribute('target'); }   
    else { link.setAttribute('target', '_blank'); }  
  });  
}  
setLinkTarget();
