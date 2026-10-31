'use strict';
module.exports = {
  async up(q) {
    await q.sequelize.transaction(async (transaction) => {
      await q.sequelize.query(
        `
        ALTER TYPE enum_partner_users_staff_role RENAME TO enum_partner_users_staff_role_legacy;
        CREATE TYPE enum_partner_users_staff_role AS ENUM ('PARTNER_ADMIN','PARTNER_SUPPORT');
        ALTER TABLE partner_users ALTER COLUMN staff_role TYPE enum_partner_users_staff_role
          USING (CASE WHEN staff_role::text IN ('OWNER','MANAGER') THEN 'PARTNER_ADMIN' ELSE 'PARTNER_SUPPORT' END)::enum_partner_users_staff_role;
        DROP TYPE enum_partner_users_staff_role_legacy;
        ALTER TABLE partner_users ADD COLUMN invited_by_account_id uuid REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE SET NULL;
        COMMENT ON COLUMN partner_users.invited_by_account_id IS 'Partner admin who registered this support employee; first login must verify the employee phone.';
        CREATE TABLE partner_assets (
          id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES partners(id), uploaded_by_account_id uuid NOT NULL REFERENCES accounts(id),
          url text NOT NULL, mime_type varchar(30) NOT NULL, size_bytes integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX partner_assets_partner_idx ON partner_assets(partner_id);
        CREATE TABLE partner_content (
          id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES partners(id), kind varchar(10) NOT NULL CHECK (kind IN ('MENU','PLAN','PACKAGE','EVENT')),
          title varchar(160) NOT NULL, description varchar(5000) NOT NULL DEFAULT '', price_inr integer CHECK (price_inr>=0), starts_at timestamptz, ends_at timestamptz,
          is_published boolean NOT NULL DEFAULT false, photo_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
          created_by_account_id uuid NOT NULL REFERENCES accounts(id), updated_by_account_id uuid NOT NULL REFERENCES accounts(id),
          created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
          CHECK (ends_at IS NULL OR (starts_at IS NOT NULL AND ends_at>starts_at)), CHECK (kind<>'EVENT' OR starts_at IS NOT NULL)
        );
        CREATE INDEX partner_content_partner_idx ON partner_content(partner_id,updated_at DESC) WHERE deleted_at IS NULL;
      `,
        { transaction },
      );
    });
  },
  async down(q) {
    await q.sequelize.transaction(async (transaction) => {
      await q.sequelize.query(
        `DROP TABLE partner_content; DROP TABLE partner_assets; ALTER TABLE partner_users DROP COLUMN invited_by_account_id;
        ALTER TYPE enum_partner_users_staff_role RENAME TO enum_partner_users_staff_role_new;
        CREATE TYPE enum_partner_users_staff_role AS ENUM ('OWNER','MANAGER','STAFF');
        ALTER TABLE partner_users ALTER COLUMN staff_role TYPE enum_partner_users_staff_role USING (CASE WHEN staff_role::text='PARTNER_ADMIN' THEN 'OWNER' ELSE 'STAFF' END)::enum_partner_users_staff_role;
        DROP TYPE enum_partner_users_staff_role_new;`,
        { transaction },
      );
    });
  },
};
