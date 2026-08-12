// Check if user is logged in
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
      
      // Update navbar with user info
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
        
        navRight.style.cursor = 'pointer';
        navRight.title = 'View profile';
        
        const popup = navRight.querySelector('.profile-popup');
        
        navRight.addEventListener('click', (e) => {
          if (popup.contains(e.target)) {
            if (e.target.classList.contains('logout-btn')) {
              if (confirm('Do you want to log out?')) {
                fetch('/auth/logout', { method: 'POST' })
                  .then(res => {
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

document.addEventListener('DOMContentLoaded', () => {
  const board = document.querySelector('.board');
  if (!board) return;

  // Append drag & drop styles
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

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // Create card element
  function createCardElement(task) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = task.id;
    card.dataset.type = task.type;
    card.setAttribute('draggable', 'true');

    const initials = task.assignee_initials || '–';
    card.innerHTML = `
      <span class="tag">${task.type === 'story' ? 'S' : (task.type === 'bug' ? 'B' : 'T')}</span>
      <p>${escapeHTML(task.title)}</p>
      <select class="status" data-status="${task.status}">
        <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
        <option value="progress" ${task.status === 'progress' ? 'selected' : ''}>In Progress</option>
        <option value="review" ${task.status === 'review' ? 'selected' : ''}>In Review</option>
        <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
      </select>
      <div class="card-foot">
        <span>${escapeHTML(task.priority)}</span>
        <span class="who-badge">${escapeHTML(initials)}</span>
      </div>
    `;
    return card;
  }

  // Fetch and load tasks from the database
  function loadTasks() {
    document.querySelectorAll('.col .card').forEach(c => c.remove());
    fetch('/tasks')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load tasks');
        return r.json();
      })
      .then(tasks => {
        tasks.forEach(task => {
          const col = board.querySelector(`.col[data-status="${task.status}"]`);
          if (col) col.appendChild(createCardElement(task));
        });
        updateCounts();
      })
      .catch(err => {
        console.error('Error loading tasks:', err);
      });
  }

  loadTasks();

  let draggedCard = null;

  board.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.card');
    if (card) {
      draggedCard = card;
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', '');
    }
  });

  board.addEventListener('dragend', (e) => {
    const card = e.target.closest('.card');
    if (card) card.classList.remove('dragging');
    draggedCard = null;
  });

  board.addEventListener('dragover', e => {
    if (e.target.closest('.col') && draggedCard) e.preventDefault();
  });

  board.addEventListener('dragenter', e => {
    const col = e.target.closest('.col');
    if (col && draggedCard) {
      e.preventDefault();
      col.classList.add('drag-over');
    }
  });

  board.addEventListener('dragleave', e => {
    const col = e.target.closest('.col');
    if (col && draggedCard && !col.contains(e.relatedTarget)) {
      col.classList.remove('drag-over');
    }
  });

  board.addEventListener('drop', e => {
    const col = e.target.closest('.col');
    if (col && draggedCard) {
      e.preventDefault();
      col.classList.remove('drag-over');

      const oldCol = draggedCard.parentElement;
      const select = draggedCard.querySelector('select.status');
      const oldStatus = select ? select.dataset.status : null;

      // Optimistically append the card
      col.appendChild(draggedCard);

      if (select) {
        select.value = col.dataset.status;
        select.dataset.status = col.dataset.status;
      }
      updateCounts();

      fetch(`/tasks/${draggedCard.dataset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: col.dataset.status })
      })
      .then(r => {
        if (!r.ok) throw new Error('Update failed');
        return r.json();
      })
      .then(updatedTask => {
        if (select) {
          select.value = updatedTask.status;
          select.dataset.status = updatedTask.status;
        }
      })
      .catch(err => {
        alert('Failed to update status on server. Reverting.');
        if (oldCol) {
          oldCol.appendChild(draggedCard);
        }
        if (select && oldStatus) {
          select.value = oldStatus;
          select.dataset.status = oldStatus;
        }
        updateCounts();
      });
    }
  });

  board.addEventListener('change', e => {
    if (e.target.classList.contains('status')) {
      const card = e.target.closest('.card');
      const oldStatus = e.target.dataset.status;
      const col = board.querySelector(`.col[data-status="${e.target.value}"]`);
      
      if (card && col) {
        // Optimistically append the card
        col.appendChild(card);
        const newStatus = e.target.value;
        e.target.dataset.status = newStatus;
        updateCounts();

        fetch(`/tasks/${card.dataset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        })
        .then(r => {
          if (!r.ok) throw new Error('Update failed');
          return r.json();
        })
        .then(updatedTask => {
          e.target.value = updatedTask.status;
          e.target.dataset.status = updatedTask.status;
        })
        .catch(err => {
          alert('Failed to update status on server. Reverting.');
          const oldCol = board.querySelector(`.col[data-status="${oldStatus}"]`);
          if (oldCol) {
            oldCol.appendChild(card);
          }
          e.target.value = oldStatus;
          e.target.dataset.status = oldStatus;
          updateCounts();
        });
      }
    }
  });

  function updateCounts() {
    document.querySelectorAll('.col').forEach(col => {
      const span = col.querySelector('h2 span');
      if (span) span.textContent = col.querySelectorAll('.card').length;
    });
  }
});
