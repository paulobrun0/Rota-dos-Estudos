import db from "./db.js";
import { sendToUser } from "./push.js";

// Brazil is UTC-3 (no DST currently) and the VPS itself runs in UTC, so a
// user's local reminder_hour maps to (reminder_hour + 3) % 24 in UTC.
const BRAZIL_UTC_OFFSET = 3;
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

// reminder_last_sent is tracked per-user (on the users row) rather than in a
// single global flag, because each user can now pick their own hour — one
// user's send shouldn't mark the day as "done" for everyone else's.
const listSubscribedUsers = db.prepare(`
  SELECT DISTINCT u.id, u.reminder_hour, u.reminder_last_sent, d.value
  FROM users u
  JOIN push_subscriptions ps ON ps.user_id = u.id
  LEFT JOIN user_data d ON d.user_id = u.id
  WHERE u.is_suspended = 0
`);
const markSent = db.prepare("UPDATE users SET reminder_last_sent = ? WHERE id = ?");

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// Only pings someone who genuinely hasn't done anything today and has an
// actual plan set up — this deliberately doesn't try to recompute the
// cycle/rotation (that logic lives client-side in src/lib/planner.js, and
// duplicating it here risks the two drifting apart); `activity` is a simple
// day -> count map already sitting in the stored blob, so checking it is
// enough to know "did they study at all today."
async function maybeSend(row, today) {
  if (!row.value) return;
  let data;
  try {
    data = JSON.parse(row.value);
  } catch {
    return;
  }
  const studiedToday = (data.activity?.[today] || 0) > 0;
  const hasAnyPlan = (data.concursos || []).some((c) => (c.materias || []).length > 0);
  if (studiedToday || !hasAnyPlan) return;
  await sendToUser(row.id, {
    title: "Ainda dá tempo hoje",
    body: "Você ainda não estudou nada hoje — dá uma olhada no seu plano.",
  });
}

export function startDailyReminderSchedule() {
  setInterval(async () => {
    const nowUtcHour = new Date().getUTCHours();
    const today = todayUTC();
    const rows = listSubscribedUsers.all();
    for (const row of rows) {
      const targetUtcHour = (row.reminder_hour + BRAZIL_UTC_OFFSET) % 24;
      if (nowUtcHour !== targetUtcHour || row.reminder_last_sent === today) continue;
      markSent.run(today, row.id);
      try {
        await maybeSend(row, today);
      } catch (err) {
        console.error("lembrete diário falhou:", err.message);
      }
    }
  }, CHECK_INTERVAL_MS);
}
