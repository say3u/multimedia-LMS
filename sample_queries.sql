-- GameBuddy - Sample Queries
-- CS 514 Final Project
--
-- these are the actual queries the backend runs to power each part of
-- the app. grouped by feature, and each one says which sql concept it
-- covers (joins / aggregates / subqueries / view / transactions) since
-- the project needs to show all of those.
--
-- run schema.sql and at least one of the import scripts first so there's
-- data in here. user_id = 1 / game_id = 1 etc are placeholders -- in the
-- backend these get passed in as parameters (%s) instead of hardcoded

USE game_tracker;

-- ============================================
-- WISHLIST PAGE
-- ============================================

-- 1. a user's wishlist with the best current price for each game
-- concept: JOIN (4 tables) + the current_best_prices view
-- LEFT JOIN on the view so games with no price yet still show up (just
-- with a null best_price) instead of silently disappearing
SELECT
    g.title,
    nc.name           AS category,
    pa.target_price,
    cbp.current_price AS best_price,
    cbp.platform_name AS cheapest_on,
    pa.status
FROM price_alerts pa
JOIN games g                    ON g.game_id = pa.game_id
JOIN notification_categories nc ON nc.category_id = pa.category_id
LEFT JOIN current_best_prices cbp ON cbp.game_id = pa.game_id
WHERE pa.user_id = 1
ORDER BY nc.name, g.title;

-- 2. alerts that are within $5 of triggering -- "almost at your price"
-- badge on the wishlist
-- concept: JOIN + computed column
SELECT
    g.title,
    pa.target_price,
    cbp.current_price,
    cbp.current_price - pa.target_price AS still_needs_to_drop
FROM price_alerts pa
JOIN games g ON g.game_id = pa.game_id
JOIN current_best_prices cbp ON cbp.game_id = pa.game_id
WHERE pa.user_id = 1
  AND pa.status = 'active'
  AND cbp.current_price > pa.target_price
  AND cbp.current_price - pa.target_price <= 5.00
ORDER BY still_needs_to_drop ASC;

-- ============================================
-- GAME DETAIL PAGE
-- ============================================

-- 3. full price history for one game across every store (for the
-- price chart)
-- concept: JOIN (4 tables)
SELECT
    p.name       AS platform,
    ph.price,
    ph.recorded_at
FROM price_history ph
JOIN listings l  ON l.listing_id = ph.listing_id
JOIN platforms p ON p.platform_id = l.platform_id
WHERE l.game_id = 1
ORDER BY ph.recorded_at ASC;

-- 4. all-time low / high / average for that game (the stats under the chart)
-- concept: aggregates + GROUP BY + HAVING
-- HAVING skips it if we've only checked once, since min/max/avg of one
-- price doesn't really tell you anything
SELECT
    g.title,
    COUNT(ph.history_id)    AS times_checked,
    MIN(ph.price)           AS all_time_low,
    MAX(ph.price)           AS all_time_high,
    ROUND(AVG(ph.price), 2) AS avg_price
FROM games g
JOIN listings l       ON l.game_id = g.game_id
JOIN price_history ph ON ph.listing_id = l.listing_id
WHERE g.game_id = 1
GROUP BY g.game_id, g.title
HAVING COUNT(ph.history_id) >= 2;

-- ============================================
-- HOMEPAGE / DEALS
-- ============================================

-- 5. 10 cheapest games right now, across whatever store has them cheapest
-- concept: VIEW
SELECT * FROM current_best_prices
ORDER BY current_price ASC
LIMIT 10;

-- 6. biggest price drops right now -- how far each listing's current
-- price is below the highest price we've ever seen for it
-- concept: subquery (derived table in the FROM)
SELECT
    g.title,
    p.name                                   AS platform,
    peak.highest                             AS was,
    l.current_price                          AS now,
    ROUND(peak.highest - l.current_price, 2) AS dropped_by
FROM listings l
JOIN games g     ON g.game_id = l.game_id
JOIN platforms p ON p.platform_id = l.platform_id
JOIN (
    SELECT listing_id, MAX(price) AS highest
    FROM price_history
    GROUP BY listing_id
) peak ON peak.listing_id = l.listing_id
WHERE l.current_price < peak.highest
ORDER BY dropped_by DESC
LIMIT 10;

