# app/db/models.py
from datetime import date, time, datetime

from sqlalchemy import Integer, Text, Date, Time, DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for SQLAlchemy declarative models."""
    pass


class Event(Base):
    __tablename__ = 'events'
    __table_args__ = {'schema': 'app'}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_code: Mapped[str] = mapped_column(Text)
    course_name: Mapped[str] = mapped_column(Text)
    weekday: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    room: Mapped[str] = mapped_column(Text)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    fingerprint: Mapped[str] = mapped_column(Text, unique=True)
    instructor: Mapped[str] = mapped_column(Text)
    duration: Mapped[int] = mapped_column(Integer)

class UserCourse(Base):
    __tablename__ = 'user_courses'
    __table_args__ = {'schema': 'app'}

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer)
    course_code: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime)