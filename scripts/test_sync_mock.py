import asyncio

from app.services.sync_service import run_sync
from scripts.fake_google import FakeGoogleCalendarService


async def main() -> None:
    fake = FakeGoogleCalendarService()
    result = await run_sync(user_id=1, gcal=fake)
    print(result)


if __name__ == "__main__":
    asyncio.run(main())