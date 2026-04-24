"""Add content_text to documentversion for full-text content search

Revision ID: c3f1a2b8e456
Revises: b5e3d1f8a092
Create Date: 2026-04-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'c3f1a2b8e456'
down_revision = 'b5e3d1f8a092'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'documentversion',
        sa.Column('content_text', sa.Text(), nullable=True),
    )
    op.execute(
        "CREATE INDEX idx_documentversion_content_tsv ON documentversion "
        "USING GIN(to_tsvector('english', coalesce(content_text, '')))"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_documentversion_content_tsv")
    op.drop_column('documentversion', 'content_text')
