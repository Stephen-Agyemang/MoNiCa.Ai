# 🗺️ MoNiCa.AI: System Architecture & Data Flow

This outlines the master backend and infrastructure architecture for MoNiCa.AI. The system is deployed as a suite of microservices on Kubernetes, leveraging WebRTC for low-latency media processing.

## 🏗️ Infrastructure Map (Kubernetes)

```mermaid
flowchart TD
    %% External Traffic
    User[Client / Web Browser]
    Ingress[Nginx Ingress Controller]
    
    %% K8s Services
    subgraph K8sCluster [Kubernetes Cluster]
        SvcBackend[Backend Service]
        SvcFrontend[Frontend Service]
        
        subgraph Pods
            BackendPod[FastAPI Backend Pod]
            AgentPod[LiveKit Agent Pod]
            FrontendPod[React Client Pod]
        end
    end
    
    %% External APIs
    LKCloud[("LiveKit WebRTC Cloud")]
    DB[(Supabase / PostgreSQL)]
    AI_APIs["AI APIs (OpenAI, Deepgram, ElevenLabs)"]
    
    %% Routing
    User -- HTTPS --> Ingress
    Ingress -- "/api/*" --> SvcBackend
    Ingress -- "/*" --> SvcFrontend
    
    SvcBackend --> BackendPod
    SvcFrontend --> FrontendPod
    
    %% Backend Logic
    BackendPod -- "Read/Write State" --> DB
    BackendPod -- "Sign JWT Metadata" --> FrontendPod
    
    %% Real-Time WebRTC Pipeline
    FrontendPod -- "Connect via WebRTC" --> LKCloud
    AgentPod -- "Process Audio/Video Stream" --> LKCloud
    AgentPod -- "Orchestrate Inference" --> AI_APIs
```

## ⚙️ Core Backend Components

### 1. FastAPI Gateway (`server.py`)
*   **Role**: Serves as the primary REST API and session manager.
*   **Responsibilities**:
    *   Generates secure, cryptographically signed JWTs containing user intent, role, and interview mode.
    *   Manages API rate limiting and health checks (`/healthz`) for Kubernetes Liveness/Readiness probes.
    *   Stores and retrieves comprehensive interview reports from PostgreSQL.

### 2. The AI Worker Agent (`agent.py` & `prompts.py`)
*   **Role**: An asynchronous, highly concurrent worker node connected to the LiveKit WebRTC server.
*   **Responsibilities**:
    *   **VAD (Voice Activity Detection):** Detects user speech starts and stops locally.
    *   **STT (Speech-to-Text):** Streams audio chunks to Deepgram for real-time transcription.
    *   **LLM Inference:** Injects context via `prompts.py` based on JWT metadata, generating dynamic responses via OpenAI.
    *   **TTS (Text-to-Speech) & Visuals:** Streams LLM text to ElevenLabs for natural voice synthesis, and maps output to 3D avatar visual APIs (Tavus/Simli) at 12-24 FPS.

### 3. Persistence Layer (`database.py`)
*   **Role**: State and data durability.
*   **Responsibilities**: Uses Supabase (PostgreSQL) for cloud environments, allowing multi-pod deployment in Kubernetes to share state regarding generated reports, user sessions, and telemetry metrics.
