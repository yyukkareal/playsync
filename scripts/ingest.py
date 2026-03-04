from app.parser.tmu_parser import parse_events
from app.db.repository import upsert_events

events = parse_events("timetable.xlsx")

inserted = upsert_events(events)

print(f"Inserted {inserted} events into database")