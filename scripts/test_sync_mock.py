from app.services.sync_service import run_sync
from scripts.fake_google import FakeGoogleCalendarService

fake = FakeGoogleCalendarService()

result = run_sync(user_id=1, gcal=fake)

print(result)