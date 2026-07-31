import asyncio
import math
import httpx


async def _fetch_all_pages(
    client: httpx.AsyncClient,
    url_fn,
    data_extractor,
    has_more_fn,
    page_size: int = 10,
) -> list:
    """
    Fetches page 1 synchronously to learn total count,
    then fires all remaining pages in parallel.
    """
    resp = await client.get(url_fn(1))
    resp.raise_for_status()
    data = resp.json()

    items = data_extractor(data)

    if not has_more_fn(data):
        return items

    total = (
        data.get("data", {}).get("pagination", {}).get("total")
        or data.get("pagination", {}).get("total")
        or data.get("total")
    )

    if total:
        total_pages = math.ceil(total / page_size)
        remaining_pages = range(2, total_pages + 1)
    else:
        remaining_pages = range(2, 21)

    async def fetch_page(page: int) -> list:
        try:
            r = await client.get(url_fn(page))
            r.raise_for_status()
            return data_extractor(r.json())
        except Exception:
            return []

    pages = await asyncio.gather(*[fetch_page(p) for p in remaining_pages])

    for page_items in pages:
        items.extend(page_items)

    return items
