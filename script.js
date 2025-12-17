window.onload = function() {
    const dimensions = { 'w': 115, 'hw': 57 };
    
    Object.keys(dimensions).forEach(className => {
        document.querySelectorAll(`rect.${className}`).forEach(rect => {
            rect.setAttribute('width', dimensions[className]);
        });
    });

    const mainSvg = document.getElementById('main-svg');
    const scrollContainer = document.getElementById('scroll-container');
    const clipDefs = mainSvg.querySelector('defs');
    const loadingOverlay = document.getElementById('loading-overlay');
    const jsToggle = document.getElementById('js-toggle');
    const searchInput = document.getElementById('search-input');

    let interactionEnabled = jsToggle.checked;
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    const activeState = { rect: null, animationId: null };

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
        const images = mainSvg.querySelectorAll('image');
        if (!images.length) return;
        const totalWidth = images.length * 1024;
        mainSvg.setAttribute('viewBox', `0 0 ${totalWidth} 2454`);
        window.MAX_SCROLL_LEFT = totalWidth - window.innerWidth;
    }
    updateDynamicSizes();

    function cleanupHover() {
        if (!activeState.rect) return;
        if (activeState.animationId) clearInterval(activeState.animationId);
        activeState.rect.style.filter = 'none';
        activeState.rect.style.transform = 'scale(1)';
        activeState.rect.style.strokeWidth = '2px';
        activeState.rect = null;
    }

    function startHover() {
        if (!interactionEnabled) return;
        const rect = this;
        if (activeState.rect === rect) return;
        cleanupHover();
        activeState.rect = rect;
        const x = parseFloat(rect.getAttribute('x'));
        const y = parseFloat(rect.getAttribute('y'));
        const width = parseFloat(rect.getAttribute('width'));
        const height = parseFloat(rect.getAttribute('height'));
        rect.style.transformOrigin = `${x + width/2}px ${y + height/2}px`;
        rect.style.transform = `scale(1.1)`;
        rect.style.strokeWidth = '4px';
        let hue = 0;
        activeState.animationId = setInterval(() => {
            hue = (hue + 10) % 360;
            rect.style.filter = `drop-shadow(0 0 8px hsl(${hue},100%,50%))`;
        }, 100);
    }

    const svgImages = Array.from(mainSvg.querySelectorAll('image'));
    const urls = svgImages.map(img => img.getAttribute('data-src') || img.getAttribute('href'));
    let loadedCount = 0;

    urls.forEach((url) => {
        const img = new Image();
        img.onload = img.onerror = () => {
            loadedCount++;
            const percent = Math.round((loadedCount / urls.length) * 100);
            if (percent >= 25) document.getElementById('bulb-1').classList.add('on');
            if (percent >= 50) document.getElementById('bulb-2').classList.add('on');
            if (percent >= 75) document.getElementById('bulb-3').classList.add('on');
            if (percent === 100) {
                document.getElementById('bulb-4').classList.add('on');
                svgImages.forEach((sImg, i) => sImg.setAttribute('href', urls[i]));
                loadingOverlay.style.opacity = '0';
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                    mainSvg.style.opacity = '1';
                    scrollContainer.scrollLeft = scrollContainer.scrollWidth;
                }, 400);
            }
        };
        img.src = url;
    });

    document.querySelectorAll('rect.m').forEach((rect, i) => {
        const href = rect.getAttribute('data-href') || '';
        const fileName = href.split('/').pop().split('.')[0] || '';
        const rectX = parseFloat(rect.getAttribute('x'));
        const rectY = parseFloat(rect.getAttribute('y'));
        const rectWidth = parseFloat(rect.getAttribute('width'));
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', rectX + rectWidth / 2);
        text.setAttribute('y', rectY + 20);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', 'rect-label');
        text.style.fill = 'white';
        text.style.fontSize = '12px';
        text.style.pointerEvents = 'none';
        text.textContent = fileName;
        rect.parentNode.insertBefore(text, rect.nextSibling);
        if (!isTouchDevice) {
            rect.addEventListener('mouseover', startHover);
            rect.addEventListener('mouseout', cleanupHover);
        }
        rect.addEventListener('click', () => {
            if (href && href !== '#') window.open(href, '_blank');
        });
    });

    searchInput.addEventListener('input', debounce(function() {
        const query = this.value.toLowerCase();
        document.querySelectorAll('rect.m').forEach(rect => {
            const fileName = (rect.getAttribute('data-href') || '').toLowerCase();
            const label = rect.nextElementSibling;
            if (fileName.includes(query)) {
                rect.style.opacity = '1';
                if(label) label.style.opacity = '1';
            } else {
                rect.style.opacity = '0.1';
                if(label) label.style.opacity = '0.1';
            }
        });
    }, 150));

    jsToggle.addEventListener('change', function() {
        interactionEnabled = this.checked;
        document.getElementById('toggle-label').textContent = interactionEnabled ? 'Interaction Enabled' : 'Interaction Disabled';
    });

    document.getElementById('move-toggle').addEventListener('click', () => {
        const container = document.getElementById('js-toggle-container');
        container.classList.toggle('top');
        container.classList.toggle('bottom');
    });
};