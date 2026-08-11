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
        navRight.innerHTML = `
          <div class="user-name">${user.name}</div>
          <div class="avatar">${user.initials}</div>
          <div class="profile-popup">
            <div class="avatar large">${user.initials}</div>
            <div class="profile-name">${user.name}</div>
            <div class="profile-email">${user.email || ''}</div>
            <button class="logout-btn">Log Out</button>
          </div>
        `;
        
        // Toggle profile popup on click
        navRight.style.cursor = 'pointer';
        navRight.title = 'View profile';
        
        const popup = navRight.querySelector('.profile-popup');
        
        navRight.addEventListener('click', (e) => {
          // If clicking inside the popup
          if (popup.contains(e.target)) {
            if (e.target.classList.contains('logout-btn')) {
              if (confirm('Do you want to log out?')) {
                fetch('/auth/logout', { method: 'POST' })
                  .then(() => {
                    window.location.href = '../index.html';
                  });
              }
            }
            return;
          }
          
          popup.classList.toggle('show');
          e.stopPropagation();
        });

        // Close popup when clicking outside
        document.addEventListener('click', () => {
          popup.classList.remove('show');
        });
      }
    })
    .catch(() => {
      window.location.href = '../index.html';
    });
})();

document.addEventListener('DOMContentLoaded', () => {
});
