"""Shipping carriers + their public tracking-link templates.

The print shop picks a carrier when it enters the tracking number at ship time.
Real carrier/provider status sync is the cargo seam (#4); this registry is the
manual stand-in that still gives the buyer a working "Track with <carrier>" link.
"""

# id → (label, tracking-URL template with a {n} slot for the number)
CARRIERS: dict[str, dict[str, str]] = {
    "dhl": {"label": "DHL", "url": "https://www.dhl.com/track?tracking-id={n}"},
    "ups": {"label": "UPS", "url": "https://www.ups.com/track?tracknum={n}"},
    "fedex": {"label": "FedEx", "url": "https://www.fedex.com/fedextrack/?trknbr={n}"},
    "usps": {"label": "USPS", "url": "https://tools.usps.com/go/TrackConfirmAction?tLabels={n}"},
    "gls": {"label": "GLS", "url": "https://gls-group.com/track/{n}"},
    "royal_mail": {"label": "Royal Mail", "url": "https://www.royalmail.com/track-your-item#/tracking-results/{n}"},
    "other": {"label": "Other", "url": ""},  # unknown carrier — no deep link
}


def carrier_label(carrier_id: str | None) -> str | None:
    if not carrier_id:
        return None
    spec = CARRIERS.get(carrier_id)
    return spec["label"] if spec else carrier_id


def tracking_url(carrier_id: str | None, number: str | None) -> str | None:
    """Public tracking link for a carrier + number, or None when either is
    missing or the carrier has no template."""
    if not carrier_id or not number:
        return None
    spec = CARRIERS.get(carrier_id)
    if not spec or not spec["url"]:
        return None
    return spec["url"].format(n=number.strip())
