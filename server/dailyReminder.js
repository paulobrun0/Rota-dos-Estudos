import db from "./db.js";
import { sendToUser } from "./push.js";

// 19:00 in Brazil (UTC-3, no DST currently) — the VPS itself runs in UTC, so
// that's 22:00 here. Late enough that someone who already studied earlier
// today has had the chance to, early enough it's not a 2am ping.
const TARGET_UTC_HOUR = 22;
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const STATE_KEY = "daily_reminder_last_sent_date";

const getState = db.prepare("SELECT value FROM app_state WHERE key = ?");
const setState = db.prepare(`
  INSERT INTO app_state (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
const listSubscribedUsers = db.prepare(`
  SELECT DISTINCT u.id, d.value
  FROM users u
  JOIN push_subscriptions ps ON ps.user_id = u.id
  LEFT JOIN user_data d ON d.user_id = u.id
  WHERE u.is_suspended = 0
`);

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// Only pings someone who has an actual plan set up and genuinely hasn't
// done anything today — this deliberately doesn't try to recompute the
// cycle/rotation (that logic lives client-side in src/lib/planner.js, and
// duplicating it here risks the two drifting apart); `activity` is a
// simple day -> count map already sitting in the stored blob, so checking
// it is enough to know "did they study at all today."
async function sendPendingReminders() {
  const today = todayUTC();
  const rows = listSubscribedUsers.all();
  for (const row of rows) {
    if (!row.value) continue;
    let data;
    try {
      data = JSON.parse(row.value);
    } catch {
      continue;
    }
    const studiedToday = (data.activity?.[today] || 0) > 0;
    const hasAnyPlan = (data.concursos || []).some((c) => (c.materias || []).length > 0);
    if (studiedToday || !hasAnyPlan) continue;
    await sendToUser(row.id, {
      title: "Ainda dá tempo hoje",
      body: "Você ainda não estudou nada hoje — dá uma olhada no seu plano.",
    });
  }
}

export function startDailyReminderSchedule() {
  setInterval(async () => {
    const now = new Date();
    if (now.getUTCHours() !== TARGET_UTC_HOUR) return;
    const today = todayUTC();
    const lastSent = getState.get(STATE_KEY)?.value;
    if (lastSent === today) return;
    setState.run(STATE_KEY, today);
    try {
      await sendPendingReminders();
    } catch (err) {
      console.error("lembrete diário falhou:", err.message);
    }
  }, CHECK_INTERVAL_MS);
}
