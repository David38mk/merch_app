"""Seed demo designer accounts so the hiring flow is testable from both sides.

Idempotent. Run with:

    python -m app.seed_designers

All demo designers use the password: Password123
"""

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.design import Design
from app.models.enums import DesignSource, DesignType, Role
from app.models.hiring import DesignerReview
from app.models.user import DesignerProfile, User, UserRole
from app.seams.ai import generate_design_candidates
from app.seams.storage import save_design_image

PASSWORD = "Password123"

DESIGNERS = [
    ("maya@designers.local", "Maya Ortiz", "maya-ortiz", "Bold type and retro poster art. 6 years freelancing."),
    ("leo@designers.local", "Leo Fischer", "leo-fischer", "Minimal line work and monochrome apparel graphics."),
    ("ines@designers.local", "Inès Duval", "ines-duval", "Hand-drawn illustration, streetwear and skate culture."),
]

# slug → portfolio prompts (seeded artwork) and reviews (reviewer, rating, comment)
PORTFOLIO = {
    "maya-ortiz": ["retro sunset poster", "bold typographic tee", "vintage badge logo"],
    "leo-fischer": ["minimal line portrait", "monochrome geometric grid", "single-line mountain"],
    "ines-duval": ["hand drawn skull sketch", "skate deck illustration", "inked floral pattern"],
}

REVIEWS = {
    "maya-ortiz": [
        ("Aurora Studio", 5, "Nailed the brief on the first preview. Fast and easy to work with."),
        ("Nova Threads", 5, "Great instincts on colour — the tee sold out in a week."),
        ("Wildline Co", 4, "Lovely work, needed one extra round on the type."),
    ],
    "leo-fischer": [
        ("Northside Goods", 5, "Exactly the minimal look we wanted. Very clean files."),
        ("Pale Sun", 4, "Solid communication and delivered ahead of the deadline."),
    ],
    "ines-duval": [
        ("Sk8 Republic", 5, "Incredible linework. Will absolutely hire again."),
        ("Bloom Apparel", 5, "Turned a vague brief into something better than we imagined."),
        ("Drift Club", 4, "Great illustrations, small delay on the final files."),
    ],
}


def _seed_extras(db, profile: DesignerProfile, slug: str) -> None:
    """Portfolio artwork + reviews, so applicant cards have real signal."""
    has_designs = db.scalar(select(Design).where(Design.owner_user_id == profile.user_id))
    if not has_designs:
        for prompt in PORTFOLIO.get(slug, []):
            png = generate_design_candidates(prompt, 1)[0]
            db.add(
                Design(
                    owner_user_id=profile.user_id,
                    type=DesignType.PERSONAL,
                    source=DesignSource.UPLOAD,
                    resource_url=save_design_image(png, "image/png"),
                )
            )

    has_reviews = db.scalar(
        select(DesignerReview).where(DesignerReview.designer_profile_id == profile.id)
    )
    if not has_reviews:
        for reviewer, rating, comment in REVIEWS.get(slug, []):
            db.add(
                DesignerReview(
                    designer_profile_id=profile.id,
                    reviewer_name=reviewer,
                    rating=rating,
                    comment=comment,
                )
            )


def seed_designers() -> None:
    db = SessionLocal()
    try:
        created = 0
        for email, name, slug, bio in DESIGNERS:
            user = db.scalar(select(User).where(User.email == email))
            if user is None:
                user = User(
                    email=email,
                    password_hash=hash_password(PASSWORD),
                    first_name=name.split(" ")[0],
                    last_name=name.split(" ")[-1],
                    display_name=name,
                )
                # Designers are buyers too; that's the platform default.
                for role in (Role.BUYER, Role.DESIGNER):
                    user.roles.append(UserRole(role=role))
                db.add(user)
                db.flush()
                profile = DesignerProfile(user_id=user.id, slug=slug, display_name=name, bio=bio)
                db.add(profile)
                db.flush()
                created += 1
            else:
                profile = db.scalar(select(DesignerProfile).where(DesignerProfile.user_id == user.id))

            if profile is not None:  # idempotent: only fills what's missing
                _seed_extras(db, profile, slug)

        db.commit()
        print(f"Seeded {created} new demo designer(s); portfolio + reviews ensured. Password: {PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_designers()
