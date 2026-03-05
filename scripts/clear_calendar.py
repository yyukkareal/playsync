from app.config import settings  # load .env
from app.services.google_calendar import GoogleCalendarService

gcal = GoogleCalendarService()

service = gcal._service
calendar_id = gcal._calendar_id

events = service.events().list(calendarId=calendar_id).execute()

for e in events.get("items", []):
    service.events().delete(
        calendarId=calendar_id,
        eventId=e["id"]
    ).execute()

print("Calendar cleared")