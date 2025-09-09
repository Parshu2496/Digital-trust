document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  const input = document.querySelector('.form-control');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = input.value;
    try {
      const response = await fetch('/validate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uname: email, captchaResponse })
      });
      const data = await response.json();
      const statusDiv = document.getElementById('Verficationstatus');

      statusDiv.innerHTML = `
        Name: ${data.uname}<br>
        Email validation: ${data.validateEmail}<br>
        Disposable Check: ${data.validateWithDisposableCheck}<br>
        Detailed: ${data.getDetailedValidation ? data.getDetailedValidation.valid : 'N/A'}<br>
        Custom Options: ${data.validateWithCustomOptions}<br>
        Format Only: ${data.validateFormatOnly}
      `;
    } catch (error) {
      console.error('Error:', error);
      document.getElementById('Verficationstatus').innerHTML = 'Error validating email.';
    }
  });
});
