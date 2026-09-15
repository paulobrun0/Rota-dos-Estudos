import webpush from "web-push";
import db from "./db.js";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const configured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (configured) {
  webpush.setVapidDetails("mailto:paulo.bruno82@gmail.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export const isPushConfigured = () => configured;
export const vapidPublicKey = () => VAPID_PUBLIC_KEY;

const upsertSubscription = db.prepare(`
  INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
  ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
`);
const deleteSubscription = db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?");
const listSubscriptionsForUser = db.prepare("SELECT * FROM push_subscriptions WHERE user_id = ?");
const deleteSubscriptionByEndpoint = db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?");

export function saveSubscription(userId, subscription) {
  upsertSubscription.run(userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
}

export function removeSubscription(userId, endpoint) {
  deleteSubscription.run(endpoint, userId);
}

// Sends to every device this user is subscribed on. A 404/410 back from the
// push service means that endpoint is gone for good (uninstalled, browser
// data cleared) — cleaned up here rather than left to fail forever.
export async function sendToUser(userId, payload) {
  if (!configured) return;
  const subs = listSubscriptionsForUser.all(userId);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          deleteSubscriptionByEndpoint.run(sub.endpoint);
        } else {
          console.error("push falhou para", sub.endpoint, ":", err.message);
        }
      }
    }),
  );
}
