class FakeGoogleCalendarService:

    def create_event(self, event):
        print("CREATE:", event["course_code"])
        return {"id": f"fake-{event['id']}"}

    def update_event(self, google_event_id, event):
        print("UPDATE:", google_event_id)

    def delete_event(self, google_event_id):
        print("DELETE:", google_event_id)