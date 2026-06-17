const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const app = express();

app.use(cors());
app.use(express.json());
app.use(helmet());

function getClientIP(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || req.ip;
}

const checkBlockedIPMiddleware = (req, res, next) => {
  const ip = getClientIP(req);
  checkIfIPBlocked(ip, (err, blocked) => {
    if (err) {
      console.log("Error checking blocked IPs:", err);
      return res.status(500).send("Server error");
    }

    if (blocked) {
      return res.status(403).sendFile(path.join(__dirname, "../client/blocked.html"));
    }

    next();
  });
};

// Basic email format validation
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // high enough to avoid blocking legitimate test attempts
  message: "Too many login attempts"
});

app.use("/login", limiter);

app.get(["/", "/login.html"], checkBlockedIPMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "../client/login.html"));
});

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
  status TEXT,
  login_time DATETIME DEFAULT CURRENT_TIMESTAMP
)
  `);

  db.prepare(`
CREATE TABLE IF NOT EXISTS email_verification (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    otp TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

  // Create blocked_ips table if missing
  db.run(`
CREATE TABLE IF NOT EXISTS blocked_ips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT UNIQUE,
  reason TEXT,
  blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  unblock_at DATETIME,
  failed_attempts INTEGER DEFAULT 0
)`);

  db.all(`PRAGMA table_info(blocked_ips)`, (err, rows) => {
    if (err) {
      console.log("Error reading blocked_ips schema info:", err.message);
      return;
    }

    const hasUnblockAt = rows.some((row) => row.name === "unblock_at");
    if (!hasUnblockAt) {
      db.run(`ALTER TABLE blocked_ips ADD COLUMN unblock_at DATETIME`, (alterErr) => {
        if (alterErr) {
          console.log("Error adding unblock_at column:", alterErr.message);
        } else {
          console.log("Added unblock_at column to blocked_ips table");
        }
      });
    }
  });

  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address)`);
});

/* ================= REGISTER ================= */

app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "All fields required",
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Invalid email format" });
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
const BLOCK_DURATION_HOURS = 6;

function checkIfIPBlocked(ip, callback) {
  db.get(
    `SELECT * FROM blocked_ips WHERE ip_address = ?`,
    [ip],
    (err, row) => {
      if (err) {
        return callback(err);
      }

      if (!row) {
        return callback(null, null);
      }

      if (row.unblock_at) {
        if (new Date(row.unblock_at) > new Date()) {
          return callback(null, row);
        }

        return db.run(
          `DELETE FROM blocked_ips WHERE ip_address = ?`,
          [ip],
          (deleteErr) => {
            if (deleteErr) {
              return callback(deleteErr);
            }
            callback(null, null);
          }
        );
      }

      return callback(null, null);
    }
  );
}

function incrementFailedAttempts(ip, callback) {
  const now = new Date();
  const unblockTime = new Date(now.getTime() + BLOCK_DURATION_HOURS * 60 * 60 * 1000);
  const unblockAtISOString = unblockTime.toISOString();

  db.run(
    `INSERT INTO blocked_ips (ip_address, reason, failed_attempts, blocked_at, unblock_at)
     VALUES (?, ?, 1, CURRENT_TIMESTAMP, NULL)
     ON CONFLICT(ip_address) DO UPDATE SET
       failed_attempts = failed_attempts + 1,
       blocked_at = CURRENT_TIMESTAMP,
       unblock_at = CASE WHEN failed_attempts + 1 >= ? THEN ? ELSE NULL END`,
    [ip, 'Multiple failed login attempts', MAX_FAILED_ATTEMPTS, unblockAtISOString],
    callback
  );
}

/* ================= LOGIN ================= */

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const ip = getClientIP(req);

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

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

/* ================= VULNERABLE LOGIN (SQL INJECTION DEMO) ================= */

app.post("/vulnerable-login", (req, res) => {
  const { username, password } = req.body;

  const query = `
    SELECT * FROM users
    WHERE username='${username}'
    AND password='${password}'
  `;

  console.log(query);

  try {
    db.get(query, (err, user) => {
      if (err) {
        return res.json({
          success: false,
          error: err.message
        });
      }

      if (user) {
        return res.json({
          success: true,
          vulnerable: true,
          message: "SQL Injection Success"
        });
      }

      res.json({
        success: false
      });
    });
  } catch (err) {
    res.json({
      success: false,
      error: err.message
    });
  }
});

/* ================= API ENDPOINTS FOR DASHBOARD STATS ================= */

// Simple stats endpoint for dashboard
app.get("/stats", (req, res) => {
  const total = new Promise((resolve, reject) => {
    db.get(
      `SELECT COUNT(*) as count FROM login_attempts`,
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

  const failed = new Promise((resolve, reject) => {
    db.get(
      `SELECT COUNT(*) as count FROM login_attempts WHERE status='FAILED'`,
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

  const success = new Promise((resolve, reject) => {
    db.get(
      `SELECT COUNT(*) as count FROM login_attempts WHERE status='SUCCESS'`,
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

  Promise.all([total, failed, success])
    .then(([totalResult, failedResult, successResult]) => {
      res.json({
        total: totalResult.count,
        failed: failedResult.count,
        success: successResult.count
      });
    })
    .catch((err) => {
      console.log("Error fetching stats:", err);
      res.status(500).json({ error: "Server error" });
    });
});

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
            `SELECT COUNT(DISTINCT ip_address) as blocked_ips FROM blocked_ips WHERE unblock_at > CURRENT_TIMESTAMP`,
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

// Get currently active blocked IPs and unblock times
app.get("/api/active-blocked-ips", (req, res) => {
  db.all(
    `SELECT id, ip_address, reason, blocked_at, unblock_at, failed_attempts FROM blocked_ips WHERE unblock_at > CURRENT_TIMESTAMP ORDER BY unblock_at ASC`,
    [],
    (err, rows) => {
      if (err) {
        console.log("Error fetching active blocked IPs:", err);
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open your browser and go to: http://localhost:${PORT}`);
});