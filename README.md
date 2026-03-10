# 🎤 Monica: Premium AI Mock Interviewer

A fully functional, enterprise-grade AI mock interview simulator built with React, FastAPI, LiveKit, and Tavus. This application allows users to conduct highly realistic voice-to-voice interviews with a 3D AI agent ("Monica") that can see, hear, and react to candidates in real-time.

![AI Interviewer Interface](./.readme-assets/interface.png)

## ✨ Core Features & The "$100k Demo" Experience

*   **Ultra-Low Latency Voice & Video:** Connects directly via WebRTC using the `LiveKit Agents` Python SDK. The `livekit-plugins-tavus` integration generates a stunning, lip-synced 3D avatar of Monica directly into the video feed.
*   **Zero-Cost Emotion Detection:** Utilizes `face-api.js` via local WebGL in the candidate's browser to analyze facial expressions (stress, confidence, happiness) at 1 FPS. It securely streams tiny JSON telemetry payloads to the backend without ever transmitting biometric image data.
*   **Live Grading Engine & Transcripts:** The backend silently logs all candidate speech, AI speech, code submissions, and emotion telemetry into a continuous SQLite database (`interview_sessions.db`). A background LLM worker continually assesses the transcript to dispatch a live 1-100 grade to the frontend.
*   **AI Feedback PDF Reports:** At the end of the session, candidates can download a highly detailed PDF report (generated 100% client-side via `html2pdf.js`) detailing their strengths, weaknesses, code snippets, and final score.
*   **Recruiter Portal:** A dedicated `/recruiter` route allows a human to silently spectate active LiveKit rooms without publishing their own audio/video.
*   **Dynamic Role Play (4 Modes):** The AI adapts its strictness, personality, and questions based on:
    *   **Behavioral:** STAR methodology and culture fit.
    *   **Technical:** Live algorithms with a built-in code editor.
    *   **System Design:** Architecture and scalability.
    *   **Resume Deep Dive:** Uses client-side `pdf.js` to extract text from a resume and inject it into the AI's prompt for deep, personalized drilling.

## 🛠 Tech Stack

*   **Frontend:** React (Vite), `@livekit/components-react`, `face-api.js` (Emotion CV), `html2pdf.js`, `pdfjs-dist` (Resume Parsing).
*   **Backend:** FastAPI (Python), `livekit-agents`, `sqlite3`.
*   **AI Models:** OpenAI (`gpt-4o` for conversation, `gpt-4o-mini` for live grading), ElevenLabs (TTS), Tavus (3D Avatar Generation).
*   **Infrastructure:** LiveKit Cloud (WebRTC routing and Data Channels).

## 🚀 Getting Started

### 1. Backend Setup

The backend handles token generation, RAG prompt construction, SQLite logging, and hosts the LiveKit AI Agent.

```bash
# Install dependencies
pip install fastapi uvicorn livekit-agents livekit-plugins-openai livekit-plugins-elevenlabs livekit-plugins-silero livekit-plugins-tavus python-dotenv requests

# Start the Token API Server and Database Connection (Port 8000)
python server.py &

# Start the LiveKit Voice Agent (Wait for connections)
python agent.py dev
```

### 2. Frontend Setup

The frontend provides the applicant tracking dashboard and interview workspace.

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

### 3. Environment Variables (`.env`)

You need the following keys in the root directory to run the application securely:

```env
# WebRTC Routing
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_key
LIVEKIT_API_SECRET=your_secret

# AI Brain & Voice
OPENAI_API_KEY=sk-your-key
ELEVEN_API_KEY=your_elevenlabs_key

# 3D Avatar (Tavus)
TAVUS_API_KEY=your_tavus_key
TAVUS_REPLICA_ID=r79e1...
TAVUS_PERSONA_ID=pe_8f2...
```

## 🧠 System Architecture & Security

1.  **Strictly Client-Side Biometrics:** All computer vision (`face-api.js`) and document parsing (`pdfjs-dist`) execute entirely in the candidate's browser. The Python backend is absolved of biometric liability and heavy CPU overhead.
2.  **Stateless File Generation:** The PDF Feedback Report is assembled inside the React app. The backend simply exposes a single, authenticated REST endpoint (`/report/{room_name}`) serving lightweight JSON.
3.  **Data Channels:** The React frontend and Python backend communicate via robust LiveKit Data Channels to sync code submissions, send UI state updates, and record telemetry.
4.  **Silence Watchdogs:** The agent implements asynchronous timeout loops to proactively check on candidates if they remain silent for 30 seconds, ensuring a natural conversational cadence.
