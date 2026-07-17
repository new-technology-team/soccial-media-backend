-- Fix existing users with empty or duplicate usernames
-- Then add the unique index

-- Step 1: Generate usernames for users with empty usernames
-- Uses email local part or falls back to user_<id>
UPDATE \`user\`
SET username = LOWER(
    REGEXP_REPLACE(
        COALESCE(
            NULLIF(SUBSTRING_INDEX(email, '@', 1), ''),
            CONCAT('user_', userId)
        ),
        '[^a-zA-Z0-9._]',
        ''
    )
)
WHERE username IS NULL OR username = '' OR username = 'user' OR username LIKE 'user_%' OR username LIKE 'deleted_%';

-- Step 2: Handle duplicate usernames by appending userId
UPDATE \`user\` u1
JOIN (
    SELECT MIN(userId) AS minId, username
    FROM \`user\`
    GROUP BY username
    HAVING COUNT(*) > 1
) dup ON u1.username = dup.username AND u1.userId > dup.minId
SET u1.username = CONCAT(u1.username, '_', u1.userId);

-- Step 3: Make sure email-based identifiers are clean (no special chars)
UPDATE \`user\`
SET username = LOWER(REGEXP_REPLACE(username, '[^a-zA-Z0-9._]', ''))
WHERE username REGEXP '[^a-zA-Z0-9._]';

-- Step 4: Add unique index
-- Run this separately after verifying no duplicates:
-- CREATE UNIQUE INDEX IDX_username ON \`user\`(username);
