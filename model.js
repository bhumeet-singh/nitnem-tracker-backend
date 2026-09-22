class Bani {
  constructor(name, timeOfDay) {
    this.name = name;
    this.timeOfDay = timeOfDay; // "morning", "afternoon", "evening", etc.
    this.completed = false;
  }
  markDone() {
    this.completed = true;
  }
}

class DailyLog {
  constructor(date) {
    this.date = date;
    this.banis = []; // will hold Bani objects
  }
  addBani(bani) {
    this.banis.push(bani);
  }
  getCompletedBanis() {
    return this.banis.filter(function (bani) {
      return bani.completed;
    });
  }
  isComplete() {
  return this.banis.length !== 0 && this.banis.every(function (bani) {
    return bani.completed;
  });
}
}

class NitnemHistory {
  constructor() {
    this.logs = []; // array of DailyLog objects — the raw source of truth
  }
  addLog(dailyLog) {
    this.logs.push(dailyLog);
  }
  getTotalDaysLogged() {
    return this.logs.length;
  }
  getCurrentStreak() {
    const sortedLogs = this.logs.slice().sort(function (a, b) {
  return a.date.localeCompare(b.date);
});
    let streak = 0;
    for (let i = sortedLogs.length - 1; i >= 0; i--) {
      if (sortedLogs[i].isComplete()) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  }
}

/*
// Testing
// --- TEMPORARY TEST CODE ---
const history = new NitnemHistory();

const day1 = new DailyLog("2026-08-25");
const japji1 = new Bani("Japji Sahib", "morning");
japji1.markDone();
day1.addBani(japji1);
history.addLog(day1);

const day2 = new DailyLog("2026-08-26");
history.addLog(day2); // no banis added — should NOT count as complete

console.log("Day 1 complete?", day1.isComplete());
console.log("Day 2 complete?", day2.isComplete());
console.log("Current streak:", history.getCurrentStreak());
*/
module.exports = { Bani, DailyLog, NitnemHistory };