window.onload = () => {

const mainSvg = document.getElementById('main-svg');
const loadingOverlay = document.getElementById('loading-overlay');

const isTouch = window.matchMedia('(hover:none)').matches;

const activeState = {
  rect:null,
  zoomText:null,
  zoomTextBg:null,
  animationId:null
};

function cleanupHover(){
  if(activeState.animationId) clearInterval(activeState.animationId);
  if(activeState.zoomText) activeState.zoomText.remove();
  if(activeState.zoomTextBg) activeState.zoomTextBg.remove();
  if(activeState.rect) activeState.rect.style.filter = 'none';
  activeState.rect = null;
}

function startHover(){
  cleanupHover();
  const rect = this;
  activeState.rect = rect;

  const textValue = rect.getAttribute('data-full-text');
  if(!textValue) return;

  const x = +rect.getAttribute('x') + +rect.getAttribute('width')/2;
  const y = +rect.getAttribute('y') - 20;

  const text = document.createElementNS('http://www.w3.org/2000/svg','text');
  text.textContent = textValue;
  text.setAttribute('x',x);
  text.setAttribute('y',y);
  text.setAttribute('text-anchor','middle');
  text.style.fill = '#fff';
  text.style.fontSize = '32px';
  text.style.pointerEvents = 'none';

  mainSvg.appendChild(text);

  const box = text.getBBox();
  const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
  bg.setAttribute('x',box.x-10);
  bg.setAttribute('y',box.y-10);
  bg.setAttribute('width',box.width+20);
  bg.setAttribute('height',box.height+20);
  bg.setAttribute('rx',6);
  bg.setAttribute('ry',6);
  bg.setAttribute('fill','#000');
  bg.setAttribute('opacity','0.9');
  bg.style.pointerEvents = 'none';

  mainSvg.insertBefore(bg,text);

  activeState.zoomText = text;
  activeState.zoomTextBg = bg;

  let hue = 0;
  activeState.animationId = setInterval(()=>{
    hue = (hue+10)%360;
    const glow = `drop-shadow(0 0 10px hsl(${hue},100%,60%))`;

    rect.style.filter = glow;

    /* النص بدون glow */
    text.style.filter = 'none';

    /* glow على الخلفية فقط */
    bg.style.filter = glow;
  },100);
}

/* EVENTS */
document.querySelectorAll('.image-mapper-shape').forEach(r=>{
  if(!isTouch){
    r.addEventListener('mouseenter',startHover);
    r.addEventListener('mouseleave',cleanupHover);
  }
  r.addEventListener('touchstart',startHover);
  r.addEventListener('touchend',cleanupHover);
});

/* SHOW CONTENT */
setTimeout(()=>{
  loadingOverlay.style.opacity='0';
  setTimeout(()=>{
    loadingOverlay.style.display='none';
    mainSvg.style.opacity='1';
  },300);
},500);

};