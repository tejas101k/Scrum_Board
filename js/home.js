document.addEventListener('DOMContentLoaded', () => {
  const sprintsContainer = document.querySelector('.sprints');
  const headingEl = document.querySelector('.heading');

  if (sprintsContainer) {
    sprintsContainer.innerHTML = '';

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

      if (headingEl) {
        headingEl.textContent = `Active Sprints: ${activeSprints.length}`;
      }

      if (activeSprints.length === 0) {
        sprintsContainer.innerHTML = `
          <div class="home-empty-state">
            No active sprints found. Create and start one in the Backlog page!
          </div>
        `;
        return;
      }

      function formatDate(str) {
        if (!str) return '';
        const date = new Date(str);
        if (isNaN(date.getTime())) return str;
        const m = date.getMonth();
        const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${date.getDate()} ${shortMonths[m]}`;
      }

      activeSprints.forEach(sprint => {
        const sprintTasks = tasks.filter(t => t.sprint_id === sprint.id);
        const total = sprintTasks.length;
        const todo = sprintTasks.filter(t => t.status === 'todo').length;
        const progress = sprintTasks.filter(t => t.status === 'progress' || t.status === 'review').length;
        const done = sprintTasks.filter(t => t.status === 'done').length;

        const datesText = sprint.start_date && sprint.end_date 
          ? `${formatDate(sprint.start_date)} – ${formatDate(sprint.end_date)}` 
          : 'No dates';

        // 1. Sprint number
        const numEl = document.createElement('div');
        numEl.className = 'sprint_number';
        numEl.innerHTML = `${sprint.id}<span>Sprint</span>`;
        sprintsContainer.appendChild(numEl);

        // 2. Sprint details
        const detailsEl = document.createElement('div');
        detailsEl.innerHTML = `
          <h2>${escapeHTML(sprint.name)}</h2>
          <p><em>Active</em> <span class="sprint-date">${escapeHTML(datesText)}</span></p>
          ${sprint.goal ? `
          <details class="goal-details" ${window.innerWidth > 640 ? 'open' : ''}>
            <summary>Description</summary>
            <p class="goal">${escapeHTML(sprint.goal)}</p>
          </details>
          ` : ''}
        `;
        sprintsContainer.appendChild(detailsEl);

        // 3. Stats
        const statsEl = document.createElement('div');
        statsEl.className = 'stats';
        statsEl.innerHTML = `
          <div><b>${total}</b>Total</div>
          <div><b>${todo}</b>To do</div>
          <div><b>${progress}</b>In progress</div>
          <div><b>${done}</b>Done</div>
        `;
        sprintsContainer.appendChild(statsEl);
      });
    })
    .catch(err => {
      console.error('Error loading sprints/tasks on Home:', err);
      if (headingEl) {
        headingEl.textContent = 'Failed to load sprints';
      }
      sprintsContainer.innerHTML = `
        <div class="home-error-state">
          Failed to load sprints. Please refresh the page.
        </div>
      `;
    });
  }
});
