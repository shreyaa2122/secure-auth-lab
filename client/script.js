const form = document.getElementById("loginForm");

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const message = document.getElementById("message");

  if (!isValidEmail(email)) {
    message.style.color = "red";
    message.innerText = "Please enter a valid email address.";
    return;
  }

  const response = await fetch("http://localhost:5000/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      email,
      password,
    }),
  });

  const data = await response.json();

  if (response.ok) {
    message.style.color = "green";
    message.innerText = "Login Successful";

    window.location.href = "home.html";
  } else {
    message.style.color = "red";
    message.innerText = data.message;
  }
});