#!/usr/bin/env python3
"""Generate the sample data for the B2B Web App.

Uses only the Python standard library, so there is nothing to install.

The output is deterministic: running the script again with the same seed
produces byte-for-byte identical files.

Everything it produces is fictional:
  * Product names are made up ("widgets", "gizmos", ...).
  * UPCs start with 4, the range reserved for in-store use, so they never
    match a real retail product.
  * Phone numbers use 555-01xx, which is reserved for fictional use.
  * Email addresses use the reserved .example top-level domain.

Usage:
    python3 tools/generate_data.py                # writes into ./app
    python3 tools/generate_data.py --products 500 # smaller set for testing
"""

import argparse
import html
import json
import random
import shutil
from pathlib import Path

DATA_VERSION = 1

# --------------------------------------------------------------------------
# Catalog structure: category -> subcategories.
# Each subcategory names the noun used in its product names.
# --------------------------------------------------------------------------

CATALOG = [
    ("Widgets", "WID", "widget", [
        ("Standard Widgets", "Widget"),
        ("Heavy-Duty Widgets", "Heavy-Duty Widget"),
        ("Micro Widgets", "Micro-Widget"),
        ("Rotary Widgets", "Rotary Widget"),
        ("Widget Mounts", "Widget Mount"),
    ]),
    ("Gadgets", "GAD", "gadget", [
        ("Handheld Gadgets", "Handheld Gadget"),
        ("Desktop Gadgets", "Desk Gadget"),
        ("Pocket Gadgets", "Pocket Gadget"),
        ("Gadget Power Cells", "Power Cell"),
    ]),
    ("Sprockets", "SPR", "sprocket", [
        ("Drive Sprockets", "Drive Sprocket"),
        ("Idler Sprockets", "Idler Sprocket"),
        ("Double Sprockets", "Double Sprocket"),
        ("Sprocket Chains", "Sprocket Chain"),
    ]),
    ("Gizmos", "GIZ", "gizmo", [
        ("Electronic Gizmos", "Gizmo"),
        ("Mechanical Gizmos", "Mech Gizmo"),
        ("Gizmo Kits", "Gizmo Kit"),
        ("Gizmo Cases", "Gizmo Case"),
    ]),
    ("Doohickeys", "DOO", "doohickey", [
        ("Doohickey Clips", "Doohickey Clip"),
        ("Doohickey Brackets", "Doohickey Bracket"),
        ("Doohickey Hinges", "Doohickey Hinge"),
        ("Doohickey Pins", "Doohickey Pin"),
    ]),
    ("Thingamajigs", "THG", "thingamajig", [
        ("Precision Thingamajigs", "Precision Thingamajig"),
        ("Industrial Thingamajigs", "Thingamajig"),
        ("Thingamajig Adapters", "Thingamajig Adapter"),
        ("Thingamajig Spares", "Thingamajig Spare"),
    ]),
    ("Whatsits", "WHT", "whatsit", [
        ("Round Whatsits", "Round Whatsit"),
        ("Square Whatsits", "Square Whatsit"),
        ("Flexible Whatsits", "Flex Whatsit"),
    ]),
    ("Contraptions", "CON", "contraption", [
        ("Small Contraptions", "Compact Contraption"),
        ("Large Contraptions", "Contraption"),
        ("Contraption Parts", "Contraption Part"),
        ("Contraption Tools", "Contraption Tool"),
    ]),
]

ADJECTIVES = [
    "Turbo", "Ultra", "Classic", "Pro", "Compact", "Rugged", "Deluxe",
    "Precision", "Quantum", "Flexi", "Swift", "Titan", "Nimble", "Prime",
    "Vector", "Apex", "Polar", "Solar", "Lunar", "Zephyr", "Cobalt",
    "Granite", "Summit", "Orbit", "Pulse", "Echo", "Nova", "Delta",
    "Harbour", "Cedar",
]

MATERIALS = [
    "Brass", "Steel", "Aluminum", "Nylon", "Copper", "Titanium", "Carbon",
    "Polymer", "Ceramic", "Bronze", "Composite", "Zinc",
]

