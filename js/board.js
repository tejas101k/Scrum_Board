document.addEventListener('DOMContentLoaded', () => {
  const board = document.querySelector('.board');
  if (!board) return;

  // Create card element with proper visible labels and deletion button
  function createCardElement(task) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = task.id;
    card.dataset.type = task.type;
    card.setAttribute('draggable', 'true');

    const initials = task.assignee_initials || '–';
    card.innerHTML = `
      <div class="card-header-row">
        <span class="tag">${task.type === 'story' ? 'S' : (task.type === 'bug' ? 'B' : 'T')}</span>
        <button class="delete-btn" aria-label="Delete issue" title="Delete issue">&times;</button>
      </div>
      <p class="card-title">${escapeHTML(task.title)}</p>
      
      <div class="card-field-group">
        <span class="field-label">Type:</span>
        <span class="field-value">${escapeHTML(task.type)}</span>
      </div>

      <div class="card-field-group">
        <span class="field-label">Priority:</span>
        <span class="field-value">${escapeHTML(task.priority)}</span>
      </div>

      <div class="card-field-group">
        <span class="field-label">Assignee:</span>
        <span class="field-value">${escapeHTML(task.assignee_name || 'Unassigned')}</span>
      </div>

      <div class="card-field-group select-field">
        <span class="field-label">Status:</span>
        <select class="status" data-status="${task.status}">
          <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
          <option value="progress" ${task.status === 'progress' ? 'selected' : ''}>In Progress</option>
          <option value="review" ${task.status === 'review' ? 'selected' : ''}>In Review</option>
          <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
        </select>
      </div>
    `;
    return card;
  }

  // Fetch and load tasks and sprints
  function loadTasks() {
    document.querySelectorAll('.col .card').forEach(c => c.remove());
    
    // Clear any previous error/empty state notices
    const oldNotice = document.querySelector('.board-empty-notice');
    if (oldNotice) oldNotice.remove();

    Promise.all([
      fetch('/sprints').then(res => {
        if (!res.ok) throw new Error('Failed to load sprints');
        return res.json();
      }),
      fetch('/tasks').then(res => {
        if (!res.ok) throw new Error('Failed to load tasks');
        return res.json();
      })
    ])
    .then(([sprints, tasks]) => {
      const activeSprints = sprints.filter(s => s.status === 'In Progress');
      
      if (activeSprints.length === 0) {
        showBoardEmptyState('There are currently no active sprints. Start one on the Backlog page.');
        return;
      }

      const activeSprintIds = new Set(activeSprints.map(s => s.id));
      const activeTasks = tasks.filter(t => t.sprint_id !== null && activeSprintIds.has(t.sprint_id));

      if (activeTasks.length === 0) {
        showBoardEmptyState('The active sprint has no issues assigned to it.');
        return;
      }

      activeTasks.forEach(task => {
        const col = board.querySelector(`.col[data-status="${task.status}"]`);
        if (col) col.appendChild(createCardElement(task));
      });
      updateCounts();
    })
    .catch(err => {
      console.error('Error loading tasks:', err);
      showBoardEmptyState('Unable to load board data. Please refresh and try again.');
    });
  }

  function showBoardEmptyState(message) {
    document.querySelectorAll('.col .card').forEach(c => c.remove());
    updateCounts();

    const oldNotice = document.querySelector('.board-empty-notice');
    if (oldNotice) oldNotice.remove();

    const notice = document.createElement('div');
    notice.className = 'board-empty-notice';
    notice.textContent = message;
    board.appendChild(notice);
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
        if (!r.ok) {
          return r.json().then(err => { throw new Error(err.error || 'Update failed'); });
        }
        return r.json();
      })
      .then(updatedTask => {
        if (select) {
          select.value = updatedTask.status;
          select.dataset.status = updatedTask.status;
        }
      })
      .catch(err => {
        alert(err.message || 'Failed to update status on server. Reverting.');
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

  // Handle board status dropdown updates
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
          if (!r.ok) {
            return r.json().then(err => { throw new Error(err.error || 'Update failed'); });
          }
          return r.json();
        })
        .then(updatedTask => {
          e.target.value = updatedTask.status;
          e.target.dataset.status = updatedTask.status;
        })
        .catch(err => {
          alert(err.message || 'Failed to update status on server. Reverting.');
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

  // Handle click on delete button inside board cards
  board.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn')) {
      const card = e.target.closest('.card');
      if (!card || !card.dataset.id) return;

      if (confirm('Are you sure you want to delete this issue?')) {
        fetch(`/tasks/${card.dataset.id}`, {
          method: 'DELETE'
        })
        .then(res => {
          if (!res.ok) throw new Error('Delete failed');
          return res.json();
        })
        .then(() => {
          card.remove();
          updateCounts();
        })
        .catch(err => {
          alert('Failed to delete issue on server.');
          console.error('Delete issue failed:', err);
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
