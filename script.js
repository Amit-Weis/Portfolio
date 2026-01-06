// Intercept the resume form submission and open resume.pdf in a new tab
const resumeForm = document.getElementById("resume-form");
if (resumeForm) {
  resumeForm.addEventListener("submit", function (e) {
    e.preventDefault();
    window.open("resume.pdf", "_blank");
  });
}
