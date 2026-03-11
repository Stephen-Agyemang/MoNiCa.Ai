import psycopg2
import os
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")

def get_connection():
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is not set in .env")
    
    # Disable server-side prepared statements because Supabase's Transaction Pooler does not support them.
    conn = psycopg2.connect(SUPABASE_URL)
    conn.autocommit = True
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
            created_at TIMESTAMP
        )
    ''')
    conn.commit()
    cursor.close()
    conn.close()

def create_session(session_id: str, role: str, company: str, mode: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO interview_sessions (id, role, company, mode, transcript, code_submissions, created_at)
        VALUES (%s, %s, %s, %s, '[]', '[]', %s)
        ON CONFLICT (id) DO NOTHING
    ''', (session_id, role, company, mode, datetime.now()))
    conn.commit()
    cursor.close()
    conn.close()

def append_to_transcript(session_id: str, speaker: str, text: str):
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT transcript FROM interview_sessions WHERE id = %s', (session_id,))
    row = cursor.fetchone()
    if row:
        transcript = json.loads(row[0])
        transcript.append({
            "speaker": speaker,
            "text": text,
            "timestamp": datetime.now().isoformat()
        })
        cursor.execute(
            'UPDATE interview_sessions SET transcript = %s WHERE id = %s',
            (json.dumps(transcript), session_id)
        )
        conn.commit()
    cursor.close()
    conn.close()

def get_transcript_text(session_id: str) -> str:
    """Returns the formatted transcript text for a given session."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT transcript FROM interview_sessions WHERE id = %s', (session_id,))
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
    
    cursor.execute('SELECT code_submissions FROM interview_sessions WHERE id = %s', (session_id,))
    row = cursor.fetchone()
    if row:
        subs = json.loads(row[0])
        subs.append({
            "question": question,
            "code": code,
            "timestamp": datetime.now().isoformat()
        })
        cursor.execute(
            'UPDATE interview_sessions SET code_submissions = %s WHERE id = %s',
            (json.dumps(subs), session_id)
        )
        conn.commit()
    cursor.close()
    conn.close()

def update_session_score(session_id: str, score: float, feedback_json: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE interview_sessions 
        SET score = %s, feedback_json = %s 
        WHERE id = %s
    ''', (score, feedback_json, session_id))
    conn.commit()
    cursor.close()
    conn.close()

# Initialize upon import
if SUPABASE_URL:
    try:
        init_db()
        print("Successfully connected to Supabase PostgreSQL!")
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase database: {e}")
