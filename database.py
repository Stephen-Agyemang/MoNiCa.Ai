try:
    import psycopg2
    HAS_POSTGRES = True
except ImportError:
    import sqlite3
    HAS_POSTGRES = False
    print("Warning: psycopg2 not found. Falling back to SQLite.")

import os
import json
import logging
from datetime import datetime
from dotenv import load_dotenv

logger = logging.getLogger("monica-database")

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")

def get_connection():
    if HAS_POSTGRES and SUPABASE_URL:
        # PostgreSQL (Supabase)
        conn = psycopg2.connect(SUPABASE_URL)
        conn.autocommit = True
        return conn
    else:
        # Fallback to local SQLite (matches existing interview_sessions.db)
        conn = sqlite3.connect("interview_sessions.db")
        return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS interview_sessions (
            id TEXT PRIMARY KEY,
            role TEXT,
            company TEXT,
            mode TEXT,
            transcript TEXT,
            code_submissions TEXT,
            score REAL,
            feedback_json TEXT,
            is_published INTEGER DEFAULT 0,
            user_id TEXT,
            created_at TIMESTAMP
        )
    ''')
    
    # Support Requests Table (Executive Hybrid Model)
    if HAS_POSTGRES and SUPABASE_URL:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS support_requests (
                id SERIAL PRIMARY KEY,
                user_email TEXT,
                subject TEXT,
                message TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS support_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT,
                subject TEXT,
                message TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP
            )
        ''')
    conn.commit()
    cursor.close()
    conn.close()

def _get_placeholder():
    return "%s" if HAS_POSTGRES and SUPABASE_URL else "?"

def create_session(room_name, role, company, mode, user_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    p = _get_placeholder()
    cursor.execute(f'''
        INSERT INTO interview_sessions (id, role, company, mode, user_id, transcript, code_submissions, created_at)
        VALUES ({p}, {p}, {p}, {p}, {p}, {p}, {p}, {p})
    ''', (room_name, role, company, mode, user_id, '[]', '[]', datetime.now()))
    conn.commit()
    conn.close()

def set_session_published(room_name, is_published):
    """Ethical Consent: Candidates explicitly publish their sessions to recruiters."""
    conn = get_connection()
    cursor = conn.cursor()
    p = _get_placeholder()
    # Handle int conversion for SQLite 0/1
    val = 1 if is_published else 0
    cursor.execute(f"UPDATE interview_sessions SET is_published = {p} WHERE id = {p}", (val, room_name))
    conn.commit()
    conn.close()

def get_published_sessions():
    """Recruiter Access: Only fetch sessions where candidate has opted-in."""
    conn = get_connection()
    cursor = conn.cursor()
    p = _get_placeholder()
    cursor.execute(f'''
        SELECT id, role, company, mode, score, created_at 
        FROM interview_sessions 
        WHERE is_published = 1
        ORDER BY created_at DESC
    ''')
    rows = cursor.fetchall()
    conn.close()
    return rows

def append_to_transcript(session_id: str, speaker: str, text: str):
    conn = get_connection()
    cursor = conn.cursor()
    p = _get_placeholder()
    
    cursor.execute(f'SELECT transcript FROM interview_sessions WHERE id = {p}', (session_id,))
    row = cursor.fetchone()
    if row:
        transcript = json.loads(row[0])
        transcript.append({
            "speaker": speaker,
            "text": text,
            "timestamp": datetime.now().isoformat()
        })
        cursor.execute(
            f'UPDATE interview_sessions SET transcript = {p} WHERE id = {p}',
            (json.dumps(transcript), session_id)
        )
        conn.commit()
    else:
        logger.warning("append_to_transcript: session '%s' not found — transcript entry dropped.", session_id)
    cursor.close()
    conn.close()

def get_transcript_text(session_id: str) -> str:
    """Returns the formatted transcript text for a given session."""
    conn = get_connection()
    cursor = conn.cursor()
    p = _get_placeholder()
    cursor.execute(f'SELECT transcript FROM interview_sessions WHERE id = {p}', (session_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if not row: return ""
    
    try:
        transcript = json.loads(row[0])
        return "\n".join([f"{entry['speaker']}: {entry['text']}" for entry in transcript])
    except:
        return ""

def append_code_submission(session_id: str, question: str, code: str):
    conn = get_connection()
    cursor = conn.cursor()
    p = _get_placeholder()
    
    cursor.execute(f'SELECT code_submissions FROM interview_sessions WHERE id = {p}', (session_id,))
    row = cursor.fetchone()
    if row:
        subs = json.loads(row[0])
        subs.append({
            "question": question,
            "code": code,
            "timestamp": datetime.now().isoformat()
        })
        cursor.execute(
            f'UPDATE interview_sessions SET code_submissions = {p} WHERE id = {p}',
            (json.dumps(subs), session_id)
        )
        conn.commit()
    else:
        logger.warning("append_code_submission: session '%s' not found — submission dropped.", session_id)
    cursor.close()
    conn.close()

def update_session_score(session_id: str, score: float, feedback_json: str):
    conn = get_connection()
    cursor = conn.cursor()
    p = _get_placeholder()
    cursor.execute(f'''
        UPDATE interview_sessions 
        SET score = {p}, feedback_json = {p} 
        WHERE id = {p}
    ''', (score, feedback_json, session_id))
    conn.commit()
    cursor.close()
    conn.close()

def get_session_data(session_id: str):
    """Retrieves the full interview session data for generating a report."""
    conn = get_connection()
    cursor = conn.cursor()
    p = _get_placeholder()
    cursor.execute(f'''
        SELECT role, company, mode, transcript, code_submissions, score, feedback_json, is_published, created_at
        FROM interview_sessions
        WHERE id = {p}
    ''', (session_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return row

def create_support_request(user_email: str, subject: str, message: str):
    conn = get_connection()
    cursor = conn.cursor()
    p = _get_placeholder()
    email_col = "user_email" if (HAS_POSTGRES and SUPABASE_URL) else "email"
    cursor.execute(f'''
        INSERT INTO support_requests ({email_col}, subject, message)
        VALUES ({p}, {p}, {p})
    ''', (user_email, subject, message))
    conn.commit()
    cursor.close()
    conn.close()

# Initialize upon import
try:
    init_db()
    if HAS_POSTGRES and SUPABASE_URL:
        print("Successfully connected to Supabase PostgreSQL!")
    else:
        print("Backend: Unified Database initialized (Local Fallback).")
except Exception as e:
    print(f"Warning: Failed to initialize database: {e}")
