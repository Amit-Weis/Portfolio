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
    option.addEventListener('click', function() {
      const img = option.querySelector('img');
      if (!img) return;

      const alt = img.getAttribute('alt');
      if (!alt) return;

      // Skip if this option group is already selected
      if (option.classList.contains('selected')) return;

      // Remove 'selected' from all .option elements
      document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));

      // Add 'selected' to all options with the same alt
      document.querySelectorAll('.option').forEach(opt => {
        const optImg = opt.querySelector('img');
        if (optImg && optImg.getAttribute('alt') === alt) {
          opt.classList.add('selected');
        }
      });

      // Navigate to the appropriate page
      const page = alt.toLowerCase().replace(/\s+/g, '') + '.html'; // e.g., "Person" → "person.html"
      setTimeout(() => {
        window.location.href = page;
      }, 10);
    });
  });
});
