import sqlite3
import os
import json
from datetime import datetime

DB_PATH = "interview_sessions.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
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
    conn.close()

def create_session(session_id: str, role: str, company: str, mode: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO interview_sessions (id, role, company, mode, transcript, code_submissions, created_at)
        VALUES (?, ?, ?, ?, '[]', '[]', ?)
    ''', (session_id, role, company, mode, datetime.now()))
    conn.commit()
    conn.close()

def append_to_transcript(session_id: str, speaker: str, text: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('SELECT transcript FROM interview_sessions WHERE id = ?', (session_id,))
    row = cursor.fetchone()
    if row:
        transcript = json.loads(row[0])
        transcript.append({
            "speaker": speaker,
            "text": text,
            "timestamp": datetime.now().isoformat()
        })
        cursor.execute(
            'UPDATE interview_sessions SET transcript = ? WHERE id = ?',
            (json.dumps(transcript), session_id)
        )
        conn.commit()
    conn.close()

def get_transcript_text(session_id: str) -> str:
    """Returns the formatted transcript text for a given session."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT transcript FROM interview_sessions WHERE id = ?', (session_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row: return ""
    
    try:
        transcript = json.loads(row[0])
        return "\n".join([f"{entry['speaker']}: {entry['text']}" for entry in transcript])
    except:
        return ""

def append_code_submission(session_id: str, question: str, code: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('SELECT code_submissions FROM interview_sessions WHERE id = ?', (session_id,))
    row = cursor.fetchone()
    if row:
        subs = json.loads(row[0])
        subs.append({
            "question": question,
            "code": code,
            "timestamp": datetime.now().isoformat()
        })
        cursor.execute(
            'UPDATE interview_sessions SET code_submissions = ? WHERE id = ?',
            (json.dumps(subs), session_id)
        )
        conn.commit()
    conn.close()

def update_session_score(session_id: str, score: float, feedback_json: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE interview_sessions 
        SET score = ?, feedback_json = ? 
        WHERE id = ?
    ''', (score, feedback_json, session_id))
    conn.commit()
    conn.close()

# Initialize upon import
init_db()
