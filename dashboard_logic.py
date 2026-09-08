"""Warstwa kompatybilności. Nowy kod powinien importować z dashboard.domain."""
from dashboard.domain.analytics import *  # noqa: F401,F403
from dashboard.domain.preprocessing import *  # noqa: F401,F403
