# GameBuddy API (draft)

what the backend gives the frontend. based on the screens in the mockup
(watchlist, game page, add game, alerts). if something on a screen needs
data that isn't here, tell me and I'll add it.

- base url (local): `http://localhost:5000`
- everything is JSON
- **prices are numbers, not strings** (`23.99`, not `"$23.99"`), so the
  frontend formats them. `null` means we don't have a price
- errors come back as `{ "error": "message" }` with a 400 / 404 / 500
- no login for the draft, it's one local user (multi-user is phase 2)
- `platform` is always `"PC"` for now since we only import Steam / GOG /
  Epic. console stores come later

---

## Watchlist page

### `GET /api/watchlist`

every game you're tracking, with its best price right now.

query params (all optional):

| param | values | default |
|---|---|---|
| `sort` | `drop`, `price_asc`, `price_desc`, `name`, `recent` | `drop` |
| `store` | a store name like `Steam` | all stores |
| `platform` | `PC`, `PS5`, `Xbox Series X\|S`, `Switch` | all |
| `on_sale` | `1` = only games with a discount | off |
| `notify` | `1` = only games with notifications on | off |

response:

```json
{
  "total": 24,
  "stores": ["Epic Games Store", "GOG", "Steam"],
  "games": [
    {
      "game_id": 12,
      "title": "Hades II",
      "best_price": 23.99,
      "regular_price": 29.99,
      "discount_percent": 20,
      "store": "Steam",
      "platform": "PC",
      "lowest_ever": 23.99,
      "is_lowest_ever": true,
      "notify": true,
      "added_at": "2026-03-14T18:22:00"
    }
  ]
}
```

- `total` is before filters, `games` is after, so the "8 of 24 games" label works
- `stores` is every store in your list, for the store filter
- `discount_percent` is `0` when it's not on sale, `null` if we don't know
  the regular price
- `store` is whichever store has the best price right now

---

## Game page

### `GET /api/games/:game_id`

query params: `range` = `3M`, `1Y`, or `All` (for the price chart, default `1Y`)

```json
{
  "game_id": 12,
  "title": "Hades II",
  "developer": "Supergiant Games",
  "publisher": "Supergiant Games",
  "release_year": 2025,
  "synopsis": "...",
  "platform": "PC",
  "on_watchlist": true,
  "watchlist_since": "2025-03-14T18:22:00",
  "notify": true,
  "best": {
    "store": "Steam",
    "price": 23.99,
    "regular_price": 29.99,
    "discount_percent": 20,
    "url": "https://store.steampowered.com/app/1145350"
  },
  "lowest_ever": 23.99,
  "stores": [
    {
      "store": "Steam",
      "price": 23.99,
      "regular_price": 29.99,
      "discount_percent": 20,
      "lowest_ever": 23.99,
      "url": "https://store.steampowered.com/app/1145350",
      "last_checked_at": "2026-10-11T12:00:00"
    }
  ],
  "history": [
    { "date": "2026-09-01", "store": "Steam", "price": 29.99 },
    { "date": "2026-10-11", "store": "Steam", "price": 23.99 }
  ]
}
```

- `stores` is every store we have the game on, cheapest first. the mockup's
  "Other stores" table is this minus `best`
- `history` is one point per price check, oldest first, for the chart.
  `High` / `Low` on the chart = max / min of these

---

## Add game popup

### `GET /api/search?q=hollow kn`

searches games we already have in the database by title (min 2 characters).

```json
{
  "results": [
    {
      "game_id": 3,
      "title": "Hollow Knight",
      "stores_found": 2,
      "best_price": 7.49,
      "best_store": "Epic Games Store",
      "on_watchlist": false
    }
  ]
}
```

- for the draft this only finds games the import scripts already pulled in.
  searching the stores live ("Searching 7 stores") is a later thing

### `POST /api/watchlist`

```json
{ "game_id": 3, "notify": true }
```

returns `201` with the same object as one item from `GET /api/watchlist`.
`409` if it's already on the watchlist.

### `PATCH /api/watchlist/:game_id`

turn notifications on / off (the bell button).

```json
{ "notify": false }
```

returns `200` with the updated watchlist item.

### `DELETE /api/watchlist/:game_id`

the Remove button on the game page. returns `204`, no body.

---

## Alerts panel

### `GET /api/alerts`

price drops on games with notifications on, newest first.

```json
{
  "alerts": [
    {
      "game_id": 12,
      "title": "Hades II",
      "store": "Steam",
      "price": 23.99,
      "discount_percent": 20,
      "is_lowest_ever": true,
      "triggered_at": "2026-10-11T12:00:00"
    }
  ]
}
```

the popup toast ("Hades II dropped to $23.99 on Steam") can just use the
newest one of these.

---

## Not in the draft

- **My library page** (games you bought, paid, saved): needs a purchases
  table, phase 1.5
- login / accounts, social, notification categories: phase 2
