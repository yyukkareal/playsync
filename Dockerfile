# Sử dụng Python 3.12 bản slim cho nhẹ (phù hợp với chip J1800)
FROM python:3.12-slim

# Ngăn Python tạo ra các file .pyc và cho phép log hiển thị ngay lập tức
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Cài đặt các thư viện hệ thống cần thiết cho psycopg2 (nếu bạn dùng bản binary thì nhẹ hơn)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements và cài đặt
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ code vào container
COPY . .

# Chạy app bằng Uvicorn
CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]