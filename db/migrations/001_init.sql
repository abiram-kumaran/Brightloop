-- =============================================================================
-- 001_init.sql  |  Brightloop Subscription Management System  |  PostgreSQL 14+
-- Applied by the migration runner inside ONE transaction (do not add BEGIN/COMMIT).
-- Money = BIGINT paise (INR minor units). Dates that mean "a day" = DATE, not timestamptz.
-- Normalised to 3NF. Deliberate denormalisation is marked "DENORM" with the reason.
-- See docs/03-database-design.md for the ER overview and the rationale per table.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS citext;

-- ---------- ENUMS -------------------------------------------------------------
CREATE TYPE product_type        AS ENUM ('service','software','addon','physical');
CREATE TYPE billing_period      AS ENUM ('daily','weekly','monthly','yearly');
CREATE TYPE discount_type       AS ENUM ('fixed','percentage');
CREATE TYPE discount_scope      AS ENUM ('product','subscription');
CREATE TYPE subscription_status AS ENUM ('draft','quotation','confirmed','active','paused','closed');
CREATE TYPE invoice_status      AS ENUM ('draft','confirmed','paid','cancelled');
CREATE TYPE payment_method      AS ENUM ('cash','bank_transfer','upi','card','cheque','other');
CREATE TYPE payment_status      AS ENUM ('posted','reversed');
CREATE TYPE credit_note_status  AS ENUM ('draft','submitted','approved','rejected','applied');
CREATE TYPE change_type         AS ENUM ('plan_change','quantity_change','pause','resume','close');
CREATE TYPE change_status       AS ENUM ('pending','applied','cancelled');
CREATE TYPE sub_event_type      AS ENUM ('created','activated','upgraded','downgraded','quantity_changed',
                                         'paused','resumed','renewed','closed');
CREATE TYPE run_status          AS ENUM ('running','completed','partial','failed');
CREATE TYPE outbox_status       AS ENUM ('pending','sent','failed');
CREATE TYPE ticket_status       AS ENUM ('open','pending','resolved','closed');
CREATE TYPE ticket_priority     AS ENUM ('low','normal','high');
CREATE TYPE ticket_source       AS ENUM ('chat','portal','staff');
CREATE TYPE author_type         AS ENUM ('customer','staff','bot');
CREATE TYPE chat_role           AS ENUM ('user','assistant','system');

-- ---------- COMMON TRIGGER ----------------------------------------------------
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- RBAC --------------------------------------------------------------
CREATE TABLE roles (
  id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        VARCHAR(30) NOT NULL UNIQUE,
  description TEXT        NOT NULL
);

CREATE TABLE permissions (
  id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        VARCHAR(60) NOT NULL UNIQUE,
  description TEXT        NOT NULL
);

