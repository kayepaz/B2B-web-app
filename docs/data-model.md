# Data model

The app downloads these JSON files from `app/data/`. They are produced by
`tools/generate_data.py`.

Conventions:

- IDs are strings (for example `prod-1`, `cust-3`).
- Money is stored as an integer number of **cents** (`priceCents: 2349`
  means $23.49). This avoids rounding errors from floating-point numbers.
- All addresses use the same shape (see [Address](#address)).

## index.json

Describes the data set. The app can compare `dataVersion` with what it has
cached to decide whether to download the data again.

```json
{
  "dataVersion": 1,
  "seed": 42,
  "counts": { "categories": 8, "subcategories": 32, "products": 4000,
              "companies": 3, "customers": 5 },
  "files": ["categories.json", "products.json", "companies.json", "customers.json"]
}
```

## categories.json

A list of categories, each with its subcategories.

```json
{
  "id": "cat-1",
  "name": "Widgets",
  "subcategories": [
    { "id": "cat-1-1", "name": "Standard Widgets" }
  ]
}
```

## products.json

Every product belongs to one category and one subcategory.

| Field           | Description                                          |
|-----------------|------------------------------------------------------|
| `id`            | Unique ID                                            |
| `itemNumber`    | Item number shown to customers, e.g. `WID-00001`     |
| `name`          | Product name                                         |
| `description`   | Product description                                  |
| `status`        | `Active`, `Backordered` or `Discontinued`            |
| `priceCents`    | Price in cents                                       |
| `upc`           | 12-digit UPC-A code with a valid check digit         |
| `categoryId`    | ID of the category                                   |
| `subcategoryId` | ID of the subcategory (always inside that category)  |
| `image`         | Image path relative to `app/`                        |

```json
{
  "id": "prod-1",
  "itemNumber": "WID-00001",
  "name": "Cobalt Steel Widget CS-125",
  "description": "A galvanized steel widget designed for cold-storage environments. ...",
  "status": "Active",
  "priceCents": 2349,
  "upc": "438908386375",
  "categoryId": "cat-1",
  "subcategoryId": "cat-1-1",
  "image": "images/products/WID-00001.svg"
}
```

## companies.json

A company has one or more locations.

```json
{
  "id": "co-1",
  "name": "Cedarline Fabrication Ltd.",
  "locations": [
    { "id": "loc-1", "name": "Head Office", "phone": "604-555-0101",
      "address": { "...": "see Address" } }
  ]
}
```

## customers.json

A customer belongs to one company. The 5 customers here are the sample
users on the stub login page.

```json
{
  "id": "cust-1",
  "firstName": "Avery",
  "lastName": "Chen",
  "email": "avery.chen@cedarline.example",
  "phone": "604-555-0131",
  "address": { "...": "see Address" },
  "companyId": "co-1"
}
```

`email` is not in the original spec, but Order Requests are confirmed by
email, so each customer needs one.

## Address

```json
{
  "line1": "1200 Foundry Way",
  "line2": "Suite 4",
  "city": "Burnaby",
  "region": "BC",
  "postalCode": "V5A 0A1",
  "country": "Canada"
}
```

`line2` is an empty string when not used.

## Data stored in the browser

These are created in the app and kept in the browser's IndexedDB database
(`b2b-web-app`), not downloaded. Storage changes go through `upgrade()` in
`app/js/db.js`, which keeps existing data.

### carts

One record per customer.

```json
{
  "customerId": "cust-4",
  "items": [{ "productId": "prod-1", "quantity": 3 }],
  "updatedAt": "2026-11-09T19:52:44.000Z"
}
```

Carts store no prices; the current product price is always shown.

### orderRequests

One record per Order Request, indexed by `customerId`. Each line records the
product, the quantity and the **unit price at the moment of submission**. No
taxes, delivery fees or other charges are calculated.

```json
{
  "id": "OR-20261109-G2JCJ",
  "customerId": "cust-4",
  "companyId": "co-3",
  "locationId": "loc-5",
  "createdAt": "2026-11-09T19:52:44.000Z",
  "status": "sent",
  "sentAt": "2026-11-09T19:52:45.000Z",
  "confirmationNumber": "CONF-EVP9KY34",
  "lines": [
    { "productId": "prod-1", "itemNumber": "WID-00001",
      "name": "Cobalt Steel Widget CS-125", "quantity": 3, "unitPriceCents": 2349 }
  ],
  "totalCents": 19345
}
```

`locationId` is the ship-to location, chosen from the customer's company's
locations at checkout.

| `status` | Meaning                                                         |
|----------|-----------------------------------------------------------------|
| `queued` | Saved; waiting to send (for example, while offline)             |
| `sent`   | Accepted by the processing system; the customer will be emailed |

`sentAt` and `confirmationNumber` are only present once sent. Sending is
simulated in `app/js/api.js`.
