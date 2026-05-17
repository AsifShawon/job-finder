"""store canonical ISC category keys on opportunities

Revision ID: 20260516_0018
Revises: 20260513_0017
Create Date: 2026-05-16
"""

from alembic import op
import sqlalchemy as sa

revision = "20260516_0018"
down_revision = "20260513_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    _add_column_if_missing(
        "opportunities",
        sa.Column("isc_category_key", sa.String(length=64), nullable=True),
    )
    _create_index_if_missing(
        "ix_opportunity_isc_category_listing",
        "opportunities",
        ["isc_category_key", "status", "is_active", "opportunity_type"],
        unique=False,
    )


def downgrade() -> None:
    _drop_index_if_exists("ix_opportunity_isc_category_listing", "opportunities")
    _drop_column_if_exists("opportunities", "isc_category_key")


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_column(table_name: str, column_name: str) -> bool:
    return any(column["name"] == column_name for column in _inspector().get_columns(table_name))


def _has_index(table_name: str, index_name: str) -> bool:
    return any(index["name"] == index_name for index in _inspector().get_indexes(table_name))


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if not _has_column(table_name, column.name):
        op.add_column(table_name, column)


def _drop_column_if_exists(table_name: str, column_name: str) -> None:
    if _has_column(table_name, column_name):
        op.drop_column(table_name, column_name)


def _create_index_if_missing(
    index_name: str,
    table_name: str,
    columns: list[str],
    *,
    unique: bool = False,
) -> None:
    if not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def _drop_index_if_exists(index_name: str, table_name: str) -> None:
    if _has_index(table_name, index_name):
        op.drop_index(index_name, table_name=table_name)
