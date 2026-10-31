import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createStaffSchema, AppError } from "@brightloop/shared";
import { getDb } from "../../db/pool.js";
import { authenticate, requirePermission } from "../../common/auth.js";

const listUsersQuerySchema = z.object({
  role: z.enum(["admin", "manager", "staff", "customer"]).optional(),
});

const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(["manager", "staff"]).optional(),
});

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", authenticate);

  // List users (Admin or Manager with users.manage)
  fastify.get(
    "/",
    { preHandler: [requirePermission("users.manage")] },
    async (request, reply) => {
      const query = listUsersQuerySchema.parse(request.query);
      const db = await getDb();

      let sql = `
        SELECT u.id, u.email, u.full_name, r.name as role, u.is_active,
               u.updated_at, u.created_at, creator.full_name as created_by_name
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN users creator ON creator.id = u.created_by
        WHERE u.deleted_at IS NULL
      `;
      const params: unknown[] = [];

      if (query.role) {
        params.push(query.role);
        sql += ` AND r.name = $${params.length}`;
      }

      sql += ` ORDER BY u.created_at DESC`;
      const res = await db.query(sql, params);
      return reply.status(200).send({ data: res.rows });
    }
  );

  // Admin provisions new staff or manager
  fastify.post(
    "/",
    { preHandler: [requirePermission("users.manage")] },
    async (request, reply) => {
      const input = createStaffSchema.parse(request.body);
      const db = await getDb();

      // Check duplicate
      const existing = await db.query("SELECT id FROM users WHERE lower(email::text) = lower($1)", [
        input.email,
      ]);
      if (existing.rows.length > 0) {
        throw new AppError({
          code: "CONFLICT",
          message: "A user account with this email address already exists.",
          statusCode: 409,
          fields: { email: ["Email is already registered"] },
        });
      }

      const roleRes = await db.query<{ id: number }>("SELECT id FROM roles WHERE name = $1", [
        input.role,
      ]);
      if (!roleRes.rows[0]) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Invalid role specified",
          statusCode: 422,
        });
      }
      const roleId = roleRes.rows[0].id;

      // Temporary or provided password
      const initialPassword = input.password || "Brightloop@2026!";
      const passwordHash = await bcrypt.hash(initialPassword, 10);
      const adminId = request.user?.id;

      const userRes = await db.query<{ id: number; full_name: string; email: string; created_at: string }>(
        `INSERT INTO users (email, password_hash, full_name, role_id, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, full_name, email, created_at`,
        [input.email, passwordHash, input.fullName, roleId, adminId]
      );
      const newUser = userRes.rows[0];

      return reply.status(201).send({
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            fullName: newUser.full_name,
            role: input.role,
            createdAt: newUser.created_at,
          },
          initialPassword,
          message: "Staff account created successfully.",
        },
      });
    }
  );

  // Update staff status or role
  fastify.patch(
    "/:id",
    { preHandler: [requirePermission("users.manage")] },
    async (request, reply) => {
      const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
      const input = updateUserSchema.parse(request.body);
      const db = await getDb();

      if (input.isActive !== undefined) {
        await db.query("UPDATE users SET is_active = $1 WHERE id = $2", [input.isActive, id]);
      }

      if (input.role) {
        const roleRes = await db.query<{ id: number }>("SELECT id FROM roles WHERE name = $1", [
          input.role,
        ]);
        if (roleRes.rows[0]) {
          await db.query("UPDATE users SET role_id = $1 WHERE id = $2", [roleRes.rows[0].id, id]);
        }
      }

      return reply.status(200).send({ data: { message: "User updated successfully" } });
    }
  );
}
