document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  const input1 = document.querySelector('.firstinput');
  const input2 = document.querySelector('.secondinput');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = input1.value.trim();
    const pass = input2.value.trim();
    const captchaResponse = grecaptcha.getResponse();
    const statusDiv = document.getElementById('status');
    if (!email || !pass) {
      statusDiv.innerHTML = 'Please enter email and password.';
      return;
    }
    if (!captchaResponse) {
      statusDiv.innerHTML = 'Please complete the captcha.';
      return;
    }
    try {
      const response = await fetch('/validate-captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uname: email, captchaResponse })
      });
      const data = await response.json();
      statusDiv.innerHTML = data.message;
    } catch (error) {
      console.error('Error:', error);
      statusDiv.innerHTML = 'Error validating captcha.';
    }
  });
});
        const passwordInput = document.querySelector('.secondinput');
        const showPassCheckbox = document.getElementById('showPass');
        showPassCheckbox.addEventListener('change', () => {
            if (showPassCheckbox.checked) {
              passwordInput.type = 'text';
            } else {
              passwordInput.type = 'password';
            }
        });