#!/usr/bin/env python3
"""
RSVP Reminder Cron Job
Runs daily to send 24-hour event reminders to users who have RSVPed.
"""

import requests
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

API_URL = "http://localhost:8001/api/rsvp/send-reminders"

def send_reminders():
    """Call the backend API to send RSVP reminders."""
    try:
        logger.info(f"Starting RSVP reminder job at {datetime.now()}")
        
        response = requests.post(API_URL, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"Success: {result.get('message', 'Reminders sent')}")
        else:
            logger.error(f"Failed with status {response.status_code}: {response.text}")
            
    except requests.exceptions.ConnectionError:
        logger.error("Could not connect to backend API. Is the server running?")
    except requests.exceptions.Timeout:
        logger.error("Request timed out")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")

if __name__ == "__main__":
    send_reminders()
