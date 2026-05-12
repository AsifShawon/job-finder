"""add copilot conversations and messages

Revision ID: 20260509_0016
Revises: 20260509_0015
Create Date: 2026-05-09
"""

from alembic import op
import sqlalchemy as sa


revision = "20260509_0016"
down_revision = "20260509_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "copilot_conversations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False, server_default="New chat"),
        sa.Column("locale", sa.String(length=10), nullable=False, server_default="bn"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_copilot_conversations_user_last_message",
        "copilot_conversations",
        ["user_id", "last_message_at"],
    )

    op.create_table(
        "copilot_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "conversation_id",
            sa.Integer(),
            sa.ForeignKey("copilot_conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("citations_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("suggested_follow_ups_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_copilot_messages_conversation_created",
        "copilot_messages",
        ["conversation_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_copilot_messages_conversation_created", table_name="copilot_messages")
    op.drop_table("copilot_messages")
    op.drop_index("ix_copilot_conversations_user_last_message", table_name="copilot_conversations")
    op.drop_table("copilot_conversations")
