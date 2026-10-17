-- Authorization metadata only; existing grants retain scopes, consent version and expiry.
ALTER TABLE web_developer_resource_grants MODIFY COLUMN expires_at DATETIME(3) NULL DEFAULT NULL;
