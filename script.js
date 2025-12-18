window.onload = function() {
    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');
    const searchIcon = document.getElementById('search-icon');
    const backButtonGroup = document.getElementById('back-button-group');
    const backBtnText = document.getElementById('back-btn-text');

    let currentFolder = ""; 
    let interactionEnabled = jsToggle.checked;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;

    const activeState = { rect: null, animationId: null };

    // وظائف الحركة (Scroll)
    const goToWood = () => scrollContainer.scrollTo({ left: 0, behavior: 'smooth' });
    const goToMapEnd = () => scrollContainer.scrollTo({ left: scrollContainer.scrollWidth, behavior: 'smooth' });

    // تحديث أبعاد الـ SVG بناءً على عدد الصور
    function updateViewBox() {
        const images = mainSvg.querySelectorAll('image');
        mainSvg.setAttribute('viewBox', `0 0 ${images.length * 1024} 2454`);
    }
    updateViewBox();

    // بناء قائمة المجلدات والملفات على الخشب بنظام صفين
    function updateWoodInterface() {
        const dynamicGroup = document.getElementById('dynamic-links-group');
        if (!dynamicGroup) return;
        dynamicGroup.innerHTML = ''; 

        // تحديث نص زر الرجوع ديناميكياً
        backBtnText.textContent = currentFolder === "" ? "إلى الخريطة ←" : "رجوع للخلف ↑";

        const allRects = Array.from(mainSvg.querySelectorAll('rect.m:not(.list-item)'));
        const folders = new Set();
        const files = [];

        allRects.forEach(r => {
            const href = r.getAttribute('data-href') || "";
            if (!href || href === "#") return;

            if (currentFolder === "") {
                if (href.includes('/')) folders.add(href.split('/')[0]);
                else files.push({ href, text: r.getAttribute('data-full-text') || href });
            } else if (href.startsWith(currentFolder + '/')) {
                const relativePath = href.replace(currentFolder + '/', '');
                if (relativePath.includes('/')) folders.add(relativePath.split('/')[0]);
                else files.push({ href, text: r.getAttribute('data-full-text') || relativePath });
            }
        });

        const items = [
            ...Array.from(folders).map(f => ({ label: f, path: f, isFolder: true })),
            ...files.map(f => ({ label: f.text, path: f.href, isFolder: false }))
        ];

        // توزيع العناصر في صفين (Column 1: x=120 | Column 2: x=550)
        items.forEach((item, index) => {
            const col = index % 2; 
            const row = Math.floor(index / 2);
            const x = col === 0 ? 120 : 550;
            const y = 250 + (row * 90);
            
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            g.style.cursor = "pointer";

            const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            r.setAttribute("x", x); r.setAttribute("y", y);
            r.setAttribute("width", "350"); r.setAttribute("height", "70"); r.setAttribute("rx", "12");
            r.style.fill = item.isFolder ? "#5d4037" : "rgba(0,0,0,0.7)";
            r.style.stroke = "#fff";
            r.setAttribute("class", "list-item");

            const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
            t.setAttribute("x", x + 175); t.setAttribute("y", y + 42);
            t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "white");
            t.style.fontWeight = "bold"; t.style.fontSize = "18px";
            t.textContent = (item.isFolder ? "📁 " : "📄 ") + item.label;

            g.appendChild(r); g.appendChild(t);
            g.onclick = (e) => {
                e.stopPropagation();
                if (item.isFolder) {
                    currentFolder = currentFolder === "" ? item.path : currentFolder + "/" + item.path;
                    updateWoodInterface();
                } else { window.open(item.path, '_blank'); }
            };
            dynamicGroup.appendChild(g);
        });
    }

    // منطق الأزرار والتحكم بالحركة
    backButtonGroup.onclick = () => {
        if (currentFolder !== "") {
            let parts = currentFolder.split('/'); parts.pop();
            currentFolder = parts.join('/');
            updateWoodInterface();
        } else { goToMapEnd(); } // العودة لأقصى اليمين
    };

    searchIcon.onclick = () => { goToWood(); searchInput.focus(); }; // الذهاب لأقصى اليسار

    searchInput.onkeydown = (e) => {
        if (e.key === "Enter") { goToWood(); searchInput.blur(); } // الذهاب لليسار عند البحث
    };

    // ميزات الـ Hover والتفاعل
    function startHover() {
        if (!interactionEnabled || this.classList.contains('list-item')) return;
        activeState.rect = this;
        this.style.transform = "scale(1.1)";
        let h = 0;
        activeState.animationId = setInterval(() => {
            h = (h + 15) % 360;
            this.style.filter = `drop-shadow(0 0 10px hsl(${h},100%,60%))`;
        }, 100);
    }

    function stopHover() {
        this.style.transform = "scale(1)";
        this.style.filter = "none";
        clearInterval(activeState.animationId);
    }

    // نظام التحميل (Loading) واللمبات
    const allImages = mainSvg.querySelectorAll('image');
    let loaded = 0;
    allImages.forEach(img => {
        const src = img.getAttribute('data-src');
        if (!src) return;
        const temp = new Image();
        temp.onload = () => {
            img.setAttribute('href', src);
            loaded++;
            const progress = (loaded / allImages.length) * 100;
            if(progress >= 25) document.getElementById('bulb-1').classList.add('on');
            if(progress >= 50) document.getElementById('bulb-2').classList.add('on');
            if(progress >= 75) document.getElementById('bulb-3').classList.add('on');
            if(loaded === allImages.length) {
                document.getElementById('bulb-4').classList.add('on');
                setTimeout(() => {
                    loadingOverlay.style.opacity = 0;
                    setTimeout(() => { 
                        loadingOverlay.style.display = 'none'; 
                        mainSvg.style.opacity = 1;
                        updateWoodInterface();
                        goToMapEnd(); // البداية من اليمين عند اكتمال التحميل
                    }, 500);
                }, 500);
            }
        };
        temp.src = src;
    });

    // ربط الأحداث بالمربعات التفاعلية
    mainSvg.querySelectorAll('rect.m').forEach(r => {
        if (!isTouchDevice) {
            r.addEventListener('mouseenter', startHover);
            r.addEventListener('mouseleave', stopHover);
        }
        r.onclick = () => { if (r.dataset.href && r.dataset.href !== '#') window.open(r.dataset.href, '_blank'); };
    });

    jsToggle.addEventListener('change', function() { interactionEnabled = this.checked; });
};