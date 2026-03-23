#!/bin/bash
# Weekly Event Search Cron Script
# This script calls the automated event search API endpoint
# Schedule: Run every Sunday at 2:00 AM

API_URL="http://localhost:8001/api/scheduler/weekly-event-search"
SECRET_KEY="okc-car-events-weekly-search-2025"
LOG_FILE="/var/log/event-search-cron.log"

echo "========================================" >> $LOG_FILE
echo "Event Search Started: $(date)" >> $LOG_FILE

# Call the API endpoint
RESPONSE=$(curl -s -X POST "${API_URL}?secret_key=${SECRET_KEY}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS")

echo "HTTP Status: $HTTP_STATUS" >> $LOG_FILE
echo "Response: $BODY" >> $LOG_FILE
echo "Event Search Completed: $(date)" >> $LOG_FILE
echo "========================================" >> $LOG_FILE

# Exit with error if request failed
if [ "$HTTP_STATUS" != "200" ]; then
  echo "ERROR: Event search failed with status $HTTP_STATUS" >> $LOG_FILE
  exit 1
fi

exit 0
