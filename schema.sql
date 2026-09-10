-- Game Library Tracker - Database Schema
-- CS 514 Final Project
--
-- pivoted from the original "any media" idea to just video games, plus we
-- added a price tracking layer on top (tracking what a game costs across
-- different stores/platforms over time). commented section by section so
-- it's easier to follow what each one does and why

CREATE DATABASE IF NOT EXISTS game_tracker;
USE game_tracker;

-- USERS TABLE
-- pretty standard accounts table, nothing crazy here.
-- every other table that needs to know "which user" links back to this
-- one using user_id as a foreign key
CREATE TABLE users (
    user_id         INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- GAMES TABLE
-- one row = one game. doesn't matter which api it came from (igdb, steam,
-- etc), it all lands here the same way. same "source" + "external_id"
-- trick as before so we don't accidentally import the same game twice
-- from two different apis
CREATE TABLE games (
    game_id         INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    genre           VARCHAR(100),
    developer       VARCHAR(255),
    publisher       VARCHAR(255),
    release_year    SMALLINT,
    synopsis        TEXT,
    icon_url        VARCHAR(500),  -- small thumbnail, for grid/list views
    banner_url      VARCHAR(500),  -- bigger hero image, for the detail page
    source          VARCHAR(50) NOT NULL,  -- 'igdb', 'steam', 'cheapshark', etc
    external_id     VARCHAR(255),
    source_url      VARCHAR(500),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_source_game (source, external_id)
) ENGINE=InnoDB;
-- note: this one table covers both a homepage grid (title, icon_url,
-- genre) AND the detail page (synopsis, developer, publisher, etc) --
-- just select fewer columns for the grid view. no need for two separate
-- tables like "games-main" and "games-profiles", that'd just mean
-- keeping the same title/description in sync in two places for no
-- reason. also didn't add a stored "category" column for stuff like
-- "on sale" or "featured" -- that kind of thing changes constantly and
-- is cheap to compute with a query against listings/price_history
-- instead of storing (and risking it going stale)

-- USER_GAMES TABLE -- the main join table, connects users to games
-- one user can track a ton of games, one game can be tracked by a ton of
-- users, so it's many-to-many and needs this table in between. this is
-- where we store stuff specific to THAT user + THAT game, like their
-- play status and personal notes
CREATE TABLE user_games (
    user_game_id    INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    game_id         INT NOT NULL,
    status          ENUM('want_to_play','playing','completed') NOT NULL DEFAULT 'want_to_play',
    rating          TINYINT,               -- 1-10, null until they actually rate it
    notes           TEXT,
    added_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_game (user_id, game_id)
) ENGINE=InnoDB;

