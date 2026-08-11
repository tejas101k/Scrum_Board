document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  if (!form) return;

  const errorMessage = document.createElement('div');
  errorMessage.style.color = '#e74c3c';
  errorMessage.style.fontSize = '12px';
  errorMessage.style.marginTop = '10px';
  errorMessage.style.textAlign = 'center';
  errorMessage.style.fontWeight = 'bold';
  form.appendChild(errorMessage);

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = form.querySelector('input[type="email"]').value.trim();
    const password = form.querySelector('input[type="password"]').value;

    errorMessage.textContent = '';

    if (!email || !password) {
      errorMessage.textContent = 'Please fill in all required fields.';
      return;
    }

    if (password.length < 8) {
      errorMessage.textContent = 'Password must be at least 8 characters long.';
      return;
    }

    // Submit credentials to login
    fetch('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    })
    .then(async (res) => {
      if (res.ok) {
        window.location.href = 'html/home.html';
      } else {
        const errData = await res.json().catch(() => ({}));
        errorMessage.textContent = errData.error || 'Invalid email or password.';
      }
    })
    .catch((err) => {
      console.error('Login error:', err);
      errorMessage.textContent = 'A network error occurred. Please try again.';
    });
  });
});
