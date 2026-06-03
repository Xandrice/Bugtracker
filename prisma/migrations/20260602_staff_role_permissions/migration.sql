-- Custom staff roles for staff-panel permissions.
CREATE TABLE "StaffRole" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "baseRole"    TEXT NOT NULL DEFAULT 'Member',
  "permissions" JSONB NOT NULL,
  "isSystem"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StaffRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffRole_name_key" ON "StaffRole"("name");

ALTER TABLE "ProjectMember"
ADD COLUMN "staffRoleId" TEXT,
ADD COLUMN "staffPermissionOverrides" JSONB;

ALTER TABLE "ProjectMember"
ADD CONSTRAINT "ProjectMember_staffRoleId_fkey" FOREIGN KEY ("staffRoleId")
  REFERENCES "StaffRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ProjectMember_staffRoleId_idx" ON "ProjectMember"("staffRoleId");

INSERT INTO "StaffRole" ("id", "name", "baseRole", "permissions", "isSystem")
VALUES
  (
    'staff-role-owner',
    'Owner',
    'Owner',
    '{"players":{"view":true,"manage":true},"vehicles":{"view":true,"manage":true},"economy":{"view":true},"schema":{"refresh":true}}'::jsonb,
    true
  ),
  (
    'staff-role-admin',
    'Admin',
    'Admin',
    '{"players":{"view":true,"manage":true},"vehicles":{"view":true,"manage":true},"economy":{"view":true},"schema":{"refresh":true}}'::jsonb,
    true
  ),
  (
    'staff-role-moderator',
    'Moderator',
    'Moderator',
    '{"players":{"view":true,"manage":true},"vehicles":{"view":true,"manage":true},"economy":{"view":true},"schema":{"refresh":true}}'::jsonb,
    true
  ),
  (
    'staff-role-developer',
    'Developer',
    'Developer',
    '{"players":{"view":false,"manage":false},"vehicles":{"view":false,"manage":false},"economy":{"view":false},"schema":{"refresh":false}}'::jsonb,
    true
  ),
  (
    'staff-role-member',
    'Member',
    'Member',
    '{"players":{"view":false,"manage":false},"vehicles":{"view":false,"manage":false},"economy":{"view":false},"schema":{"refresh":false}}'::jsonb,
    true
  );

UPDATE "ProjectMember"
SET "staffRoleId" = CASE "role"
  WHEN 'Owner' THEN 'staff-role-owner'
  WHEN 'Admin' THEN 'staff-role-admin'
  WHEN 'Moderator' THEN 'staff-role-moderator'
  WHEN 'Developer' THEN 'staff-role-developer'
  ELSE 'staff-role-member'
END;
