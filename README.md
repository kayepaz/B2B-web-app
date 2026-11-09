# B2B Web App

An open-source B2B ordering portal, built as a Progressive Web App (PWA).
Business customers sign in, browse products by category, add items to a
cart and submit an **Order Request**.

> **Status:** early development. You can sign in as a sample user, browse
> categories and products, fill a cart and submit Order Requests. Sending
> to the order-processing system is simulated.

## What it will do

- **Sign-in:** Microsoft Entra single sign-on (SSO). For now this is a
  stub: a sample login page where you pick one of 5 sample users.
- **Browse:** products are organised into categories and subcategories.
- **Cart and checkout:** checking out saves an Order Request in the app
  and pretends to send it to another system for processing. That system
  contacts the customer by email.
- **Order Requests** record only quantities and prices per line. They do
  not calculate taxes, delivery fees or other charges.

## Design principles

- **As few dependencies as possible.** The app is plain HTML, CSS and
  JavaScript, with no framework, no npm packages and no build step. Fewer
  dependencies means less to audit and a smaller attack surface.
- **Works offline.** A service worker caches the app and its data.
- **Browser built-ins only.** IndexedDB stores the cart and Order Requests.

## Try it

The latest version of `main` is published at
**<https://kayepaz.github.io/B2B-web-app/>**.

It's rebuilt automatically by the
[Deploy to GitHub Pages](.github/workflows/pages.yml) workflow whenever
`main` changes. Carts are saved in your own browser only.

## Running it locally

You only need Python 3.7 or newer. There is nothing to install.

```sh
# 1. Generate the sample data (5 customers, 4,000 products and their images)
python3 tools/generate_data.py

# 2. Serve the app locally
python3 -m http.server 8000 --directory app
```

Then open <http://localhost:8000>. Browsers allow service workers on
`localhost`, so the PWA features will work without HTTPS during
development.

The generator is deterministic: the same `--seed` always produces the same
data. Run `python3 tools/generate_data.py --help` for options, such as
`--products 500` for a smaller data set.

## Project layout

```
app/                 The PWA itself (served as static files)
  index.html         The single page the app runs in
  css/styles.css     All styles
  js/app.js          Entry point: routing and page rendering
  js/views.js        One function per screen
  js/data.js         Loads the data files and builds lookups
  js/db.js           The IndexedDB database (cart and Order Requests)
  js/cart.js         Each customer's cart
  js/orders.js       Creating, storing and sending Order Requests
  js/api.js          Pretend order-processing server (replace for real use)
  js/session.js      Stub sign-in (stand-in for Entra SSO)
  js/dom.js          Safe element builder (no innerHTML)
  js/format.js       Price and number formatting
  data/              Generated JSON data (not committed)
  images/products/   Generated product images (not committed)
docs/                Project documentation
  data-model.md      Shape of each data file
tools/
  generate_data.py   Sample data generator (Python standard library only)
```

## Sample data

All sample data is fictional:

- Products are made-up items such as widgets, gizmos and sprockets.
- UPCs start with `4`, the range reserved for in-store use, so they never
  match a real retail product. Check digits are valid.
- Phone numbers use `555-01xx`, which is reserved for fictional use.
- Email addresses use the reserved `.example` domain.

See [docs/data-model.md](docs/data-model.md) for the data format.

## License

[0BSD](LICENSE): use it for anything, no attribution required.
