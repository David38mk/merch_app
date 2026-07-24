"""Seed a demo print-partner catalog so the seller browse experience is populated.

Idempotent: re-running is a no-op once the demo providers exist. Run with:

    python -m app.seed_catalog

'Products are synced from print providers' is a seam — this stands in for that sync
until a real provider integration (or the print-shop authoring UI) lands.
"""

import io

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.catalog import BaseItem, BaseItemVariant, ItemCategory, PrintArea, PrintOption
from app.models.enums import PrintOptionKind, Role
from app.models.user import PrintShopProfile, User, UserRole
from app.seams.storage import save_image

# Category → production lead time shown on the configure page.
PROD_TIME = {
    "T-Shirts": "3–5 business days",
    "Hoodies": "4–6 business days",
    "Mugs": "2–4 business days",
    "Tote Bags": "3–5 business days",
    "Caps": "4–6 business days",
    "Phone Cases": "2–4 business days",
    "Posters": "2–3 business days",
    "Stickers": "1–2 business days",
}
DEFAULT_PROD_TIME = "3–5 business days"

# Premium materials / print methods carry a per-unit surcharge; everything else is free.
OPTION_DELTA = {
    "Organic Cotton": "2.00",
    "Polyester": "1.50",
    "Cotton Canvas": "1.00",
    "Embroidery": "3.00",
    "Screen Print": "1.00",
    "Sublimation": "1.00",
    "Giclée": "2.00",
}

# Category → background colour for the generated placeholder image.
CAT_BG = {
    "T-Shirts": (99, 102, 241),
    "Hoodies": (14, 116, 144),
    "Mugs": (217, 119, 6),
    "Tote Bags": (5, 150, 105),
    "Caps": (190, 24, 93),
    "Phone Cases": (109, 40, 217),
    "Posters": (30, 64, 175),
    "Stickers": (219, 39, 119),
}

# provider name → (email, city, [items])
# item = (name, category, price, colors, sizes, materials, methods, areas, description)
APPAREL = ["S", "M", "L", "XL", "XXL"]
ONE = ["One size"]

CATALOG = {
    "Acme Prints": {
        "email": "acme@partners.local",
        "city": "Berlin",
        "items": [
            ("Classic Cotton Tee", "T-Shirts", "12.00", ["Black", "White", "Navy", "Red"], APPAREL,
             ["Cotton", "Organic Cotton"], ["DTG", "Screen Print"], ["Front", "Back"],
             "A versatile 180gsm cotton crew-neck — the everyday blank."),
            ("Pullover Hoodie", "Hoodies", "32.00", ["Black", "Grey", "Navy"], APPAREL,
             ["Cotton", "Polyester"], ["DTG", "Embroidery"], ["Front", "Back", "Sleeve"],
             "Cosy fleece-lined pullover with a double-layer hood."),
            ("Ceramic Mug 11oz", "Mugs", "9.00", ["White", "Black"], ONE,
             ["Ceramic"], ["Sublimation"], ["Wrap"],
             "Dishwasher-safe 11oz ceramic mug with a full wrap print area."),
            ("Canvas Tote", "Tote Bags", "11.00", ["Natural", "Black"], ONE,
             ["Cotton Canvas"], ["Screen Print"], ["Front"],
             "Heavyweight cotton canvas tote with long handles."),
            ("Snapback Cap", "Caps", "18.00", ["Black", "Navy", "White"], ONE,
             ["Polyester"], ["Embroidery"], ["Front"],
             "Structured 6-panel snapback, flat brim."),
            ("Clear Phone Case", "Phone Cases", "17.00", ["Clear", "Black"], ONE,
             ["Polyester"], ["Sublimation"], ["Back"],
             "Slim shock-absorbing case with an edge-to-edge print."),
            ("Die-cut Stickers", "Stickers", "3.50", ["White"], ONE,
             ["Vinyl"], ["Digital"], ["Front"],
             "Weatherproof die-cut vinyl stickers with a gloss laminate."),
        ],
    },
    "PixelPress": {
        "email": "pixelpress@partners.local",
        "city": "Lisbon",
        "items": [
            ("Premium Heavy Tee", "T-Shirts", "15.50", ["Black", "White", "Sand"], APPAREL,
             ["Organic Cotton"], ["DTG", "Screen Print"], ["Front", "Back"],
             "Boxy 240gsm heavyweight tee with a premium hand-feel."),
            ("Zip Hoodie", "Hoodies", "38.00", ["Black", "Grey"], APPAREL,
             ["Cotton", "Polyester"], ["Embroidery"], ["Front", "Back"],
             "Full-zip hoodie with metal hardware and split pouch pockets."),
            ("Enamel Camp Mug", "Mugs", "14.00", ["White"], ONE,
             ["Ceramic"], ["Sublimation"], ["Wrap"],
             "Retro enamel camp mug with a rolled stainless rim."),
            ("Drawstring Bag", "Tote Bags", "10.00", ["Black", "Natural"], ONE,
             ["Polyester"], ["Screen Print"], ["Front"],
             "Lightweight cinch backpack for gym and events."),
            ("Dad Hat", "Caps", "16.00", ["Black", "Stone", "Pink"], ONE,
             ["Cotton"], ["Embroidery"], ["Front"],
             "Unstructured low-profile 6-panel cap with a curved brim."),
            ("Matte Poster A2", "Posters", "8.50", ["White"], ONE,
             ["Matte Paper"], ["Giclée"], ["Front"],
             "Museum-grade matte poster printed on 200gsm stock."),
        ],
    },
}


