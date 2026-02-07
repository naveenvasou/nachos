from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
import pytz
import logging

logger = logging.getLogger(__name__)

# Initialize Scheduler
scheduler = AsyncIOScheduler()

async def trigger_morning_briefing():
    """Wakes Cooper for the Morning Briefing (8:00 AM)"""
    from agent import wake_cooper
    logger.info("⏰ Heartbeat: Triggering Morning Briefing")
    await wake_cooper(reason="Morning Briefing")

async def trigger_eod_check():
    """Wakes Cooper for the EOD Check (6:00 PM)"""
    from agent import wake_cooper
    logger.info("⏰ Heartbeat: Triggering EOD Check")
    await wake_cooper(reason="EOD Check")

async def trigger_midday_check():
    """Wakes Cooper for the Mid-Day Check-In (1:30 PM)"""
    from agent import wake_cooper
    logger.info("⏰ Heartbeat: Triggering Mid-Day Check-In")
    await wake_cooper(reason="Mid-Day Check-In")

async def trigger_night_owl_check():
    """Wakes Cooper for the Night Owl Check (10:00 PM)"""
    from agent import wake_cooper
    logger.info("⏰ Heartbeat: Triggering Night Owl Check")
    await wake_cooper(reason="Night Owl Check")

async def trigger_weekly_planning():
    """Wakes Cooper for Weekly Planning (Sunday 7:00 PM)"""
    from agent import wake_cooper
    logger.info("⏰ Heartbeat: Triggering Weekly Planning")
    await wake_cooper(reason="Weekly Planning")

def start_scheduler():
    """Starts the proactive scheduler"""
    if not scheduler.running:
        # Configuration
        # Uses system local time by default, but good to be explicit if needed. 
        # For now relying on server time (host machine time).
        
        # 1. Morning Briefing: 8:00 AM
        scheduler.add_job(
            trigger_morning_briefing, 
            CronTrigger(hour=8, minute=0), 
            id="morning_briefing",
            replace_existing=True
        )

        # 2. Mid-Day Check-In: 1:30 PM
        scheduler.add_job(
            trigger_midday_check,
            CronTrigger(hour=13, minute=30),
            id="midday_check",
            replace_existing=True
        )

        # 3. EOD Check: 6:00 PM
        scheduler.add_job(
            trigger_eod_check,
            CronTrigger(hour=18, minute=0),
            id="eod_check",
            replace_existing=True
        )

        # 4. Night Owl Check: 10:00 PM
        scheduler.add_job(
            trigger_night_owl_check,
            CronTrigger(hour=22, minute=0),
            id="night_owl_check",
            replace_existing=True
        )

        # 5. Weekly Planning: Sunday 7:00 PM
        scheduler.add_job(
            trigger_weekly_planning,
            CronTrigger(day_of_week='sun', hour=19, minute=0),
            id="weekly_planning",
            replace_existing=True
        )

        scheduler.start()
        logger.info("✅ Proactive Scheduler Started")

def stop_scheduler():
    """Stops the scheduler on shutdown"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("🛑 Proactive Scheduler Stopped")
