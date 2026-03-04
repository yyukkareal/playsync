from dotenv import load_dotenv
import os
from pathlib import Path

# Load .env từ root project
BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


class Settings:
    """Application configuration loaded from environment variables."""

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL")

    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET")

    # Google tokens (for development)
    GOOGLE_ACCESS_TOKEN: str = os.getenv("GOOGLE_ACCESS_TOKEN")
    GOOGLE_REFRESH_TOKEN: str = os.getenv("GOOGLE_REFRESH_TOKEN")

    # Timezone
    TIMEZONE: str = os.getenv("TIMEZONE", "Asia/Ho_Chi_Minh")


settings = Settings()