-- Optional per-room secret for automation (e.g. n8n) to POST push without user JWT.
ALTER TABLE Room ADD COLUMN integrationSecretHash TEXT;
