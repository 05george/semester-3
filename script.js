window.onload = function() {
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const clipDefs = mainSvg.querySelector('defs');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    const moveToggle = document.getElementById('move-toggle');
    const toggleContainer = document.getElementById('js-toggle-container');
    const backButtonGroup = document.getElementById('back-button-group');
    const backBtnText = document.getElementById('back-btn-text');

    let activeState = {  
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,  
        baseText: null, baseBg: null, animationId: null, clipPathId: null,  
        touchStartTime: 0, initialScrollLeft: 0  
    };  

    let currentFolder = "";   
    let interactionEnabled = jsToggle.checked;  
    const isTouchDevice = window.matchMedia('(hover: none)').matches;  
    const TAP_THRESHOLD_MS = 300;  

    // --- نظام الجلب من GitHub (مع فلترة المجلدات الفارغة والصور) ---
    async function fetchGithubContents(path = "") {
        try {
            const response = await fetch(`https://api.github.com/repos/05george/semester-3/contents/${path}`);
            if (!response.ok) return [];
            const data = await response.json();
            return data.filter(item => item.name.toLowerCase() !== 'image' && !item.name.startsWith('.'));
        } catch (error) { return []; }
    }

    // --- السلوك القديم: بدء الـ Hover والتأثيرات اللولبية ---
    function startHover() {    
        if (!interactionEnabled || this.classList.contains('list-item')) return;    
        const rect = this;    
        if (activeState.rect === rect) return;    
        cleanupHover();    
        activeState.rect = rect;    

        const rW = parseFloat(rect.getAttribute('width')) || rect.getBBox().width;    
        const rH = parseFloat(rect.getAttribute('height')) || rect.getBBox().height;    
        const cum = getCumulativeTranslate(rect);    
        const absX = parseFloat(rect.getAttribute('x')) + cum.x;    
        const absY = parseFloat(rect.getAttribute('y')) + cum.y;    
        const centerX = absX + rW / 2;    

        const scaleFactor = 1.1;  
        const hoveredY = absY - (rH * (scaleFactor - 1)) / 2;  

        // الزووم الأصلي
        rect.style.transformOrigin = `${parseFloat(rect.getAttribute('x')) + rW/2}px ${parseFloat(rect.getAttribute('y')) + rH/2}px`;    
        rect.style.transform = `scale(${scaleFactor})`;    
        rect.style.strokeWidth = '4px';    

        // قص جزء الصورة وعرضه فوق (السلوك القديم)
        const imgData = getGroupImage(rect);    
        if (imgData) {    
            const clipId = `clip-${Date.now()}`;    
            activeState.clipPathId = clipId;    
            const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');    
            clip.setAttribute('id', clipId);    
            const cRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');    
            cRect.setAttribute('x', absX); cRect.setAttribute('y', absY);    
            cRect.setAttribute('width', rW); cRect.setAttribute('height', rH);    
            clipDefs.appendChild(clip).appendChild(cRect);    

            const zPart = document.createElementNS('http://www.w3.org/2000/svg', 'image');    
            zPart.setAttribute('href', imgData.src);    
            zPart.setAttribute('width', imgData.width); zPart.setAttribute('height', imgData.height);    
            zPart.setAttribute('clip-path', `url(#${clipId})`);    
            const mTrans = imgData.group.getAttribute('transform')?.match(/translate\s*([\d.-]+)[ ,]+([\d.-]+)\s*/);    
            zPart.setAttribute('x', mTrans ? mTrans[1] : 0); zPart.setAttribute('y', mTrans ? mTrans[2] : 0);    
            zPart.style.pointerEvents = 'none';    
            zPart.style.transformOrigin = `${centerX}px ${absY + rH/2}px`;    
            zPart.style.transform = `scale(${scaleFactor})`;    
            mainSvg.appendChild(zPart);    
            activeState.zoomPart = zPart;    
        }    

        // إظهار النص المكبر
        let bText = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);    
        if (bText) {    
            bText.style.opacity = '0';    
            let bBg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);    
            if(bBg) bBg.style.opacity = '0';    
            activeState.baseText = bText; activeState.baseBg = bBg;    

            const zText = document.createElementNS('http://www.w3.org/2000/svg', 'text');    
            zText.textContent = rect.getAttribute('data-full-text') || bText.getAttribute('data-original-text') || "";    
            zText.setAttribute('x', centerX); zText.setAttribute('text-anchor', 'middle');    
            zText.style.dominantBaseline = 'central'; zText.style.fill = 'white';    
            zText.style.fontWeight = 'bold'; zText.style.fontSize = (parseFloat(bText.style.fontSize || 10) * 2) + 'px';    
            mainSvg.appendChild(zText);    

            const bbox = zText.getBBox();    
            const zBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');    
            zBg.setAttribute('x', centerX - (bbox.width + 20) / 2); zBg.setAttribute('y', hoveredY);    
            zBg.setAttribute('width', bbox.width + 20); zBg.setAttribute('height', bbox.height + 10);    
            zBg.setAttribute('rx', '5'); zBg.style.fill = 'black';  
            mainSvg.insertBefore(zBg, zText);    
            zText.setAttribute('y', hoveredY + (bbox.height + 10) / 2);  
            activeState.zoomText = zText; activeState.zoomBg = zBg;    
        }    

        // تأثير الألوان المتغيرة (HSL Animation)
        let h = 0;    
        activeState.animationId = setInterval(() => {    
            h = (h + 10) % 360;    
            const color = `hsl(${h},100%,60%)`;  
            rect.style.filter = `drop-shadow(0 0 8px ${color})`;    
            if (activeState.zoomPart) activeState.zoomPart.style.filter = `drop-shadow(0 0 8px ${color})`;    
            if (activeState.zoomBg) activeState.zoomBg.style.stroke = color;    
        }, 100);    
    }  

    function cleanupHover() {  
        if (!activeState.rect) return; if (activeState.animationId) clearInterval(activeState.animationId);  
        activeState.rect.style.filter = 'none'; activeState.rect.style.transform = 'scale(1)'; activeState.rect.style.strokeWidth = '2px';  
        if (activeState.zoomPart) activeState.zoomPart.remove(); if (activeState.zoomText) activeState.zoomText.remove(); if (activeState.zoomBg) activeState.zoomBg.remove();  
        if (activeState.baseText) activeState.baseText.style.opacity = '1'; if (activeState.baseBg) activeState.baseBg.style.opacity = '1';  
        const clip = document.getElementById(activeState.clipPathId); if (clip) clip.remove();  
        Object.assign(activeState, { rect: null, zoomPart: null, zoomText: null, zoomBg: null, baseText: null, baseBg: null, animationId: null, clipPathId: null });  
    }  

    // --- الدوال الأساسية الأخرى ---
    function getCumulativeTranslate(el) { let x=0, y=0; while(el && el.tagName!=='svg'){ const t=el.getAttribute('transform'); if(t){ const m=t.match(/translate\s*([\d.-]+)[ ,]+([\d.-]+)\s*/); if(m){ x+=parseFloat(m[1]); y+=parseFloat(m[2]); } } el=el.parentNode; } return {x,y}; }
    function getGroupImage(el) { while(el && el.tagName!=='svg'){ if(el.tagName==='g'){ const imgs=[...el.children].filter(c=>c.tagName==='image'); if(imgs.length) return {src: imgs[0].getAttribute('data-src')||imgs[0].getAttribute('href'), width: parseFloat(imgs[0].getAttribute('width')), height: parseFloat(imgs[0].getAttribute('height')), group: el}; } el=el.parentNode; } return null; }
    function debounce(f, d) { let t; return function(){ clearTimeout(t); t=setTimeout(()=>f.apply(this,arguments),d); } }

    async function updateWoodInterface() {  
        const dynamicGroup = document.getElementById('dynamic-links-group');  
        if (!dynamicGroup) return; dynamicGroup.innerHTML = '';   
        backBtnText.textContent = currentFolder === "" ? "إلى الخريطة ←" : "رجوع للخلف ↑";  
        const items = await fetchGithubContents(currentFolder);
        items.forEach((item, index) => {  
            const col = index % 2; const x = col === 0 ? 120 : 550; const y = 250 + (Math.floor(index / 2) * 90);  
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); g.style.cursor = "pointer";  
            const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", "350"); r.setAttribute("height", "70"); r.setAttribute("rx", "12"); r.setAttribute("class", "list-item");
            r.style.fill = item.type === 'dir' ? "#5d4037" : "rgba(0,0,0,0.8)"; r.style.stroke = "#fff";
            const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
            t.setAttribute("x", x + 175); t.setAttribute("y", y + 42); t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "white"); t.style.fontWeight = "bold"; t.style.fontSize = "17px";
            t.textContent = (item.type === 'dir' ? "📁 " : "📄 ") + (item.name.length > 25 ? item.name.substring(0, 22) + "..." : item.name);
            g.appendChild(r); g.appendChild(t);
            g.onclick = (e) => { e.stopPropagation(); if (item.type === 'dir') { currentFolder = item.path; updateWoodInterface(); } else { window.open(`https://raw.githubusercontent.com/05george/semester-3/main/${item.path}`, '_blank'); } };
            dynamicGroup.appendChild(g);
        });
    }

    function processRect(r) {
        if (r.hasAttribute('data-processed')) return;
        if(r.classList.contains('w')) r.setAttribute('width', '113.5');
        const href = r.getAttribute('data-href') || '';
        const name = r.getAttribute('data-full-text') || (href !== '#' ? href.split('/').pop().split('#')[0] : '');
        const w = parseFloat(r.getAttribute('width')) || r.getBBox().width;
        const x = parseFloat(r.getAttribute('x')), y = parseFloat(r.getAttribute('y'));

        if (name && name.trim() !== '') {
            const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            txt.setAttribute('x', x + w/2); txt.setAttribute('y', y + 2); txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('class', 'rect-label');
            txt.setAttribute('data-original-text', name); txt.setAttribute('data-original-for', href);
            txt.style.fontSize = '10px'; txt.style.fill = 'white'; txt.style.dominantBaseline = 'hanging';
            r.parentNode.appendChild(txt);
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('x', x); bg.setAttribute('y', y); bg.setAttribute('width', w); bg.setAttribute('height', '20');
            bg.setAttribute('class', 'label-bg'); bg.setAttribute('data-original-for', href);
            bg.style.fill = 'black'; r.parentNode.insertBefore(bg, txt);
        }
        if (!isTouchDevice) { r.addEventListener('mouseover', startHover); r.addEventListener('mouseout', cleanupHover); }
        r.onclick = () => { if (href && href !== '#') window.open(href, '_blank'); };
        r.setAttribute('data-processed', 'true');
    }

    // --- الأحداث النهائية وبدء التحميل ---
    const images = mainSvg.querySelectorAll('image');
    mainSvg.setAttribute('viewBox', `0 0 ${images.length * 1024} 2454`);
    
    let loadedCount = 0;
    images.forEach(img => {
        const src = img.getAttribute('data-src') || img.getAttribute('href');
        const tempImg = new Image();
        tempImg.onload = tempImg.onerror = () => {
            loadedCount++;
            const p = (loadedCount / images.length) * 100;
            if(p >= 25) document.getElementById('bulb-1').classList.add('on');
            if(p >= 50) document.getElementById('bulb-2').classList.add('on');
            if(p >= 75) document.getElementById('bulb-3').classList.add('on');
            if(p === 100) {
                document.getElementById('bulb-4').classList.add('on');
                images.forEach(i => i.setAttribute('href', i.getAttribute('data-src')));
                setTimeout(() => {
                    loadingOverlay.style.opacity = 0;
                    setTimeout(() => { loadingOverlay.style.display = 'none'; mainSvg.style.opacity = 1; mainSvg.querySelectorAll('rect.m').forEach(processRect); updateWoodInterface(); scrollContainer.scrollTo({left:0}); }, 300);
                }, 500);
            }
        };
        tempImg.src = src;
    });

    moveToggle.onclick = () => toggleContainer.classList.toggle('top') || toggleContainer.classList.toggle('bottom');
    backButtonGroup.onclick = () => { if(currentFolder!==""){ let p=currentFolder.split('/'); p.pop(); currentFolder=p.join('/'); updateWoodInterface(); } else scrollContainer.scrollTo({left:0, behavior:'smooth'}); };
    jsToggle.onchange = function() { interactionEnabled = this.checked; if(!interactionEnabled) cleanupHover(); };
};