FINISHES = ["matte", "polished", "powder-coated", "anodized", "brushed", "galvanized"]

USES = [
    "general workshop use", "light assembly lines", "field maintenance",
    "high-cycle production", "cold-storage environments",
    "outdoor installations", "precision fitting work", "everyday repairs",
    "warehouse racking", "prototype builds",
]

FEATURES = [
    "Rated for over 100,000 cycles.",
    "Tool-free installation.",
    "Corrosion-resistant finish.",
    "Compatible with all standard mounting rails.",
    "Colour-coded for quick identification.",
    "Fits the same footprint as earlier models.",
    "Ships fully assembled.",
    "Includes a quick-start card.",
    "Stackable for compact storage.",
    "Backed by a 2-year limited warranty.",
]

PACKS = ["Sold individually.", "Pack of 5.", "Pack of 10.", "Box of 25.", "Case of 50."]

STATUSES = [("Active", 85), ("Backordered", 10), ("Discontinued", 5)]


def address(line1, city, region, postal, line2="", country="Canada"):
    return {
        "line1": line1,
        "line2": line2,
        "city": city,
        "region": region,
        "postalCode": postal,
        "country": country,
    }


COMPANIES = [
    {
        "id": "co-1",
        "name": "Cedarline Fabrication Ltd.",
        "locations": [
            {"id": "loc-1", "name": "Head Office", "phone": "604-555-0101",
             "address": address("1200 Foundry Way", "Burnaby", "BC", "V5A 0A1")},
            {"id": "loc-2", "name": "Delta Warehouse", "phone": "604-555-0102",
             "address": address("88 Riverbend Road", "Delta", "BC", "V4G 0B2")},
        ],
    },
    {
        "id": "co-2",
        "name": "Harbourview Industrial Supply",
        "locations": [
            {"id": "loc-3", "name": "Main Branch", "phone": "250-555-0111",
             "address": address("45 Quayside Drive", "Victoria", "BC", "V8W 0C3")},
        ],
    },
    {
        "id": "co-3",
        "name": "Pinecrest Maintenance Co.",
        "locations": [
            {"id": "loc-4", "name": "Calgary Depot", "phone": "403-555-0121",
             "address": address("300 Ironwood Street SE", "Calgary", "AB", "T2G 0D4")},
            {"id": "loc-5", "name": "Edmonton Depot", "phone": "780-555-0122",
             "address": address("17 Prairie Gate", "Edmonton", "AB", "T5J 0E5")},
            {"id": "loc-6", "name": "Red Deer Yard", "phone": "403-555-0123",
             "address": address("9 Gravel Pit Lane", "Red Deer", "AB", "T4N 0F6")},
        ],
    },
]

CUSTOMERS = [
    {"id": "cust-1", "firstName": "Avery", "lastName": "Chen",
     "email": "avery.chen@cedarline.example", "phone": "604-555-0131",
     "address": address("1200 Foundry Way", "Burnaby", "BC", "V5A 0A1", line2="Suite 4"),
     "companyId": "co-1"},
    {"id": "cust-2", "firstName": "Jordan", "lastName": "Patel",
     "email": "jordan.patel@cedarline.example", "phone": "604-555-0132",
     "address": address("88 Riverbend Road", "Delta", "BC", "V4G 0B2"),
     "companyId": "co-1"},
    {"id": "cust-3", "firstName": "Morgan", "lastName": "Tremblay",
     "email": "morgan.tremblay@harbourview.example", "phone": "250-555-0133",
     "address": address("45 Quayside Drive", "Victoria", "BC", "V8W 0C3"),
     "companyId": "co-2"},
    {"id": "cust-4", "firstName": "Riley", "lastName": "Okafor",
     "email": "riley.okafor@pinecrest.example", "phone": "403-555-0134",
     "address": address("300 Ironwood Street SE", "Calgary", "AB", "T2G 0D4"),
     "companyId": "co-3"},
    {"id": "cust-5", "firstName": "Sam", "lastName": "Lindqvist",
     "email": "sam.lindqvist@pinecrest.example", "phone": "780-555-0135",
     "address": address("17 Prairie Gate", "Edmonton", "AB", "T5J 0E5"),
     "companyId": "co-3"},
]


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def upc_check_digit(first11):
    """Return the UPC-A check digit for an 11-digit string."""
    odd = sum(int(d) for d in first11[0::2])   # positions 1, 3, 5, ...
    even = sum(int(d) for d in first11[1::2])  # positions 2, 4, 6, ...
    return str((10 - (odd * 3 + even) % 10) % 10)


