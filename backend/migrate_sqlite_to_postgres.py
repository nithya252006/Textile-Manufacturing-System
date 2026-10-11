import getpass
import hashlib
import json
import os
import secrets
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import MetaData, create_engine, func, inspect, select, text
from sqlalchemy.engine import make_url

DEFAULT_SQLITE_URL = "sqlite:///./textile_factory.db"
DEMO_EMAILS = {
    "owner@everestmills.com",
    "store@everestmills.com",
    "floor@everestmills.com",
    "dispatch@everestmills.com",
    "buyer@everestmills.com",
}
BATCH_SIZE = 500
PASSWORD_FILE = Path(__file__).resolve().with_name("migration-passwords.json")


def password_hash(password):
    salt = secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120000)
    return f"{salt}:{derived.hex()}"


def get_target_url():
    raw_url = os.getenv("DATABASE_URL")
    if not raw_url:
        raw_url = getpass.getpass("PostgreSQL DATABASE_URL (input hidden): ")
    url = make_url(raw_url)
    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+psycopg")
    if not url.drivername.startswith("postgresql"):
        raise ValueError("DATABASE_URL must point to PostgreSQL")
    return url


def get_source_url():
    url = make_url(os.getenv("SQLITE_DATABASE_URL", DEFAULT_SQLITE_URL))
    if url.drivername != "sqlite" or not url.database or url.database == ":memory:":
        raise ValueError("SQLITE_DATABASE_URL must point to a file-backed SQLite database")
    path = Path(url.database)
    if not path.is_absolute():
        path = Path(__file__).resolve().parent / path
    if not path.is_file():
        raise FileNotFoundError(f"SQLite source database was not found: {path}")
    return url.set(database=str(path.resolve()))


def collect_demo_password_updates(source_engine):
    source_metadata = MetaData()
    source_metadata.reflect(bind=source_engine)
    users = source_metadata.tables.get("users")
    if users is None:
        raise RuntimeError("The SQLite source has no users table")

    with source_engine.connect() as connection:
        demo_users = connection.execute(
            select(users.c.email).where(users.c.email.in_(DEMO_EMAILS))
        ).scalars().all()

    if PASSWORD_FILE.exists():
        passwords = json.loads(PASSWORD_FILE.read_text(encoding="utf-8"))
        if not isinstance(passwords, dict):
            raise ValueError("migration-passwords.json must contain an email-to-password object")
        missing_emails = sorted(set(demo_users) - passwords.keys())
        if missing_emails:
            raise ValueError(
                "migration-passwords.json is missing passwords for: "
                + ", ".join(missing_emails)
            )
        updates = {}
        for email in sorted(demo_users):
            password = passwords[email]
            if (
                not isinstance(password, str)
                or len(password) < 12
                or password.startswith("REPLACE_WITH_")
            ):
                raise ValueError(f"Password for {email} must be a string of at least 12 characters")
            updates[email] = password_hash(password)
        return updates

    updates = {}
    for email in sorted(demo_users):
        while True:
            new_password = getpass.getpass(f"Set a new production password for {email} (12+ characters): ")
            confirmation = getpass.getpass("Confirm password (input hidden): ")
            if new_password != confirmation:
                print("Passwords did not match; try again.")
                continue
            if len(new_password) < 12:
                print("Use at least 12 characters.")
                continue
            updates[email] = password_hash(new_password)
            break
    return updates


def upgrade_target(target_url):
    config = Config(str(Path(__file__).resolve().with_name("alembic.ini")))
    previous_database_url = os.environ.get("DATABASE_URL")
    previous_app_env = os.environ.get("APP_ENV")
    os.environ["DATABASE_URL"] = target_url.render_as_string(hide_password=False)
    os.environ["APP_ENV"] = "production"
    try:
        with create_engine(target_url).connect() as connection:
            existing_tables = set(inspect(connection).get_table_names())
        if existing_tables and "alembic_version" not in existing_tables:
            raise RuntimeError(
                "Target PostgreSQL is not empty and has no Alembic history; refusing to modify it"
            )
        command.upgrade(config, "head")
        return ScriptDirectory.from_config(config).get_current_head()
    finally:
        if previous_database_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous_database_url
        if previous_app_env is None:
            os.environ.pop("APP_ENV", None)
        else:
            os.environ["APP_ENV"] = previous_app_env


