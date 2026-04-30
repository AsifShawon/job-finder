"""email alert logs table

Revision ID: 20260501_0012
Revises: 20260428_0011
Create Date: 2026-05-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260501_0012"
down_revision = "20260428_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_alert_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "opportunity_ids",
            postgresql.JSONB(),
            nullable=False,
            server_default="[]",
        ),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'sent'"),
        ),
    )
    op.create_index("ix_email_alert_logs_user_id", "email_alert_logs", ["user_id"])
    op.create_index("ix_email_alert_logs_sent_at", "email_alert_logs", ["sent_at"])


def downgrade() -> None:
    op.drop_index("ix_email_alert_logs_sent_at", table_name="email_alert_logs")
    op.drop_index("ix_email_alert_logs_user_id", table_name="email_alert_logs")
    op.drop_table("email_alert_logs")
