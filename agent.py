import logging
import asyncio
import os
import json
import time
from enum import Enum
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    JobContext, 
    cli, 
    AutoSubscribe,
    llm,
    stt,
    tts,
    vad,
)
from livekit.agents.voice import Agent, AgentSession, RunContext
from livekit.plugins import openai, silero, elevenlabs, tavus
from prompts import TECHNICAL_INTERVIEW_PROMPT, STRICTNESS_INSTRUCTIONS, CLOSING_ASSESSMENT_PROMPT
import database

# Load environment configuration
load_dotenv()

# Setup professional logging
logger = logging.getLogger("monica-agent")
logger.setLevel(logging.INFO)

# --- Configuration ---
STAGES_TIMEOUT = 120.0

class InterviewStage(Enum):
    SELF_INTRO = 1
    PAST_EXPERIENCE = 2

class MonicaSessionState:
    """Manages the state of a single interview session."""
    def __init__(self, ctx: JobContext):
        self.ctx = ctx
        self.stage = InterviewStage.SELF_INTRO
        self.lock = asyncio.Lock()
        self.background_tasks: set[asyncio.Task] = set()

    def add_task(self, task: asyncio.Task):
        self.background_tasks.add(task)
        task.add_done_callback(self.background_tasks.discard)

    async def cleanup(self):
        """Ensures no ghost tasks or connections remain."""
        for task in self.background_tasks:
            task.cancel()
        if self.background_tasks:
            await asyncio.gather(*self.background_tasks, return_exceptions=True)
        logger.info(f"Cleanup complete for room: {self.ctx.room.name}")


import typing
from typing import Annotated

class MonicaAssistant:
    """The AI Identity of the Interviewer."""
    def __init__(self, state: MonicaSessionState, metadata: dict = None, room=None):
        super().__init__()
        self.state = state
        self._room = room
        self._metadata = metadata or {}

    @llm.function_tool
    async def send_question(self, 
                            question_text: str):
        """Sends a written question to the candidate's screen so they can read it while working on their solution. Use this for technical questions, coding problems, or any question that benefits from being written down.
        
        Args:
            question_text: The full question text to display on the candidate's screen
        """
        if self._room:
            try:
                data = json.dumps({"type": "question", "content": question_text}).encode("utf-8")
                await self._room.local_participant.publish_data(data, reliable=True)
                logger.info(f"Monica sent question to candidate screen: {question_text[:80]}...")
                return "Question displayed on candidate's screen. Wait for them to work on it and discuss their approach."
            except Exception as e:
                logger.error(f"Failed to send question via data channel: {e}")
                return "Could not display question on screen, but I'll read it aloud instead."
        return "Data channel not available. Read the question aloud."

    @llm.function_tool
    async def finish_interview(self, 
                               score_technical: int, 
                               score_problem_solving: int, 
                               score_communication: int, 
                               score_code_quality: int, 
                               score_optimization: int, 
                               strengths: str, 
                               improvements: str, 
                               verdict: str):
        """Delivers the final preparedness assessment to the candidate. Call this when the interview is concluding.
        
        Args:
            score_technical: Rating from 1-10 on technical accuracy
            score_problem_solving: Rating from 1-10 on problem solving intuition
            score_communication: Rating from 1-10 on verbal communication
            score_code_quality: Rating from 1-10 on code structure/readability
            score_optimization: Rating from 1-10 on algorithmic optimization
            strengths: 2-3 key strengths the candidate demonstrated
            improvements: 2-3 areas where the candidate should improve
            verdict: One of 'Ready', 'Nearly Ready', or 'Not Yet Ready'
        """
        is_technical = any(word in self._metadata.get("role", "").lower() for word in ["engineer", "dev", "tech", "arch", "backend", "frontend"])
        
        weights = {
            "technical": 0.30 if is_technical else 0.10,
            "problem_solving": 0.25 if is_technical else 0.30,
            "communication": 0.15 if is_technical else 0.35,
            "code_quality": 0.20 if is_technical else 0.05,
            "optimization": 0.10 if is_technical else 0.20
        }

        weighted_score = (
            (score_technical * weights["technical"]) +
            (score_problem_solving * weights["problem_solving"]) +
            (score_communication * weights["communication"]) +
            (score_code_quality * weights["code_quality"]) +
            (score_optimization * weights["optimization"])
        )
        
        final_normalized_score = round(weighted_score, 1)
        
        feedback = {
            "metrics": {
                "technical": score_technical,
                "problem_solving": score_problem_solving,
                "communication": score_communication,
                "code_quality": score_code_quality,
                "optimization": score_optimization,
            },
            "weights": weights,
            "role_archetype": "Technical" if is_technical else "Strategic",
            "strengths": strengths,
            "improvements": improvements,
            "verdict": verdict
        }
        
        if self._room:
            try:
                database.update_session_score(self._room.name, final_normalized_score * 10, json.dumps(feedback))
                logger.info(f"Saved DB Assessment — Weighted Score: {final_normalized_score}/10, Verdict: {verdict}")
            except Exception as e:
                logger.error(f"Failed to save assessment to DB: {e}")
                
        return f"Executive assessment recorded. Weighted Score: {final_normalized_score}/10. Verdict: {verdict}."

