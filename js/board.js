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
  const board = document.querySelector('.board');
  if (!board) return;

  // Add dragging styles dynamically
  const style = document.createElement('style');
  style.textContent = `
    .card.dragging { opacity: 0.4; }
    .col.drag-over {
      background-color: #f5eceb !important;
      border: 2px dashed #c9a4a1;
      border-radius: 8px;
    }
  `;
  document.head.appendChild(style);

  // Enable drag and drop
  document.querySelectorAll('.card').forEach(card => {
    card.setAttribute('draggable', 'true');
  });

  updateCounts();

  let draggedCard = null;

  board.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.card');
    if (card) {
      draggedCard = card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    }
  });

  board.addEventListener('dragend', (e) => {
    const card = e.target.closest('.card');
    if (card) card.classList.remove('dragging');
    draggedCard = null;
  });

  board.addEventListener('dragover', (e) => {
    const col = e.target.closest('.col');
    if (col && draggedCard) e.preventDefault();
  });

  board.addEventListener('dragenter', (e) => {
    const col = e.target.closest('.col');
    if (col && draggedCard) {
      e.preventDefault();
      col.classList.add('drag-over');
    }
  });

  board.addEventListener('dragleave', (e) => {
    const col = e.target.closest('.col');
    if (col && draggedCard && !col.contains(e.relatedTarget)) {
      col.classList.remove('drag-over');
    }
  });

  board.addEventListener('drop', (e) => {
    const col = e.target.closest('.col');
    if (col && draggedCard) {
      e.preventDefault();
      col.classList.remove('drag-over');
      col.appendChild(draggedCard);

      const select = draggedCard.querySelector('select.status');
      if (select) {
        select.value = col.dataset.status;
        select.dataset.status = col.dataset.status;
      }
      updateCounts();
    }
  });

  // Handle dropdown changes
  board.addEventListener('change', (e) => {
    if (e.target.classList.contains('status')) {
      const card = e.target.closest('.card');
      const targetCol = board.querySelector(`.col[data-status="${e.target.value}"]`);
      if (card && targetCol) {
        targetCol.appendChild(card);
        e.target.dataset.status = e.target.value;
        updateCounts();
      }
    }
  });

  function updateCounts() {
    document.querySelectorAll('.col').forEach(col => {
      const count = col.querySelectorAll('.card').length;
      const span = col.querySelector('h2 span');
      if (span) span.textContent = count;
    });
  }
});
