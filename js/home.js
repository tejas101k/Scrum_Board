// Check auth state
(function() {
  fetch('/auth/me')
    .then(res => {
      if (!res.ok) {
        window.location.href = '../index.html';
        return;
      }
      return res.json();
    })
    .then(user => {
      if (!user) return;
      
      // Update navbar
      const navRight = document.querySelector('.nav_right');
      if (navRight) {
        navRight.innerHTML = `<div>${user.name}</div><div class="avatar">${user.initials}</div>`;
        
        // Log out on click
        navRight.style.cursor = 'pointer';
        navRight.title = 'Click to log out';
        navRight.addEventListener('click', () => {
          if (confirm('Do you want to log out?')) {
            fetch('/auth/logout', { method: 'POST' })
              .then(() => {
                window.location.href = '../index.html';
              });
          }
        });
      }
    })
    .catch(() => {
      window.location.href = '../index.html';
    });
})();

document.addEventListener('DOMContentLoaded', () => {
});
