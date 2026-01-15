import { getDb } from "./index";
import { isTauriRuntime } from "./runtime";

export interface User {
    id: string;
    username: string;
    role: "admin" | "staff";
    name: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface UserRow {
    id: string;
    username: string;
    password_hash: string;
    role: string;
    name: string;
    is_active: number;
    created_at: string;
    updated_at: string;
}

// Simple SHA-256 hash function using Web Crypto API
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateId(): string {
    return `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function mapRowToUser(row: UserRow): User {
    return {
        id: row.id,
        username: row.username,
        role: row.role as "admin" | "staff",
        name: row.name,
        is_active: row.is_active === 1,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

export const userService = {
    /**
     * Get all users
     */
    async getAll(): Promise<User[]> {
        if (!isTauriRuntime()) {
            return [];
        }

        const db = await getDb();
        const rows = await db.select<UserRow[]>(
            "SELECT id, username, role, name, is_active, created_at, updated_at FROM users ORDER BY created_at DESC"
        );
        return rows.map(mapRowToUser);
    },

    /**
     * Get user by ID
     */
    async getById(id: string): Promise<User | null> {
        if (!isTauriRuntime()) {
            return null;
        }

        const db = await getDb();
        const rows = await db.select<UserRow[]>(
            "SELECT id, username, role, name, is_active, created_at, updated_at FROM users WHERE id = $1",
            [id]
        );
        return rows.length > 0 ? mapRowToUser(rows[0]) : null;
    },

    /**
     * Get user by username
     */
    async getByUsername(username: string): Promise<User | null> {
        if (!isTauriRuntime()) {
            return null;
        }

        const db = await getDb();
        const rows = await db.select<UserRow[]>(
            "SELECT id, username, role, name, is_active, created_at, updated_at FROM users WHERE username = $1",
            [username]
        );
        return rows.length > 0 ? mapRowToUser(rows[0]) : null;
    },

    /**
     * Create a new user
     */
    async create(data: {
        username: string;
        password: string;
        role: "admin" | "staff";
        name: string;
    }): Promise<User> {
        if (!isTauriRuntime()) {
            throw new Error("User management requires desktop app");
        }

        const db = await getDb();
        const id = generateId();
        const passwordHash = await hashPassword(data.password);

        await db.execute(
            `INSERT INTO users (id, username, password_hash, role, name) VALUES ($1, $2, $3, $4, $5)`,
            [id, data.username, passwordHash, data.role, data.name]
        );

        const user = await this.getById(id);
        if (!user) throw new Error("Failed to create user");
        return user;
    },

    /**
     * Update user details (not password)
     */
    async update(
        id: string,
        data: { username?: string; role?: "admin" | "staff"; name?: string; is_active?: boolean }
    ): Promise<User> {
        if (!isTauriRuntime()) {
            throw new Error("User management requires desktop app");
        }

        const db = await getDb();
        const updates: string[] = [];
        const values: (string | number)[] = [];
        let paramIndex = 1;

        if (data.username !== undefined) {
            updates.push(`username = $${paramIndex++}`);
            values.push(data.username);
        }
        if (data.role !== undefined) {
            updates.push(`role = $${paramIndex++}`);
            values.push(data.role);
        }
        if (data.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name);
        }
        if (data.is_active !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            values.push(data.is_active ? 1 : 0);
        }

        if (updates.length === 0) {
            const user = await this.getById(id);
            if (!user) throw new Error("User not found");
            return user;
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        await db.execute(
            `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
            values
        );

        const user = await this.getById(id);
        if (!user) throw new Error("User not found");
        return user;
    },

    /**
     * Change user password
     */
    async changePassword(id: string, newPassword: string): Promise<void> {
        if (!isTauriRuntime()) {
            throw new Error("User management requires desktop app");
        }

        const db = await getDb();
        const passwordHash = await hashPassword(newPassword);

        await db.execute(
            `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [passwordHash, id]
        );
    },

    /**
     * Delete a user
     */
    async delete(id: string): Promise<void> {
        if (!isTauriRuntime()) {
            throw new Error("User management requires desktop app");
        }

        const db = await getDb();
        await db.execute("DELETE FROM users WHERE id = $1", [id]);
    },

    /**
     * Validate login credentials
     * Returns user if valid, null otherwise
     */
    async validateLogin(username: string, password: string): Promise<User | null> {
        if (!isTauriRuntime()) {
            // Fallback for non-Tauri environment (dev mode)
            if (username === "admin" && password === "admin") {
                return {
                    id: "dev-admin",
                    username: "admin",
                    role: "admin",
                    name: "Admin (Dev)",
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
            }
            if (username === "staff" && password === "staff") {
                return {
                    id: "dev-staff",
                    username: "staff",
                    role: "staff",
                    name: "Staff (Dev)",
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
            }
            return null;
        }

        const db = await getDb();
        const passwordHash = await hashPassword(password);

        const rows = await db.select<UserRow[]>(
            "SELECT id, username, role, name, is_active, created_at, updated_at FROM users WHERE username = $1 AND password_hash = $2 AND is_active = 1",
            [username, passwordHash]
        );

        return rows.length > 0 ? mapRowToUser(rows[0]) : null;
    },

    /**
     * Check if a username already exists
     */
    async usernameExists(username: string, excludeId?: string): Promise<boolean> {
        if (!isTauriRuntime()) {
            return false;
        }

        const db = await getDb();
        let query = "SELECT COUNT(*) as count FROM users WHERE username = $1";
        const params: string[] = [username];

        if (excludeId) {
            query += " AND id != $2";
            params.push(excludeId);
        }

        const result = await db.select<{ count: number }[]>(query, params);
        return result[0].count > 0;
    },

    /**
     * Get count of admin users
     */
    async getAdminCount(): Promise<number> {
        if (!isTauriRuntime()) {
            return 1;
        }

        const db = await getDb();
        const result = await db.select<{ count: number }[]>(
            "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1"
        );
        return result[0].count;
    },
};
