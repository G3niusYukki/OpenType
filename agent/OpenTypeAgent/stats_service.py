"""
Statistics service for OpenType Agent
Manages persistent storage of service statistics using SQLite
"""

import Foundation
import AppKit
import objc
from Foundation import NSObject, NSDate, NSUserDefaults, NSLog
import sqlite3
import json
import csv
import os
from datetime import datetime, timedelta
from pathlib import Path

from .constants import DB_FILE


class StatsService(NSObject):
    """Service for collecting and storing usage statistics"""

    def init(self):
        """Initialize the statistics service"""
        self = objc.super(StatsService, self).init()
        if self is None:
            return None

        self.db_path = str(DB_FILE)
        self._connection = None
        self._current_session_id = None

        return self

    def init_database(self):
        """Initialize the SQLite database with required tables"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            # Sessions table - individual transcription sessions
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    end_time TIMESTAMP,
                    duration_seconds INTEGER,
                    word_count INTEGER DEFAULT 0,
                    provider TEXT,
                    mode TEXT,
                    status TEXT DEFAULT 'running'
                )
            """)

            # Daily statistics - aggregated daily stats
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS daily_stats (
                    date TEXT PRIMARY KEY,
                    total_duration_seconds INTEGER DEFAULT 0,
                    total_word_count INTEGER DEFAULT 0,
                    session_count INTEGER DEFAULT 0
                )
            """)

            # Crash records
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS crashes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    exit_code INTEGER,
                    reason TEXT,
                    auto_restarted BOOLEAN DEFAULT 0
                )
            """)

            # Server uptime log
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS uptime_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    end_time TIMESTAMP,
                    duration_seconds INTEGER
                )
            """)

            # Create indexes for better query performance
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_crashes_timestamp ON crashes(timestamp)
            """)

            conn.commit()
            NSLog("Statistics database initialized")

        except sqlite3.Error as e:
            NSLog(f"Failed to initialize database: {e}")

    def _get_connection(self):
        """Get or create database connection"""
        if self._connection is None:
            self._connection = sqlite3.connect(self.db_path, check_same_thread=False)
            self._connection.row_factory = sqlite3.Row
        return self._connection

    # MARK: - Session Management

    def record_session_start(self, provider=None, mode=None):
        """Record the start of a transcription session"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute("""
                INSERT INTO sessions (provider, mode, status)
                VALUES (?, ?, 'running')
            """, (provider, mode))

            self._current_session_id = cursor.lastrowid
            conn.commit()

            NSLog(f"Recorded session start: ID {self._current_session_id}")
            return self._current_session_id

        except sqlite3.Error as e:
            NSLog(f"Failed to record session start: {e}")
            return None

    def record_session_end(self, session_id=None, word_count=0):
        """Record the end of a transcription session"""
        session_id = session_id or self._current_session_id
        if not session_id:
            return False

        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            # Get start time
            cursor.execute("""
                SELECT start_time FROM sessions WHERE id = ?
            """, (session_id,))

            row = cursor.fetchone()
            if not row:
                return False

            start_time = datetime.fromisoformat(row['start_time'])
            end_time = datetime.now()
            duration = int((end_time - start_time).total_seconds())

            # Update session
            cursor.execute("""
                UPDATE sessions
                SET end_time = CURRENT_TIMESTAMP,
                    duration_seconds = ?,
                    word_count = ?,
                    status = 'completed'
                WHERE id = ?
            """, (duration, word_count, session_id))

            # Update daily stats
            date_str = end_time.strftime('%Y-%m-%d')
            cursor.execute("""
                INSERT INTO daily_stats (date, total_duration_seconds, total_word_count, session_count)
                VALUES (?, ?, ?, 1)
                ON CONFLICT(date) DO UPDATE SET
                    total_duration_seconds = total_duration_seconds + ?,
                    total_word_count = total_word_count + ?,
                    session_count = session_count + 1
            """, (date_str, duration, word_count, duration, word_count))

            conn.commit()

            if session_id == self._current_session_id:
                self._current_session_id = None

            NSLog(f"Recorded session end: ID {session_id}, duration {duration}s, words {word_count}")
            return True

        except sqlite3.Error as e:
            NSLog(f"Failed to record session end: {e}")
            return False

    def record_crash(self, exit_code=None, reason=None, auto_restarted=False):
        """Record a server crash"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute("""
                INSERT INTO crashes (exit_code, reason, auto_restarted)
                VALUES (?, ?, ?)
            """, (exit_code, reason, auto_restarted))

            conn.commit()
            NSLog(f"Recorded crash: exit_code={exit_code}, reason={reason}")
            return True

        except sqlite3.Error as e:
            NSLog(f"Failed to record crash: {e}")
            return False

    def record_server_start(self):
        """Record server start time for uptime tracking"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            # Close any previous unclosed uptime records
            cursor.execute("""
                UPDATE uptime_log
                SET end_time = CURRENT_TIMESTAMP,
                    duration_seconds = CAST((julianday('now') - julianday(start_time)) * 86400 AS INTEGER)
                WHERE end_time IS NULL
            """)

            # Insert new uptime record
            cursor.execute("""
                INSERT INTO uptime_log (start_time)
                VALUES (CURRENT_TIMESTAMP)
            """)

            conn.commit()
            return True

        except sqlite3.Error as e:
            NSLog(f"Failed to record server start: {e}")
            return False

    def record_server_stop(self):
        """Record server stop time for uptime tracking"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute("""
                UPDATE uptime_log
                SET end_time = CURRENT_TIMESTAMP,
                    duration_seconds = CAST((julianday('now') - julianday(start_time)) * 86400 AS INTEGER)
                WHERE end_time IS NULL
            """)

            conn.commit()
            return True

        except sqlite3.Error as e:
            NSLog(f"Failed to record server stop: {e}")
            return False

    # MARK: - Statistics Queries

    def get_statistics(self, period="all"):
        """Get aggregated statistics for a time period"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            # Calculate date range
            end_date = datetime.now()
            if period == "today":
                start_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
            elif period == "week":
                start_date = end_date - timedelta(days=7)
            elif period == "month":
                start_date = end_date - timedelta(days=30)
            else:
                start_date = None

            # Query sessions
            if start_date:
                cursor.execute("""
                    SELECT
                        COALESCE(SUM(duration_seconds), 0) as total_time,
                        COALESCE(SUM(word_count), 0) as total_words,
                        COUNT(*) as session_count
                    FROM sessions
                    WHERE start_time >= ?
                """, (start_date.isoformat(),))
            else:
                cursor.execute("""
                    SELECT
                        COALESCE(SUM(duration_seconds), 0) as total_time,
                        COALESCE(SUM(word_count), 0) as total_words,
                        COUNT(*) as session_count
                    FROM sessions
                """)

            row = cursor.fetchone()

            # Query crashes
            if start_date:
                cursor.execute("""
                    SELECT COUNT(*) as crash_count
                    FROM crashes
                    WHERE timestamp >= ?
                """, (start_date.isoformat(),))
            else:
                cursor.execute("""
                    SELECT COUNT(*) as crash_count
                    FROM crashes
                """)

            crash_row = cursor.fetchone()

            # Query uptime
            if start_date:
                cursor.execute("""
                    SELECT COALESCE(SUM(duration_seconds), 0) as total_uptime
                    FROM uptime_log
                    WHERE start_time >= ?
                """, (start_date.isoformat(),))
            else:
                cursor.execute("""
                    SELECT COALESCE(SUM(duration_seconds), 0) as total_uptime
                    FROM uptime_log
                """)

            uptime_row = cursor.fetchone()

            return {
                "period": period,
                "total_time": row['total_time'] or 0,
                "total_words": row['total_words'] or 0,
                "session_count": row['session_count'] or 0,
                "crash_count": crash_row['crash_count'] or 0,
                "total_uptime": uptime_row['total_uptime'] or 0,
            }

        except sqlite3.Error as e:
            NSLog(f"Failed to get statistics: {e}")
            return {
                "period": period,
                "total_time": 0,
                "total_words": 0,
                "session_count": 0,
                "crash_count": 0,
                "total_uptime": 0,
            }

    def get_recent_crashes(self, hours=24):
        """Get recent crash records"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            since = (datetime.now() - timedelta(hours=hours)).isoformat()

            cursor.execute("""
                SELECT timestamp, exit_code, reason, auto_restarted
                FROM crashes
                WHERE timestamp >= ?
                ORDER BY timestamp DESC
            """, (since,))

            return [dict(row) for row in cursor.fetchall()]

        except sqlite3.Error as e:
            NSLog(f"Failed to get recent crashes: {e}")
            return []

    # MARK: - Export

    def export_statistics(self, format_type, output_path=None):
        """Export statistics to a file"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            # Get all sessions
            cursor.execute("""
                SELECT * FROM sessions ORDER BY start_time DESC
            """)
            sessions = [dict(row) for row in cursor.fetchall()]

            # Get all daily stats
            cursor.execute("""
                SELECT * FROM daily_stats ORDER BY date DESC
            """)
            daily_stats = [dict(row) for row in cursor.fetchall()]

            # Get all crashes
            cursor.execute("""
                SELECT * FROM crashes ORDER BY timestamp DESC
            """)
            crashes = [dict(row) for row in cursor.fetchall()]

            data = {
                "export_date": datetime.now().isoformat(),
                "app_version": "0.1.0",
                "sessions": sessions,
                "daily_stats": daily_stats,
                "crashes": crashes,
            }

            # Generate default output path
            if not output_path:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                desktop = Path.home() / "Desktop"
                output_path = desktop / f"opentype_stats_{timestamp}.{format_type}"

            output_path = Path(output_path)

            if format_type.lower() == "json":
                with open(output_path, 'w') as f:
                    json.dump(data, f, indent=2, default=str)

            elif format_type.lower() == "csv":
                # Export sessions as CSV
                csv_path = output_path.with_suffix('.csv')
                with open(csv_path, 'w', newline='') as f:
                    if sessions:
                        writer = csv.DictWriter(f, fieldnames=sessions[0].keys())
                        writer.writeheader()
                        writer.writerows(sessions)

                # Also export daily stats
                daily_csv_path = output_path.parent / f"{output_path.stem}_daily.csv"
                with open(daily_csv_path, 'w', newline='') as f:
                    if daily_stats:
                        writer = csv.DictWriter(f, fieldnames=daily_stats[0].keys())
                        writer.writeheader()
                        writer.writerows(daily_stats)

                output_path = csv_path

            NSLog(f"Exported statistics to {output_path}")
            return True

        except Exception as e:
            NSLog(f"Failed to export statistics: {e}")
            return False
