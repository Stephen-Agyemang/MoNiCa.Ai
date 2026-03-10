import os
import logging
from uuid import uuid4
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from livekit import api
from dotenv import load_dotenv
import time
import requests
from fastapi.responses import JSONResponse

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("monica-token-server")

app = FastAPI()

# Allow the React frontend to communicate with this token server
ALLOWED_ORIGINS = [
    "http://localhost:5173", # Default Vite Port
    "http://localhost:5174", # Fallback Vite Port (Active)
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "https://your-frontend-domain.vercel.app" # UPDATE THIS WHEN DEPLOYED
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS, 
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

# Basic in-memory rate limiting (IP -> [timestamps])
RATE_LIMIT_STORE = {}
MAX_REQUESTS_PER_MINUTE = 5

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host
    now = time.time()
    
    if client_ip not in RATE_LIMIT_STORE:
        RATE_LIMIT_STORE[client_ip] = []
        
    # Remove old requests
    RATE_LIMIT_STORE[client_ip] = [t for t in RATE_LIMIT_STORE[client_ip] if now - t < 60]
    
    if len(RATE_LIMIT_STORE[client_ip]) >= MAX_REQUESTS_PER_MINUTE:
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Try again later."})
        
    RATE_LIMIT_STORE[client_ip].append(now)
    response = await call_next(request)
    return response

import json
import database

@app.get("/token")
async def get_token(room: str = None, role: str = "Candidate", metadata: str = None):
    """Generates a secure LiveKit Access Token with deep metadata."""
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(status_code=500, detail="Missing LiveKit API Keys in .env")

    # Generate a unique room name per session to avoid stale room conflicts
    if not room:
        room = f"interview-{uuid4().hex[:8]}"
        
    company_name = ""
    interview_mode = "general"
    if metadata:
        try:
            m_dict = json.loads(metadata)
            company_name = m_dict.get("company", "")
            interview_mode = m_dict.get("mode", "general")
        except:
            pass

    # Initialize the interview transcript record in SQLite
    try:
        database.create_session(room, role, company_name, interview_mode)
    except Exception as e:
        logger.error(f"Failed to create DB session: {e}")
    
    identity = f"user-{uuid4().hex[:6]}"
    
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET) \
        .with_identity(identity) \
        .with_metadata(metadata or role) \
        .with_name(role) \
        .with_grants(api.VideoGrants(
            room_join=True,
            room=room,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True
        ))

    return {"token": token.to_jwt(), "url": LIVEKIT_URL}

@app.get("/recruiter-token")
async def get_recruiter_token(room: str):
    """Generates a view-only LiveKit Access Token for a recruiter to silently observe."""
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(status_code=500, detail="Missing LiveKit API Keys in .env")

    if not room:
        raise HTTPException(status_code=400, detail="Room name is required for recruiter access.")
        
    identity = f"recruiter-{uuid4().hex[:6]}"
    
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET) \
        .with_identity(identity) \
        .with_name("Recruiter (Observer)") \
        .with_grants(api.VideoGrants(
            room_join=True,
            room=room,
            can_publish=False, # Silent observer
            can_subscribe=True,
            can_publish_data=False
        ))

    return {"token": token.to_jwt(), "url": LIVEKIT_URL}

@app.get("/report/{room_name}")
async def get_report(room_name: str):
    """Retrieves the full interview session data for generating a PDF report."""
    import sqlite3
    try:
        conn = sqlite3.connect("interview_sessions.db")
        cursor = conn.cursor()
        cursor.execute('''
            SELECT role, company, mode, transcript, code_submissions, score, feedback_json, created_at
            FROM interview_sessions
            WHERE id = ?
        ''', (room_name,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="Interview session not found.")
            
        return {
            "roomName": room_name,
            "role": row[0],
            "company": row[1],
            "mode": row[2],
            "transcript": json.loads(row[3]) if row[3] else [],
            "codeSubmissions": json.loads(row[4]) if row[4] else [],
            "score": row[5],
            "feedback": json.loads(row[6]) if row[6] else None,
            "createdAt": row[7]
        }
    except Exception as e:
        logger.error(f"Failed to fetch report for {room_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch report data.")

if __name__ == "__main__":
    import uvicorn
    # Run the server on Port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
