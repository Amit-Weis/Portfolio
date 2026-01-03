// // Section collapse
// document.querySelectorAll(".portfolio-section-header").forEach((header) => {
//   header.addEventListener("click", () => {
//     header.parentElement.classList.toggle("collapsed");
//     const content = header.nextElementSibling.nextElementSibling;
//     content.style.display = content.style.display === "none" ? "block" : "none";
//   });
// });

// Item collapse
document.querySelectorAll(".portfolio-item-header").forEach((header) => {
  header.addEventListener("click", () => {
    header.parentElement.classList.toggle("expanded");
  });
});
