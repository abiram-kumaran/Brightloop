import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getDb } from "../../db/pool.js";
import { authenticate, requirePermission } from "../../common/auth.js";
import {
  createProductSchema,
  createPlanSchema,
  createTaxRuleSchema,
  createDiscountRuleSchema,
  AppError,
  toPaise,
} from "@brightloop/shared";

export async function catalogRoutes(app: FastifyInstance) {
  /* =======================================================================
   * PRODUCTS & VARIANTS
   * ======================================================================= */

  // List all products with their variants
  app.get("/products", async (request: FastifyRequest, reply: FastifyReply) => {
    const db = await getDb();
    const query = request.query as { status?: string; search?: string };

    let sql = `
      SELECT p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', v.id,
              'name', concat(v.attribute, ': ', v.value),
              'attribute', v.attribute,
              'value', v.value,
              'priceAdjustment', v.extra_price_paise,
              'status', 'active'
            )
          ) FILTER (WHERE v.id IS NOT NULL), '[]'
        ) as variants
      FROM products p
      LEFT JOIN product_variants v ON p.id = v.product_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (query.status) {
      params.push(query.status);
      sql += ` AND p.status = $${params.length}`;
    }

    if (query.search) {
      params.push(`%${query.search}%`);
      sql += ` AND p.name ILIKE $${params.length}`;
    }

    sql += ` GROUP BY p.id ORDER BY p.id ASC`;

    const res = await db.query(sql, params);
    return reply.status(200).send({
      data: res.rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        salesPrice: Number(row.sales_price_paise),
        costPrice: Number(row.cost_price_paise),
        notes: row.notes,
        isActive: row.is_active,
        variants: row.variants,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  });

  // Get product by ID
  app.get("/products/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = await getDb();
    const productId = parseInt(request.params.id, 10);

    const res = await db.query(
      `SELECT p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', v.id,
              'name', concat(v.attribute, ': ', v.value),
              'attribute', v.attribute,
              'value', v.value,
              'priceAdjustment', v.extra_price_paise,
              'status', 'active'
            )
          ) FILTER (WHERE v.id IS NOT NULL), '[]'
        ) as variants
      FROM products p
      LEFT JOIN product_variants v ON p.id = v.product_id
      WHERE p.id = $1
      GROUP BY p.id`,
      [productId]
    );

    if (res.rows.length === 0) {
      throw new AppError("NOT_FOUND", "Product not found");
    }

    const row = res.rows[0];
    return reply.status(200).send({
      data: {
        id: row.id,
        name: row.name,
        type: row.type,
        salesPrice: Number(row.sales_price_paise),
        costPrice: Number(row.cost_price_paise),
        notes: row.notes,
        isActive: row.is_active,
        variants: row.variants,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  });

  // Create Product (Admin or Staff with catalog:write)
  app.post(
    "/products",
    { preHandler: [authenticate, requirePermission("catalog:write")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const db = await getDb();
      const body = createProductSchema.parse(request.body);
      const user = request.user!;

      const salesPricePaise = toPaise(body.salesPrice);
      const costPricePaise = toPaise(body.costPrice);

      const res = await db.withTransaction(async (client) => {
        const prodRes = await client.query(
          `INSERT INTO products (name, type, sales_price_paise, cost_price_paise, notes, is_active)
           VALUES ($1, $2, $3, $4, $5, true)
           RETURNING *`,
          [body.name, body.type, salesPricePaise, costPricePaise, body.notes || null]
        );
        const newProduct = prodRes.rows[0];

        // Insert variants if supplied
        const createdVariants: unknown[] = [];
        if (body.variants && body.variants.length > 0) {
          for (const v of body.variants) {
            const adjPaise = toPaise(v.priceAdjustment);
            const varRes = await client.query(
              `INSERT INTO product_variants (product_id, attribute, value, extra_price_paise)
               VALUES ($1, $2, $3, $4)
               RETURNING *`,
              [newProduct.id, v.attribute || "Standard", v.value || v.name, adjPaise]
            );
            createdVariants.push({
              id: varRes.rows[0].id,
              name: `${varRes.rows[0].attribute}: ${varRes.rows[0].value}`,
              attribute: varRes.rows[0].attribute,
              value: varRes.rows[0].value,
              priceAdjustment: Number(varRes.rows[0].extra_price_paise),
            });
          }
        }

        return {
          id: newProduct.id,
          name: newProduct.name,
          type: newProduct.type,
          salesPrice: Number(newProduct.sales_price_paise),
          costPrice: Number(newProduct.cost_price_paise),
          notes: newProduct.notes,
          isActive: newProduct.is_active,
          variants: createdVariants,
          createdAt: newProduct.created_at,
        };
      });

      return reply.status(201).send({ data: res });
    }
  );

  // Update Product
  app.put(
    "/products/:id",
    { preHandler: [authenticate, requirePermission("catalog:write")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const db = await getDb();
      const productId = parseInt(request.params.id, 10);
      const body = createProductSchema.partial().parse(request.body);

      const updates: string[] = [];
      const values: unknown[] = [];

      if (body.name !== undefined) {
        values.push(body.name);
        updates.push(`name = $${values.length}`);
      }
      if (body.type !== undefined) {
        values.push(body.type);
        updates.push(`type = $${values.length}`);
      }
      if (body.salesPrice !== undefined) {
        values.push(toPaise(body.salesPrice));
        updates.push(`sales_price = $${values.length}`);
      }
      if (body.costPrice !== undefined) {
        values.push(toPaise(body.costPrice));
        updates.push(`cost_price = $${values.length}`);
      }
      if (body.notes !== undefined) {
        values.push(body.notes);
        updates.push(`notes = $${values.length}`);
      }

      if (updates.length === 0) {
        return reply.status(200).send({ data: { message: "No updates provided" } });
      }

      values.push(productId);
      const sql = `UPDATE products SET ${updates.join(", ")}, updated_at = now() WHERE id = $${values.length} RETURNING *`;
      const res = await db.query(sql, values);

      if (res.rows.length === 0) {
        throw new AppError("NOT_FOUND", "Product not found");
      }

      return reply.status(200).send({ data: res.rows[0] });
    }
  );

  // Add Variant to Product
  app.post(
    "/products/:id/variants",
    { preHandler: [authenticate, requirePermission("catalog:write")] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const db = await getDb();
      const productId = parseInt(request.params.id, 10);
      const schema = z.object({
        name: z.string().min(1),
        attribute: z.string().default("Edition"),
        value: z.string().min(1),
        priceAdjustment: z.number().default(0),
      });
      const body = schema.parse(request.body);
      const adjPaise = toPaise(body.priceAdjustment);

      const res = await db.query(
        `INSERT INTO product_variants (product_id, attribute, value, extra_price_paise)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [productId, body.attribute, body.value, adjPaise]
      );

      return reply.status(201).send({
        data: {
          id: res.rows[0].id,
          name: `${res.rows[0].attribute}: ${res.rows[0].value}`,
          attribute: res.rows[0].attribute,
          value: res.rows[0].value,
          priceAdjustment: Number(res.rows[0].extra_price_paise),
        },
      });
    }
  );

  /* =======================================================================
   * SUBSCRIPTION PLANS & LIFECYCLE RULES
   * ======================================================================= */

  // List all plans
  app.get("/plans", async (request: FastifyRequest, reply: FastifyReply) => {
    const db = await getDb();
    const query = request.query as { status?: string };

    let sql = `
      SELECT p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'productId', pp.product_id,
              'productName', pr.name,
              'defaultQuantity', pp.default_quantity
            )
          ) FILTER (WHERE pp.product_id IS NOT NULL), '[]'
        ) as products
      FROM plans p
      LEFT JOIN plan_products pp ON p.id = pp.plan_id
      LEFT JOIN products pr ON pp.product_id = pr.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (query.status) {
      params.push(query.status);
      sql += ` AND p.status = $${params.length}`;
    }

    sql += ` GROUP BY p.id ORDER BY p.id ASC`;

    const res = await db.query(sql, params);
    return reply.status(200).send({
      data: res.rows.map((row) => ({
        id: row.id,
        name: row.name,
        pricePaise: Number(row.price_paise),
        billingFrequency: row.billing_period,
        billingIntervalInteger: row.billing_interval,
        minQuantity: row.min_quantity,
        availableFrom: row.available_from,
        availableUntil: row.available_to,
        autoClose: row.auto_close,
        allowEarlyClose: row.closable,
        allowPause: row.pausable,
        allowRenewal: row.renewable,
        isActive: row.is_active,
        products: row.products,
      })),
    });
  });

  // Get Plan by ID
  app.get("/plans/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = await getDb();
    const planId = parseInt(request.params.id, 10);

    const res = await db.query(
      `SELECT p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'productId', pp.product_id,
              'productName', pr.name,
              'salesPrice', pr.sales_price,
              'defaultQuantity', pp.default_quantity
            )
          ) FILTER (WHERE pp.product_id IS NOT NULL), '[]'
        ) as products
      FROM plans p
      LEFT JOIN plan_products pp ON p.id = pp.plan_id
      LEFT JOIN products pr ON pp.product_id = pr.id
      WHERE p.id = $1
      GROUP BY p.id`,
      [planId]
    );

    if (res.rows.length === 0) {
      throw new AppError("NOT_FOUND", "Plan not found");
    }

    const row = res.rows[0];
    return reply.status(200).send({
      data: {
        id: row.id,
        name: row.name,
        pricePaise: Number(row.price_paise),
        billingFrequency: row.billing_period,
        billingIntervalInteger: row.billing_interval,
        minQuantity: row.min_quantity,
        availableFrom: row.available_from,
        availableUntil: row.available_to,
        autoClose: row.auto_close,
        allowEarlyClose: row.closable,
        allowPause: row.pausable,
        allowRenewal: row.renewable,
        isActive: row.is_active,
        products: row.products,
      },
    });
  });

  // Create Plan
  app.post(
    "/plans",
    { preHandler: [authenticate, requirePermission("plans:write")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const db = await getDb();
      const body = createPlanSchema.parse(request.body);

      const res = await db.withTransaction(async (client) => {
        const availFrom = body.availableFrom || new Date().toISOString().slice(0, 10);
        const planRes = await client.query(
          `INSERT INTO plans (
            name, price_paise, billing_period, billing_interval,
            min_quantity, available_from, available_to,
            auto_close, closable, pausable, renewable, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
          RETURNING *`,
          [
            body.name,
            0,
            body.billingFrequency,
            body.billingIntervalInteger,
            body.minQuantity,
            availFrom,
            body.availableUntil || null,
            body.autoClose,
            body.allowEarlyClose,
            body.allowPause,
            body.allowRenewal,
          ]
        );
        const newPlan = planRes.rows[0];

        // Insert products into plan_products
        if (body.productIds && body.productIds.length > 0) {
          for (const pid of body.productIds) {
            await client.query(
              `INSERT INTO plan_products (plan_id, product_id, default_quantity)
               VALUES ($1, $2, 1)
               ON CONFLICT (plan_id, product_id) DO NOTHING`,
              [newPlan.id, pid]
            );
          }
        }

        return newPlan;
      });

      return reply.status(201).send({ data: res });
    }
  );

  /* =======================================================================
   * TAX RULES (e.g. GST 18%, VAT 5%)
   * ======================================================================= */

  app.get("/taxes", async (_req: FastifyRequest, reply: FastifyReply) => {
    const db = await getDb();
    const res = await db.query(
      `SELECT id, name, rate_percent as "ratePercent", is_active as "isActive", created_at as "createdAt"
       FROM tax_rules ORDER BY id ASC`
    );
    return reply.status(200).send({ data: res.rows });
  });

  app.post(
    "/taxes",
    { preHandler: [authenticate, requirePermission("tax:manage")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const db = await getDb();
      const body = createTaxRuleSchema.parse(request.body);

      const res = await db.query(
        `INSERT INTO tax_rules (name, rate_percent, is_active)
         VALUES ($1, $2, $3)
         RETURNING id, name, rate_percent as "ratePercent", is_active as "isActive"`,
        [body.name, body.ratePercent, body.isActive ?? true]
      );
      return reply.status(201).send({ data: res.rows[0] });
    }
  );

  /* =======================================================================
   * DISCOUNT RULES
   * ======================================================================= */

  app.get("/discounts", async (_req: FastifyRequest, reply: FastifyReply) => {
    const db = await getDb();
    const res = await db.query(
      `SELECT id, name, type, value, scope as "discountScope",
              min_purchase_paise as "minAmount", is_active as "isActive",
              start_date as "validFrom", end_date as "validUntil"
       FROM discounts ORDER BY id ASC`
    );
    return reply.status(200).send({ data: res.rows });
  });

  app.post(
    "/discounts",
    { preHandler: [authenticate, requirePermission("discounts:manage")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const db = await getDb();
      const body = createDiscountRuleSchema.parse(request.body);
      const val = body.type === "fixed" ? toPaise(body.value) : body.value;
      const minAmt = body.minAmount ? toPaise(body.minAmount) : 0;

      const today = new Date().toISOString().slice(0, 10);
      const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
      const res = await db.query(
        `INSERT INTO discounts (
           name, type, value, scope, min_purchase_paise, start_date, end_date, is_active, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, name, type, value, scope as "discountScope", is_active as "isActive"`,
        [
          body.name,
          body.type,
          val,
          body.discountScope,
          minAmt,
          body.validFrom || today,
          body.validUntil || nextYear,
          body.isActive ?? true,
          request.user!.id,
        ]
      );
      return reply.status(201).send({ data: { ...res.rows[0], code: body.code } });
    }
  );

  /* =======================================================================
   * QUOTATION TEMPLATES
   * ======================================================================= */

  app.get("/templates", async (_req: FastifyRequest, reply: FastifyReply) => {
    const db = await getDb();
    const res = await db.query(
      `SELECT qt.id, qt.name, qt.validity_days as "validityDays", qt.notes, qt.is_active as "isActive",
              COALESCE(
                json_agg(
                  json_build_object(
                    'productId', qtl.product_id,
                    'productName', p.name,
                    'variantId', qtl.variant_id,
                    'quantity', qtl.quantity
                  )
                ) FILTER (WHERE qtl.id IS NOT NULL), '[]'
              ) as lines
       FROM quotation_templates qt
       LEFT JOIN quotation_template_lines qtl ON qt.id = qtl.quotation_template_id
       LEFT JOIN products p ON qtl.product_id = p.id
       GROUP BY qt.id
       ORDER BY qt.id ASC`
    );
    return reply.status(200).send({ data: res.rows });
  });

  app.post(
    "/templates",
    { preHandler: [authenticate, requirePermission("templates:write")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const db = await getDb();
      const schema = z.object({
        name: z.string().min(1),
        validityDays: z.number().int().min(1).default(30),
        notes: z.string().optional(),
        lines: z.array(
          z.object({
            productId: z.number().int(),
            variantId: z.number().int().optional().nullable(),
            quantity: z.number().int().min(1).default(1),
          })
        ),
      });
      const body = schema.parse(request.body);

      const res = await db.withTransaction(async (client) => {
        const tmplRes = await client.query(
          `INSERT INTO quotation_templates (name, validity_days, notes, is_active)
           VALUES ($1, $2, $3, true)
           RETURNING *`,
          [body.name, body.validityDays, body.notes || null]
        );
        const template = tmplRes.rows[0];

        for (const line of body.lines) {
          await client.query(
            `INSERT INTO quotation_template_lines (quotation_template_id, product_id, variant_id, quantity)
             VALUES ($1, $2, $3, $4)`,
            [template.id, line.productId, line.variantId || null, line.quantity]
          );
        }

        return template;
      });

      return reply.status(201).send({ data: res });
    }
  );
}
