# B2B Web App

An open-source B2B ordering portal, built as a Progressive Web App (PWA).
Business customers sign in, browse products by category, add items to a
cart and submit an **Order Request**.

> **Status:** early development. You can sign in as a sample user, browse,
> search or scan products, re-order past items, fill a cart and submit
> Order Requests, online or offline. Sending to the order-processing system is simulated.

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
`main` changes. Carts and Order Requests are saved in your own browser only.

### Install it and use it offline

- **Chrome or Edge (Windows, Mac, Linux, Android):** click **Install app**
  in the header, or use the install icon in the address bar.
- **iPhone or iPad (Safari):** tap **Share**, then **Add to Home Screen**.

After the first visit the app works offline: you can browse every product
(images you've already seen, plus a placeholder for the rest), fill your
cart and submit Order Requests. They're sent automatically when you
reconnect.

### Sorting, filtering and views

Every page that lists products (subcategories, search results and
Re-Order) can:

- **Sort** by name (A to Z or Z to A) or price (low to high or high to
  low). Search results can also be sorted by best match, and Re-Order by
  most recently ordered.
- **Filter by availability:** Active, Backordered and Discontinued, each
  with a count.
- **Filter by name:** plain text matches anywhere in the name; `*` matches
  any text and `?` any single character, so `apex*` finds names starting
  with "Apex" and `*cs-1??` finds models CS-100 to CS-199.
- **Switch between tiles and a compact list.** Your choice of view is
  remembered, and each kind of page remembers its sort.

### Scanning barcodes

- **Camera:** tap **Scan** in the header, then **Start camera**. Choose
  whether a scan opens the product or **quick-adds** one to the cart so
  you can keep scanning (each item counts once while it stays in view).
- **Handheld USB or Bluetooth scanners** work on any page with no setup:
  scanning opens the product, or quick-adds when the Scan page is in that
  mode.
- **No camera?** Type the UPC on the Scan page.
- **Something to scan:** the products are made up, so every product page
  shows its barcode, and **Scan → sample barcode sheet** has a printable
  page of 34 barcodes (including a backordered and a discontinued
  product, and one that isn't in the catalogue).

The camera uses the browser's built-in barcode reader where there is one
(Chrome and Edge on Android, ChromeOS and macOS) and the app's own reader
everywhere else, including iPhone, Firefox and Windows. Images are processed
on the device and never uploaded.

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

If you add a file to `app/`, also add it to `APP_FILES` in `app/sw.js`
so it works offline. `python3 tools/check_offline_files.py` checks this,
and the deploy fails if something is missing.

The generator is deterministic: the same `--seed` always produces the same
data. Run `python3 tools/generate_data.py --help` for options, such as
`--products 500` for a smaller data set.

## Project layout

```
app/                 The PWA itself (served as static files)
  index.html         The single page the app runs in
  manifest.webmanifest  App name, icons and colours for installing
  sw.js              Service worker: offline support
  icons/             App icons
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
  js/format.js       Price, date and address formatting
  js/pwa.js          Registers the service worker; Install button; offline notice
  js/search.js       Product search
  js/listview.js     Sorting, filters and tiles/list view for product lists
  js/barcode.js      Draws and reads UPC-A / EAN-13 barcodes (no libraries)
  js/scanner.js      Camera and handheld-scanner input
  js/scanview.js     The Scan page
  data/              Generated JSON data (not committed)
  images/products/   Generated product images (not committed)
docs/                Project documentation
  data-model.md      Shape of each data file
tools/
  generate_data.py   Sample data generator (Python standard library only)
  check_offline_files.py  Checks every app file is listed in sw.js
```

## Sample data

All sample data is fictional:

- Products are made-up items such as widgets, gizmos and sprockets.
- UPCs start with `4`, the range reserved for in-store use, so they never
  match a real retail product. Check digits are valid.
- Phone numbers use `555-01xx`, which is reserved for fictional use.
- Email addresses use the reserved `.example` domain.

See [docs/data-model.md](docs/data-model.md) for the data format.

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability privately
and how the project keeps its attack surface small.

## License

[0BSD](LICENSE): use it for anything, no attribution required.
