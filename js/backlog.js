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

  // Build issue row element
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
    `;
    return li;
  }

  // Load database users, sprints, and tasks
  async function loadData() {
    // Clear dynamic sprint details, keep only backlogDetails
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

    const dates = sprint.start_date && sprint.end_date ? `${formatDate(sprint.start_date)} – ${formatDate(sprint.end_date)}` : 'No dates';
    details.innerHTML = `
      <summary>
        <span class="no">Sprint ${sprint.id}</span>
        <div>
          <h2>${escapeHTML(sprint.name)}</h2>
          <p><em>Active</em> ${dates}</p>
          ${sprint.goal ? `<p class="goal">${escapeHTML(sprint.goal)}</p>` : ''}
        </div>
        <span class="count">0 issues</span>
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