async def _fallback_watchdog(state: MonicaSessionState):
    """Secondary guard to ensure interview progression."""
    try:
        await asyncio.sleep(STAGES_TIMEOUT)
        async with state.lock:
            if state.stage == InterviewStage.SELF_INTRO:
                state.stage = InterviewStage.PAST_EXPERIENCE
                logger.info("Watchdog Triggered: Transitioning Monica to Stage 2.")
    except asyncio.CancelledError:
        pass

def create_voice_engine():
    """Selects the best possible voice engine."""
    try:
        eleven_key = os.getenv("ELEVEN_API_KEY")
        if eleven_key:
            logger.info("Using ElevenLabs TTS for high-quality, human-like voice")
            return elevenlabs.TTS(
                api_key=eleven_key,
                voice=elevenlabs.Voice(
                    id="21m00Tcm4TlvDq8ikWAM",
                    name="Rachel",
                    category="premade"
                ),
                model="eleven_turbo_v2_5"
            )
    except Exception as e:
        logger.warning(f"Voice engine 'ElevenLabs' reported error: {e}. Falling back to OpenAI.")
    
    logger.info("Falling back to OpenAI TTS")
    return openai.TTS(voice="nova")

async def entrypoint(ctx: JobContext):
    """The master controller for a single interview session."""
    logger.info(f"High-Stakes Session Started: {ctx.room.name}")
    state = MonicaSessionState(ctx)
    
    try:
        await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
        
        metadata = {}
        state.add_task(asyncio.create_task(_fallback_watchdog(state)))

        silero_vad = silero.VAD.load(
            min_speech_duration=0.1,
            min_silence_duration=0.6,
            prefix_padding_duration=0.1
        )
        
        fnc_ctx = MonicaAssistant(state, metadata=metadata, room=ctx.room)

        participant = await ctx.wait_for_participant()
        
        try:
            if participant.metadata:
                metadata = json.loads(participant.metadata)
                user_role = metadata.get("role", "Candidate")
                company = metadata.get("company", "the company")
                mode = metadata.get("mode", "behavioral")
                strictness = int(metadata.get("strictness", 3))
                resume_context = metadata.get("resumePromptContext", "")
            else:
                raise ValueError("Empty metadata")
        except:
            user_role = participant.metadata or "Candidate"
            company = "the company"
            mode = "behavioral"
            strictness = 3
            resume_context = ""

        from prompts import (BEHAVIORAL_INTERVIEW_PROMPT, TECHNICAL_INTERVIEW_PROMPT, 
                             SYSTEM_DESIGN_PROMPT, RESUME_DEEP_DIVE_PROMPT)
                             
        mode_prompts = {
            "behavioral": BEHAVIORAL_INTERVIEW_PROMPT,
            "technical": TECHNICAL_INTERVIEW_PROMPT,
            "system_design": SYSTEM_DESIGN_PROMPT,
            "resume_deep_dive": RESUME_DEEP_DIVE_PROMPT
        }
        
        base_instruction = mode_prompts.get(mode, BEHAVIORAL_INTERVIEW_PROMPT)
        final_instructions = base_instruction.replace("{role}", user_role).replace("{company}", company)
        strictness_level = max(1, min(5, strictness))
        
        elite_firms = ["google", "openai", "apple", "stripe", "meta", "facebook", "amazon", "netflix", "uber", "airbnb", "anthropic", "nvidia"]
        is_elite = any(firm in company.lower() for firm in elite_firms)
        
        if is_elite and strictness_level < 5:
            strictness_level += 2 if strictness_level <= 3 else 1
            final_instructions += f"\n\n**ELITE BAR RAISER MODE (ACTIVE):** Higher rigor for {company}."

        final_instructions += STRICTNESS_INSTRUCTIONS.get(strictness_level, STRICTNESS_INSTRUCTIONS[3])
        final_instructions += CLOSING_ASSESSMENT_PROMPT
        
        if resume_context:
            final_instructions += f"\n\n**CANDIDATE RESUME CONTEXT:**\n{resume_context}"

        # 2. Setup Assistant Components
        stt_model = openai.STT()
        llm_model = openai.LLM(model="gpt-4o")
        tts_model = create_voice_engine()

        # Define Agent ("The Brain")
        monica_chat_ctx = llm.ChatContext()
        monica_chat_ctx.add_message(role="system", content=final_instructions)
        
        monica_agent = Agent(
            instructions=final_instructions,
            stt=stt_model,
            llm=llm_model,
            tts=tts_model,
            vad=silero_vad,
            chat_ctx=monica_chat_ctx,
            tools=llm.find_function_tools(fnc_ctx),
        )

        # Define Session ("The Runtime")
        session = AgentSession(
            stt=stt_model,
            llm=llm_model,
            tts=tts_model,
            vad=silero_vad,
        )

        # 3. Mount Tavus 3D Avatar
        tavus_api_key = os.getenv("TAVUS_API_KEY")
        replica_id = os.getenv("TAVUS_REPLICA_ID")
        persona_id = os.getenv("TAVUS_PERSONA_ID")
        
        if tavus_api_key and replica_id and persona_id:
            logger.info(f"Mounting Tavus Avatar (Replica '{replica_id}')")
            avatar = tavus.AvatarSession(
                api_key=tavus_api_key,
                replica_id=replica_id,
                persona_id=persona_id,
                avatar_participant_name="Monica (Interviewer)",
            )
            async def start_tavus():
                try:
                    await avatar.start(agent_session=session, room=ctx.room)
                    logger.info("Tavus Avatar streaming.")
                except Exception as e:
                    logger.error(f"Tavus failed: {e}")
            
            asyncio.create_task(start_tavus())

        # 4. Start Core Session
        await session.start(
            agent=monica_agent,
            room=ctx.room,
        )

        last_speech_time = time.time()
        import openai as openai_package
        oai_client = openai_package.AsyncOpenAI()

        # Monitoring tasks
        async def silence_watchdog():
            nonlocal last_speech_time
            while ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
                await asyncio.sleep(5)
                if time.time() - last_speech_time > 30.0:
                    asyncio.create_task(session.generate_reply(user_input="[SYSTEM: Candidate silent for 30s. Nudge them.]"))
                    last_speech_time = time.time() + 60.0

        asyncio.create_task(silence_watchdog())

        # Event Handlers
        @session.on("user_input_transcribed")
        def on_user_speech(ev: stt.SpeechEvent):
            if ev.is_final:
                nonlocal last_speech_time
                last_speech_time = time.time()
                # Typing indicator
                asyncio.create_task(ctx.room.local_participant.publish_data(json.dumps({"type": "typing", "status": "start"}).encode("utf-8"), reliable=True))
                # Log DB
                database.append_to_transcript(ctx.room.name, "Candidate", ev.transcript)

        @session.on("agent_state_changed")
        def on_agent_state(ev):
            if ev.new_state == "speaking":
                asyncio.create_task(ctx.room.local_participant.publish_data(json.dumps({"type": "typing", "status": "stop"}).encode("utf-8"), reliable=True))

        @session.on("conversation_item_added")
        def on_item_added(ev):
            if ev.item.role == "assistant" and ev.item.content:
                database.append_to_transcript(ctx.room.name, "Monica", ev.item.content)

        # Proactive Greeting (Wait for Tavus video to synchronize)
        await asyncio.sleep(3)
        
        greeting = f"Hello, I'm Monica. I'll be conducting your interview for the '{user_role}' position at {company}."
        if mode == "technical":
            greeting += " I'll present coding problems on your screen while we discuss them. What are you looking to show me today?"
        else:
            greeting += " Tell me why you are the exceptional choice for this environment."
            
        await session.say(greeting, allow_interruptions=True)
        
        while ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
            await asyncio.sleep(1)
            
    except Exception as e:
        logger.error(f"Monica session error: {e}", exc_info=True)
    finally:
        await state.cleanup()

if __name__ == "__main__":
    from livekit.agents import WorkerOptions
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))