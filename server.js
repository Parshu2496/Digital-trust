const http = require("http");
const fs = require('fs')
const express = require('express');
const emailValidator = require('node-email-verifier');
const path = require('path');
const { VerifaliaRestClient } = require('verifalia');
const app = express();
const port = 8080;
const Recaptcha = require('recaptcha-verify');

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

app.get('/captcha', (req, res) => {
  res.render('captcha.ejs');
});

app.get('/information',(req,res)=>{
  res.render('information.ejs')
})
// Verify reCAPTCHA on captcha form submission

const recaptcha = new Recaptcha({
    secret: "6Lej8sIrAAAAAH9eKmnGexGIvT0gWbRdiwtPh9EJ",
    verbose: true
});

// Helper function to promisify recaptcha check
function checkRecaptchaAsync(response) {
    return new Promise((resolve, reject) => {
        recaptcha.checkResponse(response, (error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
}
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

app.post('/validate-email', async (req, res) => {
    const { uname, captchaResponse } = req.body;
    try {
        if (!captchaResponse) {
            return res.status(400).json({ message: 'Captcha response is required' });
        }

        // Check captcha first using promisified function
        const captchaResult = await checkRecaptchaAsync(captchaResponse);

        if (!captchaResult.success) {
            return res.json({
                uname: uname,
                captchaValid: false,
                message: 'Captcha validation failed - you might be a robot'
            });
        }

        // If captcha is valid, proceed with email validation
        try {
            const username = uname;
            const checkemail = await validateEmail(uname);
            const disposableCheck = await validateWithDisposableCheck(uname);
            const detailed = await getDetailedValidation(uname);
            const customOptions = await validateWithCustomOptions(uname);
            const formatOnly = await validateFormatOnly(uname);

            res.json({
                uname: username,
                captchaValid: true,
                validateEmail: checkemail,
                validateWithDisposableCheck: disposableCheck,
                getDetailedValidation: detailed,
                validateWithCustomOptions: customOptions,
                validateFormatOnly: formatOnly
            });
        } catch (emailError) {
            res.status(500).json({ error: 'Email validation failed: ' + emailError.message });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Email checker 
const verifalia = new VerifaliaRestClient({
  username: 'atharva@',
  password: 'atharva7'
});
async function validateEmail(email) {
  try {
    // Submit the email for validation
    const result = await verifalia.emailValidations.submit(email);

    // Get the first validation entry
    const entry = result.entries[0];

    // Log the classification and status
    console.log(`${entry.classification} (${entry.status})`);

    // Return the full entry if you want to use it elsewhere
    return entry.status;
  } catch (error) {
    console.error('Validation error:', error);
    throw error;
  }
}


// Disposable email detection
async function validateWithDisposableCheck(email) {
  try {
    const isValid = await emailValidator(email, {
      checkDisposable: true,
      checkMx: false, // Disable MX check to avoid SMTP connection
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
      checkMx: false, // Disable MX check to avoid SMTP connection
    });
    return result;
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