def make_upc(rng, used):
    while True:
        first11 = "4" + "".join(rng.choice("0123456789") for _ in range(10))
        upc = first11 + upc_check_digit(first11)
        if upc not in used:
            used.add(upc)
            return upc


def weighted_choice(rng, options):
    total = sum(weight for _, weight in options)
    pick = rng.uniform(0, total)
    for value, weight in options:
        pick -= weight
        if pick <= 0:
            return value
    return options[-1][0]


def make_price_cents(rng):
    """Mostly cheap items, with a long tail of expensive ones.
    Prices end in .49, .95 or .99 so they look like real price lists."""
    dollars = max(1, min(4999, int(rng.lognormvariate(3.3, 1.0))))
    return dollars * 100 + rng.choice([49, 95, 99])


# --------------------------------------------------------------------------
# Product images: one small SVG per product, drawn from simple shapes.
# Each category gets its own shape so products are easy to tell apart.
# --------------------------------------------------------------------------

def shape_svg(kind, fill, stroke):
    common = f'fill="{fill}" stroke="{stroke}" stroke-width="4"'
    if kind == "widget":
        return (f'<rect x="50" y="55" width="100" height="70" rx="14" {common}/>'
                f'<circle cx="100" cy="90" r="16" fill="{stroke}"/>')
    if kind == "gadget":
        return (f'<rect x="65" y="35" width="70" height="110" rx="10" {common}/>'
                f'<rect x="75" y="47" width="50" height="60" fill="#ffffff" opacity="0.7"/>')
    if kind == "sprocket":
        teeth = "".join(
            f'<rect x="94" y="32" width="12" height="20" fill="{stroke}" '
            f'transform="rotate({angle} 100 90)"/>'
            for angle in range(0, 360, 30))
        return (teeth + f'<circle cx="100" cy="90" r="40" {common}/>'
                f'<circle cx="100" cy="90" r="12" fill="#ffffff"/>')
    if kind == "gizmo":
        return f'<polygon points="100,38 145,64 145,116 100,142 55,116 55,64" {common}/>'
    if kind == "doohickey":
        return f'<polygon points="100,40 150,135 50,135" {common}/>'
    if kind == "thingamajig":
        return (f'<polygon points="100,35 113,74 154,74 121,98 133,138 100,114 '
                f'67,138 79,98 46,74 87,74" {common}/>')
    if kind == "whatsit":
        return (f'<ellipse cx="100" cy="90" rx="55" ry="40" {common}/>'
                f'<text x="100" y="105" font-size="44" text-anchor="middle" '
                f'fill="{stroke}" font-family="sans-serif">?</text>')
    # contraption
    return (f'<rect x="45" y="60" width="110" height="55" rx="6" {common}/>'
            f'<circle cx="70" cy="125" r="14" {common}/>'
            f'<circle cx="130" cy="125" r="14" {common}/>')


def product_svg(kind, item_number, hue):
    fill = f"hsl({hue}, 65%, 70%)"
    stroke = f"hsl({hue}, 55%, 30%)"
    background = f"hsl({hue}, 40%, 94%)"
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" '
        'width="200" height="200">'
        f'<rect width="200" height="200" fill="{background}"/>'
        + shape_svg(kind, fill, stroke) +
        f'<text x="100" y="182" font-size="16" text-anchor="middle" '
        f'fill="#333333" font-family="sans-serif">{html.escape(item_number)}</text>'
        '</svg>\n'
    )


