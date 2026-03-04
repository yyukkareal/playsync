import os
from dotenv import load_dotenv

# Load biến môi trường từ .env (phải có DATABASE_URL trong này)
load_dotenv()

# Import các thành phần cần thiết
from app.services.google_calendar import GoogleCalendarService
# Import thêm get_engine để tạo kết nối DB
from app.db.repository import get_events, get_engine 

# 1. Khởi tạo engine từ DATABASE_URL trong .env
engine = get_engine()

# 2. Khởi tạo Google Service
service = GoogleCalendarService()

# 3. Truyền engine vào hàm get_events (Đây là chỗ nãy bị thiếu)
events = get_events(engine=engine, limit=5)

print(f"✅ Đã tải {len(events)} sự kiện từ database.")

# 4. Đồng bộ
if events:
    service.sync_events(events)
else:
    print("Không có sự kiện nào để đồng bộ. 🤷‍♂️")