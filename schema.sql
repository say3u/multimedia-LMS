-- Media Library Tracker - Database Schema
-- CS 514 Final Project
--
-- all the tables for the project, commented section by section so
-- it's easier to follow what each one does and why

CREATE DATABASE IF NOT EXISTS media_tracker;
USE media_tracker;

-- USERS TABLE
-- pretty standard accounts table, nothing crazy here.
-- every other table that needs to know "which user" links back to this
-- one using user_id as a foreign key
CREATE TABLE users (
    user_id         INT AUTO_INCREMENT PRIMARY KEY, -- mysql handles the numbering for us
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,          -- obviously don't store plain passwords
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- MEDIA_ITEMS TABLE
-- one row = one book/movie/show/game. doesn't matter if it came from
-- an api call or one of the scrapers, it all lands here the same way.
-- we added "source" + "external_id" so we know where each item came
-- from and don't accidentally add the same movie twice from two
-- different places
CREATE TABLE media_items (
    media_id        INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    media_type      ENUM('book','movie','show','game') NOT NULL, -- locking this to just these 4 for now
    genre           VARCHAR(100),
    creator         VARCHAR(255),          -- author/director/studio/dev, whatever applies
    release_year    SMALLINT,
    synopsis        TEXT,                  -- these can get long so not using varchar
    source          VARCHAR(50) NOT NULL,  -- 'tmdb', 'open_library', 'igdb', or our own scraper name
    external_id     VARCHAR(255),          -- whatever id that source uses for this item
    source_url      VARCHAR(500),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_source_item (source, external_id) -- so we can't double-import the same thing
) ENGINE=InnoDB;

-- USER_MEDIA TABLE -- probably the most important table honestly
-- this is the join table connecting users to media items. we needed
-- this because one user can track a ton of items, and one item can be
-- tracked by a ton of users, so it's many-to-many and you can't just
-- stick a foreign key on one side. this is also where we store the
-- stuff specific to THAT user + THAT item combo, like their status
-- and personal notes
CREATE TABLE user_media (
    user_media_id   INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    media_id        INT NOT NULL,
    status          ENUM('want_to_try','in_progress','completed') NOT NULL DEFAULT 'want_to_try',
    rating          TINYINT,               -- 1-10, null until they actually rate it
    notes           TEXT,                  -- like "sarah recommended this, said it was great"
    added_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_media (user_id, media_id) -- can't add the same item twice to your own list
) ENGINE=InnoDB;
-- side note: ON DELETE CASCADE means if a user's account gets deleted
-- all their rows here get cleaned up automatically instead of leaving
-- broken references lying around

-- STATUS_HISTORY TABLE
-- user_media only stores whatever your CURRENT status is, it doesn't
-- remember what it used to be. so if we want to show stuff like
-- "you completed 5 things this month" we need somewhere to actually
-- log every time a status changes, which is what this table is for
CREATE TABLE status_history (
    history_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_media_id   INT NOT NULL,
    old_status      ENUM('want_to_try','in_progress','completed'),
    new_status      ENUM('want_to_try','in_progress','completed') NOT NULL,
    changed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_media_id) REFERENCES user_media(user_media_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- LISTS + LIST_ITEMS
-- custom lists users can make, like "comfort rewatches" or w/e they
-- want to call it. same many-to-many deal as user_media above -- one
-- list has multiple items, one item can be on multiple lists, so we
-- need list_items in between to connect them
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
    media_id        INT NOT NULL,
    added_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (list_id, media_id), -- using both columns together as the key here
    FOREIGN KEY (list_id) REFERENCES lists(list_id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- FOLLOWS TABLE
-- the social part -- users following other users. this one's a
-- little different because BOTH sides point back to the same users
-- table (a user follows another user, so it references itself
-- basically)
CREATE TABLE follows (
    follower_id     INT NOT NULL,  -- the one doing the following
    followee_id     INT NOT NULL,  -- the one getting followed
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, followee_id),
    FOREIGN KEY (follower_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (followee_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CHECK (follower_id <> followee_id) -- lol no following yourself
) ENGINE=InnoDB;

-- LOANS TABLE
-- for lending an item to someone else. this is the table we're using
-- for the transactions part of the rubric -- borrowing something
-- needs to either fully happen or not happen at all, we can't have
-- two people both "successfully" borrow the same copy at the same
-- time. see the borrow_item procedure at the bottom, that's where we
-- actually handle that
CREATE TABLE loans (
    loan_id         INT AUTO_INCREMENT PRIMARY KEY,
    media_id        INT NOT NULL,
    lender_id       INT NOT NULL,   -- who owns it
    borrower_id     INT NOT NULL,   -- who's borrowing it
    loaned_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_at          DATE,
    returned_at     TIMESTAMP NULL, -- null until it actually gets returned
    status          ENUM('active','returned','overdue') NOT NULL DEFAULT 'active',
    FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE CASCADE,
    FOREIGN KEY (lender_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (borrower_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CHECK (lender_id <> borrower_id) -- can't lend to yourself either
) ENGINE=InnoDB;

-- REVIEWS TABLE
-- keeping this separate from the "notes" field in user_media on
-- purpose -- notes are private just for you, reviews are meant to be
-- public so other people can see them
CREATE TABLE reviews (
    review_id       INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    media_id        INT NOT NULL,
    rating          TINYINT NOT NULL,
    review_text     TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES media_items(media_id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_review (user_id, media_id) -- one review per person per item
) ENGINE=InnoDB;

-- IMPORT_LOG TABLE
-- honestly not 100% required for the app to work but it's a nice
-- little extra -- every time we pull data from an api or run a
-- scraper, it logs a row here. good for debugging when a scraper
-- breaks (which it probably will at some point lol) and it's also
-- something to point to for the "database programming" part of the
-- rubric
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
-- this is our transaction example for the rubric. basically the
-- problem is: what if two people try to borrow the same item at the
-- exact same time? we don't want both of those to go through. a
-- transaction lets us check "is this already loaned" AND create the
-- new loan as one single all-or-nothing step so nothing weird can
-- happen in between.
--
-- quick rundown if anyone forgets how this works later:
-- - START TRANSACTION begins it
-- - FOR UPDATE locks the row we're checking so nobody else can grab
--   it while we're in the middle of deciding
-- - if it's already loaned, we ROLLBACK (undo/cancel, nothing saved)
-- - if it's free, we INSERT the loan and COMMIT (actually save it)
DELIMITER //
CREATE PROCEDURE borrow_item (
    IN p_media_id INT,
    IN p_lender_id INT,
    IN p_borrower_id INT,
    IN p_due_at DATE
)
BEGIN
    DECLARE already_loaned INT;

    START TRANSACTION;

    SELECT COUNT(*) INTO already_loaned
    FROM loans
    WHERE media_id = p_media_id AND status = 'active'
    FOR UPDATE;

    IF already_loaned > 0 THEN
        -- somebody beat us to it, cancel out
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item is already loaned out.';
    ELSE
        -- all good, nobody has it right now
        INSERT INTO loans (media_id, lender_id, borrower_id, due_at, status)
        VALUES (p_media_id, p_lender_id, p_borrower_id, p_due_at, 'active');
        COMMIT;
    END IF;
END //
DELIMITER ;

-- quick recap of all the tables in case anyone forgets what's what:
-- users            - accounts
-- media_items      - the actual books/movies/shows/games
-- user_media       - connects users to items + tracks status/rating/notes
-- status_history   - logs status changes over time
-- lists            - custom lists people make
-- list_items       - connects lists to items
-- follows          - who's following who
-- loans            - lending stuff between users (has the transaction)
-- reviews          - public reviews
-- import_log       - tracks api/scraper runs
--
-- (still need to double check the rating scale is consistent between
-- user_media and reviews before we go too much further -- pretty sure
-- we said 1-10 for both but worth confirming as a team)