# --------------------------------------------------------------------------
# Generation
# --------------------------------------------------------------------------

def build_categories():
    categories = []
    for c_index, (name, _prefix, _kind, subs) in enumerate(CATALOG, start=1):
        categories.append({
            "id": f"cat-{c_index}",
            "name": name,
            "subcategories": [
                {"id": f"cat-{c_index}-{s_index}", "name": sub_name}
                for s_index, (sub_name, _noun) in enumerate(subs, start=1)
            ],
        })
    return categories


def build_products(rng, count):
    # Every subcategory gets roughly the same number of products.
    slots = []
    for c_index, (_name, prefix, kind, subs) in enumerate(CATALOG, start=1):
        for s_index, (_sub_name, noun) in enumerate(subs, start=1):
            slots.append((f"cat-{c_index}", f"cat-{c_index}-{s_index}", prefix, kind, noun))

    used_names, used_upcs = set(), set()
    counters = {}
    products, images = [], {}

    for i in range(count):
        category_id, subcategory_id, prefix, kind, noun = slots[i % len(slots)]

        counters[prefix] = counters.get(prefix, 0) + 1
        item_number = f"{prefix}-{counters[prefix]:05d}"

        while True:
            adjective = rng.choice(ADJECTIVES)
            material = rng.choice(MATERIALS)
            model = f"{adjective[0]}{material[0]}-{rng.randint(100, 999)}"
            name = f"{adjective} {material} {noun} {model}"
            if name not in used_names:
                used_names.add(name)
                break

        description = " ".join([
            f"A {rng.choice(FINISHES)} {material.lower()} {noun.lower()} "
            f"designed for {rng.choice(USES)}.",
            *rng.sample(FEATURES, 2),
            rng.choice(PACKS),
        ])

        image_path = f"images/products/{item_number}.svg"
        images[image_path] = product_svg(kind, item_number, rng.randint(0, 359))

        products.append({
            "id": f"prod-{i + 1}",
            "itemNumber": item_number,
            "name": name,
            "description": description,
            "status": weighted_choice(rng, STATUSES),
            "priceCents": make_price_cents(rng),
            "upc": make_upc(rng, used_upcs),
            "categoryId": category_id,
            "subcategoryId": subcategory_id,
            "image": image_path,
        })

    return products, images


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default="app",
                        help="app folder to write into (default: app)")
    parser.add_argument("--products", type=int, default=4000,
                        help="number of products (default: 4000)")
    parser.add_argument("--seed", type=int, default=42,
                        help="random seed; same seed gives same data (default: 42)")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    out = Path(args.out)
    data_dir = out / "data"
    image_dir = out / "images" / "products"

    # Start clean so products removed by a smaller --products run don't linger.
    shutil.rmtree(data_dir, ignore_errors=True)
    shutil.rmtree(image_dir, ignore_errors=True)
    image_dir.mkdir(parents=True)

    categories = build_categories()
    products, images = build_products(rng, args.products)

    write_json(data_dir / "categories.json", categories)
    write_json(data_dir / "products.json", products)
    write_json(data_dir / "companies.json", COMPANIES)
    write_json(data_dir / "customers.json", CUSTOMERS)
    write_json(data_dir / "index.json", {
        "dataVersion": DATA_VERSION,
        "seed": args.seed,
        "counts": {
            "categories": len(categories),
            "subcategories": sum(len(c["subcategories"]) for c in categories),
            "products": len(products),
            "companies": len(COMPANIES),
            "customers": len(CUSTOMERS),
        },
        "files": ["categories.json", "products.json", "companies.json", "customers.json"],
    })

    for rel_path, svg in images.items():
        with open(out / rel_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(svg)

    print(f"Wrote {len(products)} products, {len(images)} images, "
          f"{len(CUSTOMERS)} customers and {len(COMPANIES)} companies to {out}/")


if __name__ == "__main__":
    main()
