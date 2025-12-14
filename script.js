const mainSvg=document.getElementById('main-svg')
const clipDefs=mainSvg.querySelector('defs')
const scrollContainer=document.getElementById('scroll-container')
const loadingOverlay=document.getElementById('loading-overlay')
const loadingText=document.getElementById('loading-text')

const activeState={
rect:null,
zoomPart:null,
zoomText:null,
animationId:null,
clipPathId:null
}

function updateDynamicSizes(){
const images=mainSvg.querySelectorAll('image')
if(!images.length)return
const firstImage=images[0]
const w=parseFloat(firstImage.getAttribute('width'))||1024
const h=parseFloat(firstImage.getAttribute('height'))||2454
const total=w*images.length
mainSvg.setAttribute('viewBox',`0 0 ${total} ${h}`)
window.MAX_SCROLL_LEFT=total-window.innerWidth
}
updateDynamicSizes()

scrollContainer.addEventListener('scroll',function(){
if(this.scrollLeft>window.MAX_SCROLL_LEFT){
this.scrollLeft=window.MAX_SCROLL_LEFT
}
})

function getCumulativeTranslate(el){
let x=0,y=0
while(el&&el.tagName!=='svg'){
const t=el.getAttribute('transform')
if(t){
const m=t.match(/translate\(([\d.-]+)[ ,]+([\d.-]+)\)/)
if(m){x+=+m[1];y+=+m[2]}
}
el=el.parentNode
}
return{x,y}
}

function getGroupImage(el){
while(el&&el.tagName!=='svg'){
if(el.tagName==='g'){
const img=[...el.children].find(c=>c.tagName==='image')
if(img){
return{
src:img.getAttribute('href'),
width:+img.getAttribute('width'),
height:+img.getAttribute('height'),
group:el
}
}
}
el=el.parentNode
}
return null
}

function cleanupHover(){
if(!activeState.rect)return
if(activeState.animationId)clearInterval(activeState.animationId)
activeState.rect.style.transform='scale(1)'
activeState.rect.style.filter='none'
activeState.rect.style.strokeWidth='2px'
if(activeState.zoomPart)activeState.zoomPart.remove()
if(activeState.zoomText)activeState.zoomText.remove()
const clip=document.getElementById(activeState.clipPathId)
if(clip)clip.remove()
Object.assign(activeState,{rect:null,zoomPart:null,zoomText:null,animationId:null,clipPathId:null})
}

function startHover(){
const rect=this
if(activeState.rect===rect)return
cleanupHover()
activeState.rect=rect

const id=`clip-${Date.now()}`
activeState.clipPathId=id

const x=+rect.getAttribute('x')
const y=+rect.getAttribute('y')
const w=+rect.getAttribute('width')
const h=+rect.getAttribute('height')

const cum=getCumulativeTranslate(rect)
const ax=x+cum.x
const ay=y+cum.y

const imgData=getGroupImage(rect)
if(!imgData)return

const clip=document.createElementNS('http://www.w3.org/2000/svg','clipPath')
clip.setAttribute('id',id)
const r=document.createElementNS('http://www.w3.org/2000/svg','rect')
r.setAttribute('x',ax)
r.setAttribute('y',ay)
r.setAttribute('width',w)
r.setAttribute('height',h)
clip.appendChild(r)
clipDefs.appendChild(clip)

const zoom=document.createElementNS('http://www.w3.org/2000/svg','image')
zoom.setAttribute('href',imgData.src)
zoom.setAttribute('width',imgData.width)
zoom.setAttribute('height',imgData.height)
zoom.setAttribute('clip-path',`url(#${id})`)
zoom.setAttribute('class','zoom-part')

const t=imgData.group.getAttribute('transform')
const m=t?t.match(/translate\(([\d.-]+),([\d.-]+)\)/):null
zoom.setAttribute('x',m?+m[1]:0)
zoom.setAttribute('y',m?+m[2]:0)

mainSvg.appendChild(zoom)
activeState.zoomPart=zoom

rect.style.transformOrigin=`${x+w/2}px ${y+h/2}px`
rect.style.transform='scale(1.1)'
rect.style.strokeWidth='4px'

const cx=ax+w/2
const cy=ay+h/2
zoom.style.transformOrigin=`${cx}px ${cy}px`
zoom.style.transform='scale(1.1)'

let hue=0
activeState.animationId=setInterval(()=>{
hue=(hue+10)%360
const glow=`drop-shadow(0 0 8px hsl(${hue},100%,55%)) drop-shadow(0 0 14px hsl(${(hue+60)%360},100%,60%))`
rect.style.filter=glow
zoom.style.filter=glow
if(activeState.zoomText)activeState.zoomText.style.filter=glow
},100)

const baseText=rect.parentNode.querySelector('text')
if(baseText){
const zt=baseText.cloneNode(true)
const fs=parseFloat(baseText.style.fontSize)
zt.style.fontSize=fs*2+'px'
zt.style.pointerEvents='none'
zt.setAttribute('x',cx)
zt.setAttribute('y',ay+fs*2)
zt.setAttribute('text-anchor','middle')
mainSvg.appendChild(zt)
activeState.zoomText=zt
}
}

function stopHover(){
if(activeState.rect===this)setTimeout(cleanupHover,50)
}

function attachHover(rect){
rect.addEventListener('mouseover',startHover)
rect.addEventListener('mouseout',stopHover)
rect.addEventListener('touchstart',startHover,{passive:true})
rect.addEventListener('touchend',cleanupHover)
}

document.querySelectorAll('rect.image-mapper-shape').forEach(rect=>{
const href=rect.getAttribute('data-href')||''
const name=href.split('/').pop()||''
const w=+rect.getAttribute('width')
const x=+rect.getAttribute('x')
const y=+rect.getAttribute('y')
let fs=Math.max(8,Math.min(16,w*0.12))
const text=document.createElementNS('http://www.w3.org/2000/svg','text')
text.setAttribute('x',x+w/2)
text.setAttribute('y',y+fs+6)
text.setAttribute('text-anchor','middle')
text.textContent=name
text.style.fontSize=fs+'px'
text.style.fill='white'
text.style.pointerEvents='none'
rect.parentNode.appendChild(text)
attachHover(rect)
})

const images=[...document.images]
let loaded=0
const steps=[0,25,50,75,100]

function updateLoader(){
const percent=Math.floor((loaded/images.length)*100)
const step=steps.findLast(s=>percent>=s)
loadingText.textContent=step+'%'
if(step===100){
setTimeout(()=>loadingOverlay.style.display='none',300)
}
}

images.forEach(img=>{
if(img.complete){
loaded++
updateLoader()
}else{
img.addEventListener('load',()=>{
loaded++
updateLoader()
})
}
})