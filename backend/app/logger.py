import logging
import os
import sys

# Define formatting
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

# Setup root logger
logger = logging.getLogger("inventory")
logger.setLevel(logging.INFO)

# Formatter
formatter = logging.Formatter(LOG_FORMAT)

# Console handler
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

# File handler
log_file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "app.log")
file_handler = logging.FileHandler(log_file_path, encoding="utf-8")
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)
