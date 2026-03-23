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
        user_id = m_dict.get("userId") if metadata else None
        database.create_session(room, role, company_name, interview_mode, user_id=user_id)
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
    try:
        row = database.get_session_data(room_name)
        
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
            "createdAt": row[7].isoformat() if hasattr(row[7], 'isoformat') else str(row[7])
        }
    except Exception as e:
        logger.error(f"Failed to fetch report for {room_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch report data.")
@app.get("/published-sessions")
async def get_published_sessions():
    """Recruiter Portal Endpoint: Returns only candidate-approved sessions."""
    try:
        rows = database.get_published_sessions()
        return [
            {
                "id": r[0],
                "role": r[1],
                "company": r[2],
                "mode": r[3],
                "score": r[4],
                "createdAt": r[5]
            } for r in rows
        ]
    except Exception as e:
        logger.error(f"Failed to fetch published sessions: {e}")
        raise HTTPException(status_code=500, detail="Failed to load recruiter dashboard.")

@app.post("/publish-report/{room_name}")
async def publish_report(room_name: str, payload: dict):
    """Candidate Opt-In: Explicitly share or hide a report from recruiters."""
    published = payload.get("published", False)
    try:
        database.set_session_published(room_name, published)
        return {"status": "success", "published": published}
    except Exception as e:
        logger.error(f"Failed to toggle publication for {room_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update privacy settings.")

@app.post("/support")
async def post_support_request(request: Request):
    """Securely handles incoming support tickets, saving them to DB and triggering a Formspree relay."""
    import urllib.request
    import json

    try:
        data = await request.json()
        email = data.get("email", "Anonymous")
        subject = data.get("subject", "No Subject")
        message = data.get("message", "")

        if not message:
            raise HTTPException(status_code=400, detail="Message content is required.")

        # 1. Permanent Storage (Supabase)
        database.create_support_request(email, subject, message)
        logger.info(f"Support Request Persisted: {subject} from {email}")

        # 2. Hybrid Relay (Formspree)
        formspree_url = os.getenv("FORMSPREE_URL")

        if formspree_url:
            try:
                # Construct Payload for Formspree
                payload = {
                    "email": email,
                    "subject": f"Monica Support: {subject}",
                    "message": message
                }
                
                req = urllib.request.Request(
                    formspree_url, 
                    data=json.dumps(payload).encode('utf-8'),
                    headers={'Content-Type': 'application/json', 'User-Agent': 'Monica-AI-Backend'}
                )
                
                with urllib.request.urlopen(req) as response:
                    if response.status == 200:
                        logger.info("Formspree Relay Successful.")
                    else:
                        logger.error(f"Formspree Relay returned status: {response.status}")
            except Exception as relay_err:
                logger.error(f"Formspree Relay Failed: {relay_err}")
        else:
            logger.warning("Formspree Relay Skipped: FORMSPREE_URL not set in .env")

        return {"status": "success", "message": "Executive Support Request Received."}

    except Exception as e:
        logger.error(f"Failed to process support request: {e}")
        raise HTTPException(status_code=500, detail="Executive Support Engine Encountered an Error.")

if __name__ == "__main__":
    import uvicorn
    # Run the server on Port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)
