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
        
        navRight.style.cursor = 'pointer';
        navRight.title = 'View profile';
        const popup = navRight.querySelector('.profile-popup');
        
        navRight.addEventListener('click', (e) => {
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
  const sprintsContainer = document.querySelector('.sprints');
  const headingEl = document.querySelector('.heading');

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

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
      if (headingEl) {
        headingEl.textContent = `Active Sprints: ${sprints.length}`;
      }

      if (sprints.length === 0) {
        sprintsContainer.innerHTML = `
          <div style="grid-column: span 3; text-align: center; color: #7f8c8d; padding: 40px 0;">
            No active sprints found. Create one in the Backlog page!
          </div>
        `;
        return;
      }

      function formatDate(str) {
        if (!str) return '';
        const date = new Date(str);
        if (isNaN(date.getTime())) return str;
        const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
        const m = date.getMonth();
        const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${date.getDate()} ${shortMonths[m]}`;
      }

      sprints.forEach(sprint => {
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
        <div style="grid-column: span 3; text-align: center; color: #e74c3c; padding: 40px 0;">
          Failed to load sprints. Please refresh the page.
        </div>
      `;
    });
  }
});
