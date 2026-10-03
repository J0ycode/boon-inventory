"use server";

import { getNotificationSummary, type NotificationSummary } from "./queries";

/** Polled by the notification bell. */
export async function fetchNotifications(): Promise<NotificationSummary> {
  return getNotificationSummary();
}
