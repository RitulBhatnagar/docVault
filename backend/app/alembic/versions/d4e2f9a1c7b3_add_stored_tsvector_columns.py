"""Add stored tsvector columns for fast full-text search

Revision ID: d4e2f9a1c7b3
Revises: c3f1a2b8e456
Create Date: 2026-04-23 00:00:00.000000

"""
from alembic import op

revision = 'd4e2f9a1c7b3'
down_revision = 'c3f1a2b8e456'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE document
        ADD COLUMN metadata_tsv tsvector
        GENERATED ALWAYS AS (
            to_tsvector('english'::regconfig,
                (coalesce(title, '') || ' ' || coalesce(creator, '') || ' ' || coalesce(subject, ''))::text)
        ) STORED
    """)
    op.execute(
        "CREATE INDEX idx_document_metadata_tsv ON document USING GIN(metadata_tsv)"
    )

    op.execute("""
        ALTER TABLE documentversion
        ADD COLUMN content_tsv tsvector
        GENERATED ALWAYS AS (
            to_tsvector('english'::regconfig, coalesce(content_text, '')::text)
        ) STORED
    """)
    op.execute(
        "CREATE INDEX idx_documentversion_content_tsv_col ON documentversion USING GIN(content_tsv)"
    )

    # Old expression-based index replaced by the column index above
    op.execute("DROP INDEX IF EXISTS idx_documentversion_content_tsv")


def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_documentversion_content_tsv_col")
    op.execute("DROP INDEX IF EXISTS idx_document_metadata_tsv")
    op.execute("ALTER TABLE documentversion DROP COLUMN IF EXISTS content_tsv")
    op.execute("ALTER TABLE document DROP COLUMN IF EXISTS metadata_tsv")
    op.execute(
        "CREATE INDEX idx_documentversion_content_tsv ON documentversion "
        "USING GIN(to_tsvector('english', coalesce(content_text, '')))"
    )
