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
  const main = document.querySelector('main');
  const sprintForm = document.querySelector('.backlog-header details:nth-of-type(1) form');
  const issueForm = document.querySelector('.backlog-header details:nth-of-type(2) form');

  const customSprints = [];
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

  // Build issue row element
  function createIssueRow(issue) {
    const li = document.createElement('li');
    li.dataset.id = issue.id;

    let assigneeOptions = '';
    usersList.forEach(u => {
      assigneeOptions += `<option value="${u.id}" ${parseInt(issue.assignee_id) === parseInt(u.id) ? 'selected' : ''}>${escapeHTML(u.initials)}</option>`;
    });
    assigneeOptions += `<option value="" ${!issue.assignee_id ? 'selected' : ''}>–</option>`;

    li.innerHTML = `
      <span class="tag" data-type="${issue.type}">${issue.type === 'story' ? 'S' : (issue.type === 'bug' ? 'B' : 'T')}</span>
      <span class="title">${escapeHTML(issue.title)}</span>
      <select class="issue-sprint">
        <option value="12">Sprint 12</option>
        <option value="13">Sprint 13</option>
        <option value="" selected>Backlog</option>
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
    `;
    return li;
  }

  // Load database users and tasks
  async function loadData() {
    document.querySelectorAll('details.sprint ul').forEach(ul => ul.innerHTML = '');
    try {
      const usersRes = await fetch('/users');
      if (!usersRes.ok) throw new Error('Failed to fetch users');
      usersList = await usersRes.json();
      
      populateAssigneeSelects();

      const tasksRes = await fetch('/tasks');
      if (!tasksRes.ok) throw new Error('Failed to fetch tasks');
      const tasks = await tasksRes.json();

      if (backlogDetails) {
        const ul = backlogDetails.querySelector('ul');
        if (ul) {
          tasks.forEach(task => ul.appendChild(createIssueRow(task)));
        }
      }
      updateSprintIssueCounts();
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }

  loadData();

  // Create local sprint (frontend-only for Phase 4)
  if (sprintForm) {
    sprintForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = sprintForm.querySelector('input[type="text"]').value.trim();
      const dates = sprintForm.querySelectorAll('input[type="date"]');
      const goal = sprintForm.querySelector('textarea').value.trim();

      if (!name || !dates[0].value || !dates[1].value) return;

      const noSpans = Array.from(document.querySelectorAll('.sprint summary .no'));
      let maxId = 13;
      noSpans.forEach(span => {
        const num = parseInt(span.textContent.replace('Sprint', '').trim());
        if (!isNaN(num) && num > maxId) maxId = num;
      });
      const nextId = String(maxId + 1);

      const newSprint = { id: nextId, name, startDate: dates[0].value, endDate: dates[1].value, goal };
      customSprints.push(newSprint);

      const sprintEl = createSprintElement(newSprint);
      if (backlogDetails) main.insertBefore(sprintEl, backlogDetails);
      else main.appendChild(sprintEl);

      updateNewIssueSprintOptions();
      updateAllIssueSprintSelects();
      sprintForm.reset();
      sprintForm.closest('details').removeAttribute('open');
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
      const prioritySelect = issueForm.querySelector('select[name="priority"]') || issueForm.querySelectorAll('select')[2];
      const assigneeSelect = issueForm.querySelector('select[name="assignee"]') || issueForm.querySelectorAll('select')[3];
      const statusSelect = issueForm.querySelector('select[name="status"]') || issueForm.querySelectorAll('select')[4];

      const title = titleInput ? titleInput.value.trim() : '';
      const desc = descTextarea ? descTextarea.value.trim() : '';
      const type = typeSelect ? typeSelect.value : 'task';
      const priority = (prioritySelect && prioritySelect.value) || 'Medium';
      const assigneeId = (assigneeSelect && assigneeSelect.value) ? parseInt(assigneeSelect.value) : null;
      const status = (statusSelect && statusSelect.value) || 'todo';
      const points = (pointsInput && pointsInput.value) ? parseInt(pointsInput.value) : 0;

      if (!title) return;

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
          story_points: points
        })
      })
      .then(r => {
        if (!r.ok) throw new Error('Create task failed');
        return r.json();
      })
      .then(newIssue => {
        if (backlogDetails) {
          const ul = backlogDetails.querySelector('ul');
          if (ul) ul.appendChild(createIssueRow(newIssue));
        }
        updateSprintIssueCounts();
        issueForm.reset();
        
        // Re-populate assignee select to reset it correctly
        populateAssigneeSelects();

        issueForm.closest('details').removeAttribute('open');
      })
      .catch(err => {
        alert('Failed to create task on server. Please try again.');
        console.error('Error creating task:', err);
      });
    });
  }

  // Sync field updates back to the database
  main.addEventListener('change', (e) => {
    const target = e.target;
    const li = target.closest('li');
    if (!li || !li.dataset.id) return;

    const updates = {};
    let previousValue = null;

    if (target.classList.contains('issue-sprint')) {
      appendIssueToSprintUI(li, target.value);
      updateSprintIssueCounts();
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
      updates.story_points = parseInt(target.value) || 0;
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

  // Helpers
  function getSprints() {
    const list = [{ id: '12', name: 'Sprint 12' }, { id: '13', name: 'Sprint 13' }];
    customSprints.forEach(s => list.push({ id: s.id, name: `Sprint ${s.id}` }));
    return list;
  }

  function appendIssueToSprintUI(li, sprintId) {
    const target = Array.from(document.querySelectorAll('details.sprint')).find(el => {
      if (el.dataset.sprintId === String(sprintId)) return true;
      const noSpan = el.querySelector('.no');
      if (noSpan) {
        if (!sprintId && (noSpan.textContent.trim() === '–' || noSpan.textContent.trim().toLowerCase() === 'backlog')) return true;
        if (noSpan.textContent.replace('Sprint', '').trim() === String(sprintId)) return true;
      }
      return false;
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

    const dates = sprint.startDate && sprint.endDate ? `${formatDate(sprint.startDate)} – ${formatDate(sprint.endDate)}` : 'No dates';
    details.innerHTML = `
      <summary>
        <span class="no">Sprint ${sprint.id}</span>
        <div>
          <h2>${sprint.name}</h2>
          <p><em>Active</em> ${dates}</p>
          ${sprint.goal ? `<p class="goal">${sprint.goal}</p>` : ''}
        </div>
        <span class="count">0 issues</span>
      </summary>
      <ul></ul>
    `;
    return details;
  }

  function updateNewIssueSprintOptions() {
    const select = document.querySelector('.backlog-header details:nth-of-type(2) form select[name="sprint"]') || 
                   document.querySelector('.backlog-header details:nth-of-type(2) form select:nth-of-type(2)');
    if (!select) return;

    let html = `
      <option value="12">Sprint 12 — Checkout</option>
      <option value="13">Sprint 13 — Login</option>
    `;
    customSprints.forEach(s => {
      html += `<option value="${s.id}">Sprint ${s.id} — ${s.name}</option>`;
    });
    html += '<option value="">Backlog (unscheduled)</option>';
    select.innerHTML = html;
  }

  function updateAllIssueSprintSelects() {
    document.querySelectorAll('select.issue-sprint').forEach(select => {
      if (select.closest('form')) return;

      const val = select.value;
      let html = '';
      getSprints().forEach(s => {
        html += `<option value="${s.id}" ${s.id === val ? 'selected' : ''}>${s.name}</option>`;
      });
      html += `<option value="" ${val === '' ? 'selected' : ''}>Backlog</option>`;
      select.innerHTML = html;
    });
  }
});
