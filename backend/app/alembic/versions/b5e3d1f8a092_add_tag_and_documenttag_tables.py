"""Add Tag and DocumentTag tables

Revision ID: b5e3d1f8a092
Revises: a4f2c7e9b1d3
Create Date: 2026-04-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'b5e3d1f8a092'
down_revision = 'a4f2c7e9b1d3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'tag',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('owner_id', 'name', name='uq_tag_owner_name'),
    )
    op.create_index('ix_tag_name', 'tag', ['name'])

    op.create_table(
        'documenttag',
        sa.Column('document_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tag_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['document.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tag.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('document_id', 'tag_id'),
    )


def downgrade():
    op.drop_table('documenttag')
    op.drop_index('ix_tag_name', table_name='tag')
    op.drop_table('tag')