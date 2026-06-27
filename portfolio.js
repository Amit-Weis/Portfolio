// ===== Portfolio cards → modal =====
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("projModal");
  if (!modal) return;
  const body = modal.querySelector(".proj-modal-body");
  const closeBtn = modal.querySelector(".proj-modal-close");

  function openProject(id) {
    const src = document.getElementById(id);
    if (!src) return;
    body.innerHTML = src.innerHTML;
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
    if (e.key === "Escape" && modal.classList.contains("open")) closeProject();
  });
});
