// كامل السكربت المحدث
window.onload = function() {
  const mainSvg = document.getElementById('main-svg');
  const scrollContainer = document.getElementById('scroll-container');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');
  const jsToggle = document.getElementById('js-toggle');
  const searchInput = document.getElementById('search-input');

  // Allow overflow so zoomed image/text can extend outside original rect
  try {
    mainSvg.setAttribute('overflow', 'visible');
    mainSvg.style.overflow = 'visible';
  } catch (e) {}

  let interactionEnabled = jsToggle.checked;
  const isTouchDevice = window.matchMedia('(hover: none)').matches;
  const TAP_THRESHOLD_MS = 300;

  const activeState = {
    rect: null,
    zoomPart: null,
    zoomText: null,
    zoomBg: null,
    baseText: null,
    animationId: null,
    clipPathId: null,
    initialScrollLeft: 0,
    isScrolling: false,
    touchStartTime: 0
  };

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
    const firstImage = images[0];
    const imageWidth = parseFloat(firstImage.getAttribute('width')) || 1024;
    const imageHeight = parseFloat(firstImage.getAttribute('height')) || 2454;
    const totalWidth = images.length * imageWidth;
    mainSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${imageHeight}`);
    window.MAX_SCROLL_LEFT = totalWidth - window.innerWidth;
  }
  updateDynamicSizes();

  const debouncedCleanupHover = debounce(function() {
    if (!interactionEnabled || !activeState.rect) return;
    if (activeState.rect) cleanupHover();
  }, 50);

  scrollContainer.addEventListener('scroll', function() {
    if (this.scrollLeft > window.MAX_SCROLL_LEFT) {
      this.scrollLeft = window.MAX_SCROLL_LEFT;
    }
    if (!interactionEnabled) return;
    if (activeState.rect && !isTouchDevice) {
      debouncedCleanupHover();
    }
    if (activeState.rect && isTouchDevice) {
      if (Math.abs(this.scrollLeft - activeState.initialScrollLeft) > 5) {
        activeState.isScrolling = true;
        cleanupHover();
      }
    }
  });

  function getCumulativeTranslate(element) {
    let x = 0, y = 0;
    let current = element;
    while (current && current.tagName !== 'svg') {
      const transformAttr = current.getAttribute('transform');
      if (transformAttr) {
        const match = transformAttr.match(/translate\(\s*([\d.-]+)[ ,]+([\d.-]+)\s*\)/);
        if (match) {
          x += parseFloat(match[1]);
          y += parseFloat(match[2]);
        }
      }
      current = current.parentNode;
    }
    return { x, y };
  }

  function getGroupImage(element) {
    let current = element;
    while (current && current.tagName !== 'svg') {
      if (current.tagName === 'g') {
        const images = [...current.children].filter(c => c.tagName === 'image');
        if (images.length) {
          const baseImage = images[0];
          return {
            src: baseImage.getAttribute('data-src') || baseImage.getAttribute('href'),
            width: parseFloat(baseImage.getAttribute('width')),
            height: parseFloat(baseImage.getAttribute('height')),
            group: current
          };
        }
      }
      current = current.parentNode;
    }
    return null;
  }

  function cleanupHover() {
    if (!activeState.rect) return;
    const rectToClean = activeState.rect;
    const zoomPartToClean = activeState.zoomPart;
    const zoomTextToClean = activeState.zoomText;
    const zoomBgToClean = activeState.zoomBg;
    const baseTextToClean = activeState.baseText;
    const animationIdToClean = activeState.animationId;

    if (animationIdToClean) clearInterval(animationIdToClean);

    rectToClean.style.filter = 'none';
    if (zoomPartToClean) zoomPartToClean.style.filter = 'none';
    if (zoomTextToClean) zoomTextToClean.style.filter = 'none';
    rectToClean.style.transform = 'scale(1)';
    rectToClean.style.strokeWidth = '2px';
    if (zoomPartToClean) zoomPartToClean.style.transform = 'scale(1)';
    if (baseTextToClean) baseTextToClean.style.opacity = '1';
    if (zoomTextToClean) zoomTextToClean.style.opacity = '0';

    if (zoomPartToClean) zoomPartToClean.remove();
    if (zoomTextToClean) zoomTextToClean.remove();
    if (zoomBgToClean) zoomBgToClean.remove();

    Object.assign(activeState, {
      rect: null,
      zoomPart: null,
      zoomText: null,
      zoomBg: null,
      baseText: null,
      animationId: null,
      clipPathId: null,
      initialScrollLeft: 0,
      isScrolling: false,
      touchStartTime: 0
    });
  }

  function startHover() {
    if (!interactionEnabled) return;
    const rect = this;
    if (activeState.rect === rect) return;
    cleanupHover();
    activeState.rect = rect;

    const scale = 2.0; // نكبر للضعف كما طلبتي
    const x = parseFloat(rect.getAttribute('x'));
    const y = parseFloat(rect.getAttribute('y'));
    const width = parseFloat(rect.getAttribute('width'));
    const height = parseFloat(rect.getAttribute('height'));

    const cumulative = getCumulativeTranslate(rect);
    const absoluteX = x + cumulative.x;
    const absoluteY = y + cumulative.y;
    const centerX = absoluteX + width / 2;
    const centerY = absoluteY + height / 2;

    rect.style.transformOrigin = `${x + width / 2}px ${y + height / 2}px`;
    rect.style.transform = `scale(${1.05})`; // نافذة بصريّة للمستطيل نفسه (خفيفة)
    rect.style.strokeWidth = '4px';

    const imageData = getGroupImage(rect);
    let zoomPartElement = null;
    if (imageData) {
      // لا ننشئ clipPath لكي يسمح للـ zoom-part بالخروج من حدود المستطيل
      const zoomPart = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      zoomPart.setAttribute('href', imageData.src);
      zoomPart.setAttribute('width', imageData.width);
      zoomPart.setAttribute('height', imageData.height);
      zoomPart.setAttribute('class', 'zoom-part');

      // وضع الصورة بنفس مكان المجموعة ليتطابق الإحداثي عند التكبير
      const groupTransform = imageData.group.getAttribute('transform');
      const match = groupTransform ? groupTransform.match(/translate\(([\d.-]+),([\d.-]+)\)/) : null;
      const groupX = match ? parseFloat(match[1]) : 0;
      const groupY = match ? parseFloat(match[2]) : 0;
      zoomPart.setAttribute('x', groupX);
      zoomPart.setAttribute('y', groupY);

      // اظهرها واعمل تكبير حول مركز المستطيل (سيخرج من الحدود لعدم وجود clip)
      zoomPart.style.opacity = 0;
      mainSvg.appendChild(zoomPart);
      activeState.zoomPart = zoomPart;
      zoomPart.style.transformOrigin = `${centerX}px ${centerY}px`;
      // تطبيق التحويل داخل style ليقوم بالتكبير من المركز
      zoomPart.style.transform = `scale(${scale})`;
      zoomPart.style.opacity = 1;
      zoomPartElement = zoomPart;
    }

    let baseText = rect.nextElementSibling;
    if (baseText && !baseText.matches('text.rect-label')) {
      baseText = null;
    }
    if (baseText) {
      baseText.style.opacity = '0';
      activeState.baseText = baseText;

      const zoomText = baseText.cloneNode(true);
      const rectFullText = rect.getAttribute('data-full-text') || baseText.getAttribute('data-original-text') || baseText.textContent;
      // remove children and set single text
      while (zoomText.firstChild) zoomText.removeChild(zoomText.firstChild);
      zoomText.textContent = rectFullText;

      // تكبير النص ×2 كما طلبتي
      const baseFont = parseFloat(baseText.style.fontSize) || parseFloat(window.getComputedStyle(baseText).fontSize) || 12;
      zoomText.style.fontSize = (baseFont * 2) + 'px';
      zoomText.style.fill = 'white';
      zoomText.style.pointerEvents = 'none';
      zoomText.style.userSelect = 'none';
      zoomText.style.opacity = '1';
      zoomText.setAttribute('text-anchor', 'middle');
      zoomText.setAttribute('class', 'rect-label zoom-text');

      // سنضع النص أفقياً في منتصف المستطيل الأساسي (عرض الخلفية يساوي عرض المستطيل)
      const textX = absoluteX + width / 2;
      // أضف النص أولاً ثم نحسب ثم نضيف الخلفية القصيرة في الأعلى
      zoomText.setAttribute('x', textX);
      // مؤقتاً ضع y لتتم إضافته إلى DOM
      zoomText.setAttribute('y', absoluteY + 10);
      mainSvg.appendChild(zoomText);
      activeState.zoomText = zoomText;

      // انتظر إطار لقياس البوكس ثم نرسم الخلفية بالعرض الكامل للمستطيل وبحافة علوية تلامس المستطيل الأساسي
      requestAnimationFrame(() => {
        try {
          const bbox = zoomText.getBBox();
          const fontSizePx = parseFloat(zoomText.style.fontSize) || (bbox.height || 12);
          const padding = fontSizePx * 0.18;

          // ارتفاع الخلفية: صغير (جزء علوي فقط) — بين حد أدنى وحد أقصى
          const minBgHeight = Math.max(Math.round(fontSizePx * 1.0), 14);
          const maxBgHeight = Math.max(Math.round(height * 0.28), minBgHeight);
          const desiredBgHeight = Math.round(fontSizePx + padding * 2);
          const bgHeight = Math.max(minBgHeight, Math.min(maxBgHeight, desiredBgHeight));

          // الخلفية تمتد بعرض المستطيل الأساسي، وتلامس الحافة العلوية
          const bgX = absoluteX;
          const bgY = absoluteY;
          const bgWidth = width;

          const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bg.setAttribute('x', bgX);
          bg.setAttribute('y', bgY);
          bg.setAttribute('width', bgWidth);
          bg.setAttribute('height', bgHeight);
          bg.setAttribute('rx', Math.max(2, Math.round(padding / 1.5)));
          bg.setAttribute('fill', 'black');
          bg.style.opacity = '0.95';
          bg.setAttribute('pointer-events', 'none');
          bg.setAttribute('class', 'zoom-text-bg');

          // ضع الخلفية قبل النص (حتى تكون خلفه)
          mainSvg.insertBefore(bg, zoomText);
          activeState.zoomBg = bg;

          // اضبط y للنص ليكون في منتصف الخلفية تقريباً (قريب من الأعلى كما طلبت)
          const textY = bgY + Math.round(bgHeight * 0.62);
          zoomText.setAttribute('y', textY);
        } catch (e) {
          console.warn('unable to measure zoomText bbox', e);
        }
      });
    }

    // تأثير الـ glow (متحرك)
    let hue = 0;
    activeState.animationId = setInterval(() => {
      hue = (hue + 10) % 360;
      const glow = `drop-shadow(0 0 8px hsl(${hue},100%,55%)) drop-shadow(0 0 14px hsl(${(hue + 60) % 360},100%,60%))`;
      rect.style.filter = glow;
      if (zoomPartElement) zoomPartElement.style.filter = glow;
      if (activeState.zoomText) activeState.zoomText.style.filter = glow;
      if (activeState.zoomBg) activeState.zoomBg.style.filter = glow;
    }, 100);
  }

  function stopHover() {
    if (!interactionEnabled) return;
    if (activeState.rect === this) cleanupHover();
  }

  function handleLinkOpen(event) {
    const href = event.currentTarget.getAttribute('data-href');
    if (href && href !== '#') {
      window.open(href, '_blank');
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function attachHover(rect, i) {
    rect.setAttribute('data-index', i);
    if (!isTouchDevice) {
      function handleMouseOver() { if (interactionEnabled) startHover.call(rect); }
      function handleMouseOut() { if (interactionEnabled) stopHover.call(rect); }
      rect.addEventListener('mouseover', handleMouseOver);
      rect.addEventListener('mouseout', handleMouseOut);
    }

    rect.addEventListener('click', handleLinkOpen);

    rect.addEventListener('touchstart', function(event) {
      if (!interactionEnabled) return;
      activeState.touchStartTime = Date.now();
      activeState.initialScrollLeft = scrollContainer.scrollLeft;
      activeState.isScrolling = false;
      startHover.call(this);
    });

    rect.addEventListener('touchend', function(event) {
      if (!interactionEnabled) return;
      const timeElapsed = Date.now() - activeState.touchStartTime;
      if (activeState.isScrolling === false && timeElapsed < TAP_THRESHOLD_MS) {
        handleLinkOpen(event);
      }
      cleanupHover();
    });
  }

  const svgImages = Array.from(mainSvg.querySelectorAll('image'));
  const rectShapes = Array.from(mainSvg.querySelectorAll('rect.image-mapper-shape'));
  const rectLabels = Array.from(mainSvg.querySelectorAll('text.rect-label'));
  const allRectsAndLabels = [...rectShapes, ...rectLabels];

  function filterRects(query) {
    const lowerQuery = query.toLowerCase();
    allRectsAndLabels.forEach(element => {
      let match = false;
      if (element.tagName === 'rect') {
        const href = element.getAttribute('data-href') || '';
        if (href.toLowerCase().includes(lowerQuery)) match = true;
      } else if (element.tagName === 'text') {
        if (element.textContent.toLowerCase().includes(lowerQuery)) match = true;
      }
      const rectShape = (element.tagName === 'rect') ? element : element.previousElementSibling;
      if (rectShape && rectShape.matches('rect.image-mapper-shape')) {
        const correspondingLabel = rectShape.nextElementSibling;
        if (query.length > 0 && !match) {
          rectShape.style.opacity = '0.1';
          rectShape.style.pointerEvents = 'none';
          if (correspondingLabel) correspondingLabel.style.opacity = '0.1';
        } else {
          rectShape.style.opacity = '1';
          rectShape.style.pointerEvents = 'auto';
          if (correspondingLabel) correspondingLabel.style.opacity = '1';
          if (query.length > 0 && match) {
            rectShape.style.filter = 'drop-shadow(0 0 8px #00FFFF) drop-shadow(0 0 14px #00FFFF)';
          } else {
            rectShape.style.filter = 'none';
          }
        }
      }
    });
  }

  const debouncedFilter = debounce(filterRects, 150);
  searchInput.addEventListener('input', function() { debouncedFilter(this.value); });

  const urls = svgImages.map(img => img.getAttribute('data-src') || img.getAttribute('href'));
  let loadedCount = 0;
  const totalCount = urls.length;

  function updateLoader() {
    const percent = Math.round((loadedCount / totalCount) * 100);
    if (loadingText) loadingText.textContent = `Preparing the environment...`;
    if (percent >= 25) document.getElementById('bulb-1').classList.add('on');
    if (percent >= 50) document.getElementById('bulb-2').classList.add('on');
    if (percent >= 75) document.getElementById('bulb-3').classList.add('on');
    if (percent === 100) document.getElementById('bulb-4').classList.add('on');
  }

  function finishLoading() {
    if (loadingOverlay) {
      setTimeout(() => {
        loadingOverlay.style.opacity = 0;
        setTimeout(() => {
          loadingOverlay.style.display = 'none';
          mainSvg.style.opacity = 1;
          setTimeout(() => {
            scrollContainer.scrollLeft = scrollContainer.scrollWidth;
            scrollContainer.scrollTo({ left: scrollContainer.scrollWidth, behavior: 'smooth' });
          }, 50);
        }, 300);
      }, 0);
    }
  }

  urls.forEach((url, index) => {
    const img = new Image();
    img.onload = img.onerror = () => {
      loadedCount++;
      updateLoader();
      if (loadedCount === totalCount) {
        finishLoading();
        svgImages.forEach((svgImg, i) => { svgImg.setAttribute('href', urls[i]); });
      }
    };
    img.src = url;
  });

  function wrapTextInSvg(textElement, maxWidth, padding = 5) {
    const text = textElement.textContent;
    const words = text.split(/\s+/).filter(w => w.length > 0);
    textElement.textContent = null;
    let tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    tspan.setAttribute('x', textElement.getAttribute('x'));
    tspan.setAttribute('dy', '0');
    textElement.appendChild(tspan);
    let currentLine = '';
    const lineHeight = parseFloat(textElement.style.fontSize) * 1.2;
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const lineTest = currentLine + (currentLine.length ? ' ' : '') + word;
      tspan.textContent = lineTest;
      if (tspan.getComputedTextLength() > maxWidth - (padding * 2) && currentLine.length > 0) {
        tspan.textContent = currentLine;
        tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.setAttribute('x', textElement.getAttribute('x'));
        tspan.setAttribute('dy', `${lineHeight}px`);
        textElement.appendChild(tspan);
        currentLine = word;
        tspan.textContent = word;
      } else {
        currentLine = lineTest;
      }
    }
  }

  document.querySelectorAll('rect.image-mapper-shape').forEach(rect => {
    const href = rect.getAttribute('data-href') || '';
    const fileName = href.split('/').pop().split('#')[0] || '';
    const baseName = fileName.split('.');
    const textContent = baseName.slice(0, baseName.length - 1).join('.');
    const rectWidth = parseFloat(rect.getAttribute('width'));
    const rectX = parseFloat(rect.getAttribute('x'));
    const rectY = parseFloat(rect.getAttribute('y'));
    const minFont = 8;
    const maxFont = 16;
    const scaleFactor = 0.12;
    let fontSize = rectWidth * scaleFactor;
    fontSize = Math.max(minFont, Math.min(maxFont, fontSize));
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', rectX + rectWidth / 2);
    const padding = fontSize * 0.2;
    const initialY = rectY + padding + fontSize * 0.8;
    text.setAttribute('y', initialY);
    text.setAttribute('text-anchor', 'middle');
    text.textContent = textContent;
    text.style.fontSize = fontSize + 'px';
    text.style.fill = 'white';
    text.style.pointerEvents = 'none';
    text.setAttribute('class', 'rect-label');
    text.setAttribute('data-original-text', textContent);
    rect.parentNode.insertBefore(text, rect.nextSibling);
    wrapTextInSvg(text, rectWidth);
  });

  document.querySelectorAll('rect.image-mapper-shape').forEach((rect, i) => {
    rect.setAttribute('data-processed', 'true');
    attachHover(rect, i);
  });

  const rootObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          if (node.matches('rect.image-mapper-shape') && !node.hasAttribute('data-processed')) {
            attachHover(node, Date.now());
            node.setAttribute('data-processed', 'true');
          }
          if (node.querySelector) {
            node.querySelectorAll('rect.image-mapper-shape:not([data-processed])').forEach(rect => {
              attachHover(rect, Date.now());
              rect.setAttribute('data-processed', 'true');
            });
          }
        }
      });
    });
  });
  rootObserver.observe(mainSvg, { childList: true, subtree: true });

  jsToggle.addEventListener('change', function() {
    interactionEnabled = this.checked;
    const label = document.getElementById('toggle-label');
    if (interactionEnabled) {
      label.textContent = 'Interaction Enabled';
    } else {
      label.textContent = 'Interaction Disabled';
      cleanupHover();
    }
  });

  const moveToggle = document.getElementById('move-toggle');
  const toggleContainer = document.getElementById('js-toggle-container');
  moveToggle.addEventListener('click', function() {
    if (toggleContainer.classList.contains('top')) {
      toggleContainer.classList.remove('top');
      toggleContainer.classList.add('bottom');
    } else {
      toggleContainer.classList.remove('bottom');
      toggleContainer.classList.add('top');
    }
  });
};