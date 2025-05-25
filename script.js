// Intercept the resume form submission and open resume.pdf in a new tab
const resumeForm = document.getElementById('resume-form');
if (resumeForm) {
  resumeForm.addEventListener('submit', function(e) {
    e.preventDefault();
    window.open('resume.pdf', '_blank');
  });
}


// Prevent .option buttons from being selected on click
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.option').forEach(function(option) {
    option.addEventListener('mousedown', function(e) {
      if (option.classList.contains('selected')) {
        e.preventDefault();
        e.stopPropagation();
        // Optionally, add a small animation or feedback here
      }
    });
  });
});