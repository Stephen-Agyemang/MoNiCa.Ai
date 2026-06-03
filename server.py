import os
import base64
import logging
from uuid import uuid4
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from livekit import api
from dotenv import load_dotenv
import time
from fastapi.responses import JSONResponse
import redis.asyncio as aioredis
import httpx
import jwt as pyjwt
from jwt import PyJWKClient

load_dotenv()

# ── Clerk JWT Auth ────────────────────────────────────────────────────────────
def _jwks_url_from_publishable_key(pk: str) -> str:
    """Derive the Clerk JWKS URL from the publishable key (pk_test_... / pk_live_...)."""
    try:
        b64 = pk.split("_")[2]
        b64 += "=" * (-len(b64) % 4)
        domain = base64.b64decode(b64).decode().rstrip("$")
        return f"https://{domain}/.well-known/jwks.json"
    except Exception:
        return ""

_CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL") or _jwks_url_from_publishable_key(
    os.getenv("VITE_CLERK_PUBLISHABLE_KEY", "")
)
_jwks_client: PyJWKClient | None = PyJWKClient(_CLERK_JWKS_URL, cache_keys=True) if _CLERK_JWKS_URL else None

async def require_auth(request: Request) -> str:
    """FastAPI dependency — validates a Clerk session token, returns the Clerk user ID."""
    if _jwks_client is None:
        raise HTTPException(status_code=503, detail="Authentication service not configured.")
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token.")
    token = auth[7:]
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = pyjwt.decode(
            token, signing_key.key, algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return payload["sub"]
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session token has expired.")
    except Exception as e:
        logging.getLogger("monica-token-server").warning(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid session token.")
# ─────────────────────────────────────────────────────────────────────────────

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("monica-token-server")

_redis: aioredis.Redis | None = None

@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _redis
    try:
        _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
        await _redis.ping()
        logger.info(f"Redis connected at {REDIS_URL}")
    except Exception as e:
        logger.warning(f"Redis unavailable ({e}). Rate limiting falls back to in-memory.")
        _redis = None
    yield
    if _redis:
        await _redis.aclose()

app = FastAPI(lifespan=lifespan)

# Allow the React frontend to communicate with this token server.
DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost",      # Docker Nginx Frontend
    "http://localhost:5173", # Default Vite Port
    "http://localhost:5174", # Fallback Vite Port (Active)
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "https://your-frontend-domain.vercel.app" # UPDATE THIS WHEN DEPLOYED
]
EXTRA_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
ALLOWED_ORIGINS = DEFAULT_ALLOWED_ORIGINS + EXTRA_ALLOWED_ORIGINS

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

MAX_REQUESTS_PER_MINUTE = 5

# In-memory fallback used when Redis is unavailable (e.g. plain local dev without Docker)
_fallback_store: dict[str, list[float]] = {}

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path == "/healthz":
        return await call_next(request)

    client_ip = getattr(request.client, "host", "unknown")
    now = time.time()

    if _redis is not None:
        # Sliding-window via Redis sorted set — survives restarts, works across replicas
        key = f"rate:{client_ip}"
        try:
            async with _redis.pipeline(transaction=True) as pipe:
                member = f"{now}:{uuid4().hex[:8]}"   # unique per request
                pipe.zadd(key, {member: now})
                pipe.zremrangebyscore(key, 0, now - 60)
                pipe.zcard(key)
                pipe.expire(key, 60)
                _, _, count, _ = await pipe.execute()
            if count > MAX_REQUESTS_PER_MINUTE:
                return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Try again later."})
        except Exception as e:
            logger.warning(f"Redis rate-limit check failed: {e}. Falling through to in-memory.")
            if _redis_fallback(client_ip, now):
                return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Try again later."})
    else:
        if _redis_fallback(client_ip, now):
            return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Try again later."})

    response = await call_next(request)
    return response

def _redis_fallback(client_ip: str, now: float) -> bool:
    """In-memory sliding-window check. Returns True if the request should be blocked."""
    _fallback_store.setdefault(client_ip, [])
    _fallback_store[client_ip] = [t for t in _fallback_store[client_ip] if now - t < 60]
    if len(_fallback_store[client_ip]) >= MAX_REQUESTS_PER_MINUTE:
        return True
    _fallback_store[client_ip].append(now)
    # Prune stale IPs to prevent unbounded memory growth
    if len(_fallback_store) > 1000:
        stale = [ip for ip, ts in _fallback_store.items() if not ts or now - ts[-1] > 60]
        for k in stale:
            _fallback_store.pop(k, None)
    return False

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

import json
import database
from pydantic import BaseModel
from typing import Optional

class TokenRequest(BaseModel):
    room: Optional[str] = None
    role: str = "Candidate"
    metadata: Optional[str] = None

@app.post("/token")
async def post_token(body: TokenRequest):
    return await get_token(room=body.room, role=body.role, metadata=body.metadata)

@app.get("/token")
async def get_token(room: str | None = None, role: str = "Candidate", metadata: str | None = None):
    """Generates a secure LiveKit Access Token with deep metadata."""
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(status_code=500, detail="Missing LiveKit API Keys in .env")

    # Generate a unique room name per session to avoid stale room conflicts
    if not room:
        room = f"interview-{uuid4().hex}" # Full 32-char UUID for cryptographic entropy
        
    company_name = ""
    interview_mode = "general"
    m_dict = {}
    if metadata:
        try:
            m_dict = json.loads(metadata)
            company_name = m_dict.get("company", "")
            interview_mode = m_dict.get("mode", "general")
        except json.JSONDecodeError:
            logger.warning("Invalid token metadata payload. Continuing with defaults.")

    # Initialize the interview transcript record in SQLite
    try:
        user_id = m_dict.get("userId")
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

    return {"token": token.to_jwt(), "url": LIVEKIT_URL, "room_name": room}

@app.get("/recruiter-token")
async def get_recruiter_token(room: str, _user_id: str = Depends(require_auth)):
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

ADMIN_SECRET = os.getenv("ADMIN_SECRET")

@app.get("/report/{room_name}")
async def get_report(room_name: str, secret: str | None = None):
    """Retrieves the full interview session data for generating a PDF report."""
    if ADMIN_SECRET and secret != ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized access to reports.")
        
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
            "isPublished": bool(row[7]),
            "createdAt": row[8].isoformat() if hasattr(row[8], 'isoformat') else str(row[8])
        }
    except Exception as e:
        logger.error(f"Failed to fetch report for {room_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch report data.")
