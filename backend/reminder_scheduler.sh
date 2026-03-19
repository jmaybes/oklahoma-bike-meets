#!/bin/bash
# RSVP Reminder Scheduler
# Runs the reminder script every hour

while true; do
    echo "$(date): Running RSVP reminder check..."
    cd /app/backend && python3 cron_reminders.py
    echo "$(date): Sleeping for 1 hour..."
    sleep 3600  # 1 hour in seconds
done
