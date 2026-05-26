const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) return console.error('DB open error:', err.message);
});

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    console.log('tables:', tables.map(t=>t.name));
  });
  db.all('SELECT * FROM users', (err, rows) => {
    if (err) return console.log('users error:', err.message);
    console.log('users rows:', rows);
  });
  db.all('SELECT * FROM login_attempts', (err, rows) => {
    if (err) return console.log('login_attempts error:', err.message);
    console.log('login_attempts rows:', rows.slice(-10));
  });
});

db.close();
