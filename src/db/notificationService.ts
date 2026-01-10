import { v4 as uuidv4 } from "uuid";
import { InboxNotification, ReportIntent } from "../types/notifications";

const STORAGE_KEY = "motormods_inbox_v1";
const LAST_KEYS = {
  daily: "motormods_inbox_last_daily_v1",
  weekly: "motormods_inbox_last_weekly_v1",
  monthly: "motormods_inbox_last_monthly_v1",
} as const;

const loadAll = (): InboxNotification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InboxNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveAll = (items: InboxNotification[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const startOfWeek = (d: Date) => {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day; // Monday
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const endOfWeek = (d: Date) => {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return e;
};

const startOfMonth = (d: Date) => {
  const copy = new Date(d);
  copy.setDate(1);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const endOfMonth = (d: Date) => {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + 1, 0);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const pushNotification = (title: string, message: string, intent?: ReportIntent) => {
  const current = loadAll();
  current.unshift({
    id: uuidv4(),
    title,
    message,
    created_at: new Date().toISOString(),
    read: false,
    intent,
  });
  saveAll(current);
};

export const notificationService = {
  getAll(): InboxNotification[] {
    return loadAll();
  },

  getUnreadCount(): number {
    return loadAll().filter((n) => !n.read).length;
  },

  markRead(id: string) {
    const current = loadAll();
    const idx = current.findIndex((n) => n.id === id);
    if (idx < 0) return;
    current[idx] = { ...current[idx], read: true };
    saveAll(current);
  },

  markAllRead() {
    const current = loadAll().map((n) => ({ ...n, read: true }));
    saveAll(current);
  },

  clearAll() {
    saveAll([]);
  },

  // Creates notifications when a new period starts, meaning the previous period's report
  // is ready to download. Runs fast and offline (localStorage only).
  checkAndQueuePeriodNotifications(now: Date = new Date()) {
    const todayKey = isoDate(now);

    // Daily: notify once per day (for yesterday)
    const lastDaily = localStorage.getItem(LAST_KEYS.daily);
    if (lastDaily !== todayKey) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const from = isoDate(yesterday);
      const to = isoDate(yesterday);
      pushNotification(
        "Daily report ready",
        `Daily sales report is ready for ${from}.`,
        { report: "daily-sales", from, to }
      );
      localStorage.setItem(LAST_KEYS.daily, todayKey);
    }

    // Weekly: notify once per new week (for last week)
    const thisWeekStart = startOfWeek(now);
    const thisWeekKey = isoDate(thisWeekStart);
    const lastWeekly = localStorage.getItem(LAST_KEYS.weekly);
    if (lastWeekly !== thisWeekKey) {
      const lastWeek = new Date(thisWeekStart);
      lastWeek.setDate(lastWeek.getDate() - 1);
      const from = isoDate(startOfWeek(lastWeek));
      const to = isoDate(endOfWeek(lastWeek));
      pushNotification(
        "Weekly report ready",
        `Weekly sales report is ready (${from} to ${to}).`,
        { report: "daily-sales", from, to }
      );
      localStorage.setItem(LAST_KEYS.weekly, thisWeekKey);
    }

    // Monthly: notify once per new month (for last month)
    const thisMonthStart = startOfMonth(now);
    const thisMonthKey = isoDate(thisMonthStart);
    const lastMonthly = localStorage.getItem(LAST_KEYS.monthly);
    if (lastMonthly !== thisMonthKey) {
      const lastMonthEnd = new Date(thisMonthStart);
      lastMonthEnd.setDate(0);
      const from = isoDate(startOfMonth(lastMonthEnd));
      const to = isoDate(endOfMonth(lastMonthEnd));
      pushNotification(
        "Monthly report ready",
        `Monthly sales report is ready (${from} to ${to}).`,
        { report: "daily-sales", from, to }
      );
      localStorage.setItem(LAST_KEYS.monthly, thisMonthKey);
    }
  },
};
