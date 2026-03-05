import psycopg
from app.config import settings


def get_connection():
    return psycopg.connect(settings.DATABASE_URL)


def get_cursor():
    conn = psycopg.connect(settings.DATABASE_URL)
    return conn, conn.cursor()