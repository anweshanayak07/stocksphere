import os
from slowapi import Limiter
from slowapi.util import get_remote_address

# Disable rate limiting when running pytest tests
is_testing = "pytest" in os.environ.get("PYTEST_CURRENT_TEST", "") or "test" in os.environ.get("ASGIREF_STANDARD_LOGGER", "") or os.getenv("TESTING") == "1"

limiter = Limiter(key_func=get_remote_address, enabled=not is_testing)
