import webpush from "web-push";
import { db } from "./db";
import { pushSubscriptions, users } from "@shared/schema";
import { eq, inArray, ne } from "drizzle-orm";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:safeexit@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export async function savePushSubscription(userId: number, endpoint: string, p256dh: string, auth: string) {
  console.log(`[PUSH] Saving subscription for userId=${userId}, endpoint=${endpoint.substring(0, 60)}...`);
  const existing = await db.select().from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
  if (existing.length > 0) {
    await db.update(pushSubscriptions)
      .set({ userId, p256dh, auth })
      .where(eq(pushSubscriptions.endpoint, endpoint));
    console.log(`[PUSH] Updated existing subscription for userId=${userId}`);
    return existing[0];
  }
  const [sub] = await db.insert(pushSubscriptions).values({ userId, endpoint, p256dh, auth }).returning();
  console.log(`[PUSH] Created new subscription id=${sub.id} for userId=${userId}`);
  return sub;
}

export async function removePushSubscription(endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function sendPushToUser(userId: number, payload: { title: string; body: string; tag?: string; data?: any }) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  console.log(`[PUSH] Sending to userId=${userId}, found ${subs.length} subscription(s)`);
  const jsonPayload = JSON.stringify(payload);
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        jsonPayload
      );
      console.log(`[PUSH] Sent OK to sub ${sub.id}`);
    } catch (err: any) {
      console.error(`[PUSH] Failed to send to sub ${sub.id}: ${err.statusCode || err.message}`);
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }
}

export async function sendPushToUsers(userIds: number[], payload: { title: string; body: string; tag?: string; data?: any }) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || userIds.length === 0) return;
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  const jsonPayload = JSON.stringify(payload);
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        jsonPayload
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }
}

export async function sendPushToAllNonAdmin(payload: { title: string; body: string; tag?: string; data?: any }) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  const nonAdminUsers = await db.select({ id: users.id }).from(users).where(ne(users.role, "admin"));
  const nonAdminIds = nonAdminUsers.map(u => u.id);
  if (nonAdminIds.length === 0) return;
  const allSubs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, nonAdminIds));
  const jsonPayload = JSON.stringify(payload);
  for (const sub of allSubs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        jsonPayload
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }
}
