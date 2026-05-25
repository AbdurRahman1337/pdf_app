from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# Utilize the asyncpg postgres driver engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True if settings.ENVIRONMENT == "development" else False,
    future=True,
    pool_pre_ping=True
)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides a transactional async session
    for SQLAlchemy database inquiries, automatically handles system release.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
