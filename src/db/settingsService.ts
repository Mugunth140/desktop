import { AppSettings } from "../types";
import { getDb } from "./index";
import { isTauriRuntime } from "./runtime";

const SETTINGS_KEY = "motormods_settings_v1";

const defaultSettings: AppSettings = {
    low_stock_method: 'reorder_level',
    low_stock_percentage: 20,
    low_stock_days_supply: 15,
    non_moving_threshold_days: 120,
    auto_backup_enabled: true,
    auto_backup_time: '23:00',
    backup_retention_days: 30,
};

const loadSettings = (): Partial<AppSettings> => {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as Partial<AppSettings>;
    } catch {
        return {};
    }
};

const saveSettings = (settings: Partial<AppSettings>) => {
    const existing = loadSettings();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...existing, ...settings }));
};

export const settingsService = {
    async get<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
        if (!isTauriRuntime()) {
            const settings = loadSettings();
            return settings[key] ?? defaultSettings[key];
        }

        const db = await getDb();
        const result = await db.select<{ value: string }[]>(
            "SELECT value FROM settings WHERE key = $1",
            [key]
        );

        if (result.length === 0) {
            return defaultSettings[key];
        }

        const rawValue = result[0].value;

        // Parse based on expected type
        if (typeof defaultSettings[key] === 'boolean') {
            return (rawValue === '1' || rawValue === 'true') as AppSettings[K];
        }
        if (typeof defaultSettings[key] === 'number') {
            return Number(rawValue) as AppSettings[K];
        }
        return rawValue as AppSettings[K];
    },

    async set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
        if (!isTauriRuntime()) {
            saveSettings({ [key]: value });
            return;
        }

        const db = await getDb();
        const stringValue = typeof value === 'boolean'
            ? (value ? '1' : '0')
            : String(value);


        await db.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)",
            [key, stringValue]
        );
    },

    async getAll(): Promise<AppSettings> {
        if (!isTauriRuntime()) {
            const stored = loadSettings();
            return { ...defaultSettings, ...stored };
        }

        const db = await getDb();
        const rows = await db.select<{ key: string; value: string }[]>(
            "SELECT key, value FROM settings"
        );

        const settings: Partial<AppSettings> = {};
        for (const row of rows) {
            const key = row.key as keyof AppSettings;
            if (key in defaultSettings) {
                if (typeof defaultSettings[key] === 'boolean') {
                    (settings as Record<string, unknown>)[key] = row.value === '1' || row.value === 'true';
                } else if (typeof defaultSettings[key] === 'number') {
                    (settings as Record<string, unknown>)[key] = Number(row.value);
                } else {
                    (settings as Record<string, unknown>)[key] = row.value;
                }
            }
        }

        return { ...defaultSettings, ...settings };
    },

    async setMultiple(updates: Partial<AppSettings>): Promise<void> {
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
                await this.set(key as keyof AppSettings, value as AppSettings[keyof AppSettings]);
            }
        }
    },

    getDefaults(): AppSettings {
        return { ...defaultSettings };
    },
};
