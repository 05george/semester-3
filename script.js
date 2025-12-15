window.onload = function () {

const mainSvg = document.getElementById('main-svg');
const scrollContainer = document.getElementById('scroll-container');
const loadingOverlay = document.getElementById('loading-overlay');
const jsToggle = document.getElementById('js-toggle');

let interactionEnabled = jsToggle.checked;
const isTouchDevice = window.matchMedia('(hover: none)').matches;
const TAP_THRESHOLD_MS = 300;

const activeState = {
  rect: null,
  zoomText: null,
  zoomTextBg: null,
  animationId: null
};

/* ===== VIEWBOX AUTO ===== */
(function updateViewBox(){
  const images = mainSvg.querySelectorAll('image');
  if(!images.length) return;
  const w = +images[0].getAttribute('width') || 1024;
  const h = +images[0].getAttribute('height') || 2454;
  mainSvg.setAttribute('viewBox', `0 0 ${images.length*w} ${h}`);
})();

/* ===== CLEANUP ===== */
function cleanupHover(){
  if(activeState.animationId) clearInterval(activeState.animationId);
  if(activeState.zoomText) activeState.zoomText.remove();
  if(activeState.zoomTextBg) activeState.zoomTextBg.remove();
  activeState.rect = null;
}

/* ===== HOVER ===== */
function startHover(){
  if(!interactionEnabled) return;
  cleanupHover();
  activeState.rect = this;

  const rect = this;
  rect.style.transform = 'scale(1.1)';
  rect.style.strokeWidth = '4px';

  const text = rect.getAttribute('data-full-text');
  if(!text) return;

  const x = +rect.getAttribute('x') + +rect.getAttribute('width')/2;
  const y = +rect.getAttribute('y') + 40;

  const zoomText = document.createElementNS('http://www.w3.org/2000/svg','text');
  zoomText.textContent = text;
  zoomText.setAttribute('x', x);
  zoomText.setAttribute('y', y);
  zoomText.setAttribute('text-anchor','middle');
  zoomText.style.fill = 'white';
  zoomText.style.fontSize = '32px';
  zoomText.style.pointerEvents = 'none';

  mainSvg.appendChild(zoomText);

  const box = zoomText.getBBox();
  const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
  bg.setAttribute('x', box.x - 10);
  bg.setAttribute('y', box.y - 10);
  bg.setAttribute('width', box.width + 20);
  bg.setAttribute('height', box.height + 20);
  bg.setAttribute('rx', 6);
  bg.setAttribute('ry', 6);
  bg.setAttribute('fill', '#000');
  bg.setAttribute('opacity', '0.9');
  bg.style.pointerEvents = 'none';

  mainSvg.insertBefore(bg, zoomText);

  activeState.zoomText = zoomText;
  activeState.zoomTextBg = bg;

  let hue = 0;
  activeState.animationId = setInterval(()=>{
    hue = (hue+10)%360;
    rect.style.filter = `drop-shadow(0 0 8px hsl(${hue},100%,55%))`;
    zoomText.style.filter = rect.style.filter;
  },100);
}

/* ===== EVENTS ===== */
document.querySelectorAll('rect.image-mapper-shape').forEach(rect=>{
  if(!isTouchDevice){
    rect.addEventListener('mouseover', startHover);
    rect.addEventListener('mouseout', cleanupHover);
  }
  rect.addEventListener('touchstart', startHover);
  rect.addEventListener('touchend', cleanupHover);
});

jsToggle.onchange = ()=> interactionEnabled = jsToggle.checked;

/* ===== SHOW CONTENT ===== */
setTimeout(()=>{
  loadingOverlay.style.opacity = '0';
  setTimeout(()=>{
    loadingOverlay.style.display = 'none';
    mainSvg.style.opacity = '1';
  },300);
},500);

};