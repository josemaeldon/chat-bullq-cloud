-- Backfill de colunas que já existem no schema Prisma mas ficaram fora do
-- histórico de migrations em alguns ambientes.
--
-- Objetivo:
-- - corrigir 500s em /api/v1/channels (`channels.ai_enabled`)
-- - corrigir 500s em /api/v1/ai-agents (`ai_agents.parent_agent_id`)
-- - alinhar demais campos do model AiAgent usados pelo código atual

ALTER TABLE "channels"
  ADD COLUMN IF NOT EXISTS "ai_enabled" BOOLEAN;

ALTER TABLE "ai_agents"
  ADD COLUMN IF NOT EXISTS "parent_agent_id" TEXT,
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "squad" TEXT,
  ADD COLUMN IF NOT EXISTS "operational_context" TEXT,
  ADD COLUMN IF NOT EXISTS "operational_context_updated_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "idx_ai_agent_parent"
  ON "ai_agents"("parent_agent_id");

CREATE INDEX IF NOT EXISTS "idx_ai_agent_org_dept"
  ON "ai_agents"("organization_id", "department");

DO $$ BEGIN
  ALTER TABLE "ai_agents"
    ADD CONSTRAINT "ai_agents_parent_agent_id_fkey"
    FOREIGN KEY ("parent_agent_id") REFERENCES "ai_agents"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
