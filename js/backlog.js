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
        navRight.style.display = 'flex';
        navRight.style.alignItems = 'center';
        navRight.style.gap = '10px';
        navRight.innerHTML = `
          <div class="user-meta" style="display: flex; flex-direction: column; align-items: flex-end; justify-content: center; font-family: inherit;">
            <span class="user-name" style="font-weight: 700; font-size: 13px; color: #822f3e;">${user.name}</span>
            <span class="user-role" style="font-size: 10px; color: #7f8c8d; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${user.role || 'Admin'}</span>
          </div>
          <div class="avatar">${user.initials}</div>
          <div class="profile-popup">
            <div class="avatar large">${user.initials}</div>
            <div class="profile-name">${user.name}</div>
            <div class="profile-role" style="font-size: 11px; color: #822f3e; font-weight: bold; margin-bottom: 8px; text-transform: uppercase;">${user.role || 'Admin'}</div>
            <div class="profile-email" style="margin-bottom: 12px;">${user.email || ''}</div>
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

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // Populate assignee options in new issue form
  function populateAssigneeSelects() {
    if (issueForm) {
      const select = issueForm.querySelector('select[name="assignee"]') || issueForm.querySelectorAll('select')[3];
      if (select) {
        let html = '<option value="">Assignee</option>';
        usersList.forEach(u => {
          html += `<option value="${u.id}">${escapeHTML(u.name)}</option>`;
        });
        html += '<option value="">Unassigned</option>';
        select.innerHTML = html;
      }
    }
  }

  // Build issue row element with deletion button
  function createIssueRow(issue) {
    const li = document.createElement('li');
    li.dataset.id = issue.id;

    let assigneeOptions = '';
    usersList.forEach(u => {
      assigneeOptions += `<option value="${u.id}" ${parseInt(issue.assignee_id) === parseInt(u.id) ? 'selected' : ''}>${escapeHTML(u.initials)}</option>`;
    });
    assigneeOptions += `<option value="" ${!issue.assignee_id ? 'selected' : ''}>–</option>`;

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
      <button class="delete-btn" style="background: none; border: none; color: #822f3e; font-weight: bold; font-size: 18px; cursor: pointer; padding: 0 4px; line-height: 1;">&times;</button>
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

      // Organize tasks into sprints or backlog
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
    }
  }

  loadData();

  // Create new sprint in database
  if (sprintForm) {
    sprintForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = sprintForm.querySelector('input[type="text"]');
      const dateInputs = sprintForm.querySelectorAll('input[type="date"]');
      const goalTextarea = sprintForm.querySelector('textarea');

      const name = nameInput ? nameInput.value.trim() : '';
      const startDate = dateInputs[0] ? dateInputs[0].value : '';
      const endDate = dateInputs[1] ? dateInputs[1].value : '';
      const goal = goalTextarea ? goalTextarea.value.trim() : '';

      if (!name || !startDate || !endDate) return;

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
        if (!res.ok) throw new Error('Failed to create sprint');
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
        sprintForm.closest('details').removeAttribute('open');
      })
      .catch(err => {
        alert('Failed to create sprint on server. Please try again.');
        console.error('Error creating sprint:', err);
      });
    });
  }

  // Create new task in database
  if (issueForm) {
    issueForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const titleInput = issueForm.querySelector('input[placeholder="Issue title"]');
      const descTextarea = issueForm.querySelector('textarea');
      const pointsInput = issueForm.querySelector('input[type="number"]');

      const typeSelect = issueForm.querySelector('select[name="type"]') || issueForm.querySelectorAll('select')[0];
      const sprintSelect = issueForm.querySelector('select[name="sprint"]') || issueForm.querySelectorAll('select')[1];
      const prioritySelect = issueForm.querySelector('select[name="priority"]') || issueForm.querySelectorAll('select')[2];
      const assigneeSelect = issueForm.querySelector('select[name="assignee"]') || issueForm.querySelectorAll('select')[3];
      const statusSelect = issueForm.querySelector('select[name="status"]') || issueForm.querySelectorAll('select')[4];

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
      if (points < 0) {
        alert('Story points cannot be negative.');
        return;
      }

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
        if (!r.ok) throw new Error('Create task failed');
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

        issueForm.closest('details').removeAttribute('open');
      })
      .catch(err => {
        alert('Failed to create task on server. Please try again.');
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
      fetch(`/sprints/${sprintId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'In Progress' })
      })
      .then(res => {
        if (!res.ok) throw new Error('Failed to start sprint');
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
        alert('Failed to start sprint on server.');
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
      fetch(`/sprints/${sprintId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Closed' })
      })
      .then(res => {
        if (!res.ok) throw new Error('Failed to complete sprint');
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
        alert('Failed to complete sprint on server.');
        console.error('Complete sprint error:', err);
      });
      return;
    }

    // 4. Toggle Edit Sprint Form Inline
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
      editForm.style.cssText = 'padding: 15px 20px; background: #faf9f8; border-bottom: 1px solid #e9dfde; display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;';
      
      const sDate = sprint.start_date ? new Date(sprint.start_date).toISOString().split('T')[0] : '';
      const eDate = sprint.end_date ? new Date(sprint.end_date).toISOString().split('T')[0] : '';

      editForm.innerHTML = `
        <input type="text" class="edit-sprint-name" value="${escapeHTML(sprint.name)}" placeholder="Sprint name" required style="font-size: 13px; padding: 4px 8px; border: 1px solid #e9dfde; border-radius: 4px; height: 30px;">
        <div style="display: flex; gap: 8px;">
          <input type="date" class="edit-sprint-start" value="${sDate}" required style="font-size: 12px; padding: 4px; border: 1px solid #e9dfde; border-radius: 4px; flex: 1; height: 30px;">
          <input type="date" class="edit-sprint-end" value="${eDate}" required style="font-size: 12px; padding: 4px; border: 1px solid #e9dfde; border-radius: 4px; flex: 1; height: 30px;">
        </div>
        <textarea class="edit-sprint-goal" placeholder="Goal (optional)" rows="2" style="font-size: 13px; padding: 4px 8px; border: 1px solid #e9dfde; border-radius: 4px; font-family: inherit;">${escapeHTML(sprint.goal || '')}</textarea>
        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;">
          <button type="button" class="cancel-edit-sprint-btn" style="padding: 4px 10px; font-size: 12px; border: 1px solid #e9dfde; background: #fff; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button type="submit" style="padding: 4px 10px; font-size: 12px; border: none; background: #822f3e; color: #fff; border-radius: 4px; cursor: pointer; font-weight: bold;">Save</button>
        </div>
      `;

      editForm.addEventListener('click', (ev) => {
        ev.stopPropagation();
      });

      editForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        const name = editForm.querySelector('.edit-sprint-name').value.trim();
        const start = editForm.querySelector('.edit-sprint-start').value;
        const end = editForm.querySelector('.edit-sprint-end').value;
        const goal = editForm.querySelector('.edit-sprint-goal').value.trim();

        if (!name || !start || !end) return;

        fetch(`/sprints/${sprintId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, start_date: start, end_date: end, goal })
        })
        .then(res => {
          if (!res.ok) throw new Error('Failed to update sprint');
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
          alert('Failed to save sprint changes on server.');
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

      fetch(`/tasks/${li.dataset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sprint_id: newSprintId })
      })
      .then(res => {
        if (!res.ok) throw new Error('Update failed');
        return res.json();
      })
      .then(updatedIssue => {
        target.dataset.sprint = updatedIssue.sprint_id || '';
        target.value = updatedIssue.sprint_id || '';
      })
      .catch(err => {
        alert('Failed to update task sprint on server. Reverting.');
        appendIssueToSprintUI(li, previousValue);
        updateSprintIssueCounts();
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
        if (!res.ok) throw new Error('Update failed');
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
        alert('Failed to update task on server. Reverting.');
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
    let statusHTML = `<span class="sprint-status-badge" style="font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: bold; background: #e9dfde; color: #555;">${statusText}</span>`;
    if (statusText === 'In Progress') {
      statusHTML = `<span class="sprint-status-badge" style="font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: bold; background: #faf0ed; color: #822f3e;">Active</span>`;
    } else if (statusText === 'Closed') {
      statusHTML = `<span class="sprint-status-badge" style="font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: bold; background: #eaeaea; color: #7f8c8d;">Closed</span>`;
    }

    let actionButtonsHTML = '';
    if (statusText === 'Created') {
      actionButtonsHTML = `
        <button class="start-sprint-btn" style="padding: 4px 8px; font-size: 12px; border: none; background: #822f3e; color: #fff; border-radius: 4px; cursor: pointer; font-weight: bold; margin-left: 10px;">Start</button>
        <button class="edit-sprint-btn" style="padding: 4px 8px; font-size: 12px; border: 1px solid #e9dfde; background: #fff; color: #333; border-radius: 4px; cursor: pointer; margin-left: 5px;">Edit</button>
      `;
    } else if (statusText === 'In Progress') {
      actionButtonsHTML = `
        <button class="complete-sprint-btn" style="padding: 4px 8px; font-size: 12px; border: none; background: #27ae60; color: #fff; border-radius: 4px; cursor: pointer; font-weight: bold; margin-left: 10px;">Complete</button>
        <button class="edit-sprint-btn" style="padding: 4px 8px; font-size: 12px; border: 1px solid #e9dfde; background: #fff; color: #333; border-radius: 4px; cursor: pointer; margin-left: 5px;">Edit</button>
      `;
    } else if (statusText === 'Closed') {
      actionButtonsHTML = `
        <span style="font-size: 12px; color: #7f8c8d; margin-left: 10px; font-style: italic;">Completed</span>
      `;
    }

    details.innerHTML = `
      <summary style="display: flex; align-items: center; justify-content: space-between; padding: 10px 20px;">
        <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
          <span class="no" style="font-weight: bold;">Sprint ${sprint.id}</span>
          <div style="flex: 1;">
            <h2 class="sprint-title-text" style="font-size: 15px; font-weight: 700; margin: 0; color: #822f3e;">${escapeHTML(sprint.name)}</h2>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: #7f8c8d;">
              <em>${statusHTML}</em> <span class="sprint-dates-text">${dates}</span>
            </p>
            ${sprint.goal ? `<p class="goal sprint-goal-text" style="margin: 4px 0 0 0; font-size: 12px; color: #555;">${escapeHTML(sprint.goal)}</p>` : '<p class="goal sprint-goal-text" style="margin: 4px 0 0 0; font-size: 12px; color: #555; display: none;"></p>'}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;" class="sprint-summary-actions">
          ${actionButtonsHTML}
          <span class="count" style="font-size: 12px; color: #7f8c8d;">0 issues</span>
        </div>
      </summary>
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
    html += '<option value="">Backlog (unscheduled)</option>';
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
