"""🔌 SEAM: search indexing (MVP-SCOPE seam #8).

MVP marketplace search is a basic name match straight off the DB. Publishing a
product would trigger indexing into a real search engine; here it's a logged no-op.
"""


def index_product(shop_item_id: str, name: str, tags: str | None) -> None:
    """STUB: real impl pushes the product into the search index."""
    print(f"[search:stub] would index shop_item={shop_item_id} name={name!r} tags={tags!r}")
