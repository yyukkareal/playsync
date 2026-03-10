# 🌻 PlaySync

**PlaySync** là công cụ giúp tự động hóa việc đồng bộ lịch học (TMU) và quản lý tài liệu học tập theo phong cách tối giản (Minimalism). Dự án được xây dựng với mục tiêu giúp sinh viên tập trung tối đa vào việc học thay vì quản lý lịch trình thủ công.

## 🚀 Công nghệ sử dụng
- **Backend:** FastAPI (Python), PostgreSQL, SQLAlchemy.
- **Frontend:** Next.js 15 (Tailwind CSS v4, TypeScript).
- **Infrastructure:** Docker & Docker Compose.
- **Security:** OAuth2 Google, JWT (JSON Web Token).

## 🛠️ Cấu trúc dự án
- `/server`: Chứa mã nguồn FastAPI (Backend).
- `/client`: Chứa mã nguồn Next.js (Frontend).
- `docker-compose.yml`: Quản lý các dịch vụ (Backend, Frontend, Database).

## 🏃‍♂️ Bắt đầu
1. Clone dự án: `git clone https://github.com/yyukkareal/playsync.git`
2. Cấu hình file `.env` dựa trên `.env.example`.
3. Chạy hệ thống: `docker-compose up --build`

---