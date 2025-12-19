window.onload = function() {
  const mainSvg = document.getElementById('main-svg');
  const scrollContainer = document.getElementById('scroll-container');
  const loadingOverlay = document.getElementById('loading-overlay');
  const jsToggle = document.getElementById('js-toggle');
  const searchInput = document.getElementById('search-input');

  const GITHUB_OWNER = "05george";
  const GITHUB_REPO  = "semester-3";
  const BRANCH = "main";

  // تحميل ملفات PDF من GitHub
  async function loadAllPdfFromGithub() {
    try {
      const api = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${BRANCH}?recursive=1`;
      const res = await fetch(api);
      const data = await res.json();
      if (!data.tree) return;

      const dynamicGroup = document.getElementById("dynamic-links-group");
      data.tree.forEach(item => {
        if (item.type === "blob" && item.path.endsWith(".pdf")) {
          const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
          g.style.cursor = "pointer";
          g.dataset.href = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${BRANCH}/${item.path}`;

          const yPos = dynamicGroup.childElementCount * 50 + 50;

          // المستطيل الأسود
          const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          rect.setAttribute("x", 50);
          rect.setAttribute("y", yPos);
          rect.setAttribute("width", 300);
          rect.setAttribute("height", 40);
          rect.setAttribute("rx", 5);
          rect.setAttribute("fill", "rgba(0,0,0,0.7)");
          rect.setAttribute("stroke", "#fff");
          rect.setAttribute("stroke-width", "1");
          rect.style.transition = "all 0.2s ease";

          // النص
          const text = document.createElementNS("http://www.w3.org/2000/svg","text");
          text.setAttribute("x", 200);
          text.setAttribute("y", yPos + 25);
          text.setAttribute("text-anchor","middle");
          text.setAttribute("fill","#fff");
          text.style.fontSize = "14px";
          text.style.pointerEvents = "none"; // منع النص من استقبال الhover
          text.textContent = item.path.split("/").pop();

          g.appendChild(rect);
          g.appendChild(text);

          // تأثير hover (تكبير + glow)
          g.addEventListener("mouseenter", () => {
            rect.setAttribute("fill", "rgba(255,255,255,0.2)");
            rect.setAttribute("stroke", "#00f");
            rect.setAttribute("stroke-width", "2");
            rect.setAttribute("transform", "scale(1.05)");
          });

          g.addEventListener("mouseleave", () => {
            rect.setAttribute("fill", "rgba(0,0,0,0.7)");
            rect.setAttribute("stroke", "#fff");
            rect.setAttribute("stroke-width", "1");
            rect.setAttribute("transform", "scale(1)");
          });

          g.addEventListener("click", () => {
            if(jsToggle.checked) window.open(g.dataset.href, "_blank");
          });

          dynamicGroup.appendChild(g);
        }
      });

      loadingOverlay.style.display = "none";
      mainSvg.style.opacity = 1;

    } catch(err) {
      console.error("Failed to load PDFs from GitHub:", err);
    }
  }

  loadAllPdfFromGithub();

  // التبديل بين تفعيل/تعطيل التفاعل
  jsToggle.addEventListener("change", () => {
    const enabled = jsToggle.checked;
    const items = document.querySelectorAll("#dynamic-links-group g");
    items.forEach(g => g.style.pointerEvents = enabled ? "auto" : "none");
  });

  // البحث داخل القائمة
  searchInput.addEventListener("input", () => {
    const value = searchInput.value.toLowerCase();
    const items = document.querySelectorAll("#dynamic-links-group g");
    items.forEach(g => {
      const text = g.querySelector("text").textContent.toLowerCase();
      g.style.display = text.includes(value) ? "block" : "none";
    });
  });

  // Lazy loading للصور داخل الـSVG
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting) {
        const img = entry.target;
        const src = img.getAttribute("data-src");
        if(src) img.setAttribute("href", src);
      }
    });
  }, { root: scrollContainer, threshold: 0.1 });

  document.querySelectorAll('image[data-src]').forEach(img => observer.observe(img));
};