"""store skipped extraction diagnostics on raw documents

Revision ID: 20260517_0019
Revises: 20260516_0018
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa

revision = "20260517_0019"
down_revision = "20260516_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    _add_column_if_missing(
        "raw_documents",
        sa.Column(
            "extraction_diagnostics_json",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )


def downgrade() -> None:
    _drop_column_if_exists("raw_documents", "extraction_diagnostics_json")


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_column(table_name: str, column_name: str) -> bool:
    return any(column["name"] == column_name for column in _inspector().get_columns(table_name))


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if not _has_column(table_name, column.name):
        op.add_column(table_name, column)


def _drop_column_if_exists(table_name: str, column_name: str) -> None:
    if _has_column(table_name, column_name):
        op.drop_column(table_name, column_name)
