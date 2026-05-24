# MoNiCa.AI – Real-Time AI Interview Platform

MoNiCa.AI is a highly scalable, real-time AI interviewing agent deployed as a microservices architecture. It leverages WebRTC for low-latency bi-directional media streaming, orchestrating multiple AI services (LLMs, STT, TTS) to conduct realistic technical and behavioral interviews.

## 🏗️ Architecture Overview

The platform is designed around a robust backend infrastructure, utilizing a Python FastAPI gateway, a dedicated WebRTC worker agent, and a PostgreSQL database for state persistence. It is containerized using Docker and orchestrated via Kubernetes.

- **FastAPI Gateway Server:** Handles secure token generation, session management, REST endpoints, and WebRTC signaling metadata.
- **LiveKit Agent Worker:** A high-concurrency WebRTC backend service that processes incoming audio streams, orchestrates OpenAI for reasoning, Deepgram for transcription, and ElevenLabs/Tavus for speech and video synthesis.
- **State Persistence:** Supabase (PostgreSQL) is used for reliable storage of interview telemetry, evaluation reports, and user sessions.
- **Infrastructure:** Microservices are containerized via Docker, deployed on Kubernetes, and managed by an Nginx Ingress Controller for secure API routing and load balancing.
- **Client Application:** A lightweight React-based web client that connects to the LiveKit room to stream user media and display the AI avatar.

## 🚀 Tech Stack

- **Backend:** Python (FastAPI)
- **Real-Time Pipeline:** WebRTC, LiveKit, Python Asyncio
- **DevOps & Infrastructure:** Docker, Kubernetes, Nginx Ingress
- **Database:** PostgreSQL (Supabase)
- **AI Orchestration:** OpenAI (Reasoning), Deepgram (STT), ElevenLabs (TTS), Tavus/Simli (Visual Synthesis)

## 🛠️ Kubernetes Deployment

The platform is designed to be highly available and is deployed using standard Kubernetes manifests (`k8s/`).

### 1. Build & Push Images
```bash
docker build -t monica-backend:latest -f backend.Dockerfile .
docker build -t monica-agent:latest -f agent.Dockerfile .
# (Frontend client image build process available in k8s/README.md)
```

### 2. Deploy Infrastructure
```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Generate Secrets from local .env
kubectl -n monica create secret generic monica-secrets --from-env-file=.env --dry-run=client -o yaml | kubectl apply -f -

# Deploy backend, agent, and web client services
kubectl apply -k k8s
```

## 🔐 Environment Configuration

The backend services require the following `.env` configuration:

```bash
# WebRTC / Signaling
LIVEKIT_URL=wss://...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...

# AI Services Pipeline
OPENAI_API_KEY=sk-...
ELEVEN_API_KEY=...
TAVUS_API_KEY=...

# Persistence
SUPABASE_URL=postgresql://...
```
://...
```
