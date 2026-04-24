"""Add DriveConnection and DriveImportJob tables

Revision ID: e5f3a8b2c901
Revises: d4e2f9a1c7b3
Create Date: 2026-04-24 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'e5f3a8b2c901'
down_revision = 'd4e2f9a1c7b3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'driveconnection',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('access_token', sa.String(length=4096), nullable=False),
        sa.Column('refresh_token', sa.String(length=4096), nullable=False),
        sa.Column('token_expiry', sa.DateTime(timezone=True), nullable=False),
        sa.Column('connected_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )

    op.create_table(
        'driveimportjob',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('folder_id', sa.String(length=255), nullable=False),
        sa.Column('folder_name', sa.String(length=500), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('total_files', sa.Integer(), nullable=False),
        sa.Column('imported_files', sa.Integer(), nullable=False),
        sa.Column('skipped_files', sa.Integer(), nullable=False),
        sa.Column('failed_files', sa.Integer(), nullable=False),
        sa.Column('error_message', sa.String(length=2000), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_driveimportjob_user_id', 'driveimportjob', ['user_id'])


def downgrade():
    op.drop_index('idx_driveimportjob_user_id', table_name='driveimportjob')
    op.drop_table('driveimportjob')
    op.drop_table('driveconnection')
