"""initial_schema

Revision ID: 2276bf32f582
Revises: 
Create Date: 2026-07-14 11:10:18.792323

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2276bf32f582'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False, server_default='user'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    # 2. Create items table
    op.create_table(
        'items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('make', sa.String(length=255), nullable=True, server_default=''),
        sa.Column('material_code', sa.String(length=100), nullable=True, server_default=''),
        sa.Column('min_quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_items_id'), 'items', ['id'], unique=False)

    # 3. Create issues table
    op.create_table(
        'issues',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('issued_to', sa.String(length=255), nullable=False),
        sa.Column('sap_notification', sa.String(length=255), nullable=True, server_default=''),
        sa.Column('note', sa.Text(), nullable=True, server_default=''),
        sa.Column('issue_date', sa.DateTime(), nullable=True),
        sa.Column('type', sa.String(length=20), nullable=False, server_default='ISSUE'),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_issues_id'), 'issues', ['id'], unique=False)
    op.create_index(op.f('ix_issues_item_id'), 'issues', ['item_id'], unique=False)
    op.create_index(op.f('ix_issues_issue_date'), 'issues', ['issue_date'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_issues_issue_date'), table_name='issues')
    op.drop_index(op.f('ix_issues_item_id'), table_name='issues')
    op.drop_index(op.f('ix_issues_id'), table_name='issues')
    op.drop_table('issues')
    
    op.drop_index(op.f('ix_items_id'), table_name='items')
    op.drop_table('items')
    
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')
