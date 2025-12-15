window.onload=function(){
const mainSvg=document.getElementById("main-svg"),scrollContainer=document.getElementById("scroll-container"),clipDefs=mainSvg.querySelector("defs"),loadingOverlay=document.getElementById("loading-overlay"),loadingText=document.getElementById("loading-text"),jsToggle=document.getElementById("js-toggle"),searchInput=document.getElementById("search-input");
let interactionEnabled=jsToggle.checked;
const isTouchDevice=window.matchMedia("(hover: none)").matches,TAP_THRESHOLD_MS=300,activeState={rect:null,zoomPart:null,zoomText:null,baseText:null,animationId:null,clipPathId:null,initialScrollLeft:0,isScrolling:!1,touchStartTime:0};
function debounce(a,b){let c;return function(){const d=this,e=arguments;clearTimeout(c),c=setTimeout(()=>a.apply(d,e),b)}}
function updateDynamicSizes(){
const b=mainSvg.querySelectorAll("image");
if(!b.length)return;
const c=b[0],d=parseFloat(c.getAttribute("width"))||1024,e=parseFloat(c.getAttribute("height"))||2454,f=b.length*d;
mainSvg.setAttribute("viewBox",`0 0 ${f} ${e}`),window.MAX_SCROLL_LEFT=f-window.innerWidth}
updateDynamicSizes();
const debouncedCleanupHover=debounce(function(){if(!interactionEnabled||!activeState.rect)return;activeState.rect&&cleanupHover()},50);
scrollContainer.addEventListener("scroll",function(){
if(this.scrollLeft>window.MAX_SCROLL_LEFT){this.scrollLeft=window.MAX_SCROLL_LEFT}
if(!interactionEnabled)return;
if(activeState.rect&&!isTouchDevice){debouncedCleanupHover()}
if(activeState.rect&&isTouchDevice){
if(Math.abs(this.scrollLeft-activeState.initialScrollLeft)>5){activeState.isScrolling=!0,cleanupHover()}}});
function getCumulativeTranslate(a){let b=0,c=0,d=a;while(d&&d.tagName!=="svg"){const a=d.getAttribute("transform");if(a){const d=a.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/);if(d){b+=parseFloat(d[1]),c+=parseFloat(d[2])}}d=d.parentNode}return{x:b,y:c}}
function getGroupImage(a){let b=a;while(b&&b.tagName!=="svg"){if(b.tagName==="g"){const a=[...b.children].filter(c=>c.tagName==="image");if(a.length){const b=a[0];return{src:b.getAttribute("data-src")||b.getAttribute("href"),width:parseFloat(b.getAttribute("width")),height:parseFloat(b.getAttribute("height")),group:b}}}b=b.parentNode}return null}
function cleanupHover(){
if(!activeState.rect)return;
const a=activeState.rect,b=activeState.clipPathId,d=activeState.zoomPart,e=activeState.zoomText,f=activeState.baseText,g=activeState.animationId;
if(g)clearInterval(g);
a.style.filter="none",d&&d.style.filter&&(d.style.filter="none"),e&&e.style.filter&&(e.style.filter="none"),a.style.transform="scale(1)",a.style.strokeWidth="2px",d&&d.style.transform&&(d.style.transform="scale(1)"),f&&(f.style.opacity="1"),e&&(e.style.opacity="0"),d&&d.remove();
const h=document.getElementById(b);h&&h.remove(),e&&e.remove(),Object.assign(activeState,{rect:null,zoomPart:null,zoomText:null,baseText:null,animationId:null,clipPathId:null,initialScrollLeft:0,isScrolling:!1,touchStartTime:0})}
function startHover(){
if(!interactionEnabled)return;
const b=this;if(activeState.rect===b)return;cleanupHover(),activeState.rect=b;
const d=1.1,e=parseFloat(b.getAttribute("x")),f=parseFloat(b.getAttribute("y")),g=parseFloat(b.getAttribute("width")),h=parseFloat(b.getAttribute("height")),i=getCumulativeTranslate(b),j=e+i.x,k=f+i.y,l=j+g/2,m=k+h/2;
b.style.transformOrigin=`${e+g/2}px ${f+h/2}px`,b.style.transform=`scale(${d})`,b.style.strokeWidth="4px";
const n=getGroupImage(b);let o=null;
if(n){
const d=activeState.rect.getAttribute("data-index")||Date.now(),e=`clip-${d}-${Date.now()}`;
activeState.clipPathId=e;
const f=document.createElementNS("http://www.w3.org/2000/svg","clipPath");f.setAttribute("id",e);
const i=document.createElementNS("http://www.w3.org/2000/svg","rect");i.setAttribute("x",j),i.setAttribute("y",k),i.setAttribute("width",g),i.setAttribute("height",h),clipDefs.appendChild(f).appendChild(i);
const p=document.createElementNS("http://www.w3.org/2000/svg","image");p.setAttribute("href",n.src),p.setAttribute("width",n.width),p.setAttribute("height",n.height),p.setAttribute("class","zoom-part"),p.setAttribute("clip-path",`url(#${e})`);
const q=n.group.getAttribute("transform"),r=q?q.match(/translate\(([\d.-]+),([\d.-]+)\)/):null,s=r?parseFloat(r[1]):0,t=r?parseFloat(r[2]):0;
p.setAttribute("x",s),p.setAttribute("y",t),p.style.opacity=0,mainSvg.appendChild(p),activeState.zoomPart=p,p.style.transformOrigin=`${l}px ${m}px`,p.style.transform=`scale(${d})`,p.style.opacity=1,o=p}
let u=b.nextElementSibling;u&&!u.matches("text.rect-label")&&(u=null);
if(u){
u.style.opacity="0",activeState.baseText=u;
const a=u.cloneNode(!0),c=b.getAttribute("data-full-text")||u.getAttribute("data-original-text");
a.textContent=c,a.removeAttribute("data-original-text");
while(a.firstChild){a.removeChild(a.firstChild)}
a.textContent=c;
const d=parseFloat(u.style.fontSize);
a.style.fontSize=d*2+"px",a.style.fill="white",a.style.pointerEvents="none",a.style.userSelect="none",a.style.opacity="1",a.setAttribute("x",j+g/2),a.setAttribute("y",k+d*1.5),a.setAttribute("text-anchor","middle"),activeState.zoomText=a,document.getElementById("main-svg").appendChild(a)}
let v=0;
activeState.animationId=setInterval(()=>{v=(v+10)%360;const a=`drop-shadow(0 0 8px hsl(${v},100%,55%)) drop-shadow(0 0 14px hsl(${(v+60)%360},100%,60%))`;b.style.filter=a,o&&o.style.filter&&(o.style.filter=a),activeState.zoomText&&activeState.zoomText.style.filter&&(activeState.zoomText.style.filter=a)},100)}
function stopHover(){if(!interactionEnabled)return;activeState.rect===this&&cleanupHover()}
function handleLinkOpen(a){const b=a.currentTarget.getAttribute("data-href");b&&b!=="#"&&(window.open(b,"_blank"),a.preventDefault(),a.stopPropagation())}
function attachHover(a,b){
a.setAttribute("data-index",b);
if(!isTouchDevice){function c(){interactionEnabled&&startHover.call(a)}function d(){interactionEnabled&&stopHover.call(a)}a.addEventListener("mouseover",c),a.addEventListener("mouseout",d)}
a.addEventListener("click",handleLinkOpen),a.addEventListener("touchstart",function(b){if(!interactionEnabled)return;activeState.touchStartTime=Date.now(),activeState.initialScrollLeft=b.scrollLeft,activeState.isScrolling=!1,startHover.call(this)}),a.addEventListener("touchend",function(a){if(!interactionEnabled)return;const b=Date.now()-activeState.touchStartTime;activeState.isScrolling===!1&&b<TAP_THRESHOLD_MS&&handleLinkOpen(a),cleanupHover()})}
const svgImages=Array.from(mainSvg.querySelectorAll("image")),rectShapes=Array.from(mainSvg.querySelectorAll("rect.image-mapper-shape")),rectLabels=Array.from(mainSvg.querySelectorAll("text.rect-label")),allRectsAndLabels=[...rectShapes,...rectLabels];
function filterRects(a){
const b=a.toLowerCase();
allRectsAndLabels.forEach(c=>{
let d=!1;
if(c.tagName==="rect"){const a=c.getAttribute("data-href")||"";a.toLowerCase().includes(b)&&(d=!0)}
else if(c.tagName==="text"){c.textContent.toLowerCase().includes(b)&&(d=!0)}
const e=c.tagName==="rect"?c:c.previousElementSibling;
if(e&&e.matches("rect.image-mapper-shape")){
const c=e.nextElementSibling;
if(a.length>0&&!d){e.style.opacity="0.1",e.style.pointerEvents="none",c&&c.style.opacity&&(c.style.opacity="0.1")}
else{e.style.opacity="1",e.style.pointerEvents="auto",c&&c.style.opacity&&(c.style.opacity="1"),a.length>0&&d?e.style.filter="drop-shadow(0 0 8px #00FFFF) drop-shadow(0 0 14px #00FFFF)":e.style.filter="none"}}})}
const debouncedFilter=debounce(filterRects,150);searchInput.addEventListener("input",function(){debouncedFilter(this.value)});
const urls=svgImages.map(a=>a.getAttribute("data-src")||a.getAttribute("href"));
let loadedCount=0,totalCount=urls.length,startTime=Date.now(),MINIMUM_DISPLAY_TIME_MS=1e3;
function updateLoader(){
const a=Math.round(loadedCount/totalCount*100);
loadingText&&loadingText.textContent&&(a>=25&&document.getElementById("bulb-1").classList.add("on"),a>=50&&document.getElementById("bulb-2").classList.add("on"),a>=75&&document.getElementById("bulb-3").classList.add("on"),a===100&&document.getElementById("bulb-4").classList.add("on"))}
function finishLoading(){
if(loadingOverlay){
const a=Date.now()-startTime,b=Math.max(0,MINIMUM_DISPLAY_TIME_MS-a);
setTimeout(()=>{loadingOverlay.style.opacity=0,setTimeout(()=>{loadingOverlay.style.display="none",mainSvg.style.opacity=1,setTimeout(()=>{scrollContainer.scrollLeft=scrollContainer.scrollWidth,scrollContainer.scrollTo({left:scrollContainer.scrollWidth,behavior:"smooth"})},50)},300)},b)}}
urls.forEach((a,b)=>{const c=new Image;c.onload=c.onerror=()=>{loadedCount++,updateLoader(),loadedCount===totalCount&&finishLoading()},c.src=a});
function wrapTextInSvg(a,b,c=5){
const d=a.textContent,e=d.split(/\s+/).filter(a=>a.length>0);a.textContent=null;
let f=document.createElementNS("http://www.w3.org/2000/svg","tspan");
f.setAttribute("x",a.getAttribute("x")),f.setAttribute("dy","0"),a.appendChild(f);
let g="";
const h=parseFloat(a.style.fontSize)*1.2;
let i=0;
for(let j=0;j<e.length;j++){
const a=e[j],k=g+(g.length?" ":"")+a;f.textContent=k;
if(f.getComputedTextLength()>b-c*2&&g.length>0){
f.textContent=g,i++,f=document.createElementNS("http://www.w3.org/2000/svg","tspan"),f.setAttribute("x",a.getAttribute("x")),f.setAttribute("dy",`${h}px`),a.appendChild(f),g=a,f.textContent=a}
else{g=k}}}
document.querySelectorAll("rect.image-mapper-shape").forEach(a=>{
const b=a.getAttribute("data-href")||"",c=b.split("/").pop().split("#")[0]||"",d=c.split("."),e=d.slice(0,d.length-1).join("."),f=e.split(/\s+/).filter(a=>a.length>0),g=f.length>0?f[0]:e,h=parseFloat(a.getAttribute("width")),i=parseFloat(a.getAttribute("x")),j=parseFloat(a.getAttribute("y")),k=8,l=16,m=.12;
let n=h*m;n=Math.max(k,Math.min(l,n));
const o=document.createElementNS("http://www.w3.org/2000/svg","text");
o.setAttribute("x",i+h/2);
const p=j+5;o.setAttribute("y",p);
o.setAttribute("text-anchor","middle"),o.textContent=g,o.style.fontSize=n+"px",o.style.fill="white",o.style.pointerEvents="none",o.setAttribute("class","rect-label"),o.setAttribute("data-original-text",e),a.parentNode.insertBefore(o,a.nextSibling),wrapTextInSvg(o,h)});
document.querySelectorAll("rect.image-mapper-shape").forEach((a,b)=>{a.setAttribute("data-processed","true"),attachHover(a,b)});
const rootObserver=new MutationObserver(a=>{a.forEach(b=>{b.addedNodes.forEach(c=>{if(c.nodeType===1){if(c.matches("rect.image-mapper-shape")&&!c.hasAttribute("data-processed")){attachHover(c,Date.now()),c.setAttribute("data-processed","true")}if(c.querySelector){c.querySelectorAll("rect.image-mapper-shape:not([data-processed])").forEach(a=>{attachHover(a,Date.now()),a.setAttribute("data-processed","true")})}}})})});
rootObserver.observe(mainSvg,{childList:!0,subtree:!0}),jsToggle.addEventListener("change",function(){interactionEnabled=this.checked;const a=document.getElementById("toggle-label");interactionEnabled?a.textContent="Interaction Enabled":(a.textContent="Interaction Disabled",cleanupHover())});
const moveToggle=document.getElementById("move-toggle"),toggleContainer=document.getElementById("js-toggle-container");
moveToggle.addEventListener("click",function(){toggleContainer.classList.contains("top")?(toggleContainer.classList.remove("top"),toggleContainer.classList.add("bottom")):(toggleContainer.classList.remove("bottom"),toggleContainer.classList.add("top"))})};