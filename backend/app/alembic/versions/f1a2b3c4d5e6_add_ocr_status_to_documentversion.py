"""Add ocr_status to documentversion for tracking OCR pipeline state

Revision ID: f1a2b3c4d5e6
Revises: e5f3a8b2c901
Create Date: 2026-04-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f1a2b3c4d5e6'
down_revision = 'e5f3a8b2c901'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'documentversion',
        sa.Column('ocr_status', sa.String(length=20), nullable=True),
    )


def downgrade():
    op.drop_column('documentversion', 'ocr_status')
