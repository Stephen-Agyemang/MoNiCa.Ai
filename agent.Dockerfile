FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required by psycopg2, audio libs, and curl for CLI
RUN apt-get update && apt-get install -y libpq-dev gcc curl jq unzip libglib2.0-0 && rm -rf /var/lib/apt/lists/*

# Pre-install the LiveKit CLI so the python agent doesn't hang asking for permission to download it
RUN curl -sSL https://get.livekit.io/cli | bash

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent specific files
COPY agent.py database.py prompts.py ./

# Start the LiveKit agent (using dev mode for local Docker testing so it auto-joins rooms)
CMD ["python", "agent.py", "dev"]