@app.get("/published-sessions")
async def get_published_sessions(_user_id: str = Depends(require_auth)):
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
async def publish_report(room_name: str, payload: dict, _user_id: str = Depends(require_auth)):
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
    data = await request.json()
    email = data.get("email", "Anonymous")
    subject = data.get("subject", "No Subject")
    message = data.get("message", "")

    if not message:
        raise HTTPException(status_code=400, detail="Message content is required.")

    # 1. Permanent storage
    try:
        database.create_support_request(email, subject, message)
        logger.info(f"Support request persisted: '{subject}' from {email}")
    except Exception as e:
        logger.error(f"Failed to persist support request: {e}")
        raise HTTPException(status_code=500, detail="Failed to save support request.")

    # 2. Async email relay via Formspree
    formspree_url = os.getenv("FORMSPREE_URL")
    if formspree_url:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(
                    formspree_url,
                    json={
                        "email": email,
                        "subject": f"Monica Support: {subject}",
                        "message": message,
                    },
                    headers={"User-Agent": "Monica-AI-Backend"},
                )
            if resp.is_success:
                logger.info("Formspree relay successful.")
            else:
                logger.error(f"Formspree relay returned {resp.status_code}: {resp.text[:200]}")
        except Exception as relay_err:
            logger.error(f"Formspree relay failed: {relay_err}")
    else:
        logger.warning("Formspree relay skipped: FORMSPREE_URL not set in .env")

    return {"status": "success", "message": "Support Request Received."}

if __name__ == "__main__":
    import uvicorn
    # Run the server on Port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)