-- STATUS_HISTORY TABLE
-- user_games only remembers your CURRENT status, not what it used to be.
-- this logs every status change so we can show stuff like "you finished
-- 5 games this month" later
CREATE TABLE status_history (
    history_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_game_id    INT NOT NULL,
    old_status      ENUM('want_to_play','playing','completed'),
    new_status      ENUM('want_to_play','playing','completed') NOT NULL,
    changed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_game_id) REFERENCES user_games(user_game_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- LISTS + LIST_ITEMS
-- custom lists users can make, like "comfy couch co-op games" or w/e.
-- same many-to-many deal, list_items connects lists to games
CREATE TABLE lists (
    list_id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    description     VARCHAR(500),
    is_public       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE list_items (
    list_id         INT NOT NULL,
    game_id         INT NOT NULL,
    added_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (list_id, game_id),
    FOREIGN KEY (list_id) REFERENCES lists(list_id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- FOLLOWS TABLE
-- the social part -- users following other users. both sides point back
-- to users, since a user follows another user
CREATE TABLE follows (
    follower_id     INT NOT NULL,
    followee_id     INT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, followee_id),
    FOREIGN KEY (follower_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (followee_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CHECK (follower_id <> followee_id)
) ENGINE=InnoDB;

-- LOANS TABLE
-- for lending a physical copy/cartridge to a friend. kept this from the
-- original idea since it's still a real thing people do with games. this
-- is one of our two transaction examples -- see the borrow_item
-- procedure at the bottom
CREATE TABLE loans (
    loan_id         INT AUTO_INCREMENT PRIMARY KEY,
    game_id         INT NOT NULL,
    lender_id       INT NOT NULL,
    borrower_id     INT NOT NULL,
    loaned_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_at          DATE,
    returned_at     TIMESTAMP NULL,
    status          ENUM('active','returned','overdue') NOT NULL DEFAULT 'active',
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
    FOREIGN KEY (lender_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (borrower_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CHECK (lender_id <> borrower_id)
) ENGINE=InnoDB;

-- REVIEWS TABLE
-- public reviews, separate from the private "notes" field in user_games
CREATE TABLE reviews (
    review_id       INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    game_id         INT NOT NULL,
    rating          TINYINT NOT NULL,
    review_text     TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_review (user_id, game_id)
) ENGINE=InnoDB;

-- ============================================
-- NEW STUFF FOR THE PRICE TRACKING SIDE
-- ============================================

-- PLATFORMS TABLE
-- the stores a game can be bought from -- steam, playstation store, xbox,
-- epic, gog, nintendo eshop, etc. small lookup table
CREATE TABLE platforms (
    platform_id     INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- LISTINGS TABLE
-- one row per (game, platform) combo -- basically "this game is sold on
-- this store, and here's its price right now." this is what connects
-- games to platforms, and price_history below hangs off of this
CREATE TABLE listings (
    listing_id      INT AUTO_INCREMENT PRIMARY KEY,
    game_id         INT NOT NULL,
    platform_id     INT NOT NULL,
    current_price   DECIMAL(8,2),
    currency        CHAR(3) NOT NULL DEFAULT 'USD',
    listing_url     VARCHAR(500),
    last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
    FOREIGN KEY (platform_id) REFERENCES platforms(platform_id) ON DELETE CASCADE,
    UNIQUE KEY uq_game_platform (game_id, platform_id) -- one listing per game per store
) ENGINE=InnoDB;

-- PRICE_HISTORY TABLE
-- every time we check a price, we log a row here instead of just
-- overwriting current_price. this is basically the whole point of the
-- pivot -- lets us actually show price trends over time, biggest drops,
-- etc instead of just a snapshot
CREATE TABLE price_history (
    history_id      INT AUTO_INCREMENT PRIMARY KEY,
    listing_id      INT NOT NULL,
    price           DECIMAL(8,2) NOT NULL,
    recorded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (listing_id) REFERENCES listings(listing_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- NOTIFICATION_CATEGORIES TABLE
-- this replaces the notify_level enum we had before, based on a
-- teammate's idea that's honestly a better version of it -- instead of
-- 3 fixed options (instant/digest/muted), each USER can make their own
-- categories with their own check schedule. e.g. someone could make a
-- "hunting hard" category that checks every hour, and a "someday maybe"
-- category that only checks once a week. categories belong to a user
-- (not global) since two different people probably don't want the same
-- schedule for a category with the same name
CREATE TABLE notification_categories (
    category_id             INT AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT NOT NULL,
    name                    VARCHAR(50) NOT NULL,  -- e.g. 'hunting hard', 'someday maybe', 'muted'
    check_interval_minutes  INT,  -- how often the price-check job should look at games in this category. null = don't auto check
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_category_name (user_id, name)
) ENGINE=InnoDB;

-- PRICE_ALERTS TABLE
-- basically a wishlist entry with a target price attached -- "let me
-- know when this game drops to $X." every alert belongs to one of the
-- user's notification_categories, which is what controls how often/
-- whether they actually get pinged about it. this is our second
-- transaction example, see record_price_check below
CREATE TABLE price_alerts (
    alert_id        INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    game_id         INT NOT NULL,
    category_id     INT NOT NULL,
    target_price    DECIMAL(8,2) NOT NULL,
    status          ENUM('active','triggered','cancelled') NOT NULL DEFAULT 'active',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    triggered_at    TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES notification_categories(category_id) ON DELETE CASCADE
) ENGINE=InnoDB;
-- since category_id is required, the app needs to make sure every user
-- has at least one category to start with -- easiest way is to just
-- insert a couple of defaults (like "Instant" and "Muted") for a user
-- right when their account gets created, then they can add their own
-- custom ones after that

-- IMPORT_LOG TABLE
-- every time we pull from an api (game metadata OR a price check run),
-- it logs a row here. good for debugging and shows the import_tmdb-style
-- scripts actually get used for something real
CREATE TABLE import_log (
    import_id       INT AUTO_INCREMENT PRIMARY KEY,
    source          VARCHAR(50) NOT NULL,
    run_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    items_added     INT DEFAULT 0,
    items_updated   INT DEFAULT 0,
    status          ENUM('success','partial','failed') NOT NULL,
    error_message   TEXT
) ENGINE=InnoDB;

-- ============================================
-- BORROW_ITEM STORED PROCEDURE
-- ============================================
-- transaction example #1 -- lending a physical copy to a friend. the
-- problem: what if two people try to borrow the same copy at the same
-- time? we don't want both to go through. FOR UPDATE locks the row while
-- we check, so the check + insert happens as one atomic step
DELIMITER //
CREATE PROCEDURE borrow_item (
    IN p_game_id INT,
    IN p_lender_id INT,
    IN p_borrower_id INT,
    IN p_due_at DATE
)
BEGIN
    DECLARE already_loaned INT;

    START TRANSACTION;

    SELECT COUNT(*) INTO already_loaned
    FROM loans
    WHERE game_id = p_game_id AND status = 'active'
    FOR UPDATE;

    IF already_loaned > 0 THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item is already loaned out.';
    ELSE
        INSERT INTO loans (game_id, lender_id, borrower_id, due_at, status)
        VALUES (p_game_id, p_lender_id, p_borrower_id, p_due_at, 'active');
        COMMIT;
    END IF;
END //
DELIMITER ;

-- ============================================
-- RECORD_PRICE_CHECK STORED PROCEDURE
-- ============================================
-- transaction example #2 -- this runs every time our price-checking
-- script sees a new price for a listing. it needs to do 3 things
-- together as one unit: log the new price to price_history, update the
-- "current" price on the listing, AND check if this new price triggers
-- anybody's price alert. if we did these as separate queries instead of
-- one transaction, something could fail halfway through and leave
-- price_history and listings.current_price out of sync with each other
DELIMITER //
CREATE PROCEDURE record_price_check (
    IN p_listing_id INT,
    IN p_new_price DECIMAL(8,2)
)
BEGIN
    DECLARE v_game_id INT;

    START TRANSACTION;

    SELECT game_id INTO v_game_id
    FROM listings
    WHERE listing_id = p_listing_id
    FOR UPDATE;

    INSERT INTO price_history (listing_id, price, recorded_at)
    VALUES (p_listing_id, p_new_price, NOW());

    UPDATE listings
    SET current_price = p_new_price, last_checked_at = NOW()
    WHERE listing_id = p_listing_id;

    -- anybody watching this game for a price at or below what it just
    -- dropped to gets their alert flipped to triggered
    UPDATE price_alerts
    SET status = 'triggered', triggered_at = NOW()
    WHERE game_id = v_game_id
      AND status = 'active'
      AND target_price >= p_new_price;

    COMMIT;
END //
DELIMITER ;

-- recap:
-- users            - accounts
-- games            - the actual games (title, genre, dev/publisher, etc)
-- user_games       - connects users to games + tracks status/rating/notes
-- status_history   - logs status changes over time
-- lists            - custom lists people make
-- list_items       - connects lists to games
-- follows          - who's following who
-- loans            - lending physical copies between users (transaction #1)
-- reviews          - public reviews
-- platforms              - steam, xbox, playstation store, epic, gog, etc
-- listings               - a game's price on a specific platform right now
-- price_history          - every price we've ever logged for a listing
-- notification_categories - user-defined groups like "hunting hard" or "muted", each with its own check schedule
-- price_alerts           - wishlist + target price, tagged with a category, gets triggered on a price drop (transaction #2)
-- import_log             - tracks api/price-check runs
