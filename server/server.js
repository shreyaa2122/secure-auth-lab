const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt.js");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from the client directory
app.use(
  express.static(
    path.join(__dirname, "../client")
  )
);

/* ================= DATABASE ================= */

const db = new sqlite3.Database(path.join(__dirname, "database.db"), (err) => {
  if (err) {
    console.log(err.message);
  } else {
    console.log("Connected to SQLite database at:", path.join(__dirname, "database.db"));
  }
});

const defaultEmail = "admin@gmail.com";
const defaultPasswordPlain = "123456";

async function insertDefaultUser() {
  db.get(`SELECT * FROM users WHERE email = ?`, [defaultEmail], async (err, row) => {
    if (err) {
      console.log("Error checking default user:", err.message);
      return;
    }

    const hashedPassword = await bcrypt.hash(defaultPasswordPlain, 10);

    if (!row) {
      db.run(`INSERT INTO users (email, password) VALUES (?, ?)`, [defaultEmail, hashedPassword], (err) => {
        if (err) {
          console.log("Error inserting default user:", err.message);
        } else {
          console.log("Default user created");
        }
      });
    } else {
      const match = await bcrypt.compare(defaultPasswordPlain, row.password);
      if (!match) {
        db.run(`UPDATE users SET password = ? WHERE email = ?`, [hashedPassword, defaultEmail], (err) => {
          if (err) {
            console.log("Error updating default user password:", err.message);
          } else {
            console.log("Default user password fixed");
          }
        });
      }
    }
  });
}

// Create table and migrate if needed
db.serialize(() => {
  db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  email TEXT,
  password TEXT
)
  `);

  db.all(`PRAGMA table_info(users)`, (err, rows) => {
    if (err) {
      console.log("Error reading table info:", err.message);
      return;
    }

    const hasEmail = rows.some((row) => row.name === "email");

    if (!hasEmail) {
      db.run(`ALTER TABLE users ADD COLUMN email TEXT`, (alterErr) => {
        if (alterErr) {
          console.log("Error adding email column:", alterErr.message);
        } else {
          console.log("Added email column to users table");
          insertDefaultUser();
        }
      });
    } else {
      insertDefaultUser();
    }
  });
  
  // Create login_attempts table if missing
  db.run(`
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  ip_address TEXT,
  login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT
)`);

  // Create blocked_ips table if missing
  db.run(`
CREATE TABLE IF NOT EXISTS blocked_ips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT UNIQUE,
  reason TEXT,
  blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  failed_attempts INTEGER DEFAULT 0
)`);
});

/* ================= REGISTER ================= */

app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "All fields required",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users(email, password) VALUES (?, ?)`,
      [email, hashedPassword],
      function (err) {
        if (err) {
          return res.status(400).json({
            message: "User already exists",
          });
        }

        res.json({
          message: "User registered successfully",
        });
      }
    );
  } catch (error) {
    res.status(500).json({
      message: "Server error",
    });
  }
});

/* ================= IP BLOCKING LOGIC ================= */

const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_DURATION_MINUTES = 30;

function checkIfIPBlocked(ip, callback) {
  db.get(
    `SELECT * FROM blocked_ips WHERE ip_address = ? AND blocked_at > datetime('now', '-' || ? || ' minutes')`,
    [ip, BLOCK_DURATION_MINUTES],
    (err, row) => {
      callback(err, row);
    }
  );
}

function incrementFailedAttempts(ip, callback) {
  db.get(
    `SELECT failed_attempts FROM blocked_ips WHERE ip_address = ?`,
    [ip],
    (err, row) => {
      if (err) {
        callback(err);
        return;
      }

      if (row) {
        db.run(
          `UPDATE blocked_ips SET failed_attempts = failed_attempts + 1 WHERE ip_address = ?`,
          [ip],
          callback
        );
      } else {
        db.run(
          `INSERT INTO blocked_ips (ip_address, reason, failed_attempts) VALUES (?, ?, ?)`,
          [ip, 'Multiple failed login attempts', 1],
          callback
        );
      }
    }
  );
}

