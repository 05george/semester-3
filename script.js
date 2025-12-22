/* ================== الإعدادات العامة ================== */
const GITHUB_USER = "MUE24Med";
const REPO_NAME = "semester-3";

const TREE_API_URL =
  `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/git/trees/main?recursive=1`;
const RAW_CONTENT_BASE =
  `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/`;

let SELECTED_GROUP = null;
let globalFileTree = [];
let currentFolder = "";
let interactionEnabled = true;

/* ================== عناصر الواجهة ================== */
const loadingOverlay = document.getElementById("loading-overlay");
const groupSelector = document.getElementById("group-selector");
const splashImage = document.getElementById("splash-image");
const scrollContainer = document.getElementById("scroll-container");
const mainSvg = document.getElementById("main-svg");
const clipDefs = mainSvg.querySelector("defs");
const backButtonGroup = document.getElementById("back-button-group");
const backBtnText = document.getElementById("back-btn-text");
const searchInput = document.getElementById("search-input");
const searchIcon = document.getElementById("search-icon");
const jsToggle = document.getElementById("js-toggle");

/* ================== تحميل شجرة الملفات ================== */
async function fetchGlobalTree() {
  if (globalFileTree.length) return;
  const res = await fetch(TREE_API_URL);
  const data = await res.json();
  globalFileTree = data.tree || [];
}

/* ================== تحميل SVG الجروب ================== */
async function loadGroupSVG() {
  const container = document.getElementById("map-content-container");
  if (!container) return;

  const res = await fetch(`groups/group-${SELECTED_GROUP}.svg`);
  if (!res.ok) throw new Error("Group SVG not found");

  container.innerHTML = await res.text();
}

/* ================== اختيار الجروب ================== */
function setupGroupSelector() {
  const buttons = document.querySelectorAll(".group-buttons button");

  if (!localStorage.getItem("selectedGroup")) {
    groupSelector.style.display = "flex";
    loadingOverlay.style.display = "none";
    return;
  }

  groupSelector.style.display = "none";

  buttons.forEach(btn => {
    btn.onclick = () => {
      localStorage.setItem("selectedGroup", btn.dataset.group);
      location.reload();
    };
  });
}

/* ================== فتح الملفات ================== */
function smartOpen(item) {
  if (!item?.path) return;
  const url = RAW_CONTENT_BASE + item.path;

  if (url.endsWith(".pdf")) {
    const overlay = document.getElementById("pdf-overlay");
    const frame = document.getElementById("pdfFrame");
    overlay.classList.remove("hidden");
    frame.src =
      "https://mozilla.github.io/pdf.js/web/viewer.html?file=" +
      encodeURIComponent(url);
  } else {
    window.open(url, "_blank");
  }
}

/* ================== الخشب ================== */
async function updateWoodInterface() {
  const dynamicGroup = document.getElementById("dynamic-links-group");
  if (!dynamicGroup) return;

  dynamicGroup.innerHTML = "";
  await fetchGlobalTree();

  backBtnText.textContent =
    currentFolder === "" ? "➡️ إلى الخريطة" : "🔙 رجوع";

  const prefix = currentFolder ? currentFolder + "/" : "";
  const items = new Map();

  globalFileTree.forEach(item => {
    if (!item.path.startsWith(prefix)) return;
    const rel = item.path.slice(prefix.length);
    const parts = rel.split("/");
    const name = parts[0];

    if (items.has(name)) return;

    if (parts.length > 1 || item.type === "tree") {
      items.set(name, { type: "dir", path: prefix + name });
    } else if (item.path.endsWith(".pdf")) {
      items.set(name, { type: "file", path: item.path });
    }
  });

  let i = 0;
  for (const item of items.values()) {
    const x = i % 2 === 0 ? 120 : 550;
    const y = 250 + Math.floor(i / 2) * 90;
    i++;

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.style.cursor = "pointer";

    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", x);
    r.setAttribute("y", y);
    r.setAttribute("width", 350);
    r.setAttribute("height", 70);
    r.setAttribute("rx", 12);
    r.style.fill = item.type === "dir" ? "#5d4037" : "#000";
    r.style.opacity = "0.85";

    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", x + 175);
    t.setAttribute("y", y + 45);
    t.setAttribute("text-anchor", "middle");
    t.style.fill = "#fff";
    t.style.fontWeight = "bold";
    t.textContent =
      (item.type === "dir" ? "📁 " : "📄 ") +
      item.path.split("/").pop().replace(".pdf", "");

    g.append(r, t);
    g.onclick = () => {
      if (item.type === "dir") {
        currentFolder = item.path;
        updateWoodInterface();
      } else {
        smartOpen(item);
      }
    };

    dynamicGroup.appendChild(g);
  }
}

