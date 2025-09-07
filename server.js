// Import the http module
const http = require("http");
const fs = require('fs')
const express = require('express');
const path = require('path');
const app = express();
const port = 8080;
app.use(express.static(path.join(__dirname, 'public')));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.render('home.ejs');
});
app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`);
});

app.get('/emailvalidator', (req, res) => {
  res.render('emailvalidator.ejs');
});

// Render the captcha form with reCAPTCHA
app.get('/captcha', (req, res) => {
  res.render('captcha.ejs');
});

// Verify reCAPTCHA on captcha form submission
var Recaptcha = require('recaptcha-verify');
var recaptcha = new Recaptcha({
    secret: "6LfnQMErAAAAAL7b7LTVk4pw5jBL2y1Ek7664Hh6",
    verbose: true
});
app.get('/check', function(req, res){
    // get the user response (from reCAPTCHA)
    var userResponse = req.query['g-recaptcha-response'];
    recaptcha.checkResponse(userResponse, function(error, response){
        if(error){
            // an internal error?
            res.status(400).render('400', {
                message: error.toString()
            });
            return;
        }
        if(response.success){
            console.log("hello")
            // save session.. create user.. save form data.. render page, return json.. etc.
        }else{
            res.status(200).send('the user is a ROBOT :(');
            // show warning, render page, return a json, etc.
        }
    });
});
app.post('/validate-captcha', (req, res) => {
  const { uname, captchaResponse } = req.body;
  if (!captchaResponse) {
    return res.status(400).json({ message: 'Captcha response is required' });
  }
  recaptcha.checkResponse(captchaResponse, function(error, response) {
    if (error) {
      return res.status(400).json({ message: 'Error validating captcha' });
    }
    if (response.success) {
      res.json({ message: 'You are human' });
    } else {
      res.json({ message: 'You are a robot' });
    }
  });
});
app.post('/validate-email', async (req, res) => {
    const { uname } = req.body;
    try {
        const username = uname;
        const disposableCheck = await validateWithDisposableCheck(uname);
        const detailed = await getDetailedValidation(uname);
        const customOptions = await validateWithCustomOptions(uname);
        const formatOnly = await validateFormatOnly(uname);
        res.json({
            uname: username,
            validateWithDisposableCheck: disposableCheck,
            getDetailedValidation: detailed,
            validateWithCustomOptions: customOptions,
            validateFormatOnly: formatOnly
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


const emailValidator = require('node-email-verifier');

// Basic validation (format + MX checking)
async function validateEmail(email) {
  try {
    const isValid = await emailValidator(email);
    // console.log(`Is "${email}" valid?`, isValid);
  } catch (error) {
    console.error('Validation error:', error);
  }
}

// Disposable email detection
async function validateWithDisposableCheck(email) {
  try {
    const isValid = await emailValidator(email, {
      checkDisposable: true,
    });
    // console.log(`Is "${email}" valid (blocking disposable)?`, isValid);
    return isValid;
  } catch (error) {
    console.error('Validation error:', error);
    return false; // Or throw error, depending on desired error handling
  }
}
// Detailed validation results
async function getDetailedValidation(email) {
  try {
    const result = await emailValidator(email, {
      detailed: true,
      checkDisposable: true,
    });
    // console.log('Detailed validation result:', result);
    return result;
    /*
    Example output:
    {
      valid: false,
      email: 'test@10minutemail.com',
      format: { valid: true },
      mx: { valid: true, records: [...] },
      disposable: { 
        valid: false, 
        provider: '10minutemail.com',
        reason: 'Email from disposable provider'
      }
    }
    */
  } catch (error) {
    // console.error('Validation error:', error);
    return { valid: false, error: error.message }; // Return an error object
  }
}

// Custom timeout and advanced options
async function validateWithCustomOptions(email) {
  try {
    const isValid = await emailValidator(email, {
      checkMx: true,
      checkDisposable: true,
      timeout: '500ms', // or timeout: 500 for milliseconds
    });
    // console.log(`Is "${email}" valid with all checks?`, isValid);
    return isValid;
  } catch (error) {
    if (error.message === 'DNS lookup timed out') {
      console.error('Timeout on DNS lookup.');
    } else {
      console.error('Validation error:', error);
    }
    return false; // Or throw error
  }
}

// Format-only validation (fastest)
async function validateFormatOnly(email) {
  try {
    const isValid = await emailValidator(email, { checkMx: false });
    // console.log(`Is "${email}" format valid?`, isValid);
    return isValid;
  } catch (error) {
    console.error('Validation error:', error);
    return false; // Or throw error
  }
}
