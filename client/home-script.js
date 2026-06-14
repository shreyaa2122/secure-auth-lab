const statsUrl = "/stats";

// Load stats when page loads
document.addEventListener("DOMContentLoaded", () => {
    loadStats();
    setInterval(loadStats, 10000);

    const logoutButton = document.getElementById("logoutButton");
    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }

    document.querySelectorAll(".card[data-modal]").forEach((card) => {
        card.addEventListener("click", () => openModal(card.dataset.modal));
    });

    document.querySelectorAll(".close-btn[data-close]").forEach((button) => {
        button.addEventListener("click", () => closeModal(button.dataset.close));
    });
});

// Load dashboard statistics
async function loadStats() {
    try {
        const response = await fetch(statsUrl);
        const data = await response.json();

        document.getElementById("totalLogins").textContent = data.total || 0;
        document.getElementById("failedLogins").textContent = data.failed || 0;
        document.getElementById("successLogins").textContent = data.success || 0;
    } catch (error) {
        console.error("Error loading stats:", error);
        document.getElementById("totalLogins").textContent = "Error";
        document.getElementById("failedLogins").textContent = "Error";
        document.getElementById("successLogins").textContent = "Error";
    }
}

// Open modal and load data
async function openModal(type) {
    const modal = document.getElementById(`${type}-modal`);
    const body = document.getElementById(`${type}-body`);

    if (!modal || !body) {
        return;
    }

    modal.classList.add("active");
    body.innerHTML = '<p class="loading">Loading...</p>';

    try {
        let endpoint = "";
        if (type === "login-attempts") {
            endpoint = "/api/login-attempts";
        } else if (type === "failed-logins") {
            endpoint = "/api/failed-logins";
        } else if (type === "blocked-ips") {
            endpoint = "/api/blocked-ips";
        }

        const response = await fetch(endpoint);
        const data = await response.json();

        if (type === "blocked-ips") {
            displayBlockedIPsTable(data, body);
        } else {
            displayLoginAttemptsTable(data, body);
        }
    } catch (error) {
        console.error(`Error loading ${type}:`, error);
        body.innerHTML = '<p class="error">Error loading data. Please try again.</p>';
    }
}

// Close modal
function closeModal(type) {
    const modal = document.getElementById(`${type}-modal`);
    if (modal) {
        modal.classList.remove("active");
    }
}

// Display login attempts table
function displayLoginAttemptsTable(data, container) {
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="error">No data available</p>';
        return;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Username/Email</th>
                    <th>IP Address</th>
                    <th>Login Time</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach((attempt) => {
        const statusClass = attempt.status === "SUCCESS" ? "status-success" : "status-failed";
        const timestamp = new Date(attempt.login_time).toLocaleString();

        html += `
            <tr>
                <td>${attempt.id}</td>
                <td>${attempt.username || "-"}</td>
                <td>${attempt.ip_address}</td>
                <td>${timestamp}</td>
                <td><span class="status-badge ${statusClass}">${attempt.status}</span></td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

// Display blocked IPs table
function displayBlockedIPsTable(data, container) {
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="error">No blocked IPs</p>';
        return;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>IP Address</th>
                    <th>Reason</th>
                    <th>Failed Attempts</th>
                    <th>Blocked At</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach((ip) => {
        const timestamp = new Date(ip.blocked_at).toLocaleString();

        html += `
            <tr>
                <td>${ip.id}</td>
                <td>${ip.ip_address}</td>
                <td>${ip.reason}</td>
                <td>${ip.failed_attempts || 0}</td>
                <td>${timestamp}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

// Logout function
function logout() {
    window.location.href = "login.html";
}

// Close modal when clicking outside of it
window.addEventListener("click", (event) => {
    const modals = document.querySelectorAll(".modal");
    modals.forEach((modal) => {
        if (event.target === modal) {
            modal.classList.remove("active");
        }
    });
});
