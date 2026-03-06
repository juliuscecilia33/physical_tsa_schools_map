ALTER TABLE generated_emails ADD COLUMN parent_email_id UUID REFERENCES generated_emails(id);
ALTER TABLE generated_emails ADD COLUMN edit_instructions TEXT;
