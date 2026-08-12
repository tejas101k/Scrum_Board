// Shared escapeHTML utility
window.escapeHTML = function(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

// Shared navbar and session handling utility
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
      
      const role = user.role || 'Admin';
      const navRight = document.querySelector('.nav_right');
      if (navRight) {
        navRight.innerHTML = `
          <div class="user-meta">
            <span class="user-name">${escapeHTML(user.name)}</span>
            <span class="user-role">${escapeHTML(role)}</span>
          </div>
          <div class="avatar">${escapeHTML(user.initials)}</div>
          <div class="profile-popup">
            <div class="avatar large">${escapeHTML(user.initials)}</div>
            <div class="profile-name">${escapeHTML(user.name)}</div>
            <div class="profile-role">${escapeHTML(role)}</div>
            <div class="profile-email">${escapeHTML(user.email || '')}</div>
            <button class="logout-btn">Log Out</button>
          </div>
        `;
        
        const popup = navRight.querySelector('.profile-popup');
        
        navRight.addEventListener('click', (e) => {
          if (popup.contains(e.target)) {
            if (e.target.classList.contains('logout-btn')) {
              if (confirm('Do you want to log out?')) {
                fetch('/auth/logout', { method: 'POST' })
                  .then(() => {
                    window.location.href = '../index.html';
                  })
                  .catch(() => {
                    window.location.href = '../index.html';
                  });
              }
            }
            return;
          }
          
          popup.classList.toggle('show');
          e.stopPropagation();
        });

        document.addEventListener('click', () => {
          popup.classList.remove('show');
        });
      }
    })
    .catch(() => {
      window.location.href = '../index.html';
    });
})();