/* ================== التشغيل الرئيسي ================== */
window.onload = async () => {
  setupGroupSelector();

  const saved = localStorage.getItem("selectedGroup");
  if (!saved) return;

  SELECTED_GROUP = saved;
  splashImage.src = `image/logo-${SELECTED_GROUP}.webp`;

  try {
    await Promise.all([loadGroupSVG(), fetchGlobalTree()]);
    updateWoodInterface();

    setTimeout(() => {
      loadingOverlay.style.opacity = "0";
      setTimeout(() => {
        loadingOverlay.style.display = "none";
        scrollContainer.scrollTo({ left: 0 });
      }, 400);
    }, 700);
  } catch (e) {
    console.error(e);
    loadingOverlay.style.display = "none";
  }
};

/* ================== أزرار ================== */
backButtonGroup.onclick = () => {
  if (currentFolder) {
    currentFolder = "";
    updateWoodInterface();
  } else {
    scrollContainer.scrollTo({ left: 0, behavior: "smooth" });
  }
};

searchIcon.onclick = () =>
  scrollContainer.scrollTo({ left: -scrollContainer.scrollWidth });

jsToggle.onchange = e => {
  interactionEnabled = e.target.checked;
};
            dynamicGroup.appendChild(g);
        }
        applyWoodSearchFilter();
    }

    function applyWoodSearchFilter() {
        const query = searchInput.value.toLowerCase().trim();
        mainSvg.querySelectorAll('.wood-file-group').forEach(group => {
            const name = group.querySelector('text').getAttribute('data-search-name') || "";
            group.style.display = (query === "" || name.includes(query)) ? 'inline' : 'none';
        });
        mainSvg.querySelectorAll('.wood-folder-group').forEach(group => { group.style.display = 'inline'; });
    }

    function processRect(r) {
        if (r.hasAttribute('data-processed')) return;
        if(r.classList.contains('w')) r.setAttribute('width', '113.5');
        if(r.classList.contains('hw')) r.setAttribute('width', '56.75');
        const href = r.getAttribute('data-href') || '';
        const name = r.getAttribute('data-full-text') || (href !== '#' ? href.split('/').pop().split('#')[0].split('.').slice(0, -1).join('.') : '');
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

    function scan() { mainSvg.querySelectorAll('rect.image-mapper-shape, rect.m').forEach(r => processRect(r)); }

    const urls = Array.from(mainSvg.querySelectorAll('image'))
                  .map(img => img.getAttribute('data-src'))
                  .filter(src => src !== null && src !== "");

    urls.forEach((u, index) => {
        const img = new Image();
        img.onload = img.onerror = () => {
            loadedCount++;
            const p = (loadedCount / urls.length) * 100;
            if(p >= 25) document.getElementById('bulb-4')?.classList.add('on');
            if(p >= 50) document.getElementById('bulb-3')?.classList.add('on');
            if(p >= 75) document.getElementById('bulb-2')?.classList.add('on');
            if(loadedCount === urls.length) {
                document.getElementById('bulb-1')?.classList.add('on');
                mainSvg.querySelectorAll('image').forEach(si => {
                    const actualSrc = si.getAttribute('data-src');
                    if(actualSrc) si.setAttribute('href', actualSrc);
                });
                setTimeout(() => {
                    if(loadingOverlay) {
                        loadingOverlay.style.opacity = '0';
                        setTimeout(() => { 
                            loadingOverlay.style.display = 'none'; 
                            mainSvg.style.opacity = '1'; 
                            scan(); updateWoodInterface(); goToMapEnd(); 
                        }, 500);
                    }
                }, 600);
            }
        };
        img.src = u;
    });

    searchInput.addEventListener('input', debounce(function(e) {
        const query = e.target.value.toLowerCase().trim();
        mainSvg.querySelectorAll('rect.m:not(.list-item)').forEach(rect => {
            const isMatch = (rect.getAttribute('data-href') || '').toLowerCase().includes(query) || (rect.getAttribute('data-full-text') || '').toLowerCase().includes(query);
            const label = rect.parentNode.querySelector(`.rect-label[data-original-for='${rect.dataset.href}']`);
            const bg = rect.parentNode.querySelector(`.label-bg[data-original-for='${rect.dataset.href}']`);
            rect.style.display = (query.length > 0 && !isMatch) ? 'none' : '';
            if(label) label.style.display = rect.style.display; 
            if(bg) bg.style.display = rect.style.display;
        });
        applyWoodSearchFilter();
    }, 150));

    jsToggle.addEventListener('change', function() { 
        interactionEnabled = this.checked; if(!interactionEnabled) cleanupHover(); 
    });
// منع القائمة عند الضغط المطول على أي صورة داخل الـ SVG
document.getElementById('main-svg').addEventListener('contextmenu', function(e) {
    e.preventDefault();
}, false);
;