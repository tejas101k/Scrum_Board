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
  const main = document.querySelector('main');
  const sprintForm = document.querySelector('.backlog-header details:nth-of-type(1) form');
  const issueForm = document.querySelector('.backlog-header details:nth-of-type(2) form');

  // In-memory data
  const customSprints = [];
  const customIssues = [];

  const sprintDetails = Array.from(document.querySelectorAll('details.sprint'));
  const backlogDetails = sprintDetails.find(el => {
    const noSpan = el.querySelector('.no');
    const h2 = el.querySelector('h2');
    return (noSpan && noSpan.textContent.trim() === '–') || (h2 && h2.textContent.trim() === 'Backlog');
  });

  updateNewIssueSprintOptions();
  updateAllIssueSprintSelects();
  updateSprintIssueCounts();

  // Create new sprint
  if (sprintForm) {
    sprintForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = sprintForm.querySelector('input[type="text"]').value.trim();
      const dates = sprintForm.querySelectorAll('input[type="date"]');
      const goal = sprintForm.querySelector('textarea').value.trim();

      if (!name || !dates[0].value || !dates[1].value) {
        alert('Please fill in all required fields.');
        return;
      }

      // Increment ID from max found
      const noSpans = Array.from(document.querySelectorAll('.sprint summary .no'));
      let maxId = 13;
      noSpans.forEach(span => {
        const num = parseInt(span.textContent.replace('Sprint', '').trim());
        if (!isNaN(num) && num > maxId) maxId = num;
      });
      const nextId = String(maxId + 1);

      const newSprint = { id: nextId, name, startDate: dates[0].value, endDate: dates[1].value, goal };
      customSprints.push(newSprint);

      // Render sprint block
      const sprintEl = createSprintElement(newSprint);
      if (backlogDetails) {
        main.insertBefore(sprintEl, backlogDetails);
      } else {
        main.appendChild(sprintEl);
      }

      updateNewIssueSprintOptions();
      updateAllIssueSprintSelects();
      sprintForm.reset();

      const details = sprintForm.closest('details');
      if (details) details.removeAttribute('open');
    });
  }

  // Create new issue
  if (issueForm) {
    issueForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = issueForm.querySelector('input[placeholder="Issue title"]').value.trim();
      const desc = issueForm.querySelector('textarea').value.trim();
      const selects = issueForm.querySelectorAll('select');
      const pointsInput = issueForm.querySelector('input[type="number"]');

      if (!title) {
        alert('Please enter an issue title.');
        return;
      }

      const newIssue = {
        id: 'issue_' + Date.now(),
        title,
        description: desc,
        type: selects[0].value,
        sprint: selects[1].value,
        priority: selects[2].value || 'Medium',
        assignee: selects[3].value,
        status: selects[4].value || 'todo',
        points: pointsInput.value ? parseInt(pointsInput.value) : 0
      };

      customIssues.push(newIssue);

      const row = createIssueRow(newIssue);
      appendIssueToSprintUI(row, newIssue.sprint);
      updateSprintIssueCounts();
      issueForm.reset();

      const details = issueForm.closest('details');
      if (details) details.removeAttribute('open');
    });
  }

  // Row dropdown changes
  main.addEventListener('change', (e) => {
    const target = e.target;

    if (target.classList.contains('issue-sprint')) {
      const li = target.closest('li');
      if (li) {
        appendIssueToSprintUI(li, target.value);
        updateSprintIssueCounts();
        if (li.dataset.newId) {
          updateCustomIssue(li.dataset.newId, { sprint: target.value });
        }
      }
    }

    if (target.classList.contains('status')) {
      const li = target.closest('li');
      if (li) {
        target.dataset.status = target.value;
        if (li.dataset.newId) {
          updateCustomIssue(li.dataset.newId, { status: target.value });
        }
      }
    }

    if (target.classList.contains('priority') || target.classList.contains('who') || target.classList.contains('points')) {
      const li = target.closest('li');
      if (li && li.dataset.newId) {
        const updates = {};
        if (target.classList.contains('priority')) updates.priority = target.value;
        if (target.classList.contains('who')) updates.assignee = target.value;
        if (target.classList.contains('points')) updates.points = parseInt(target.value) || 0;
        updateCustomIssue(li.dataset.newId, updates);
      }
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

  function updateCustomIssue(id, fields) {
    const issue = customIssues.find(i => i.id === id);
    if (issue) Object.assign(issue, fields);
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

  function createIssueRow(issue) {
    const li = document.createElement('li');
    li.dataset.newId = issue.id;

    const typeChar = issue.type === 'story' ? 'S' : (issue.type === 'bug' ? 'B' : 'T');

    let sprintOptions = '';
    getSprints().forEach(s => {
      sprintOptions += `<option value="${s.id}" ${s.id === issue.sprint ? 'selected' : ''}>${s.name}</option>`;
    });
    sprintOptions += `<option value="" ${!issue.sprint ? 'selected' : ''}>Backlog</option>`;

    li.innerHTML = `
      <span class="tag" data-type="${issue.type}">${typeChar}</span>
      <span class="title">${issue.title}</span>
      <select class="issue-sprint">${sprintOptions}</select>
      <select class="priority">
        <option value="Low" ${issue.priority === 'Low' ? 'selected' : ''}>Low</option>
        <option value="Normal" ${issue.priority === 'Normal' ? 'selected' : ''}>Normal</option>
        <option value="Medium" ${issue.priority === 'Medium' ? 'selected' : ''}>Medium</option>
        <option value="High" ${issue.priority === 'High' ? 'selected' : ''}>High</option>
      </select>
      <select class="who">
        <option value="PS" ${issue.assignee === 'PS' ? 'selected' : ''}>PS</option>
        <option value="AM" ${issue.assignee === 'AM' ? 'selected' : ''}>AM</option>
        <option value="RK" ${issue.assignee === 'RK' ? 'selected' : ''}>RK</option>
        <option value="" ${!issue.assignee ? 'selected' : ''}>–</option>
      </select>
      <input type="number" class="points" value="${issue.points || 0}" min="0">
      <select class="status" data-status="${issue.status || 'todo'}">
        <option value="todo" ${issue.status === 'todo' ? 'selected' : ''}>To Do</option>
        <option value="progress" ${issue.status === 'progress' ? 'selected' : ''}>In Progress</option>
        <option value="review" ${issue.status === 'review' ? 'selected' : ''}>Review</option>
        <option value="done" ${issue.status === 'done' ? 'selected' : ''}>Done</option>
      </select>
    `;
    return li;
  }

  function updateNewIssueSprintOptions() {
    const select = document.querySelector('.backlog-header details:nth-of-type(2) form select:nth-of-type(2)');
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
