# 📅 PlaySync - TMU Timetable to Google Calendar

Dự án tự động hóa việc đồng bộ lịch học từ hệ thống TMU sang Google Calendar, hỗ trợ quản lý thời gian hiệu quả cho sinh viên.

## ✨ Tính năng chính
- **Data Ingestion:** Parse dữ liệu từ file Excel thời khóa biểu.
- **Database Persistence:** Lưu trữ với PostgreSQL, xử lý trùng lặp bằng `fingerprint` (Upsert logic).
- **Google Calendar Sync:** Tự động tạo Recurring Events với chuẩn RFC 5545.
- **Security:** Quản lý credentials qua biến môi trường.

## 🛠 Tech Stack
- **Language:** Python 3.12+
- **DB:** PostgreSQL & SQLAlchemy ORM
- **API:** Google Calendar API v3
- **Tools:** python-dotenv, Pydantic (validation)