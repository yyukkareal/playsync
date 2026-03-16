# luu.tkb

> Lưu thời khóa biểu TMU vào Google Calendar hoặc Apple Calendar — chỉ trong vài giây.

![luu.tkb screenshot](docs/screenshot.png)

## Giới thiệu

**luu.tkb** là ứng dụng web mã nguồn mở giúp sinh viên Trường Đại học Thương mại (TMU) đồng bộ lịch học từ hệ thống nhà trường vào Google Calendar hoặc Apple Calendar, thay thế việc nhập thủ công tốn thời gian.

- Tự động parser dữ liệu thời khóa biểu TMU
- Hỗ trợ Google Calendar (Android) và Apple Calendar (iPhone/Mac)
- Phát hiện xung đột lịch học ngay khi chọn lớp
- Giao diện tiếng Việt, tối ưu cho mobile

## Demo

🔗 [luu.tkb](https://luu.tkb) _(coming soon)_

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Frontend | Next.js 16, Tailwind CSS, TypeScript |
| Backend | FastAPI, Python 3.11 |
| Database | PostgreSQL 15 |
| Auth | Google OAuth2 + JWT |
| Calendar | Google Calendar API, iCalendar RFC 5545 |
| Deploy | Docker Compose |

## Cài đặt local

### Yêu cầu
- Docker & Docker Compose
- Node.js 20+
- Python 3.11+
- Google Cloud Console project với Calendar API enabled

### 1. Clone repo
```bash
git clone https://github.com/your-username/luu-tkb.git
cd luu-tkb
```

### 2. Cấu hình environment
```bash
cp .env.example .env
```

Điền các biến sau vào `.env`:
```env
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback

# JWT
JWT_SECRET_KEY=your_secret_key

# Database
DATABASE_URL=postgresql://postgres:postgres@db:5432/playsync

# Frontend
FRONTEND_URL=http://localhost:3000
```

### 3. Chạy với Docker
```bash
docker compose up -d
```

Truy cập: `http://localhost:3000`

### 4. Chạy frontend riêng (development)
```bash
cd client
npm install
npm run dev
```

## Cấu trúc project
```
luu-tkb/
├── app/                    # FastAPI backend
│   ├── api/
│   │   ├── routes/         # Endpoints: auth, courses, sync, ics
│   │   └── dependencies.py # JWT auth guard
│   ├── db/
│   │   └── repository.py   # Raw SQL queries
│   └── services/
│       ├── sync_service.py      # Google Calendar sync
│       └── google_calendar.py   # GCal API wrapper
├── client/                 # Next.js frontend
│   ├── src/
│   │   ├── app/            # App Router pages
│   │   ├── components/     # SearchBox, etc.
│   │   ├── hooks/          # useCourses, useSearch
│   │   └── lib/            # API helpers, device detection
│   └── public/
├── docker-compose.yml
└── README.md
```

## API Endpoints

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/auth/google/login` | Khởi tạo Google OAuth |
| `GET` | `/auth/google/callback` | OAuth callback, trả JWT |
| `GET` | `/api/courses/search?q=` | Tìm kiếm môn học |
| `GET` | `/api/users/me/courses` | Lấy danh sách môn đã chọn |
| `POST` | `/api/users/me/courses` | Thêm môn học |
| `DELETE` | `/api/users/me/courses/{code}` | Xóa môn học |
| `POST` | `/api/sync/{user_id}` | Sync sang Google Calendar |
| `GET` | `/api/ics/{user_id}` | Export file `.ics` cho Apple Calendar |

## Đóng góp

Pull requests và issues đều được chào đón. Xem [CONTRIBUTING.md](CONTRIBUTING.md) để biết thêm.

## Giấy phép

MIT License — xem [LICENSE](LICENSE)