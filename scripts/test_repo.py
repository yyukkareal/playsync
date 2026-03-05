from app.db.repository import get_events_with_mapping

events = get_events_with_mapping(user_id=1)

print("Events:", len(events))

if events:
    print(events[0])