#!/bin/bash
# RSVP Reminder Scheduler
# Sends 24-hour reminder notifications for upcoming RSVP'd events
# Should be run daily via cron: 0 9 * * * /app/backend/cron/reminder_scheduler.sh

API_URL="http://localhost:8001"

echo "$(date): Running RSVP reminder scheduler..."

RESPONSE=$(curl -s -X POST "$API_URL/api/rsvp/send-reminders")
echo "$(date): Response: $RESPONSE"
