-- Rename participant_status enum value: 'contacted' → 'to_be_invited'
ALTER TYPE participant_status RENAME VALUE 'contacted' TO 'to_be_invited';