-- many-to-many join table
CREATE TABLE role_permissions (
  role_id       SMALLINT NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
  permission_id SMALLINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ---------- IDENTITY ----------------------------------------------------------
CREATE TABLE users (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email              CITEXT       NOT NULL UNIQUE,              -- one account per email (PS rule)
  password_hash      TEXT         NOT NULL,
  full_name          VARCHAR(120) NOT NULL,
  role_id            SMALLINT     NOT NULL REFERENCES roles(id),
  is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
  failed_login_count INTEGER      NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until       TIMESTAMPTZ,
  created_by         BIGINT       REFERENCES users(id),        -- who created this staff user (admin)
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ,
  CONSTRAINT users_email_format CHECK (email::text ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);
CREATE INDEX idx_users_role ON users(role_id);

CREATE TABLE refresh_tokens (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,                     -- sha256 of the opaque token
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE password_reset_tokens (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,                     -- never store the raw token
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reset_user ON password_reset_tokens(user_id);

CREATE TABLE company_settings (                                -- supplier details printed on invoices
  id           SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- single-row table
  legal_name   VARCHAR(160) NOT NULL,
  gstin        VARCHAR(15),
  state_code   VARCHAR(2)   NOT NULL,                          -- GST state code, e.g. '33' = Tamil Nadu
  address      TEXT         NOT NULL,
  email        CITEXT       NOT NULL,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT UNIQUE REFERENCES users(id),          -- portal login (nullable: staff-created customer)
  company_name    VARCHAR(160) NOT NULL,
  contact_name    VARCHAR(120),
  contact_email   CITEXT,
  phone           VARCHAR(20),
  gstin           VARCHAR(15),
  billing_address TEXT,
  state_code      VARCHAR(2)   NOT NULL DEFAULT '33',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_customers_name ON customers (lower(company_name));

-- ---------- CATALOG -----------------------------------------------------------
CREATE TABLE tax_rules (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         VARCHAR(80)  NOT NULL UNIQUE,                   -- e.g. 'GST 18%'
  rate_percent NUMERIC(5,2) NOT NULL CHECK (rate_percent >= 0 AND rate_percent <= 100),
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name              VARCHAR(120) NOT NULL,
  type              product_type NOT NULL,
  sales_price_paise BIGINT       NOT NULL CHECK (sales_price_paise >= 0),
  cost_price_paise  BIGINT       NOT NULL DEFAULT 0 CHECK (cost_price_paise >= 0),
  sac_code          VARCHAR(10),                               -- GST service accounting code
  notes             TEXT,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ                                 -- soft delete (catalog only)
);
CREATE UNIQUE INDEX uq_products_name_active ON products (lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE product_variants (                                -- e.g. attribute='Brand', value='Odoo', +560.00
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id       BIGINT       NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute        VARCHAR(60)  NOT NULL,
  value            VARCHAR(80)  NOT NULL,
  extra_price_paise BIGINT      NOT NULL DEFAULT 0 CHECK (extra_price_paise >= 0),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  UNIQUE (product_id, attribute, value)
);

CREATE TABLE product_taxes (                                   -- many-to-many
  product_id  BIGINT NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  tax_rule_id BIGINT NOT NULL REFERENCES tax_rules(id) ON DELETE RESTRICT,
  PRIMARY KEY (product_id, tax_rule_id)
);

CREATE TABLE payment_terms (
  id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name     VARCHAR(60) NOT NULL UNIQUE,                        -- 'Immediate', 'Net 15', 'Net 30'
  due_days INTEGER     NOT NULL CHECK (due_days >= 0)
);

CREATE TABLE plans (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name             VARCHAR(120)   NOT NULL,
  price_paise      BIGINT         NOT NULL CHECK (price_paise >= 0),
  billing_period   billing_period NOT NULL,
  billing_interval INTEGER        NOT NULL DEFAULT 1 CHECK (billing_interval >= 1),  -- every N periods
  min_quantity     INTEGER        NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
  available_from   DATE           NOT NULL,
  available_to     DATE,
  trial_days       INTEGER        NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  -- admin decides per plan (PS: "plan by plan")
  auto_close       BOOLEAN        NOT NULL DEFAULT FALSE,
  closable         BOOLEAN        NOT NULL DEFAULT TRUE,
  pausable         BOOLEAN        NOT NULL DEFAULT FALSE,
  renewable        BOOLEAN        NOT NULL DEFAULT TRUE,
  is_active        BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT plans_dates_ok CHECK (available_to IS NULL OR available_to >= available_from)
);
CREATE UNIQUE INDEX uq_plans_name_active ON plans (lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE plan_products (                                   -- many-to-many: which products a plan may include
  plan_id          BIGINT  NOT NULL REFERENCES plans(id)    ON DELETE CASCADE,
  product_id       BIGINT  NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  default_quantity INTEGER NOT NULL DEFAULT 1 CHECK (default_quantity >= 1),
  PRIMARY KEY (plan_id, product_id)
);

CREATE TABLE quotation_templates (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  plan_id       BIGINT       NOT NULL REFERENCES plans(id),
  validity_days INTEGER      NOT NULL CHECK (validity_days >= 1),
  notes         TEXT,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE quotation_template_lines (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  template_id BIGINT  NOT NULL REFERENCES quotation_templates(id) ON DELETE CASCADE,
  product_id  BIGINT  NOT NULL REFERENCES products(id),
  variant_id  BIGINT  REFERENCES product_variants(id),
  quantity    INTEGER NOT NULL CHECK (quantity >= 1),
  UNIQUE (template_id, product_id, variant_id)
);

-- ---------- DISCOUNTS ---------------------------------------------------------
CREATE TABLE discounts (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name              VARCHAR(120)    NOT NULL,
  type              discount_type   NOT NULL,
  value             NUMERIC(12,2)   NOT NULL CHECK (value > 0),         -- paise if fixed, percent if percentage
  scope             discount_scope  NOT NULL,
  min_purchase_paise BIGINT         NOT NULL DEFAULT 0 CHECK (min_purchase_paise >= 0),
  min_quantity      INTEGER         NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  start_date        DATE            NOT NULL,
  end_date          DATE            NOT NULL,
  usage_limit       INTEGER         CHECK (usage_limit IS NULL OR usage_limit >= 1),
  used_count        INTEGER         NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_active         BOOLEAN         NOT NULL DEFAULT TRUE,
  created_by        BIGINT          NOT NULL REFERENCES users(id),      -- admin only (enforced in service)
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT discounts_dates_ok   CHECK (end_date >= start_date),
  CONSTRAINT discounts_pct_ok     CHECK (type <> 'percentage' OR value <= 100),
  CONSTRAINT discounts_limit_ok   CHECK (usage_limit IS NULL OR used_count <= usage_limit)
);

CREATE TABLE discount_products (                               -- many-to-many (scope = 'product')
  discount_id BIGINT NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  product_id  BIGINT NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  PRIMARY KEY (discount_id, product_id)
);

-- ---------- SUBSCRIPTIONS -----------------------------------------------------
CREATE SEQUENCE subscription_number_seq;

CREATE TABLE subscriptions (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number               VARCHAR(20) NOT NULL UNIQUE
                         DEFAULT ('SUB-' || lpad(nextval('subscription_number_seq')::text, 6, '0')),
  customer_id          BIGINT       NOT NULL REFERENCES customers(id),
  plan_id              BIGINT       NOT NULL REFERENCES plans(id),
  template_id          BIGINT       REFERENCES quotation_templates(id),
  payment_term_id      BIGINT       NOT NULL REFERENCES payment_terms(id),
  status               subscription_status NOT NULL DEFAULT 'draft',
  start_date           DATE         NOT NULL,
  expiry_date          DATE,
  quote_valid_until    DATE,
  -- anchor: monthly/yearly = day of month (1-31, NEVER overwritten by clamping);
  --         weekly = ISO weekday (1-7); daily = 1. anchor_month only for yearly.
  anchor_day           SMALLINT     NOT NULL CHECK (anchor_day BETWEEN 1 AND 31),
  anchor_month         SMALLINT     CHECK (anchor_month BETWEEN 1 AND 12),
  next_invoice_date    DATE,                                  -- derived from anchor; DATE not timestamptz
  last_billed_through  DATE,                                  -- period_end of the latest invoiced period
  paused_at            TIMESTAMPTZ,
  closed_at            TIMESTAMPTZ,
  close_reason         TEXT,
  version              INTEGER      NOT NULL DEFAULT 1,       -- optimistic locking
  created_by           BIGINT       REFERENCES users(id),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT sub_dates_ok CHECK (expiry_date IS NULL OR expiry_date >= start_date),
  CONSTRAINT sub_closed_ok CHECK ((status = 'closed') = (closed_at IS NOT NULL))
);
CREATE INDEX idx_sub_customer ON subscriptions(customer_id);
CREATE INDEX idx_sub_status   ON subscriptions(status);
CREATE INDEX idx_sub_due      ON subscriptions(next_invoice_date) WHERE status = 'active';
CREATE INDEX idx_sub_expiry   ON subscriptions(expiry_date)       WHERE status IN ('active','paused');

CREATE TABLE subscription_lines (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id  BIGINT  NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  product_id       BIGINT  NOT NULL REFERENCES products(id),
  variant_id       BIGINT  REFERENCES product_variants(id),
  quantity         INTEGER NOT NULL CHECK (quantity >= 1),
  unit_price_paise BIGINT  NOT NULL CHECK (unit_price_paise >= 0),  -- DENORM: price locked at sale time
  tax_rule_id      BIGINT  REFERENCES tax_rules(id),
  UNIQUE (subscription_id, product_id, variant_id)
);

CREATE TABLE scheduled_changes (                               -- downgrades / pauses applied at period end
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id BIGINT        NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  change_type     change_type   NOT NULL,
  effective_date  DATE          NOT NULL,
  payload         JSONB         NOT NULL DEFAULT '{}'::jsonb,
  status          change_status NOT NULL DEFAULT 'pending',
  created_by      BIGINT        REFERENCES users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  applied_at      TIMESTAMPTZ
);
CREATE INDEX idx_sched_pending ON scheduled_changes(effective_date) WHERE status = 'pending';

CREATE TABLE subscription_events (                             -- append-only ledger -> MRR waterfall
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id  BIGINT         NOT NULL REFERENCES subscriptions(id),
  event_type       sub_event_type NOT NULL,
  mrr_before_paise BIGINT         NOT NULL DEFAULT 0 CHECK (mrr_before_paise >= 0),
  mrr_after_paise  BIGINT         NOT NULL DEFAULT 0 CHECK (mrr_after_paise >= 0),
  occurred_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  actor_id         BIGINT         REFERENCES users(id),
  meta             JSONB          NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_subev_sub  ON subscription_events(subscription_id, occurred_at);
CREATE INDEX idx_subev_time ON subscription_events(occurred_at, event_type);

-- ---------- INVOICING ---------------------------------------------------------
CREATE TABLE invoice_sequences (                               -- gapless numbering; row-locked on allocate
  series      VARCHAR(20) PRIMARY KEY,                         -- e.g. 'INV-2026', 'CN-2026'
  last_number BIGINT      NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);

CREATE TABLE invoices (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number             VARCHAR(30) UNIQUE,                       -- assigned on confirm (NULL while draft)
  subscription_id    BIGINT         NOT NULL REFERENCES subscriptions(id),
  customer_id        BIGINT         NOT NULL REFERENCES customers(id),
  status             invoice_status NOT NULL DEFAULT 'draft',
  period_start       DATE           NOT NULL,
  period_end         DATE           NOT NULL,                  -- inclusive
  issue_date         DATE           NOT NULL,
  due_date           DATE           NOT NULL,
  supplier_state     VARCHAR(2)     NOT NULL,                  -- snapshot of company state
  place_of_supply    VARCHAR(2)     NOT NULL,                  -- snapshot of customer state
  is_interstate      BOOLEAN        NOT NULL,                  -- true -> IGST, false -> CGST+SGST
  currency           CHAR(3)        NOT NULL DEFAULT 'INR',
  subtotal_paise       BIGINT NOT NULL CHECK (subtotal_paise >= 0),
  discount_total_paise BIGINT NOT NULL DEFAULT 0 CHECK (discount_total_paise >= 0),
  tax_total_paise      BIGINT NOT NULL DEFAULT 0 CHECK (tax_total_paise >= 0),
  total_paise          BIGINT NOT NULL CHECK (total_paise >= 0),
  amount_paid_paise    BIGINT NOT NULL DEFAULT 0 CHECK (amount_paid_paise >= 0),   -- maintained in the payment tx
  amount_due_paise     BIGINT GENERATED ALWAYS AS (total_paise - amount_paid_paise) STORED,
  dunning_stage      SMALLINT       NOT NULL DEFAULT 0 CHECK (dunning_stage BETWEEN 0 AND 5),
  last_dunned_at     TIMESTAMPTZ,
  confirmed_at       TIMESTAMPTZ,
  paid_at            TIMESTAMPTZ,
  cancelled_at       TIMESTAMPTZ,
  version            INTEGER        NOT NULL DEFAULT 1,
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CONSTRAINT inv_period_ok  CHECK (period_end >= period_start),
  CONSTRAINT inv_due_ok     CHECK (due_date >= issue_date),
  CONSTRAINT inv_total_ok   CHECK (total_paise = subtotal_paise - discount_total_paise + tax_total_paise),
  CONSTRAINT inv_paid_ok    CHECK (amount_paid_paise <= total_paise),
  CONSTRAINT inv_number_ok  CHECK (status = 'draft' OR status = 'cancelled' OR number IS NOT NULL)
);
-- THE idempotency guarantee: one live invoice per subscription period.
CREATE UNIQUE INDEX uq_invoice_period ON invoices (subscription_id, period_start) WHERE status <> 'cancelled';
CREATE INDEX idx_inv_customer ON invoices (customer_id, created_at DESC);
CREATE INDEX idx_inv_sub      ON invoices (subscription_id);
CREATE INDEX idx_inv_overdue  ON invoices (due_date) WHERE status = 'confirmed';
CREATE INDEX idx_inv_status   ON invoices (status, issue_date);

CREATE TABLE invoice_lines (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id        BIGINT  NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id        BIGINT  NOT NULL REFERENCES products(id),
  variant_id        BIGINT  REFERENCES product_variants(id),
  description       VARCHAR(255) NOT NULL,                     -- snapshot of product/variant text
  sac_code          VARCHAR(10),
  quantity          INTEGER NOT NULL CHECK (quantity >= 1),
  unit_price_paise  BIGINT  NOT NULL CHECK (unit_price_paise >= 0),
  line_subtotal_paise BIGINT NOT NULL CHECK (line_subtotal_paise >= 0),
  discount_paise    BIGINT  NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
  taxable_paise     BIGINT  NOT NULL CHECK (taxable_paise >= 0),
  tax_rule_id       BIGINT  REFERENCES tax_rules(id),
  tax_rate_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,           -- DENORM snapshot: later rate edits must not change history
  tax_paise         BIGINT  NOT NULL DEFAULT 0 CHECK (tax_paise >= 0),
  line_total_paise  BIGINT  NOT NULL CHECK (line_total_paise >= 0),
  breakdown         JSONB   NOT NULL DEFAULT '{}'::jsonb,      -- human-readable "why this amount" for portal + chatbot
  CONSTRAINT il_math_ok CHECK (
    line_subtotal_paise = quantity * unit_price_paise
    AND taxable_paise = line_subtotal_paise - discount_paise
    AND line_total_paise = taxable_paise + tax_paise)
);
CREATE INDEX idx_il_invoice ON invoice_lines(invoice_id);

CREATE TABLE discount_redemptions (                            -- proves each use; supports usage limits + audit
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  discount_id     BIGINT NOT NULL REFERENCES discounts(id),
  invoice_id      BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  subscription_id BIGINT NOT NULL REFERENCES subscriptions(id),
  amount_paise    BIGINT NOT NULL CHECK (amount_paise > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (discount_id, invoice_id)
);
CREATE INDEX idx_redeem_discount ON discount_redemptions(discount_id);

CREATE TABLE payments (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id      BIGINT         NOT NULL REFERENCES invoices(id),
  amount_paise    BIGINT         NOT NULL CHECK (amount_paise > 0),
  method          payment_method NOT NULL,
  paid_on         DATE           NOT NULL,
  reference       VARCHAR(120),                                -- UPI ref / cheque no. / bank txn id
  note            TEXT,
  status          payment_status NOT NULL DEFAULT 'posted',
  idempotency_key VARCHAR(80)    UNIQUE,                       -- double-click / retry safety
  recorded_by     BIGINT         NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  reversed_at     TIMESTAMPTZ
);
CREATE INDEX idx_pay_invoice ON payments(invoice_id);
CREATE INDEX idx_pay_date    ON payments(paid_on) WHERE status = 'posted';

CREATE TABLE credit_notes (                                    -- the correct way to fix a confirmed invoice
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number        VARCHAR(30) UNIQUE,
  invoice_id    BIGINT             NOT NULL REFERENCES invoices(id),
  reason        TEXT               NOT NULL,
  amount_paise  BIGINT             NOT NULL CHECK (amount_paise > 0),
  status        credit_note_status NOT NULL DEFAULT 'draft',
  requested_by  BIGINT             NOT NULL REFERENCES users(id),
  approved_by   BIGINT             REFERENCES users(id),
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ        NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ        NOT NULL DEFAULT now(),
  CONSTRAINT cn_maker_checker CHECK (approved_by IS NULL OR approved_by <> requested_by)
);
CREATE INDEX idx_cn_invoice ON credit_notes(invoice_id);

-- ---------- OPERATIONS --------------------------------------------------------
CREATE TABLE billing_runs (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_date      DATE       NOT NULL,
  status        run_status NOT NULL DEFAULT 'running',
  triggered_by  BIGINT     REFERENCES users(id),               -- NULL = scheduler
  created_count INTEGER    NOT NULL DEFAULT 0,
  skipped_count INTEGER    NOT NULL DEFAULT 0,
  failed_count  INTEGER    NOT NULL DEFAULT 0,
  errors        JSONB      NOT NULL DEFAULT '[]'::jsonb,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ
);

CREATE TABLE audit_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_type VARCHAR(40) NOT NULL,
  entity_id   BIGINT      NOT NULL,
  action      VARCHAR(40) NOT NULL,                            -- 'transition','create','update','login',...
  from_status VARCHAR(30),
  to_status   VARCHAR(30),
  actor_id    BIGINT      REFERENCES users(id),
  request_id  VARCHAR(40),
  diff        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_actor  ON audit_log(actor_id, created_at DESC);

CREATE TABLE notifications (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(40) NOT NULL,
  title      VARCHAR(160) NOT NULL,
  body       TEXT,
  link       VARCHAR(255),
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE email_outbox (                                    -- transactional outbox: send after commit, retry on failure
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  to_email   CITEXT        NOT NULL,
  subject    VARCHAR(200)  NOT NULL,
  body       TEXT          NOT NULL,
  template   VARCHAR(60),
  status     outbox_status NOT NULL DEFAULT 'pending',
  attempts   INTEGER       NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  sent_at    TIMESTAMPTZ
);
CREATE INDEX idx_outbox_pending ON email_outbox(created_at) WHERE status = 'pending';

-- ---------- SUPPORT + CHATBOT -------------------------------------------------
CREATE SEQUENCE ticket_number_seq;

CREATE TABLE support_tickets (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number          VARCHAR(20) NOT NULL UNIQUE DEFAULT ('TKT-' || lpad(nextval('ticket_number_seq')::text, 6, '0')),
  customer_id     BIGINT          NOT NULL REFERENCES customers(id),
  subject         VARCHAR(200)    NOT NULL,
  status          ticket_status   NOT NULL DEFAULT 'open',
  priority        ticket_priority NOT NULL DEFAULT 'normal',
  source          ticket_source   NOT NULL DEFAULT 'portal',
  invoice_id      BIGINT REFERENCES invoices(id),
  subscription_id BIGINT REFERENCES subscriptions(id),
  assigned_to     BIGINT REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_status   ON support_tickets(status, created_at DESC);
CREATE INDEX idx_ticket_customer ON support_tickets(customer_id);

CREATE TABLE ticket_messages (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id      BIGINT      NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_type    author_type NOT NULL,
  author_user_id BIGINT      REFERENCES users(id),
  body           TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tmsg_ticket ON ticket_messages(ticket_id, created_at);

CREATE TABLE chat_sessions (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id         BIGINT      NOT NULL REFERENCES customers(id),
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at            TIMESTAMPTZ,
  escalated_ticket_id BIGINT      REFERENCES support_tickets(id)
);
CREATE INDEX idx_chat_customer ON chat_sessions(customer_id, started_at DESC);

CREATE TABLE chat_messages (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id BIGINT      NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       chat_role   NOT NULL,
  content    TEXT        NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  intent     VARCHAR(40),
  tool_calls JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chatmsg_session ON chat_messages(session_id, created_at);

-- ---------- updated_at TRIGGERS ----------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','company_settings','customers','tax_rules','products','plans',
                           'quotation_templates','discounts','subscriptions','invoices',
                           'credit_notes','support_tickets']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON %1$I
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;

-- ---------- REFERENCE DATA (roles, permissions, defaults) ---------------------
INSERT INTO roles (name, description) VALUES
  ('admin',    'Full control: catalog, plans, taxes, discounts, staff, everything'),
  ('manager',  'Internal lead: approvals (credit notes), reports, audit; no catalog/discount/staff admin'),
  ('staff',    'Internal employee: day-to-day customers, quotations, subscriptions, invoices, payments'),
  ('customer', 'Portal user: own subscriptions, invoices, tickets, chat only');

INSERT INTO permissions (code, description) VALUES
  ('users.manage',        'Create/deactivate staff and managers'),
  ('catalog.read',        'View products, variants, plans, templates, taxes'),
  ('catalog.write',       'Create/edit products and variants'),
  ('plans.write',         'Create/edit plans and plan flags'),
  ('templates.write',     'Create/edit quotation templates'),
  ('tax.manage',          'Create/edit tax rules'),
  ('discounts.manage',    'Create/edit discount rules'),
  ('customers.read',      'View customers'),
  ('customers.write',     'Create/edit customers'),
  ('subscriptions.read',  'View subscriptions'),
  ('subscriptions.write', 'Create/edit/transition subscriptions'),
  ('subscriptions.close', 'Close/pause/renew subscriptions'),
  ('invoices.read',       'View invoices'),
  ('invoices.write',      'Confirm/cancel invoices'),
  ('invoices.send',       'Send/print invoices'),
  ('billing.run',         'Trigger a billing run'),
  ('payments.record',     'Record payments'),
  ('payments.reverse',    'Reverse a payment'),
  ('credit_notes.request','Raise a credit note (maker)'),
  ('credit_notes.approve','Approve/reject a credit note (checker)'),
  ('reports.view',        'Finance dashboard and exports'),
  ('audit.view',          'View audit log'),
  ('tickets.manage',      'Work support tickets'),
  ('portal.self',         'Access own data through the customer portal');

INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
  WHERE r.name = 'admin' AND p.code <> 'portal.self';

INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
    'catalog.read','customers.read','customers.write','subscriptions.read','subscriptions.write',
    'subscriptions.close','invoices.read','invoices.write','invoices.send','billing.run',
    'payments.record','payments.reverse','credit_notes.request','credit_notes.approve',
    'reports.view','audit.view','tickets.manage')
  WHERE r.name = 'manager';

INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
    'catalog.read','customers.read','customers.write','subscriptions.read','subscriptions.write',
    'invoices.read','invoices.write','invoices.send','payments.record',
    'credit_notes.request','tickets.manage')
  WHERE r.name = 'staff';

INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'portal.self'
  WHERE r.name = 'customer';

INSERT INTO payment_terms (name, due_days) VALUES ('Immediate', 0), ('Net 15', 15), ('Net 30', 30);

INSERT INTO company_settings (legal_name, gstin, state_code, address, email)
  VALUES ('Brightloop Software', NULL, '33', 'Update in Admin > Company settings', 'billing@brightloop.example');

INSERT INTO invoice_sequences (series, last_number) VALUES ('INV-2026', 0), ('CN-2026', 0);
