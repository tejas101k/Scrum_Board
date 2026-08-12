document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector('main');
  const sprintForm = document.querySelector('.backlog-header details:nth-of-type(1) form');
  const issueForm = document.querySelector('.backlog-header details:nth-of-type(2) form');

  let sprintsList = [];
  let usersList = [];

  const sprintDetails = Array.from(document.querySelectorAll('details.sprint'));
  const backlogDetails = sprintDetails.find(el => {
    const noSpan = el.querySelector('.no');
    const h2 = el.querySelector('h2');
    return (noSpan && noSpan.textContent.trim() === '–') || (h2 && h2.textContent.trim() === 'Backlog');
  });

  // Populate assignee options in new issue form
  function populateAssigneeSelects() {
    if (issueForm) {
      const select = issueForm.querySelector('select[name="assignee"]');
      if (select) {
        let html = '<option value="">Unassigned</option>';
        usersList.forEach(u => {
          html += `<option value="${u.id}">${escapeHTML(u.name)}</option>`;
        });
        select.innerHTML = html;
      }
    }
  }

  // Build issue row element with deletion and conditional draggability
  function createIssueRow(issue) {
    const li = document.createElement('li');
    li.dataset.id = issue.id;

    if (!issue.sprint_id) {
      li.setAttribute('draggable', 'true');
    }

    let assigneeOptions = '';
    usersList.forEach(u => {
      assigneeOptions += `<option value="${u.id}" ${parseInt(issue.assignee_id) === parseInt(u.id) ? 'selected' : ''}>${escapeHTML(u.name)}</option>`;
    });
    assigneeOptions += `<option value="" ${!issue.assignee_id ? 'selected' : ''}>Unassigned</option>`;

    let sprintOptions = '';
    sprintsList.forEach(s => {
      sprintOptions += `<option value="${s.id}" ${parseInt(issue.sprint_id) === parseInt(s.id) ? 'selected' : ''}>${escapeHTML(s.name)}</option>`;
    });
    sprintOptions += `<option value="" ${!issue.sprint_id ? 'selected' : ''}>Backlog</option>`;

    li.innerHTML = `
      <span class="tag" data-type="${issue.type}">${issue.type === 'story' ? 'S' : (issue.type === 'bug' ? 'B' : 'T')}</span>
      <span class="title">${escapeHTML(issue.title)}</span>
      <select class="issue-sprint" data-sprint="${issue.sprint_id || ''}">
        ${sprintOptions}
      </select>
      <select class="priority" data-priority="${issue.priority}">
        <option value="Low" ${issue.priority === 'Low' ? 'selected' : ''}>Low</option>
        <option value="Normal" ${issue.priority === 'Normal' ? 'selected' : ''}>Normal</option>
        <option value="Medium" ${issue.priority === 'Medium' ? 'selected' : ''}>Medium</option>
        <option value="High" ${issue.priority === 'High' ? 'selected' : ''}>High</option>
      </select>
      <select class="who" data-who="${issue.assignee_id || ''}">${assigneeOptions}</select>
      <input type="number" class="points" data-points="${issue.story_points || 0}" value="${issue.story_points || 0}" min="0">
      <select class="status" data-status="${issue.status || 'todo'}">
        <option value="todo" ${issue.status === 'todo' ? 'selected' : ''}>To Do</option>
        <option value="progress" ${issue.status === 'progress' ? 'selected' : ''}>In Progress</option>
        <option value="review" ${issue.status === 'review' ? 'selected' : ''}>Review</option>
        <option value="done" ${issue.status === 'done' ? 'selected' : ''}>Done</option>
      </select>
      <button class="delete-btn" aria-label="Delete issue" title="Delete issue">&times;</button>
    `;
    return li;
  }

  // Load database users, sprints, and tasks
  async function loadData() {
    document.querySelectorAll('details.sprint').forEach(el => {
      if (el !== backlogDetails) {
        el.remove();
      } else {
        const ul = el.querySelector('ul');
        if (ul) ul.innerHTML = '';
      }
    });

    try {
      const usersRes = await fetch('/users');
      if (!usersRes.ok) throw new Error('Failed to fetch users');
      usersList = await usersRes.json();
      
      populateAssigneeSelects();

      const sprintsRes = await fetch('/sprints');
      if (!sprintsRes.ok) throw new Error('Failed to fetch sprints');
      sprintsList = await sprintsRes.json();

      const tasksRes = await fetch('/tasks');
      if (!tasksRes.ok) throw new Error('Failed to fetch tasks');
      const tasks = await tasksRes.json();

      // Render sprint sections
      sprintsList.forEach(s => {
        const sprintEl = createSprintElement(s);
        main.insertBefore(sprintEl, backlogDetails);
      });

      // Inject backlog row header in static Backlog section
      if (backlogDetails) {
        backlogDetails.querySelectorAll('.backlog-row-header').forEach(h => h.remove());
        const ul = backlogDetails.querySelector('ul');
        if (ul) {
          const header = document.createElement('div');
          header.className = 'backlog-row-header';
          header.innerHTML = `
            <span class="tag-spacer"></span>
            <span class="title-header">Title</span>
            <span class="sprint-header">Sprint</span>
            <span class="priority-header">Priority</span>
            <span class="assignee-header">Assignee</span>
            <span class="points-header">Points</span>
            <span class="status-header">Status</span>
            <span class="action-spacer"></span>
          `;
          backlogDetails.insertBefore(header, ul);
        }
      }

      // Organize tasks into sprints or backlog in database order
      tasks.forEach(task => {
        const row = createIssueRow(task);
        if (task.sprint_id) {
          const targetSprint = Array.from(document.querySelectorAll('details.sprint')).find(el => String(el.dataset.sprintId) === String(task.sprint_id));
          if (targetSprint) {
            const ul = targetSprint.querySelector('ul');
            if (ul) ul.appendChild(row);
          } else {
            const ul = backlogDetails.querySelector('ul');
            if (ul) ul.appendChild(row);
          }
        } else {
          const ul = backlogDetails.querySelector('ul');
          if (ul) ul.appendChild(row);
        }
      });

      updateNewIssueSprintOptions();
      updateSprintIssueCounts();
    } catch (err) {
      console.error('Error loading backlog data:', err);
      showBacklogLoadError();
    }
  }

  function showBacklogLoadError() {
    const errorNotice = document.createElement('div');
    errorNotice.className = 'home-error-state';
    errorNotice.textContent = 'Unable to load the backlog. Please refresh and try again.';
    main.innerHTML = '';
    main.appendChild(errorNotice);
  }

  loadData();

  // Create new sprint in database
  if (sprintForm) {
    sprintForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = sprintForm.querySelector('button[type="submit"]');
      const nameInput = sprintForm.querySelector('input[placeholder="Sprint name"]');
      const dateInputs = sprintForm.querySelectorAll('input[type="date"]');
      const goalTextarea = sprintForm.querySelector('textarea');

      const name = nameInput ? nameInput.value.trim() : '';
      const startDate = dateInputs[0] ? dateInputs[0].value : '';
      const endDate = dateInputs[1] ? dateInputs[1].value : '';
      const goal = goalTextarea ? goalTextarea.value.trim() : '';

      if (!name) {
        alert('Sprint name cannot be empty.');
        return;
      }
      if (!startDate || !endDate) {
        alert('Start date and End date are required.');
        return;
      }
      if (new Date(endDate) < new Date(startDate)) {
        alert('End date must not be before start date.');
        return;
      }

      if (submitBtn) submitBtn.disabled = true;

      fetch('/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          start_date: startDate,
          end_date: endDate,
          goal
        })
      })
      .then(res => {
        if (!res.ok) {
          return res.json().then(err => { throw new Error(err.error || 'Failed to create sprint'); });
        }
        return res.json();
      })
      .then(newSprint => {
        sprintsList.push(newSprint);

        const sprintEl = createSprintElement(newSprint);
        if (backlogDetails) main.insertBefore(sprintEl, backlogDetails);
        else main.appendChild(sprintEl);

        updateNewIssueSprintOptions();
        updateAllIssueSprintSelects();
        sprintForm.reset();
        if (submitBtn) submitBtn.disabled = false;
        sprintForm.closest('details').removeAttribute('open');
      })
      .catch(err => {
        if (submitBtn) submitBtn.disabled = false;
        alert(err.message || 'Failed to create sprint on server. Please try again.');
        console.error('Error creating sprint:', err);
      });
    });
  }

  // Create new task in database
  if (issueForm) {
    issueForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = issueForm.querySelector('button[type="submit"]');
      const titleInput = issueForm.querySelector('input[placeholder="Issue title"]');
      const descTextarea = issueForm.querySelector('textarea');
      const pointsInput = issueForm.querySelector('input[type="number"]');

      const typeSelect = issueForm.querySelector('select[name="type"]');
      const sprintSelect = issueForm.querySelector('select[name="sprint"]');
      const prioritySelect = issueForm.querySelector('select[name="priority"]');
      const assigneeSelect = issueForm.querySelector('select[name="assignee"]');
      const statusSelect = issueForm.querySelector('select[name="status"]');

      const title = titleInput ? titleInput.value.trim() : '';
      const desc = descTextarea ? descTextarea.value.trim() : '';
      const type = typeSelect ? typeSelect.value : 'task';
      const sprintId = (sprintSelect && sprintSelect.value) ? parseInt(sprintSelect.value) : null;
      const priority = (prioritySelect && prioritySelect.value) || 'Medium';
      const assigneeId = (assigneeSelect && assigneeSelect.value) ? parseInt(assigneeSelect.value) : null;
      const status = (statusSelect && statusSelect.value) || 'todo';
      const points = (pointsInput && pointsInput.value) ? parseInt(pointsInput.value) : 0;

      if (!title) {
        alert('Title cannot be empty.');
        return;
      }
      if (isNaN(points) || points < 0) {
        alert('Story points must be a non-negative number.');
        return;
      }
      if (!['task', 'bug', 'story'].includes(type)) {
        alert('Invalid issue type selection.');
        return;
      }
      if (!['Low', 'Normal', 'Medium', 'High'].includes(priority)) {
        alert('Invalid priority selection.');
        return;
      }
      if (!['todo', 'progress', 'review', 'done'].includes(status)) {
        alert('Invalid state selection.');
        return;
      }

      if (submitBtn) submitBtn.disabled = true;

      fetch('/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: desc,
          type,
          priority,
          assignee_id: assigneeId,
          status,
          story_points: points,
          sprint_id: sprintId
        })
      })
      .then(r => {
        if (!r.ok) {
          return r.json().then(err => { throw new Error(err.error || 'Failed to create task'); });
        }
        return r.json();
      })
      .then(newIssue => {
        const row = createIssueRow(newIssue);
        if (newIssue.sprint_id) {
          const targetSprint = Array.from(document.querySelectorAll('details.sprint')).find(el => String(el.dataset.sprintId) === String(newIssue.sprint_id));
          if (targetSprint) {
            const ul = targetSprint.querySelector('ul');
            if (ul) ul.appendChild(row);
          } else {
            const ul = backlogDetails.querySelector('ul');
            if (ul) ul.appendChild(row);
          }
        } else {
          const ul = backlogDetails.querySelector('ul');
          if (ul) ul.appendChild(row);
        }

        updateSprintIssueCounts();
        issueForm.reset();
        
        populateAssigneeSelects();
        updateNewIssueSprintOptions();

        if (submitBtn) submitBtn.disabled = false;
        issueForm.closest('details').removeAttribute('open');
      })
      .catch(err => {
        if (submitBtn) submitBtn.disabled = false;
        alert(err.message || 'Failed to create task on server. Please try again.');
        console.error('Error creating task:', err);
      });
    });
  }

  // Handle click events (deletion, start, complete, edit sprint) on main container
  main.addEventListener('click', (e) => {
    const target = e.target;

    // 1. Issue Deletion Click
    if (target.classList.contains('delete-btn')) {
      const li = target.closest('li');
      if (!li || !li.dataset.id) return;

      if (confirm('Are you sure you want to delete this issue?')) {
        fetch(`/tasks/${li.dataset.id}`, {
          method: 'DELETE'
        })
        .then(res => {
          if (!res.ok) throw new Error('Delete failed');
          return res.json();
        })
        .then(() => {
          li.remove();
          updateSprintIssueCounts();
        })
        .catch(err => {
          alert('Failed to delete issue on server.');
          console.error('Delete issue failed:', err);
        });
      }
      return;
    }

    // 2. Start Sprint Click
    if (target.classList.contains('start-sprint-btn')) {
      e.stopPropagation();
      e.preventDefault();
      const sprintEl = target.closest('details.sprint');
      if (!sprintEl || !sprintEl.dataset.sprintId) return;

      const sprintId = sprintEl.dataset.sprintId;
      target.disabled = true;

      fetch(`/sprints/${sprintId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'In Progress' })
      })
      .then(res => {
        if (!res.ok) return res.json().then(err => { throw new Error(err.error || 'Failed to start sprint'); });
        return res.json();
      })
      .then(updatedSprint => {
        const sIdx = sprintsList.findIndex(s => String(s.id) === String(sprintId));
        if (sIdx !== -1) sprintsList[sIdx] = updatedSprint;
        
        const newSprintEl = createSprintElement(updatedSprint);
        const ul = sprintEl.querySelector('ul');
        const newUl = newSprintEl.querySelector('ul');
        if (ul && newUl) {
          newUl.innerHTML = ul.innerHTML;
        }
        
        sprintEl.replaceWith(newSprintEl);
        updateSprintIssueCounts();
      })
      .catch(err => {
        target.disabled = false;
        alert(err.message || 'Failed to start sprint on server.');
        console.error('Start sprint error:', err);
      });
      return;
    }

    // 3. Complete Sprint Click
    if (target.classList.contains('complete-sprint-btn')) {
      e.stopPropagation();
      e.preventDefault();
      const sprintEl = target.closest('details.sprint');
      if (!sprintEl || !sprintEl.dataset.sprintId) return;

      const sprintId = sprintEl.dataset.sprintId;
      target.disabled = true;

      fetch(`/sprints/${sprintId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Closed' })
      })
      .then(res => {
        if (!res.ok) return res.json().then(err => { throw new Error(err.error || 'Failed to complete sprint'); });
        return res.json();
      })
      .then(updatedSprint => {
        const sIdx = sprintsList.findIndex(s => String(s.id) === String(sprintId));
        if (sIdx !== -1) sprintsList[sIdx] = updatedSprint;
        
        const newSprintEl = createSprintElement(updatedSprint);
        const ul = sprintEl.querySelector('ul');
        const newUl = newSprintEl.querySelector('ul');
        if (ul && newUl) {
          newUl.innerHTML = ul.innerHTML;
        }
        
        sprintEl.replaceWith(newSprintEl);
        updateSprintIssueCounts();
      })
      .catch(err => {
        target.disabled = false;
        alert(err.message || 'Failed to complete sprint on server.');
        console.error('Complete sprint error:', err);
      });
      return;
    }

    // 4. Toggle Edit Sprint Form Inline with Validations
    if (target.classList.contains('edit-sprint-btn')) {
      e.stopPropagation();
      e.preventDefault();
      const sprintEl = target.closest('details.sprint');
      if (!sprintEl || !sprintEl.dataset.sprintId) return;

      let existingForm = sprintEl.querySelector('.edit-sprint-form');
      if (existingForm) {
        existingForm.remove();
        return;
      }

      const sprintId = sprintEl.dataset.sprintId;
      const sprint = sprintsList.find(s => String(s.id) === String(sprintId));
      if (!sprint) return;

      const editForm = document.createElement('form');
      editForm.className = 'edit-sprint-form';
      
      const sDate = sprint.start_date ? new Date(sprint.start_date).toISOString().split('T')[0] : '';
      const eDate = sprint.end_date ? new Date(sprint.end_date).toISOString().split('T')[0] : '';

      editForm.innerHTML = `
        <input type="text" class="edit-sprint-name" value="${escapeHTML(sprint.name)}" placeholder="Sprint name" required>
        <div class="form-row">
          <input type="date" class="edit-sprint-start" value="${sDate}" required>
          <input type="date" class="edit-sprint-end" value="${eDate}" required>
        </div>
        <textarea class="edit-sprint-goal" placeholder="Goal (optional)" rows="2">${escapeHTML(sprint.goal || '')}</textarea>
        <div class="form-actions">
          <button type="button" class="cancel-edit-sprint-btn">Cancel</button>
          <button type="submit" class="save-edit-sprint-btn">Save</button>
        </div>
      `;

      editForm.addEventListener('click', (ev) => {
        ev.stopPropagation();
      });

      editForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        const submitEditBtn = editForm.querySelector('.save-edit-sprint-btn');
        const name = editForm.querySelector('.edit-sprint-name').value.trim();
        const start = editForm.querySelector('.edit-sprint-start').value;
        const end = editForm.querySelector('.edit-sprint-end').value;
        const goal = editForm.querySelector('.edit-sprint-goal').value.trim();

        if (!name) {
          alert('Sprint name cannot be empty.');
          return;
        }
        if (!start || !end) {
          alert('Start date and End date are required.');
          return;
        }
        if (new Date(end) < new Date(start)) {
          alert('End date must not be before start date.');
          return;
        }

        if (submitEditBtn) submitEditBtn.disabled = true;

        fetch(`/sprints/${sprintId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, start_date: start, end_date: end, goal })
        })
        .then(res => {
          if (!res.ok) return res.json().then(err => { throw new Error(err.error || 'Failed to update sprint'); });
          return res.json();
        })
        .then(updatedSprint => {
          const sIdx = sprintsList.findIndex(s => String(s.id) === String(sprintId));
          if (sIdx !== -1) sprintsList[sIdx] = updatedSprint;

          const tempEl = createSprintElement(updatedSprint);
          const summary = sprintEl.querySelector('summary');
          const newSummary = tempEl.querySelector('summary');
          if (summary && newSummary) {
            summary.innerHTML = newSummary.innerHTML;
          }
          editForm.remove();
        })
        .catch(err => {
          if (submitEditBtn) submitEditBtn.disabled = false;
          alert(err.message || 'Failed to save sprint changes on server.');
          console.error('Save sprint edit error:', err);
        });
      });

      const ul = sprintEl.querySelector('ul');
      sprintEl.insertBefore(editForm, ul);
      return;
    }

    // 5. Cancel Sprint Edit Form Inline
    if (target.classList.contains('cancel-edit-sprint-btn')) {
      e.stopPropagation();
      e.preventDefault();
      const form = target.closest('.edit-sprint-form');
      if (form) form.remove();
      return;
    }
  });

  // Sync field updates back to the database
  main.addEventListener('change', (e) => {
    const target = e.target;
    const li = target.closest('li');
    if (!li || !li.dataset.id) return;

    const updates = {};
    let previousValue = null;

    if (target.classList.contains('issue-sprint')) {
      previousValue = target.dataset.sprint;
      const newSprintId = target.value ? parseInt(target.value) : null;

      // Optimistically move card in UI
      appendIssueToSprintUI(li, target.value);
      updateSprintIssueCounts();

      // Maintain dragability: only backlog items are draggable
      if (newSprintId) {
        li.removeAttribute('draggable');
      } else {
        li.setAttribute('draggable', 'true');
      }

      fetch(`/tasks/${li.dataset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprint_id: newSprintId })
      })
      .then(res => {
        if (!res.ok) return res.json().then(err => { throw new Error(err.error || 'Failed to update sprint assignment'); });
        return res.json();
      })
      .then(updatedIssue => {
        target.dataset.sprint = updatedIssue.sprint_id || '';
        target.value = updatedIssue.sprint_id || '';
      })
      .catch(err => {
        alert(err.message || 'Failed to update task sprint on server. Reverting.');
        appendIssueToSprintUI(li, previousValue);
        updateSprintIssueCounts();
        if (previousValue) {
          li.removeAttribute('draggable');
        } else {
          li.setAttribute('draggable', 'true');
        }
        target.value = previousValue || '';
        target.dataset.sprint = previousValue || '';
      });
      return;
    } else if (target.classList.contains('status')) {
      previousValue = target.dataset.status;
      updates.status = target.value;
    } else if (target.classList.contains('priority')) {
      previousValue = target.dataset.priority;
      updates.priority = target.value;
    } else if (target.classList.contains('who')) {
      previousValue = target.dataset.who;
      updates.assignee_id = target.value ? parseInt(target.value) : null;
    } else if (target.classList.contains('points')) {
      previousValue = target.dataset.points;
      const pts = parseInt(target.value);
      if (isNaN(pts) || pts < 0) {
        alert('Story points must be a non-negative number.');
        target.value = previousValue;
        return;
      }
      updates.story_points = pts;
    }

    if (Object.keys(updates).length > 0) {
      fetch(`/tasks/${li.dataset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      .then(res => {
        if (!res.ok) return res.json().then(err => { throw new Error(err.error || 'Update failed'); });
        return res.json();
      })
      .then(updatedIssue => {
        if (updates.status !== undefined) {
          target.dataset.status = updatedIssue.status;
          target.value = updatedIssue.status;
        }
        if (updates.priority !== undefined) {
          target.dataset.priority = updatedIssue.priority;
          target.value = updatedIssue.priority;
        }
        if (updates.assignee_id !== undefined) {
          target.dataset.who = updatedIssue.assignee_id || '';
          target.value = updatedIssue.assignee_id || '';
        }
        if (updates.story_points !== undefined) {
          target.dataset.points = updatedIssue.story_points || 0;
          target.value = updatedIssue.story_points || 0;
        }
      })
      .catch(err => {
        alert(err.message || 'Failed to update task on server. Reverting.');
        if (updates.status !== undefined) {
          target.value = previousValue;
          target.dataset.status = previousValue;
        } else if (updates.priority !== undefined) {
          target.value = previousValue;
          target.dataset.priority = previousValue;
        } else if (updates.assignee_id !== undefined) {
          target.value = previousValue;
          target.dataset.who = previousValue;
        } else if (updates.story_points !== undefined) {
          target.value = previousValue;
          target.dataset.points = previousValue;
        }
      });
    }
  });

  // Drag and drop event listeners for backlog reordering
  let draggedRow = null;

  main.addEventListener('dragstart', (e) => {
    const li = e.target.closest('li');
    if (li && backlogDetails && backlogDetails.contains(li)) {
      draggedRow = li;
      li.classList.add('backlog-dragging');
      e.dataTransfer.setData('text/plain', '');
    }
  });

  main.addEventListener('dragend', (e) => {
    const li = e.target.closest('li');
    if (li) {
      li.classList.remove('backlog-dragging');
    }
    draggedRow = null;
    document.querySelectorAll('.backlog-drag-over').forEach(el => el.classList.remove('backlog-drag-over'));
  });

  main.addEventListener('dragover', (e) => {
    const li = e.target.closest('li');
    if (li && draggedRow && backlogDetails && backlogDetails.contains(li) && li !== draggedRow) {
      e.preventDefault();
    }
  });

  main.addEventListener('dragenter', (e) => {
    const li = e.target.closest('li');
    if (li && draggedRow && backlogDetails && backlogDetails.contains(li) && li !== draggedRow) {
      li.classList.add('backlog-drag-over');
    }
  });

  main.addEventListener('dragleave', (e) => {
    const li = e.target.closest('li');
    if (li && !li.contains(e.relatedTarget)) {
      li.classList.remove('backlog-drag-over');
    }
  });

  main.addEventListener('drop', (e) => {
    const li = e.target.closest('li');
    if (li && draggedRow && backlogDetails && backlogDetails.contains(li) && li !== draggedRow) {
      e.preventDefault();
      li.classList.remove('backlog-drag-over');
      
      const rect = li.getBoundingClientRect();
      const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
      li.parentElement.insertBefore(draggedRow, next ? li.nextSibling : li);
      
      saveBacklogOrder();
    }
  });

  function saveBacklogOrder() {
    if (!backlogDetails) return;
    const backlogUl = backlogDetails.querySelector('ul');
    if (!backlogUl) return;

    const ids = Array.from(backlogUl.querySelectorAll('li')).map(li => parseInt(li.dataset.id));
    
    fetch('/tasks/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    })
    .then(res => {
      if (!res.ok) throw new Error('Reorder failed');
      return res.json();
    })
    .catch(err => {
      alert('Failed to save backlog order on server.');
      console.error('Save backlog order error:', err);
    });
  }

  function appendIssueToSprintUI(li, sprintId) {
    const target = Array.from(document.querySelectorAll('details.sprint')).find(el => {
      if (sprintId) {
        return String(el.dataset.sprintId) === String(sprintId);
      } else {
        const noSpan = el.querySelector('.no');
        const h2 = el.querySelector('h2');
        return (noSpan && noSpan.textContent.trim() === '–') || (h2 && h2.textContent.trim() === 'Backlog');
      }
    });

    if (target) {
      let ul = target.querySelector('ul');
      if (!ul) {
        ul = document.createElement('ul');
        target.appendChild(ul);
      }
      ul.appendChild(li);
    }
  }

  function updateSprintIssueCounts() {
    document.querySelectorAll('details.sprint').forEach(sprint => {
      const count = sprint.querySelectorAll('ul li').length;
      const span = sprint.querySelector('.count');
      if (span) span.textContent = `${count} issue${count === 1 ? '' : 's'}`;
    });
  }

  function formatDate(str) {
    if (!str) return '';
    const date = new Date(str);
    if (isNaN(date.getTime())) return str;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }

  function createSprintElement(sprint) {
    const details = document.createElement('details');
    details.className = 'sprint';
    details.open = true;
    details.dataset.sprintId = sprint.id;
    details.dataset.sprintStatus = sprint.status || 'Created';

    const dates = sprint.start_date && sprint.end_date ? `${formatDate(sprint.start_date)} – ${formatDate(sprint.end_date)}` : 'No dates';
    
    let statusText = sprint.status || 'Created';
    let statusHTML = `<span class="sprint-status-badge">${statusText}</span>`;
    if (statusText === 'In Progress') {
      statusHTML = `<span class="sprint-status-badge active-sprint-badge">Active</span>`;
    } else if (statusText === 'Closed') {
      statusHTML = `<span class="sprint-status-badge closed-sprint-badge">Closed</span>`;
    }

    let actionButtonsHTML = '';
    if (statusText === 'Created') {
      actionButtonsHTML = `
        <button class="start-sprint-btn font-bold">Start</button>
        <button class="edit-sprint-btn">Edit</button>
      `;
    } else if (statusText === 'In Progress') {
      actionButtonsHTML = `
        <button class="complete-sprint-btn font-bold">Complete</button>
        <button class="edit-sprint-btn">Edit</button>
      `;
    } else if (statusText === 'Closed') {
      actionButtonsHTML = `
        <span class="completed-label">Completed</span>
      `;
    }

    details.innerHTML = `
      <summary class="sprint-summary-header">
        <div class="sprint-summary-left">
          <span class="no">Sprint ${sprint.id}</span>
          <div class="sprint-summary-details">
            <h2 class="sprint-title-text">${escapeHTML(sprint.name)}</h2>
            <p class="sprint-status-wrapper">
              <em>${statusHTML}</em> <span class="sprint-dates-text">${dates}</span>
            </p>
            ${sprint.goal ? `<p class="goal sprint-goal-text">${escapeHTML(sprint.goal)}</p>` : '<p class="goal sprint-goal-text hidden"></p>'}
          </div>
        </div>
        <div class="sprint-summary-actions">
          ${actionButtonsHTML}
          <span class="count">0 issues</span>
        </div>
      </summary>
      <div class="backlog-row-header">
        <span class="tag-spacer"></span>
        <span class="title-header">Title</span>
        <span class="sprint-header">Sprint</span>
        <span class="priority-header">Priority</span>
        <span class="assignee-header">Assignee</span>
        <span class="points-header">Points</span>
        <span class="status-header">Status</span>
        <span class="action-spacer"></span>
      </div>
      <ul></ul>
    `;
    return details;
  }

  function updateNewIssueSprintOptions() {
    const select = issueForm ? (issueForm.querySelector('select[name="sprint"]') || issueForm.querySelectorAll('select')[1]) : null;
    if (!select) return;

    let html = '';
    sprintsList.forEach(s => {
      html += `<option value="${s.id}">Sprint ${s.id} — ${escapeHTML(s.name)}</option>`;
    });
    html += '<option value="" selected>Backlog (unscheduled)</option>';
    select.innerHTML = html;
  }

  function updateAllIssueSprintSelects() {
    document.querySelectorAll('select.issue-sprint').forEach(select => {
      if (select.closest('form')) return;

      const val = select.value;
      let html = '';
      sprintsList.forEach(s => {
        html += `<option value="${s.id}" ${String(s.id) === String(val) ? 'selected' : ''}>${escapeHTML(s.name)}</option>`;
      });
      html += `<option value="" ${val === '' ? 'selected' : ''}>Backlog</option>`;
      select.innerHTML = html;
    });
  }
});
