import getpass

from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.entities import User, UserProfile


if __name__ == "__main__":
    email = input("Admin email: ").strip().lower()
    name = input("Full name: ").strip()
    password = getpass.getpass("Password: ").strip()

    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            existing.is_admin = True
            db.commit()
            print("User promoted to admin")
        else:
            user = User(
                full_name=name,
                email=email,
                hashed_password=get_password_hash(password),
                is_admin=True,
            )
            db.add(user)
            db.flush()
            db.add(UserProfile(user_id=user.id))
            db.commit()
            print("Admin user created")
