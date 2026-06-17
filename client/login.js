const loginButton = document.getElementById("loginButton");
const messageEl = document.getElementById("message");
const captchaEl = document.getElementById("captchaInput");

let generatedCaptcha = "";

function generateCaptcha() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  generatedCaptcha = "";
  for (let i = 0; i < 5; i++) {
    generatedCaptcha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const box = document.getElementById("captchaBox");
  if (box) box.innerText = generatedCaptcha;
}

// Simple email format validation
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

const refreshBtn = document.getElementById("refreshCaptcha");
if (refreshBtn) refreshBtn.addEventListener("click", generateCaptcha);

// Clear visual error when user starts typing
if (captchaEl) {
  captchaEl.addEventListener("input", () => {
    captchaEl.classList.remove("input-error", "shake");
    if (messageEl) messageEl.innerText = "";
  });
}

function getServerUrl() {
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return window.location.origin;
  }
  return null;
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const userCaptcha = document.getElementById("captchaInput").value.trim();

  if (!email || !password) {
    messageEl.innerText = "Please enter both email and password.";
    return;
  }

  // Validate email format
  if (!isValidEmail(email)) {
    messageEl.innerText = "Please enter a valid email address.";
    return;
  }

  // Validate CAPTCHA before sending credentials to server
  if (!userCaptcha || userCaptcha.toUpperCase() !== generatedCaptcha) {
    messageEl.innerText = "Invalid CAPTCHA";
    // show visual error + shake animation
    if (captchaEl) {
      captchaEl.classList.remove("shake");
      // trigger reflow to restart animation
      void captchaEl.offsetWidth;
      captchaEl.classList.add("input-error", "shake");
      captchaEl.focus();
    }

    generateCaptcha();
    return;
  }

  // remove any previous error state
  if (captchaEl) captchaEl.classList.remove("input-error", "shake");

  const serverUrl = getServerUrl();
  if (!serverUrl) {
    messageEl.innerText = "Please open this app through http://localhost:5000, not via file://.";
    return;
  }

  const response = await fetch(`${serverUrl}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const data = await response.json().catch(() => null);

  if (response.ok && data && data.token) {
    window.location.href = "home.html";
    return;
  }

  const errorMessage = (data && data.message) ? data.message : "Incorrect credentials.";
  messageEl.innerText = errorMessage;
}

if (loginButton) {
  loginButton.addEventListener("click", login);
} else if (messageEl) {
  messageEl.innerText = "Login button not found. Please reload the page via the server.";
}

// Initialize CAPTCHA on page load
generateCaptcha();