def _font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # very old Pillow without the size arg
        return ImageFont.load_default()


def _placeholder(name: str, category: str) -> str:
    """Generate a simple labelled placeholder image and store it via the seam."""
    bg = CAT_BG.get(category, (100, 116, 139))
    img = Image.new("RGB", (900, 900), bg)
    draw = ImageDraw.Draw(img)

    # category kicker (top) + product name (centre), both centred.
    kicker = category.upper()
    kf, nf = _font(34), _font(64)
    kw = draw.textbbox((0, 0), kicker, font=kf)
    draw.text(((900 - (kw[2] - kw[0])) / 2, 120), kicker, font=kf, fill=(255, 255, 255))

    # naive word-wrap for the name
    words, lines, cur = name.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if draw.textbbox((0, 0), trial, font=nf)[2] > 760 and cur:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    lines.append(cur)
    y = 400 - len(lines) * 40
    for line in lines:
        lb = draw.textbbox((0, 0), line, font=nf)
        draw.text(((900 - (lb[2] - lb[0])) / 2, y), line, font=nf, fill=(255, 255, 255))
        y += 90

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return save_image(buf.getvalue(), "image/png", max_px=900)


def _get_or_create_category(db, name: str) -> ItemCategory:
    cat = db.scalar(select(ItemCategory).where(ItemCategory.name == name))
    if cat is None:
        cat = ItemCategory(name=name)
        db.add(cat)
        db.flush()
    return cat


def _get_or_create_provider(db, name: str, email: str, city: str) -> PrintShopProfile:
    profile = db.scalar(select(PrintShopProfile).where(PrintShopProfile.name == name))
    if profile is not None:
        return profile
    user = User(
        email=email,
        password_hash=hash_password("Password123"),
        first_name=name,
        last_name="",
        display_name=name,
    )
    user.roles.append(UserRole(role=Role.PRINTSHOP))
    db.add(user)
    db.flush()
    profile = PrintShopProfile(user_id=user.id, name=name, description=f"{name} — demo print partner.", city=city)
    db.add(profile)
    db.flush()
    return profile


def _backfill_production_time(db) -> int:
    """Set production_time on any older seeded rows that predate the column."""
    rows = db.scalars(
        select(BaseItem).where(BaseItem.production_time.is_(None)).options(selectinload(BaseItem.category))
    ).all()
    for item in rows:
        cat_name = item.category.name if item.category else None
        item.production_time = PROD_TIME.get(cat_name, DEFAULT_PROD_TIME)
    return len(rows)


def _backfill_option_deltas(db) -> int:
    """Apply the canonical surcharge to premium options on existing rows."""
    rows = db.scalars(select(PrintOption)).all()
    for o in rows:
        o.price_delta = OPTION_DELTA.get(o.name, "0")
    return len(rows)


def seed() -> None:
    db = SessionLocal()
    try:
        if db.scalar(select(PrintShopProfile).where(PrintShopProfile.name == "Acme Prints")):
            n = _backfill_production_time(db)
            m = _backfill_option_deltas(db)
            db.commit()
            print(f"Catalog already seeded — backfilled production_time ({n}) + option deltas ({m}).")
            return

        total = 0
        for provider_name, cfg in CATALOG.items():
            provider = _get_or_create_provider(db, provider_name, cfg["email"], cfg["city"])
            for name, category, price, colors, sizes, materials, methods, areas, desc in cfg["items"]:
                cat = _get_or_create_category(db, category)
                item = BaseItem(
                    print_shop_profile_id=provider.id,
                    category_id=cat.id,
                    name=name,
                    description=desc,
                    base_price=price,
                    image_url=_placeholder(name, category),
                    production_time=PROD_TIME.get(category, DEFAULT_PROD_TIME),
                    active=True,
                )
                db.add(item)
                db.flush()

                for color in colors:
                    for size in sizes:
                        delta = "2.00" if size == "XXL" else "0"
                        db.add(BaseItemVariant(base_item_id=item.id, size=size, color=color, price_delta=delta))
                for m in materials:
                    db.add(PrintOption(
                        base_item_id=item.id, kind=PrintOptionKind.MATERIAL, name=m,
                        price_delta=OPTION_DELTA.get(m, "0"),
                    ))
                for m in methods:
                    db.add(PrintOption(
                        base_item_id=item.id, kind=PrintOptionKind.PRINT_TYPE, name=m,
                        price_delta=OPTION_DELTA.get(m, "0"),
                    ))
                for a in areas:
                    db.add(PrintArea(base_item_id=item.id, name=a))
                total += 1

        db.commit()
        print(f"Seeded {total} catalog items across {len(CATALOG)} print partners.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
