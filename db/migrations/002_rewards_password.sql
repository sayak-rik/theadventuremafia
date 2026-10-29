-- Add a password for reward users to sign back in (after first email-OTP verify).
--   docker compose exec -T db psql -U adventure -d adventuremafia < db/migrations/002_rewards_password.sql
ALTER TABLE customer_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
