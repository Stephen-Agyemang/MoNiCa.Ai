# Monica: AI-Powered Mock Interview Platform

Monica is an AI-driven system designed to conduct realistic mock interviews across multiple domains, including engineering, product, and design. The platform combines real-time voice interaction, photorealistic visual synthesis, and automated performance assessment to help candidates prepare for high-stakes interviews.

## Core Features

- **Real-Time Voice Interaction:** Conduct seamless, low-latency voice conversations with an AI agent.
- **Multimodal Interview Paths:** Support for technical, behavioral, system design, and resume-based interview sessions.
- **Visual Feedback & Body Language:** Embedded 3D AI avatar that reacts to candidate speech and identifies non-verbal cues.
- **Automated Performance Reports:** Generation of high-fidelity feedback reports with scoring across technical accuracy, problem-solving, and communication.
- **Sovereign Consent Dashboard:** A "Consent-First" recruiter gateway allowing candidates to explicitly share specific successful sessions.
- **Guest Practice Mode:** Account-free "Quick Practice" sessions to lower the barrier for professional preparation.
- **Emotion CV Telemetry:** Real-time analysis of facial expressions using local computer vision to gauge candidate stress and confidence levels.
- **Secure PDF Export:** Client-side generation of professional interview summaries and transcripts.

## System Architecture Overview

User → React Frontend → LiveKit Room → FastAPI Agent → AI APIs → Database

- **User Interaction:** The candidate interacts with a React-based frontend that manages WebRTC streams and local computer vision.
- **Orchestration Layer:** A FastAPI server handles session management, token generation, and communication with the LiveKit agent.
- **AI Agent Worker:** The LiveKit agent processes incoming audio, manages LLM reasoning, and coordinates TTS/VIS playback.
- **Persistence Layer:** Interview transcripts and grades are stored in Supabase (PostgreSQL) with a local SQLite fallback for reliability.

## Tech Stack

- **Infrastructure:** Docker, Docker Compose, Nginx.
- **Frontend:** React 18, Vite, @livekit/components-react, face-api.js.
- **Backend:** FastAPI, Python 3.10+, livekit-agents.
- **AI Integration:** OpenAI (LLM, Zero-Shot Dynamic Engine), ElevenLabs (TTS), Tavus (AI Avatar).
- **Security & Support:** Clerk (Authentication), Formspree (Support Relay).
- **Database:** PostgreSQL (Supabase), SQLite (Development fallback).
- **Export Engine:** html2pdf.js.

## Running the Project Locally

The entire application is completely containerized. You do not need to install Node, Python, or WebRTC dependencies on your host machine.

### 1. Prerequisites
- Docker Desktop installed and running.
- A `.env` file in the root directory containing your LiveKit, OpenAI, and Supabase credentials.

### 2. Start the Stack
```bash
docker-compose up --build
```

This single command will:
1. Build the React SPA and serve it via Nginx.
2. Spin up the FastAPI backend on port 8000.
3. Start the LiveKit WebRTC Python Worker (Monica's brain) to intercept room creations.

Navigate to `http://localhost` to start your interview.

## Environment Variables

The system requires a `.env` file in the root directory with the following keys:

```ssh
# LiveKit Cloud
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# AI Providers
OPENAI_API_KEY=sk-...
ELEVEN_API_KEY=...
TAVUS_API_KEY=...

# Persistence & Support
SUPABASE_URL=postgresql://...
FORMSPREE_URL=https://formspree.io/f/...
CLERK_PUBLISHABLE_KEY=...
```

## Design Principles & Architecture Decisions

1. **Client-Side Data sovereignty:** All biometric analysis (`face-api.js`) and PDF generation (`html2pdf.js`) occur in the user's browser. No raw video feed or identity documents are stored on the server, ensuring candidate privacy.
2. **Hybrid Persistence Model:** The system utilizes PostgreSQL for scalable cloud storage while maintaining a full SQLite fallback to prevent downtime during network or database provider interruptions.
3. **Bar-Raiser Logic:** The grading engine uses weighted metrics tailored to the specific role (e.g., higher technical weighting for engineering roles).
4. **Latency Minimization:** The architecture uses `eleven_turbo_v2_5` and WebRTC Data Channels to ensure that the AI's response time feels natural and human-like.

## Future Roadmap

We are committed to evolving Monica into a world-class career acceleration engine. Our long-term vision includes private session recording, real-time engagement analytics, and multi-persona interview simulations.

**For full details, see our [Interactive Product Roadmap](ROADMAP.md).**

## Author

Developed by the Monica Engineering Team.
