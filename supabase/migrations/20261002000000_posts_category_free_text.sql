-- Drop the hard-coded category check on posts so any tag value from the
-- live site can be imported and new categories can be added without a migration.
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_category_check;
