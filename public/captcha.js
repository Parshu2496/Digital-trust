document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  const captchares = document.querySelector('.captcha');
  const input1 = document.querySelector('.firstinput');
  const input2 = document.querySelector('.secondinput');
  const statusDiv = document.getElementById('status');
  const verificationDiv = document.getElementById('Verficationstatus');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = input1.value.trim();
    const pass = input2.value.trim();
    const captchaResponse = grecaptcha.getResponse();

    // Clear previous messages
    statusDiv.innerHTML = '';
    verificationDiv.innerHTML = '';

    // Validate inputs
    if (!email || !pass) {
      verificationDiv.innerHTML = 'Please enter email and password.';
      return;
    }
    if (!captchaResponse) {
      verificationDiv.innerHTML = 'Please complete the captcha.';
      return;
    }

    try {
      const response = await fetch('/validate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uname: email, captchaResponse })
      });
      const data = await response.json();

      if (data.captchaValid === false) {
        statusDiv.innerHTML = data.message;
        verificationDiv.innerHTML = 'Captcha validation failed.';
        return;
      }

      // Display email validation results
      verificationDiv.innerHTML = `
        Email: ${data.uname}<br>
        Validation Status: ${data.validateEmail}<br>
        Disposable Check: ${data.validateWithDisposableCheck}<br>
        Detailed Validation: ${data.getDetailedValidation ? data.getDetailedValidation.valid : 'N/A'}<br>
        Custom Options: ${data.validateWithCustomOptions}<br>
        Format Only: ${data.validateFormatOnly}
      `;
      captcha.innerHTML = 'You are a human<br>';
      
      statusDiv.innerHTML = 'Email validation completed successfully.';
    } catch (error) {
      console.error('Error:', error);
      verificationDiv.innerHTML = 'Error validating email.';
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

