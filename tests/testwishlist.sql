-- Test data for the GameBuddy wishlist API
-- Run schema.sql first.
-- This file creates one demo user, category, game, and wishlist item.

USE game_tracker;

-- Create or reuse the demo user
INSERT INTO users
    (username, email, password_hash)
VALUES
    ('demo', 'demo@example.com', 'temporary-test-value')
ON DUPLICATE KEY UPDATE
    user_id = LAST_INSERT_ID(user_id);

SET @user_id = LAST_INSERT_ID();

-- Create or reuse the notification category
INSERT INTO notification_categories
    (user_id, name, check_interval_minutes)
VALUES
    (@user_id, 'Hunting hard', 60)
ON DUPLICATE KEY UPDATE
    category_id = LAST_INSERT_ID(category_id),
    check_interval_minutes = 60;

SET @category_id = LAST_INSERT_ID();

-- Create the test game if it does not already exist
INSERT INTO games
    (title, match_title)
SELECT
    'Test Game',
    'test game'
WHERE NOT EXISTS (
    SELECT 1
    FROM games
    WHERE match_title = 'test game'
);

SET @game_id = (
    SELECT game_id
    FROM games
    WHERE match_title = 'test game'
    LIMIT 1
);

-- Add or update the game on the demo user's wishlist
INSERT INTO user_games
    (user_id, game_id, category_id, target_price, notify_enabled)
VALUES
    (@user_id, @game_id, @category_id, 20.00, TRUE)
ON DUPLICATE KEY UPDATE
    category_id = @category_id,
    target_price = 20.00,
    notify_enabled = TRUE,
    status = 'want_to_play';

COMMIT;

-- Verify the test wishlist item
SELECT
    ug.user_game_id,
    u.username,
    g.game_id,
    g.title,
    nc.name AS category,
    ug.target_price,
    ug.notify_enabled,
    ug.status
FROM user_games ug
JOIN users u
    ON u.user_id = ug.user_id
JOIN games g
    ON g.game_id = ug.game_id
LEFT JOIN notification_categories nc
    ON nc.category_id = ug.category_id
WHERE u.username = 'demo'
  AND g.match_title = 'test game';

USE game_tracker;

SELECT
    n.notification_id,
    g.title,
    ph.price,
    n.target_price,
    n.triggered_at
FROM notifications n
JOIN user_games ug
    ON ug.user_game_id = n.user_game_id
JOIN games g
    ON g.game_id = ug.game_id
JOIN price_history ph
    ON ph.history_id = n.price_history_id
WHERE ug.user_id = 1
ORDER BY n.triggered_at DESC;