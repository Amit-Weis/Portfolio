// ===== Portfolio cards → modal =====
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("projModal");
  if (!modal) return;
  const body = modal.querySelector(".proj-modal-body");
  const closeBtn = modal.querySelector(".proj-modal-close");

  // A card's preview is always the first image of its project's gallery.
  document.querySelectorAll(".proj-card[data-target]").forEach((card) => {
    const detail = document.getElementById(card.dataset.target);
    const first = detail && detail.querySelector(".gallery img");
    const media = card.querySelector("img.proj-card-media");
    if (first && media) media.src = first.getAttribute("src");
  });

  // ===== Image galleries inside a project =====
  function initGallery(gallery) {
    const imgs = Array.from(gallery.querySelectorAll("img"));
    const track = document.createElement("div");
    track.className = "gallery-track";
    imgs.forEach((img) => {
      const slide = document.createElement("div");
      slide.className = "gallery-slide";
      // Blurred copy of the image fills the letterbox around it
      slide.style.setProperty("--slide-bg", `url("${img.getAttribute("src")}")`);
      slide.appendChild(img);
      track.appendChild(slide);
    });
    gallery.appendChild(track);
    if (imgs.length < 2) return;

    const go = (i) => {
      const n = imgs.length;
      const idx = ((i % n) + n) % n;
      track.scrollTo({ left: idx * track.clientWidth, behavior: "smooth" });
    };
    const current = () => Math.round(track.scrollLeft / track.clientWidth);

    ["prev", "next"].forEach((dir) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gallery-arrow gallery-arrow--" + dir;
      btn.setAttribute("aria-label", dir === "prev" ? "Previous image" : "Next image");
      btn.textContent = dir === "prev" ? "‹" : "›";
      btn.addEventListener("click", () => go(current() + (dir === "prev" ? -1 : 1)));
      gallery.appendChild(btn);
    });

    const dots = document.createElement("div");
    dots.className = "gallery-dots";
    imgs.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "gallery-dot" + (i === 0 ? " is-active" : "");
      dot.setAttribute("aria-label", "Image " + (i + 1));
      dot.addEventListener("click", () => go(i));
      dots.appendChild(dot);
    });
    gallery.appendChild(dots);

    track.addEventListener("scroll", () => {
      const idx = current();
      dots.querySelectorAll(".gallery-dot").forEach((d, i) => {
        d.classList.toggle("is-active", i === idx);
      });
    });
  }

  function openProject(id) {
    const src = document.getElementById(id);
    if (!src) return;
    body.innerHTML = src.innerHTML;
    body.querySelectorAll(".gallery").forEach(initGallery);
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeProject() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    body.innerHTML = ""; // stops any playing video / iframe
    document.body.style.overflow = "";
  }

  document.querySelectorAll(".proj-card").forEach((card) => {
    const open = () => openProject(card.dataset.target);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });

  closeBtn.addEventListener("click", closeProject);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeProject();
  });
  document.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("open")) return;
    if (e.key === "Escape") closeProject();
    const gallery = body.querySelector(".gallery");
    if (gallery && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      const btn = gallery.querySelector(
        e.key === "ArrowLeft" ? ".gallery-arrow--prev" : ".gallery-arrow--next",
      );
      if (btn) btn.click();
    }
  });
});
