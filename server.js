require("dotenv").config(); 

const { Bani, DailyLog, NitnemHistory } = require("./model.js");
const { Pool } = require("pg");
const cors = require("cors");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const history = new NitnemHistory();

const express = require('express');
const app = express();
app.use(cors());

app.get("/", function (req, res){
    res.send("Nitnem Tracker server is running!");
});
app.get("/test-bani", function (req, res){
    const japji =new Bani("Japji Sahib", "morning");
    japji.markDone();
    res.json(japji);
});
app.get("/streak", function (req, res) {
  res.json({ currentStreak: history.getCurrentStreak() });
});
app.post("/daily-log", express.json(), function (req, res) {
  const { date, baniNames } = req.body;

  const log = new DailyLog(date);

  baniNames.forEach(function (name) {
    const bani = new Bani(name, "unspecified");
    bani.markDone();
    log.addBani(bani);
  });

  history.addLog(log);

  res.json(log);
});
app.post("/daily-log-db", express.json(), async function (req, res) {
  // Borrow one dedicated connection from the pool, so every query
  // below runs inside the same transaction.
  const client = await pool.connect();

  try {
    const { date, baniNames } = req.body;

    await client.query("BEGIN");

    // Step 1: find today's log, or create it if it doesn't exist yet.
    // ORDER BY id DESC LIMIT 1 picks the newest row, which keeps this
    // safe even while old duplicate rows are still in the table.
    const existing = await client.query(
      "SELECT id FROM daily_logs WHERE date = $1 ORDER BY id DESC LIMIT 1",
      [date]
    );

    let logId;
    if (existing.rows.length === 0) {
      const inserted = await client.query(
        "INSERT INTO daily_logs (date) VALUES ($1) RETURNING id",
        [date]
      );
      logId = inserted.rows[0].id;
    } else {
      logId = existing.rows[0].id;
    }

    // Step 2: replace this log's banis with exactly what's checked now.
    await client.query(
      "DELETE FROM completed_banis WHERE daily_log_id = $1",
      [logId]
    );

    for (const name of baniNames) {
      const baniResult = await client.query(
        "SELECT id FROM banis WHERE name = $1",
        [name]
      );
      const baniId = baniResult.rows[0].id;

      await client.query(
        "INSERT INTO completed_banis (daily_log_id, bani_id) VALUES ($1, $2)",
        [logId, baniId]
      );
    }

    await client.query("COMMIT");

    res.json({ success: true, logId: logId });
  } catch (err) {
    // Something failed partway through: undo everything from this save.
    await client.query("ROLLBACK");
    res.json({ success: false, error: err.message });
  } finally {
    // Always hand the connection back to the pool, success or failure.
    client.release();
  }
});

app.get("/daily-log/:date", async function (req, res) {
  try {
    const date = req.params.date;

    const result = await pool.query(
      `SELECT banis.name, banis.time_of_day
       FROM completed_banis
       JOIN banis ON completed_banis.bani_id = banis.id
       JOIN daily_logs ON completed_banis.daily_log_id = daily_logs.id
       WHERE daily_logs.date = $1`,
      [date]
    );

    res.json({ date: date, completedBanis: result.rows });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});
app.get("/streak-db", async function (req, res) {
  try {
    const result = await pool.query(`
      SELECT daily_logs.date
      FROM daily_logs
      LEFT JOIN completed_banis ON completed_banis.daily_log_id = daily_logs.id
      GROUP BY daily_logs.id, daily_logs.date
      HAVING COUNT(completed_banis.id) = 5
      ORDER BY daily_logs.date DESC
    `);

    const completedDates = result.rows.map(function (row) {
      return row.date;
    });

    let streak = 0;
    const today = new Date();

    for (let i = 0; i < completedDates.length; i++) {
      const expected = new Date();
      expected.setDate(today.getDate() - i);
      const year = expected.getFullYear();
      const month = String(expected.getMonth() + 1).padStart(2, "0");
      const day = String(expected.getDate()).padStart(2, "0");
      const expectedString = year + "-" + month + "-" + day;

      if (completedDates[i] === expectedString) {
        streak += 1;
      } else {
        break;
      }
    }

    res.json({ currentStreak: streak, completedDates: completedDates });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function (){
    console.log("Server listening on port " + PORT);
});

app.get("/test-db", async function (req, res) {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ success: true, time: result.rows[0] });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});