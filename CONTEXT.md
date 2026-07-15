# MyHappinessClub — Context Glossary

Ubiquitous language for the platform. This file is a **glossary only** — no
implementation details, no scope decisions. Scope lives in `MVP-SCOPE.md`.
When a term below conflicts with how someone speaks in a meeting, this file wins
(or gets updated).

## Actors (roles)

A single **User** account can hold **multiple roles** at once. Every user is a
**Buyer** by default.

- **Buyer** — browses storefronts and purchases products. Default role for every account.
- **Seller** — an influencer/creator/business who publishes products and runs a storefront. May also be a Designer on the same account.
- **Designer** — creates artwork for hire; has a portfolio and applies to Sellers' job offers. May also be a Seller on the same account.
- **PrintShop** — a fulfillment partner that is *also a user of the system*. Owns the catalog of blanks, receives production notifications for paid orders, and hands finished goods to shipment.
- **Admin** — platform operator. Not a first-class in-app role yet (managed out-of-band for now).

## Seller identity & onboarding

- **Brand** — a Seller's public storefront identity: its name is the SellerProfile's `store_name`. "Brand name" and "store name" are the same thing.
- **Creator name** — the public name of the person/creator behind the Brand (distinct from the account's legal first/last name).
- **Account type** — whether the Seller operates as a **Personal** creator or a **Company**.
- **Onboarding** — the short first-run flow a new Seller completes right after signup to create their Brand (brand name, creator name, country, currency, account type). Marked done via `onboarding_completed`; a completed Seller never sees it again.

## Catalog & products

- **BaseItem** — a blank, undesigned product offered by a PrintShop (e.g. a plain t-shirt), with its available sizes, colors, materials, and print options. The raw material a Seller designs on.
- **Variant** — a specific purchasable combination of a BaseItem (a size + color), with its own price delta. What a Buyer actually selects when ordering.
- **Print area** — a printable region on a BaseItem (front, back, …) where a Design can be placed.
- **ShopItem** — a Seller's *published, sellable* product: a BaseItem + a Design placed in a Print area + the Seller's price/name/description. What a Buyer actually browses and buys.
- **ItemCategory** — classification of BaseItems (apparel, mugs, etc.).

## Design

- **Design** — the artwork applied to a BaseItem to make a ShopItem.
  - **PersonalDesign** — a Design the Seller made themselves, via **upload** or **AI generation**.
  - **PayedDesign** — a Design produced by a hired Designer through a collaboration.
- **DesignPosition** — where a Design sits on the BaseItem: relative area + x / y / scale.

## Hire & collaboration

- **DesignerCall** — a Seller's job posting to hire a Designer: brief (title, description, reference image), deadline, and a chosen **payment type** (fixed fee, % of sales, or both) with an optional budget.
- **Bid** — a Designer's offer on a DesignerCall: their proposed price/percent + a message. Seller reviews Bids, may chat, and accepts one.
- **Collaboration (Collab)** — the working relationship created when a Seller accepts a Bid. Produces a Pending product that walks a state machine before becoming a finished ShopItem.
  - Collab states: **pending → preview → preview_accepted → final → final_accepted → payment**. Seller accepts/declines the Designer's submissions with feedback; Designer submits work and sees feedback. On completion the product lands in the Seller's Unlisted items (the Designer can never list it themselves).
- **Chat** — the message thread between a Seller and a Designer tied to a DesignerCall / Collab.

## Product lifecycle

- **Listed** — a ShopItem visible and purchasable on the storefront.
- **Unlisted** — a finished ShopItem not currently shown for sale.
- **Pending** — a collaboration product still being worked on (not yet a finished ShopItem).

## Ordering & fulfillment

- **Cart** — a Buyer's in-progress basket of ShopItems from a single Seller.
- **Order** — a paid purchase of one or more ShopItems. Carries the commission taken and the amounts owed. (New concept — absent from the original ER diagram.)
- **Production queue** — the PrintShop's list of paid Orders to manufacture.
  - Fulfillment states: **paid → in_production → handed_to_shipment**. The PrintShop's responsibility ends at *handed_to_shipment*; everything past that (cargo, tracking) is external.

## Money

- **Plan** — a Seller's subscription tier (**Free / Creator / Pro**) that sets their commission rate, limits, and feature access.
- **Commission** — the platform's cut of a sale, taken from the Seller's revenue. Determined by the Seller's Plan.
- **Payout** — the net amount owed to a Seller (or Designer) after commission.
- **AI credits** — a Seller's balance of AI-generation uses, consumed when generating a Design with AI; topped up by Plan or add-on packs.

## Catalog ownership

The **PrintShop** owns and maintains its own **BaseItem** catalog (blanks, sizes, colors, print options, base prices). There is no separate catalog administrator.
