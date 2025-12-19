window.onload = function() {
    // 1. تعريف العناصر الأساسية
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const clipDefs = mainSvg.querySelector('defs');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    const searchIcon = document.getElementById('search-icon');
    const moveToggle = document.getElementById('move-toggle');
    const toggleContainer = document.getElementById('js-toggle-container');
    const backButtonGroup = document.getElementById('back-button-group');
    const backBtnText = document.getElementById('back-btn-text');

    // --- حالة النظام (State) ---  
    let activeState = {  
        rect: null, zoomPart: null, zoomText: null, zoomBg: null,  
        baseText: null, baseBg: null, animationId: null, clipPathId: null,  
        touchStartTime: 0, initialScrollLeft: 0  
    };  

    let currentFolder = "";   
    let interactionEnabled = jsToggle.checked;  
    const isTouchDevice = window.matchMedia('(hover: none)').matches;  
    const TAP_THRESHOLD_MS = 300;  

    // --- وظائف التنقل (RTL Support) ---  
    const goToWood = () => {  
        scrollContainer.scrollTo({ left: -scrollContainer.scrollWidth, behavior: 'smooth' });  
    };  

    const goToMapEnd = () => {  
        scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });  
    };  

    // --- دالة جلب البيانات من GitHub API ---
    async function fetchGithubContents(path = "") {
        try {
            const response = await fetch(`https://api.github.com/repos/05george/semester-3/contents/${path}`);
            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error("GitHub API Error:", error);
            return [];
        }
    }

    // --- تحديث واجهة الخشب (الميزات الجديدة) ---  
    async function updateWoodInterface() {  
        const dynamicGroup = document.getElementById('dynamic-links-group');  
        if (!dynamicGroup) return;  
        
        dynamicGroup.innerHTML = ''; 
        backBtnText.textContent = currentFolder === "" ? "إلى الخريطة ←" : "رجوع للخلف ↑";  

        const items = await fetchGithubContents(currentFolder);

        // فلترة المجلدات وملفات الـ PDF فقط
        const filteredItems = items.filter(item => 
            item.type === 'dir' || item.name.toLowerCase().endsWith('.pdf')
        );

        filteredItems.forEach((item, index) => {  
            const col = index % 2; 
            const row = Math.floor(index / 2);  
            const x = col === 0 ? 120 : 550; 
            const y = 250 + (row * 90);  

            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");  
            g.setAttribute("class", "list-item-group");
            g.style.cursor = "pointer";  

            // تنظيف الاسم من صيغة .pdf
            const displayName = item.name.replace(/\.pdf$/i, ''); 

            const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");  
            r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", "350"); r.setAttribute("height", "70"); 
            r.setAttribute("rx", "12"); r.setAttribute("ry", "12"); // استنساخ ميزة rx/ry من CSS
            r.setAttribute("class", "list-item");  
            r.style.fill = item.type === 'dir' ? "#5d4037" : "rgba(0,0,0,0.8)";  
            r.style.stroke = "#fff";  
            r.style.strokeWidth = "1px";

            const t = document.createElementNS("http://www.w3.org/2000/svg", "text");  
            t.setAttribute("x", x + 175); t.setAttribute("y", y + 42);  
            t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "white");  
            t.style.fontWeight = "bold"; t.style.fontSize = "17px";  
            t.textContent = (item.type === 'dir' ? "📁 " : "📄 ") + 
                            (displayName.length > 25 ? displayName.substring(0, 22) + "..." : displayName);  

            g.appendChild(r); 
            g.appendChild(t);  

            g.onclick = (e) => {  
                e.stopPropagation();  
                if (item.type === 'dir') { 
                    currentFolder = item.path; 
                    updateWoodInterface();      
                } else { 
                    // فتح الملف مباشرة (Raw)
                    const rawUrl = `https://raw.githubusercontent.com/05george/semester-3/main/${item.path}`;
                    window.open(rawUrl, '_blank'); 
                }  
            };  
            dynamicGroup.appendChild(g);  
        });  
    }  

    // --- نظام البحث المطور (ثبات الأماكن + تنظيف) ---
    searchInput.addEventListener('input', debounce(function(e) {  
        const query = e.target.value.toLowerCase().trim();  
        
        // 1. البحث في قائمة الخشب
        document.querySelectorAll('.list-item-group').forEach(group => {
            const isMatch = group.textContent.toLowerCase().includes(query);
            group.style.visibility = isMatch ? "visible" : "hidden";
        });

        // 2. البحث في الخريطة
        mainSvg.querySelectorAll('rect.m:not(.list-item)').forEach(rect => {  
            const href = (rect.getAttribute('data-href') || '').toLowerCase();  
            const fullText = (rect.getAttribute('data-full-text') || '').toLowerCase();
            const label = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);  
            const bg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);  
            
            const isMatch = href.includes(query) || fullText.includes(query);
            const state = (query.length > 0 && !isMatch) ? 'hidden' : 'visible';
            
            rect.style.visibility = state;  
            if(label) label.style.visibility = state;   
            if(bg) bg.style.visibility = state;  
        });  
    }, 150));

    // --- دوال الأنيميشن والزووم (مستنسخة بالكامل) ---
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
        const yOffset = (rH * (scaleFactor - 1)) / 2;  
        const hoveredY = absY - yOffset;  

        rect.style.transformOrigin = `${parseFloat(rect.getAttribute('x')) + rW/2}px ${parseFloat(rect.getAttribute('y')) + rH/2}px`;    
        rect.style.transform = `scale(${scaleFactor})`;    
        rect.style.strokeWidth = '4px';    

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
            zText.style.fontWeight = 'bold'; zText.style.pointerEvents = 'none';    
            zText.style.fontSize = (parseFloat(bText.style.fontSize || 10) * 2) + 'px';    
            mainSvg.appendChild(zText);    

            const bbox = zText.getBBox();    
            const zBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');    
            zBg.setAttribute('x', centerX - (bbox.width + 20) / 2); zBg.setAttribute('y', hoveredY);    
            zBg.setAttribute('width', bbox.width + 20); zBg.setAttribute('height', bbox.height + 10);    
            zBg.setAttribute('rx', '5'); zBg.style.fill = 'black'; zBg.style.pointerEvents = 'none';    

            mainSvg.insertBefore(zBg, zText);    
            zText.setAttribute('y', hoveredY + (bbox.height + 10) / 2);  
            activeState.zoomText = zText; activeState.zoomBg = zBg;    
        }    

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
        if (!activeState.rect) return;  
        if (activeState.animationId) clearInterval(activeState.animationId);  
        activeState.rect.style.filter = 'none';  
        activeState.rect.style.transform = 'scale(1)';  
        activeState.rect.style.strokeWidth = '2px';  
        if (activeState.zoomPart) activeState.zoomPart.remove();  
        if (activeState.zoomText) activeState.zoomText.remove();  
        if (activeState.zoomBg) activeState.zoomBg.remove();  
        if (activeState.baseText) activeState.baseText.style.opacity = '1';  
        if (activeState.baseBg) activeState.baseBg.style.opacity = '1';  
        const clip = document.getElementById(activeState.clipPathId);  
        if (clip) clip.remove();  
        Object.assign(activeState, { rect: null, zoomPart: null, zoomText: null, zoomBg: null, baseText: null, baseBg: null, animationId: null, clipPathId: null });  
    }  

    // --- الدوال المساعدة للتنسيق والتحميل ---
    function debounce(func, delay) { let t; return function() { clearTimeout(t); t = setTimeout(() => func.apply(this, arguments), delay); } }
    
    function wrapText(el, maxW) {  
        const txt = el.getAttribute('data-original-text'); if(!txt) return;  
        const words = txt.split(/\s+/); el.textContent = '';  
        let ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');  
        ts.setAttribute('x', el.getAttribute('x')); ts.setAttribute('dy', '0');  
        el.appendChild(ts); let line = '';  
        const lh = parseFloat(el.style.fontSize) * 1.1;  
        words.forEach(word => {  
            let test = line + (line ? ' ' : '') + word;  
            ts.textContent = test;  
            if (ts.getComputedTextLength() > maxW - 5 && line) {  
                ts.textContent = line;  
                ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');  
                ts.setAttribute('x', el.getAttribute('x')); ts.setAttribute('dy', lh + 'px');  
                ts.textContent = word; el.appendChild(ts); line = word;  
            } else { line = test; }  
        });  
    }  

    function getCumulativeTranslate(element) {  
        let x = 0, y = 0, current = element;  
        while (current && current.tagName !== 'svg') {  
            const trans = current.getAttribute('transform');  
            if (trans) {  
                const m = trans.match(/translate\s*([\d.-]+)[ ,]+([\d.-]+)\s*/);  
                if (m) { x += parseFloat(m[1]); y += parseFloat(m[2]); }  
            }  
            current = current.parentNode;  
        }  
        return { x, y };  
    }  

    function getGroupImage(element) {  
        let current = element;  
        while (current && current.tagName !== 'svg') {  
            if (current.tagName === 'g') {  
                const imgs = [...current.children].filter(c => c.tagName === 'image');  
                if (imgs.length) return { src: imgs[0].getAttribute('data-src') || imgs[0].getAttribute('href'), width: parseFloat(imgs[0].getAttribute('width')), height: parseFloat(imgs[0].getAttribute('height')), group: current };  
            }  
            current = current.parentNode;  
        }  
        return null;  
    }  

    function processRect(r) {  
        if (r.hasAttribute('data-processed')) return;  
        if(r.classList.contains('w')) r.setAttribute('width', '113.5');  
        if(r.classList.contains('hw')) r.setAttribute('width', '56.75');  

        const href = r.getAttribute('data-href') || '';  
        let name = r.getAttribute('data-full-text') || (href !== '#' ? href.split('/').pop().split('#')[0].split('.').slice(0, -1).join('.') : '');  
        name = name.replace(/\.pdf$/i, ''); 

        const w = parseFloat(r.getAttribute('width')) || r.getBBox().width;  
        const x = parseFloat(r.getAttribute('x')); const y = parseFloat(r.getAttribute('y'));  

        if (name && name.trim() !== '') {  
            const fs = Math.max(8, Math.min(12, w * 0.11));  
            const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');  
            txt.setAttribute('x', x + w / 2); txt.setAttribute('y', y + 2);  
            txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('class', 'rect-label');  
            txt.setAttribute('data-original-text', name); txt.setAttribute('data-original-for', href);  
            txt.style.fontSize = fs + 'px'; txt.style.fill = 'white'; txt.style.pointerEvents = 'none'; txt.style.dominantBaseline = 'hanging';  
            r.parentNode.appendChild(txt); wrapText(txt, w);  

            const bbox = txt.getBBox();  
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');  
            bg.setAttribute('x', x); bg.setAttribute('y', y); bg.setAttribute('width', w); bg.setAttribute('height', bbox.height + 8);  
            bg.setAttribute('class', 'label-bg'); bg.setAttribute('data-original-for', href);  
            bg.style.fill = 'black'; bg.style.pointerEvents = 'none';  
            r.parentNode.insertBefore(bg, txt);  
        }  

        if (!isTouchDevice) { r.addEventListener('mouseover', startHover); r.addEventListener('mouseout', cleanupHover); }  
        r.onclick = () => { if (href && href !== '#') window.open(href, '_blank'); };  

        r.addEventListener('touchstart', function(e) { if(!interactionEnabled) return; activeState.touchStartTime = Date.now(); activeState.initialScrollLeft = scrollContainer.scrollLeft; startHover.call(this); });  
        r.addEventListener('touchend', function(e) {   
            if (!interactionEnabled) return;  
            if (Math.abs(scrollContainer.scrollLeft - activeState.initialScrollLeft) < 10 && (Date.now() - activeState.touchStartTime) < TAP_THRESHOLD_MS) {  
                if (href && href !== '#') window.open(href, '_blank');  
            }  
            cleanupHover();  
        });  
        r.setAttribute('data-processed', 'true');  
    }  

    function scan() { mainSvg.querySelectorAll('rect.m').forEach(r => processRect(r)); }  

    // --- أحداث الأزرار والتحكم ---
    searchIcon.onclick = (e) => { e.preventDefault(); goToWood(); };  
    moveToggle.onclick = (e) => {  
        e.preventDefault();  
        if (toggleContainer.classList.contains('top')) toggleContainer.classList.replace('top', 'bottom');  
        else toggleContainer.classList.replace('bottom', 'top');  
    };  
    backButtonGroup.onclick = () => {   
        if (currentFolder !== "") {   
            let parts = currentFolder.split('/'); parts.pop(); 
            currentFolder = parts.join('/');   
            updateWoodInterface();   
        } else { goToMapEnd(); }   
    };  
    jsToggle.addEventListener('change', function() {   
        interactionEnabled = this.checked; if(!interactionEnabled) cleanupHover();   
    });

    // --- بدء التشغيل والتحميل (نظام اللمبات) ---  
    const urls = Array.from(mainSvg.querySelectorAll('image')).map(img => img.getAttribute('data-src') || img.getAttribute('href'));  
    let loadedCount = 0;  

    urls.forEach(u => {  
        const img = new Image();  
        img.onload = img.onerror = () => {  
            loadedCount++;  
            const p = (loadedCount / urls.length) * 100;  
            if(p >= 25) document.getElementById('bulb-1')?.classList.add('on');  
            if(p >= 50) document.getElementById('bulb-2')?.classList.add('on');  
            if(p >= 75) document.getElementById('bulb-3')?.classList.add('on');  
            if(p === 100) {  
                document.getElementById('bulb-4')?.classList.add('on');  
                setTimeout(() => {  
                    loadingOverlay.style.opacity = 0;  
                    setTimeout(() => {   
                        loadingOverlay.style.display = 'none';   
                        mainSvg.style.opacity = 1;   
                        scan();   
                        updateWoodInterface();   
                        goToMapEnd();   
                    }, 300);  
                }, 500);  
            }  
        };  
        img.src = u;  
    });
};