/* ================= LOGIN ================= */

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip;

  console.log("Login attempt for email:", email, "from IP:", ip);

  // Check if IP is blocked
  checkIfIPBlocked(ip, (err, blocked) => {
    if (err) {
      console.log("Error checking blocked IPs:", err);
      return res.status(500).json({ message: "Server error" });
    }

    if (blocked) {
      return res.status(403).json({
        message: "IP address temporarily blocked due to multiple failed attempts",
      });
    }

    db.get(
      `SELECT * FROM users WHERE email = ?`,
      [email],
      async (err, user) => {
        if (err) {
          console.log("DB error:", err);
          return res.status(500).json({
            message: "Server error",
          });
        }

        if (!user) {
          // record failed attempt (user not found)
          db.run(`INSERT INTO login_attempts (username, ip_address, status) VALUES (?, ?, ?)`, [email, ip, 'FAILED'], (iErr) => {
            if (iErr) console.log('Failed to record login_attempt (not found):', iErr.message);
          });
          incrementFailedAttempts(ip, (incErr) => {
            if (incErr) console.log('Failed to increment failed attempts:', incErr.message);
          });
          console.log("User not found for email:", email);
          return res.status(401).json({
            message: "Invalid credentials",
          });
        }

        console.log("User found:", user.email);
        console.log("Stored password hash:", user.password);

        const isMatch = await bcrypt.compare(
          password,
          user.password
        );

        console.log("Password match result:", isMatch);

        if (!isMatch) {
          // record failed attempt (wrong password)
          db.run(`INSERT INTO login_attempts (username, ip_address, status) VALUES (?, ?, ?)`, [email, ip, 'FAILED'], (iErr) => {
            if (iErr) console.log('Failed to record login_attempt (bad password):', iErr.message);
          });
          incrementFailedAttempts(ip, (incErr) => {
            if (incErr) console.log('Failed to increment failed attempts:', incErr.message);
          });
          return res.status(401).json({
            message: "Invalid credentials",
          });
        }

        // record successful login
        db.run(`INSERT INTO login_attempts (username, ip_address, status) VALUES (?, ?, ?)`, [email, ip, 'SUCCESS'], (iErr) => {
          if (iErr) console.log('Failed to record login_attempt (success):', iErr.message);
        });

        const token = jwt.sign(
          {
            id: user.id,
            email: user.email,
          },
          process.env.JWT_SECRET,
          {
            expiresIn: "1h",
          }
        );

        res.json({
          message: "Login successful",
          token,
        });
      }
    );
  });
});

/* ================= API ENDPOINTS FOR DASHBOARD STATS ================= */

// Get total login attempts, failed logins, and blocked IPs
app.get("/api/stats", (req, res) => {
  db.all(
    `SELECT COUNT(*) as total_attempts FROM login_attempts`,
    [],
    (err, totalResult) => {
      if (err) {
        console.log("Error fetching total attempts:", err);
        return res.status(500).json({ message: "Server error" });
      }

      db.all(
        `SELECT COUNT(*) as failed_logins FROM login_attempts WHERE status = 'FAILED'`,
        [],
        (err, failedResult) => {
          if (err) {
            console.log("Error fetching failed logins:", err);
            return res.status(500).json({ message: "Server error" });
          }

          db.all(
            `SELECT COUNT(DISTINCT ip_address) as blocked_ips FROM blocked_ips WHERE blocked_at > datetime('now', '-30 minutes')`,
            [],
            (err, blockedResult) => {
              if (err) {
                console.log("Error fetching blocked IPs:", err);
                return res.status(500).json({ message: "Server error" });
              }

              res.json({
                total_attempts: totalResult[0]?.total_attempts || 0,
                failed_logins: failedResult[0]?.failed_logins || 0,
                blocked_ips: blockedResult[0]?.blocked_ips || 0,
              });
            }
          );
        }
      );
    }
  );
});

// Get all login attempts
app.get("/api/login-attempts", (req, res) => {
  db.all(
    `SELECT * FROM login_attempts ORDER BY login_time DESC LIMIT 1000`,
    [],
    (err, rows) => {
      if (err) {
        console.log("Error fetching login attempts:", err);
        return res.status(500).json({ message: "Server error" });
      }
      res.json(rows || []);
    }
  );
});

// Get failed login attempts
app.get("/api/failed-logins", (req, res) => {
  db.all(
    `SELECT * FROM login_attempts WHERE status = 'FAILED' ORDER BY login_time DESC LIMIT 1000`,
    [],
    (err, rows) => {
      if (err) {
        console.log("Error fetching failed logins:", err);
        return res.status(500).json({ message: "Server error" });
      }
      res.json(rows || []);
    }
  );
});

// Get blocked IPs
app.get("/api/blocked-ips", (req, res) => {
  db.all(
    `SELECT * FROM blocked_ips ORDER BY blocked_at DESC LIMIT 1000`,
    [],
    (err, rows) => {
      if (err) {
        console.log("Error fetching blocked IPs:", err);
        return res.status(500).json({ message: "Server error" });
      }
      res.json(rows || []);
    }
  );
});

/* ================= HOME ROUTE ================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../client/login.html")
  );
});
/* ================= START SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open your browser and go to: http://localhost:${PORT}`);
});
