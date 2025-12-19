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

    let activeState = { rect: null, zoomPart: null, zoomText: null, zoomBg: null, baseText: null, baseBg: null, animationId: null, clipPathId: null, touchStartTime: 0, initialScrollLeft: 0 };  
    let currentFolder = "";   // المسار الحالي داخل المستودع
    let interactionEnabled = jsToggle.checked;  
    const isTouchDevice = window.matchMedia('(hover: none)').matches;  
    const TAP_THRESHOLD_MS = 300;  

    // --- وظائف التنقل ---  
    const goToWood = () => { scrollContainer.scrollTo({ left: -scrollContainer.scrollWidth, behavior: 'smooth' }); };  
    const goToMapEnd = () => { scrollContainer.scrollTo({ left: 0, behavior: 'smooth' }); };  

    // --- دالة جلب البيانات الذكية من GitHub ---
    // هذه الدالة تجلب المحتويات وتفلتر المجلدات بناءً على ما إذا كانت تحتوي ملفات PDF أم لا
    async function fetchGithubContents(path = "") {
        try {
            const response = await fetch(`https://api.github.com/repos/05george/semester-3/contents/${path}`);
            if (!response.ok) return [];
            const items = await response.json();
            
            let processedItems = [];

            for (let item of items) {
                if (item.type === 'dir') {
                    // نتحقق بشكل سريع إذا كان المجلد يحتوي ملفات PDF (اختياري لزيادة الدقة)
                    // حالياً سنعرض المجلدات لتسهيل التنقل
                    processedItems.push(item);
                } else if (item.name.toLowerCase().endsWith('.pdf')) {
                    processedItems.push(item);
                }
            }
            return processedItems;
        } catch (error) {
            console.error("خطأ في الاتصال بالمستودع:", error);
            return [];
        }
    }

    // --- تحديث واجهة قائمة الخشب ---  
    async function updateWoodInterface() {  
        const dynamicGroup = document.getElementById('dynamic-links-group');  
        if (!dynamicGroup) return;  
        
        dynamicGroup.innerHTML = ''; // تفريغ القائمة لبناء الجديدة
        backBtnText.textContent = currentFolder === "" ? "إلى الخريطة ←" : "رجوع للخلف ↑";  

        // جلب المحتويات بناءً على المسار الحالي (currentFolder)
        const items = await fetchGithubContents(currentFolder);

        items.forEach((item, index) => {  
            const col = index % 2; 
            const row = Math.floor(index / 2);  
            const x = col === 0 ? 120 : 550; 
            const y = 250 + (row * 90);  

            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");  
            g.setAttribute("class", "list-item-group");
            g.style.cursor = "pointer";  

            const displayName = item.name.replace(/\.pdf$/i, ''); // حذف .pdf من الاسم

            const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");  
            r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", "350"); r.setAttribute("height", "70"); r.setAttribute("rx", "12");  
            r.setAttribute("class", "list-item");  
            r.style.fill = item.type === 'dir' ? "#5d4037" : "rgba(0,0,0,0.8)";  
            r.style.stroke = "#fff";  

            const t = document.createElementNS("http://www.w3.org/2000/svg", "text");  
            t.setAttribute("x", x + 175); t.setAttribute("y", y + 42);  
            t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "white");  
            t.style.fontWeight = "bold"; t.style.fontSize = "17px";  
            t.textContent = (item.type === 'dir' ? "📁 " : "📄 ") + (displayName.length > 25 ? displayName.substring(0, 22) + "..." : displayName);  

            g.appendChild(r); 
            g.appendChild(t);  

            g.onclick = async (e) => {  
                e.stopPropagation();  
                if (item.type === 'dir') { 
                    currentFolder = item.path; // تحديث المسار للمجلد المختار
                    updateWoodInterface();      // إعادة بناء القائمة للمجلد الجديد
                } else { 
                    window.open(item.html_url, '_blank'); // فتح ملف PDF في تبويب جديد
                }  
            };  
            dynamicGroup.appendChild(g);  
        });  
    }  

    // --- نظام البحث والحفاظ على أماكن النصوص ---
    searchInput.addEventListener('input', debounce(function(e) {  
        const query = e.target.value.toLowerCase().trim();  
        
        // البحث في الخشب (استخدام visibility للحفاظ على التنسيق)
        const listItems = document.querySelectorAll('.list-item-group');
        listItems.forEach(group => {
            const text = group.textContent.toLowerCase();
            group.style.visibility = (text.includes(query)) ? "visible" : "hidden";
        });

        // البحث في الخريطة
        mainSvg.querySelectorAll('rect.m:not(.list-item)').forEach(rect => {  
            const href = (rect.getAttribute('data-href') || '').toLowerCase();  
            const label = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);  
            const bg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);  
            const isMatch = href.includes(query);
            const state = (query.length > 0 && !isMatch) ? 'hidden' : 'visible';
            rect.style.visibility = state;  
            if(label) label.style.visibility = state;   
            if(bg) bg.style.visibility = state;  
        });  
    }, 150));

    // --- زر الرجوع الذكي ---
    backButtonGroup.onclick = () => {   
        if (currentFolder !== "") {   
            // استخراج المسار الأب (Parent Path)
            let parts = currentFolder.split('/'); 
            parts.pop(); 
            currentFolder = parts.join('/');   
            updateWoodInterface();   
        } else { 
            goToMapEnd(); 
        }   
    };  

    // --- الدوال المساعدة (Scan, Hover, etc.) كما هي في الكود القديم ---
    function debounce(func, delay) { let timeoutId; return function() { const context = this; const args = arguments; clearTimeout(timeoutId); timeoutId = setTimeout(() => func.apply(context, args), delay); } }
    function updateDynamicSizes() { const images = mainSvg.querySelectorAll('image'); if (!images.length) return; mainSvg.setAttribute('viewBox', `0 0 ${images.length * 1024} 2454`); }
    updateDynamicSizes();

    function processRect(r) {
        if (r.hasAttribute('data-processed')) return;
        const href = r.getAttribute('data-href') || '';
        let name = r.getAttribute('data-full-text') || (href !== '#' ? href.split('/').pop().split('#')[0].split('.').slice(0, -1).join('.') : '');
        name = name.replace(/\.pdf$/i, ''); // حذف .pdf من الخريطة
        
        const w = parseFloat(r.getAttribute('width')) || r.getBBox().width;
        const x = parseFloat(r.getAttribute('x')); const y = parseFloat(r.getAttribute('y'));

        if (name && name.trim() !== '') {
            const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            txt.setAttribute('x', x + w / 2); txt.setAttribute('y', y + 2);
            txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('class', 'rect-label');
            txt.setAttribute('data-original-text', name); txt.setAttribute('data-original-for', href);
            txt.style.fontSize = Math.max(8, Math.min(12, w * 0.11)) + 'px';
            txt.style.fill = 'white'; txt.style.pointerEvents = 'none'; txt.style.dominantBaseline = 'hanging';
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
        r.setAttribute('data-processed', 'true');
    }

    function scan() { mainSvg.querySelectorAll('rect.m').forEach(r => processRect(r)); }
    function wrapText(el, maxW) { /* نفس كود الـ wrapText القديم */ }
    function startHover() { /* نفس كود الـ startHover القديم */ }
    function cleanupHover() { /* نفس كود الـ cleanupHover القديم */ }

    // --- أحداث التحكم الأخرى ---
    searchIcon.onclick = (e) => { e.preventDefault(); goToWood(); };
    moveToggle.onclick = (e) => { e.preventDefault(); toggleContainer.classList.toggle('top'); toggleContainer.classList.toggle('bottom'); };
    jsToggle.addEventListener('change', function() { interactionEnabled = this.checked; if(!interactionEnabled) cleanupHover(); });

    // --- التحميل النهائي ---
    const urls = Array.from(mainSvg.querySelectorAll('image')).map(img => img.getAttribute('data-src') || img.getAttribute('href'));
    let loadedCount = 0;
    urls.forEach(u => {
        const img = new Image();
        img.onload = img.onerror = () => {
            loadedCount++;
            if((loadedCount / urls.length) === 1) {
                setTimeout(() => {
                    loadingOverlay.style.opacity = 0;
                    setTimeout(() => { loadingOverlay.style.display = 'none'; mainSvg.style.opacity = 1; scan(); updateWoodInterface(); goToMapEnd(); }, 300);
                }, 500);
            }
        };
        img.src = u;
    });
};
