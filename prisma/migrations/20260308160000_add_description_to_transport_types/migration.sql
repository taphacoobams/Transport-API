-- Add description column to transport_types
ALTER TABLE "transport_types" ADD COLUMN IF NOT EXISTS "description" TEXT;
