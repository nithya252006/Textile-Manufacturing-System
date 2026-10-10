"""normalize floor supervisor role

Revision ID: 498aadb97367
Revises: 6e658d8b4ff4
Create Date: 2026-10-11 04:32:25.250775

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '498aadb97367'
down_revision: Union[str, Sequence[str], None] = '6e658d8b4ff4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        sa.text(
            "UPDATE users SET role = 'floor_supervisor' "
            "WHERE lower(trim(role)) = 'operator'"
        )
    )


def downgrade() -> None:
    """Downgrade schema."""
    pass
