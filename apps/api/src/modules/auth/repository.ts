import { getDb } from "../../db/pool.js";
import { UserRole } from "@brightloop/shared";

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  role_id: number;
  role_name: UserRole;
  is_active: boolean;
  failed_login_count: number;
  locked_until: Date | null;
  customer_id: number | null;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const db = await getDb();
  const res = await db.query<UserRow>(
    `SELECT u.id, u.email, u.password_hash, u.full_name, u.role_id, r.name as role_name,
            u.is_active, u.failed_login_count, u.locked_until, c.id as customer_id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN customers c ON c.user_id = u.id AND c.deleted_at IS NULL
     WHERE lower(u.email::text) = lower($1) AND u.deleted_at IS NULL`,
    [email]
  );
  return res.rows[0] ?? null;
}

export async function findUserById(userId: number): Promise<UserRow | null> {
  const db = await getDb();
  const res = await db.query<UserRow>(
    `SELECT u.id, u.email, u.password_hash, u.full_name, u.role_id, r.name as role_name,
            u.is_active, u.failed_login_count, u.locked_until, c.id as customer_id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN customers c ON c.user_id = u.id AND c.deleted_at IS NULL
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId]
  );
  return res.rows[0] ?? null;
}

export async function getUserPermissions(userId: number, roleId: number): Promise<string[]> {
  const db = await getDb();
  const res = await db.query<{ code: string }>(
    `SELECT DISTINCT p.code
     FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id = $1`,
    [roleId]
  );
  return res.rows.map((r) => r.code);
}

export async function getRoleIdByName(roleName: UserRole): Promise<number> {
  const db = await getDb();
  const res = await db.query<{ id: number }>(
    "SELECT id FROM roles WHERE name = $1",
    [roleName]
  );
  if (!res.rows[0]) throw new Error(`Role not found: ${roleName}`);
  return res.rows[0].id;
}

export async function createUserWithCustomer(params: {
  email: string;
  passwordHash: string;
  fullName: string;
  roleId: number;
  companyName: string;
  stateCode?: string;
}): Promise<{ userId: number; customerId: number }> {
  const db = await getDb();
  return await db.withTransaction(async (client) => {
    const userRes = await client.query<{ id: number }>(
      `INSERT INTO users (email, password_hash, full_name, role_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [params.email, params.passwordHash, params.fullName, params.roleId]
    );
    const userId = userRes.rows[0].id;

    const customerRes = await client.query<{ id: number }>(
      `INSERT INTO customers (user_id, company_name, contact_name, contact_email, state_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        userId,
        params.companyName,
        params.fullName,
        params.email,
        params.stateCode || "33",
      ]
    );
    const customerId = customerRes.rows[0].id;

    return { userId, customerId };
  });
}

export async function updateLoginAttempt(
  userId: number,
  success: boolean,
  lockoutThreshold = 5
): Promise<void> {
  const db = await getDb();
  if (success) {
    await db.query(
      `UPDATE users
       SET failed_login_count = 0, locked_until = NULL, updated_at = now()
       WHERE id = $1`,
      [userId]
    );
  } else {
    await db.query(
      `UPDATE users
       SET failed_login_count = failed_login_count + 1,
           locked_until = CASE
             WHEN failed_login_count + 1 >= $2 THEN now() + interval '15 minutes'
             ELSE NULL
           END
       WHERE id = $1`,
      [userId, lockoutThreshold]
    );
  }
}

export async function savePasswordResetToken(
  userId: number,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

export async function findPasswordResetToken(tokenHash: string): Promise<{
  id: number;
  user_id: number;
  expires_at: Date;
  used_at: Date | null;
} | null> {
  const db = await getDb();
  const res = await db.query<{
    id: number;
    user_id: number;
    expires_at: Date;
    used_at: Date | null;
  }>(
    `SELECT id, user_id, expires_at, used_at
     FROM password_reset_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );
  return res.rows[0] ?? null;
}

export async function resetUserPassword(
  userId: number,
  tokenId: number,
  newPasswordHash: string
): Promise<void> {
  const db = await getDb();
  await db.withTransaction(async (client) => {
    await client.query(
      "UPDATE users SET password_hash = $1, failed_login_count = 0, locked_until = NULL WHERE id = $2",
      [newPasswordHash, userId]
    );
    await client.query(
      "UPDATE password_reset_tokens SET used_at = now() WHERE id = $1",
      [tokenId]
    );
  });
}