def migrate_rows(source_engine, target_engine, password_updates):
    source_metadata = MetaData()
    target_metadata = MetaData()
    source_metadata.reflect(bind=source_engine)
    target_metadata.reflect(bind=target_engine)

    source_tables = set(source_metadata.tables) - {"alembic_version"}
    target_tables = set(target_metadata.tables) - {"alembic_version"}
    unknown_tables = source_tables - target_tables
    if unknown_tables:
        raise RuntimeError(
            "SQLite has tables absent from the PostgreSQL schema: "
            + ", ".join(sorted(unknown_tables))
        )

    with target_engine.connect() as connection:
        populated_tables = [
            name
            for name in sorted(target_tables)
            if connection.execute(
                select(func.count()).select_from(target_metadata.tables[name])
            ).scalar_one()
        ]
    if populated_tables:
        raise RuntimeError(
            "Target PostgreSQL must have an empty application schema; rows exist in: "
            + ", ".join(populated_tables)
        )

    copied_counts = {}
    with source_engine.connect() as source_connection, target_engine.begin() as target_connection:
        for target_table in target_metadata.sorted_tables:
            table_name = target_table.name
            if table_name == "alembic_version" or table_name not in source_metadata.tables:
                continue

            source_table = source_metadata.tables[table_name]
            result = source_connection.execution_options(stream_results=True).execute(
                select(source_table)
            )
            copied_count = 0
            while batch := result.mappings().fetchmany(BATCH_SIZE):
                rows = [dict(row) for row in batch]
                if table_name == "users":
                    for row in rows:
                        replacement_hash = password_updates.get(row.get("email"))
                        if replacement_hash:
                            row["password_hash"] = replacement_hash
                target_connection.execute(target_table.insert(), rows)
                copied_count += len(rows)
            copied_counts[table_name] = copied_count

        for table_name, copied_count in copied_counts.items():
            source_count = source_connection.execute(
                select(func.count()).select_from(source_metadata.tables[table_name])
            ).scalar_one()
            target_count = target_connection.execute(
                select(func.count()).select_from(target_metadata.tables[table_name])
            ).scalar_one()
            if source_count != copied_count or target_count != copied_count:
                raise RuntimeError(
                    f"Row-count verification failed for {table_name}: "
                    f"source={source_count}, copied={copied_count}, target={target_count}"
                )

        for target_table in target_metadata.sorted_tables:
            id_column = target_table.c.get("id")
            if id_column is None or not id_column.primary_key:
                continue
            sequence_name = target_connection.execute(
                select(func.pg_get_serial_sequence(target_table.name, "id"))
            ).scalar_one_or_none()
            maximum_id = target_connection.execute(
                select(func.max(id_column))
            ).scalar_one_or_none()
            if sequence_name and maximum_id is not None:
                target_connection.execute(
                    text("SELECT setval(CAST(:sequence_name AS regclass), :maximum_id, true)"),
                    {"sequence_name": sequence_name, "maximum_id": maximum_id},
                )

    return copied_counts


def main():
    target_url = get_target_url()
    source_url = get_source_url()
    source_engine = create_engine(
        source_url,
        connect_args={"check_same_thread": False},
    )
    target_engine = create_engine(target_url, pool_pre_ping=True)
    try:
        password_updates = collect_demo_password_updates(source_engine)
        expected_head = upgrade_target(target_url)
        with target_engine.connect() as connection:
            current_revisions = connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalars().all()
        if current_revisions != [expected_head]:
            raise RuntimeError("PostgreSQL schema is not at the current Alembic revision")

        copied_counts = migrate_rows(source_engine, target_engine, password_updates)
        print("SQLite data copied to PostgreSQL:")
        for table_name, row_count in sorted(copied_counts.items()):
            print(f"  {table_name}: {row_count} rows")
        if password_updates:
            print("Rotated production passwords for the seeded demo accounts.")
        if PASSWORD_FILE.exists():
            PASSWORD_FILE.unlink()
            print("Removed the local migration password file.")
        print("SQLite source was not modified.")
    finally:
        source_engine.dispose()
        target_engine.dispose()


if __name__ == "__main__":
    main()