-- 7. listings cheaper than the average listing price overall ("under
-- average" filter)
-- concept: scalar subquery in the WHERE
SELECT g.title, p.name AS platform, l.current_price
FROM listings l
JOIN games g     ON g.game_id = l.game_id
JOIN platforms p ON p.platform_id = l.platform_id
WHERE l.current_price < (
    SELECT AVG(current_price) FROM listings WHERE current_price IS NOT NULL
)
ORDER BY l.current_price ASC;

-- ============================================
-- PRICE-CHECK JOB (backend script, runs on a schedule)
-- ============================================

-- 8. which listings are due for a price check right now, based on each
-- alert's category schedule. the job runs this first to figure out what
-- to hit next -- "hunting hard" (every 60 min) games come up way more
-- often than "someday maybe" (every 10080 min = 1 week)
-- concept: JOIN (5 tables) + date math
SELECT DISTINCT
    l.listing_id,
    g.title,
    p.name AS platform,
    l.last_checked_at
FROM price_alerts pa
JOIN notification_categories nc ON nc.category_id = pa.category_id
JOIN listings l  ON l.game_id = pa.game_id
JOIN games g     ON g.game_id = l.game_id
JOIN platforms p ON p.platform_id = l.platform_id
WHERE pa.status = 'active'
  AND nc.check_interval_minutes IS NOT NULL
  AND l.last_checked_at < NOW() - INTERVAL nc.check_interval_minutes MINUTE;

-- 9. then for each listing it gets a new price for, it calls this.
-- logs to price_history, updates listings.current_price, and flips any
-- matching alerts to triggered, all in one transaction
-- concept: stored procedure + TRANSACTION
-- (this one changes data)
CALL record_price_check(1, 14.99);

-- 10. who needs to get notified -- alerts that just got triggered
-- concept: JOIN
SELECT
    u.username,
    u.email,
    g.title,
    pa.target_price,
    pa.triggered_at
FROM price_alerts pa
JOIN users u ON u.user_id = pa.user_id
JOIN games g ON g.game_id = pa.game_id
WHERE pa.status = 'triggered'
  AND pa.triggered_at >= NOW() - INTERVAL 1 HOUR
ORDER BY pa.triggered_at DESC;

-- ============================================
-- ADMIN / DATA HEALTH
-- ============================================

-- 11. how many games each store has + their avg current price (sanity
-- check that the steam/gog imports are actually landing)
-- concept: aggregates + LEFT JOIN
SELECT
    p.name                         AS platform,
    COUNT(l.listing_id)            AS games_listed,
    ROUND(AVG(l.current_price), 2) AS avg_current_price
FROM platforms p
LEFT JOIN listings l ON l.platform_id = p.platform_id
GROUP BY p.platform_id, p.name
ORDER BY games_listed DESC;

-- 12. last 10 import runs and whether they worked
SELECT source, run_at, items_added, status, error_message
FROM import_log
ORDER BY run_at DESC
LIMIT 10;

-- 13. games nobody is tracking at all -- safe to stop price checking
-- concept: NOT EXISTS subqueries
SELECT g.game_id, g.title
FROM games g
WHERE NOT EXISTS (
    SELECT 1 FROM user_games ug WHERE ug.game_id = g.game_id
)
AND NOT EXISTS (
    SELECT 1 FROM price_alerts pa WHERE pa.game_id = g.game_id
);

-- ============================================
-- LOANS
-- ============================================

-- 14. user 1 lends game 1 to user 2, due in 2 weeks. run it twice and
-- the second one should fail with "Item is already loaned out."
-- concept: stored procedure + TRANSACTION + row locking
-- (this one changes data)
CALL borrow_item(1, 1, 2, CURDATE() + INTERVAL 14 DAY);

-- 15. loans that are past their due date but still marked active
-- concept: JOIN (users joined twice, once as lender once as borrower)
SELECT
    g.title,
    lender.username   AS lender,
    borrower.username AS borrower,
    lo.due_at,
    DATEDIFF(CURDATE(), lo.due_at) AS days_overdue
FROM loans lo
JOIN games g        ON g.game_id = lo.game_id
JOIN users lender   ON lender.user_id = lo.lender_id
JOIN users borrower ON borrower.user_id = lo.borrower_id
WHERE lo.status = 'active'
  AND lo.due_at < CURDATE()
ORDER BY days_overdue DESC;
