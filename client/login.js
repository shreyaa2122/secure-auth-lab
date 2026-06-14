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
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const userCaptcha = document.getElementById("captchaInput").value.trim();

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

  const response = await fetch("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: username,
      password,
    }),
  });

  const data = await response.json();

  if (response.ok && data.token) {
    window.location.href = "home.html";
  } else {
    messageEl.innerText = data.message || "Incorrect Credentials";
  }
}

if (loginButton) {
  loginButton.addEventListener("click", login);
} else if (messageEl) {
  messageEl.innerText = "Login button not found. Please reload the page via the server.";
}

// Initialize CAPTCHA on page load
generateCaptcha();
