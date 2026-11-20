# GameBuddy API

what the backend gives the frontend. if a screen needs data that isn't
here, tell me and I'll add it.

- base url: same origin as the app (locally vite forwards `/api` to flask on :5001)
- everything is JSON
- **prices are numbers, not strings** (`23.99`, not `"$23.99"`). `null` = no price
- errors look like `{ "error": "message" }` with 400 / 401 / 403 / 404 / 409
- 🔒 = needs login. send the token from register/login as
  `Authorization: Bearer <token>`
- times are ISO strings in UTC like `"2026-11-20T00:46:00Z"` (the Z matters --
  `new Date(...)` turns it into the viewer's local time). plain dates like
  `bought_at` are just `"2026-11-15"`

**contents:** [accounts](#accounts) · [games + search](#games--search) ·
[watchlist](#watchlist-price-tracking) · [alerts](#alerts) ·
[library (phase 1.5)](#library-phase-15) ·
[user-added games + mods](#user-added-games--mods-phase-2) ·
[social](#social-phase-2)

---

## Accounts

| | endpoint | body | returns |
|---|---|---|---|
| | `POST /api/auth/register` | `{username, email, password}` (username 3+, password 8+ chars) | `201 {token, user}` |
| | `POST /api/auth/login` | `{email, password}` | `200 {token, user}` / `401` |
| 🔒 | `GET /api/auth/me` | | `{user}` |
| 🔒 | `PATCH /api/me` | `{profile_visibility: "public" \| "followers" \| "private"}` | `{profile_visibility}` |

`user` = `{user_id, username, email, profile_visibility, created_at}`.
new accounts get 3 notification categories: Hunting hard, Someday maybe, Muted.

---

## Games + search

### `GET /api/games?q=hollow&limit=10`
quick title search (the add-game popup uses this). no login needed.
`{games: [{game_id, title, genre, developer, publisher, release_year, synopsis, ...}], total}`

### 🔒 `GET /api/search`
search with prices. params (all optional, but need `q` with 2+ chars OR a filter):

| param | example | |
|---|---|---|
| `q` | `stardew` | title contains |
| `tag` | `mod`, `vr`, `obscure` | only games with that tag |
| `store_type` | `pc`, `console`, `vr`, `mobile`, `mods` | only games sold on that kind of store; count + best price only look at those stores |

```json
{ "results": [
  { "game_id": 2, "title": "Stardew Valley", "stores_found": 2,
    "best_price": 4.99, "best_store": "Apple App Store", "on_watchlist": true } ] }
```

### `GET /api/games/:id?range=3M|1Y|All` (login optional)
the game page. logged in = you also get your watchlist info + friends.

```json
{
  "game_id": 1, "title": "Hollow Knight", "developer": "Team Cherry",
  "publisher": "Team Cherry", "release_year": 2017, "synopsis": "...",
  "platform": "PC",
  "on_watchlist": true, "my_status": "want_to_play", "watchlist_since": "...",
  "notify": true, "target_price": 10.0, "min_price": 5.0,
  "best": { "store": "Steam", "store_type": "pc", "price": 7.49, "regular_price": 14.99,
            "discount_percent": 50.0, "lowest_ever": 7.49, "url": "https://...", "currency": "USD",
            "last_checked_at": "..." },
  "stores": [ /* same shape as best, cheapest first */ ],
  "lowest_ever": 7.49,
  "history": [ { "date": "...", "store": "Steam", "price": 14.99 } ],
  "submitted_by": null, "base_game_id": null, "base_game_title": null,
  "mod_count": 1, "tags": [],
  "friends_want": ["carol"]
}
```
- `my_status` is your user_games status for it (`want_to_play`, `backlog`,
  `playing`, `completed`) or null if it's not on your lists
- `store_type` lets the page group pc vs mobile prices
- `submitted_by` is a username if a user added the game (null = imported)
- `base_game_*` is set if this is a mod; `mod_count` = how many mods it has

---

## Watchlist (price tracking)

a watchlist game = your `want_to_play` games. only these get price alerts.

### 🔒 `GET /api/watchlist?store_type=pc`
`store_type` is optional -- with it, best price only counts that kind of
store (so a $4.99 iphone sale doesn't show for a pc player).
```json
{ "total": 1, "stores": ["Steam"], "games": [
  { "game_id": 2, "title": "Stardew Valley", "best_price": 11.99, "regular_price": 14.99,
    "discount_percent": 20.0, "store": "Steam", "last_checked_at": "...",
    "target_price": 12.5, "min_price": null, "notify": true, "notify_enabled": true,
    "category": { "category_id": 1, "name": "Hunting hard", "check_interval_minutes": 60 },
    "added_at": "..." } ] }
```

### 🔒 `POST /api/watchlist`
```json
{ "game_id": 2, "target_price": 20, "min_price": 10, "category_id": 1, "notify_enabled": true }
```
only `game_id` is required. no category = your first one. `201` / `409` if already on it.
- alert fires when a price is **≤ target_price** (and **≥ min_price** if set -- that's
  the "between $X and $Y" option). min can't be above target.

### 🔒 `PATCH /api/watchlist/:game_id`
any of `{category_id, target_price, min_price, notify_enabled}`.

### 🔒 `DELETE /api/watchlist/:game_id` → `204`

### 🔒 `GET /api/categories`
`{categories: [{category_id, name, check_interval_minutes}]}` (null interval = muted)

### 🔒 `GET /api/games/user-games?status=...` / `POST /api/games/user-games`
harish's original endpoints for the dashboard -- still work. `status` is
`want_to_play`, `backlog`, `playing`, `completed`. POST `{game_id, status}`
adds it or changes its status.

---

## Alerts

### 🔒 `GET /api/alerts`
price drops that hit your target, newest first. made by the
`record_price_check` procedure whenever a price check comes in.
```json
{ "alerts": [ { "notification_id": 1, "game_id": 1, "title": "Hollow Knight",
  "store": "Steam", "price": 7.49, "currency": "USD", "target_price": 10.0,
  "is_lowest_ever": true, "is_read": false, "triggered_at": "..." } ] }
```

---

## Library (phase 1.5)

games you already own: status `backlog` (own it, not played), `playing`,
`completed`. **not price tracked** -- moving a game here from the
watchlist stops its alerts.

### 🔒 `GET /api/library?status=backlog&sort=recent`
sort: `recent` (bought date), `name`, `paid_asc`, `paid_desc`, `saved`
```json
{ "total": 2, "total_saved": 5.0, "games": [
  { "game_id": 2, "title": "Stardew Valley", "status": "backlog", "store": "Steam",
    "paid_price": 9.99, "bought_at": "2026-11-15", "saved": 5.0, "updated_at": "..." } ] }
```
`saved` = that store's regular price minus what you paid (null if unknown).

### 🔒 `POST /api/library`
```json
{ "game_id": 2, "status": "backlog", "store": "Steam", "paid_price": 9.99, "bought_at": "2026-11-15" }
```
only `game_id` needed. if it was on your watchlist it moves over (`200`),
otherwise `201`. `store` can be any name (PlayStation Store, physical copy...).

### 🔒 `PATCH /api/library/:game_id` — any of `{status, store, paid_price, bought_at}`
### 🔒 `DELETE /api/library/:game_id` → `204`
### 🔒 `GET /api/library/:game_id/history`
when you wishlisted / bought / started / finished it:
`{history: [{old_status, new_status, changed_at}]}`

---

## User-added games + mods (phase 2)

for stuff we don't import: mods, obscure / delisted games, other stores.
**only the person who added a game can edit it or log prices for it** (team decision).

### 🔒 `POST /api/games`
```json
{ "title": "Cave Story (Freeware)", "developer": "Studio Pixel", "release_year": 2004,
  "genre": "Platformer", "publisher": null, "synopsis": "...",
  "tags": ["obscure", "freeware"], "base_game_id": null }
```
- `base_game_id` = this is a mod for that game (mods automatically get the `mod` tag)
- `409 {error, game}` if we already have a game with that name (send `"force": true`
  if it really is a different game)
- returns `201 {game: {game_id, title, ..., submitted_by, base_game_id, base_game_title, mod_count, tags}}`

### 🔒 `PATCH /api/games/:id` — any of the fields above (`tags` replaces the list). `403` if not yours.

### 🔒 `POST /api/games/:id/prices`
log a price you found. goes through the same `record_price_check` as the
importers, so it shows in price history and can trigger people's alerts.
```json
{ "store": "itch.io", "price": 4.49, "regular_price": 9.99,
  "store_type": "pc", "url": "https://example.itch.io/cave" }
```

### `GET /api/games/:id/mods`
`{mods: [{game_id, title, developer, submitted_by, best_price}]}`

---

## Social (phase 2)

privacy: you can see someone's wishlist / library / activity / reviews if
their profile is `public`, or `followers` and you follow them. `private`
= only them. new accounts start as public (team decision).

| | endpoint | returns |
|---|---|---|
| 🔒 | `GET /api/users?q=ca` | `{users: [{username, is_following}]}` |
| 🔒 | `POST /api/users/:username/follow` | `201` / `409` already / `400` yourself |
| 🔒 | `DELETE /api/users/:username/follow` | `204` |
| 🔒 | `GET /api/users/:username` | profile, see below |
| 🔒 | `GET /api/feed?before=<event_id>` | friends feed, see below |
| 🔒 | `GET /api/games/:id/friends` | `{friends_want: ["carol"]}` |
| 🔒 | `GET /api/games/:id/reviews` | reviews, friends first |
| 🔒 | `POST /api/games/:id/reviews` | `{rating: 1-10, review_text}` → `201` new / `200` updated |
| 🔒 | `DELETE /api/games/:id/reviews` | `204` |

**profile:**
```json
{ "user": { "username": "alice", "profile_visibility": "public", "followers": 1,
            "following": 1, "is_following": true, "can_see": true, "created_at": "..." },
  "wishlist": [ { "game_id": 1, "title": "Hollow Knight", "best_price": 14.99, "store": "Steam" } ],
  "library": { "backlog": 1, "completed": 3 },
  "activity": [ { "event_type": "reviewed", "detail": "9/10", "game_id": 1, "title": "Hollow Knight", "created_at": "..." } ] }
```
if `can_see` is false, `wishlist` / `library` / `activity` are `null`.

**feed** (30 at a time, newest first -- pass `next_before` as `before` for more):
```json
{ "events": [ { "event_id": 3, "username": "alice", "event_type": "reviewed",
               "detail": "9/10", "game_id": 1, "title": "Hollow Knight", "created_at": "..." } ],
  "next_before": null }
```
`event_type`: `wishlisted`, `bought`, `started`, `finished`, `reviewed`.
these are written by triggers in schema.sql, not the backend.

**reviews:**
```json
{ "average_rating": 6.5, "review_count": 2, "reviews": [
  { "username": "alice", "rating": 10, "review_text": "so good", "is_friend": true, "created_at": "..." } ] }
```
