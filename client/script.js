const form = document.getElementById("loginForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

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

  const message = document.getElementById("message");

  if (response.ok) {
    message.style.color = "green";
    message.innerText = "Login Successful";

    window.location.href = "home.html";
  } else {
    message.style.color = "red";
    message.innerText = data.message;
  }
});