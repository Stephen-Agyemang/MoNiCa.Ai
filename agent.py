import logging
import asyncio
import os
from enum import Enum
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent, 
    AgentSession, 
    JobContext, 
    cli, 
    function_tool, 
    room_io, 
    RunContext, 
    AutoSubscribe
)
from livekit.plugins import openai, silero, elevenlabs, tavus
from prompts import TECHNICAL_INTERVIEW_PROMPT, STRICTNESS_INSTRUCTIONS, CLOSING_ASSESSMENT_PROMPT
import json
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



class MonicaAssistant(Agent):
    """The AI Identity of the Interviewer."""
    def __init__(self, state: MonicaSessionState, dynamic_instructions: str, room=None):
        super().__init__(instructions=dynamic_instructions)
        self.state = state
        self._room = room

    @function_tool
    async def send_question(self, context: RunContext, question_text: str):
        """Sends a written question to the candidate's screen so they can read it while working on their solution. Use this for technical questions, coding problems, or any question that benefits from being written down.
        
        Args:
            question_text: The full question text to display on the candidate's screen
        """
        if self._room:
            try:
                data = json.dumps({"type": "question", "content": question_text}).encode("utf-8")
                await self._room.local_participant.publish_data(data, reliable=True)
                logger.info(f"Monica sent question to candidate screen: {question_text[:80]}...")
                return f"Question displayed on candidate's screen. Wait for them to work on it and discuss their approach."
            except Exception as e:
                logger.error(f"Failed to send question via data channel: {e}")
                return "Could not display question on screen, but I'll read it aloud instead."
        return "Data channel not available. Read the question aloud."

    @function_tool
    async def finish_interview(self, context: RunContext, 
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
        avg_score = (score_technical + score_problem_solving + score_communication + score_code_quality + score_optimization) / 5.0
        
        feedback = {
            "metrics": {
                "technical": score_technical,
                "problem_solving": score_problem_solving,
                "communication": score_communication,
                "code_quality": score_code_quality,
                "optimization": score_optimization,
            },
            "strengths": strengths,
            "improvements": improvements,
            "verdict": verdict
        }
        
        if self._room:
            try:
                database.update_session_score(self._room.name, avg_score, json.dumps(feedback))
                logger.info(f"Saved DB Assessment — Avg Score: {avg_score}/10, Verdict: {verdict}")
            except Exception as e:
                logger.error(f"Failed to save assessment to DB: {e}")
                
        return f"Assessment recorded. Average Score: {avg_score:.1f}/10. Verdict: {verdict}."

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
        from livekit.plugins import elevenlabs
        import os
        eleven_key = os.getenv("ELEVEN_API_KEY")
        if eleven_key:
            logger.info("Using ElevenLabs TTS for high-quality, human-like voice")
            return elevenlabs.TTS(
                api_key=eleven_key,
                voice=elevenlabs.Voice(
                    id="21m00Tcm4TlvDq8ikWAM", # Rachel - professional female voice
                    name="Rachel",
                    category="premade"
                ),
                model="eleven_turbo_v2_5" # Turbo model prevents LLM streaming audio breakups
            )
    except ImportError:
        logger.warning("livekit-plugins-elevenlabs not installed. Add it via pip.")
    except Exception as e:
        logger.warning(f"Voice engine 'ElevenLabs' reported error: {e}. Falling back to OpenAI.")
    
    logger.info("Falling back to OpenAI TTS")
    return openai.TTS(voice="nova")

# --- Worker Dispatcher ---

async def entrypoint(ctx: JobContext):
    """The master controller for a single interview session."""
    logger.info(f"High-Stakes Session Started: {ctx.room.name}")
    state = MonicaSessionState(ctx)
    
    try:
        await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
        
        # 1. Setup Audio Engine (Video moved below)
        state.add_task(asyncio.create_task(_fallback_watchdog(state)))

        
        vad = silero.VAD.load(
            min_speech_duration=0.1,  # Faster trigger
            min_silence_duration=0.6, # Slightly longer silence to prevent cutting off early
            prefix_padding_duration=0.1 # Less audio latency
        )
        session = AgentSession(
            stt=openai.STT(),
            llm=openai.LLM(model="gpt-4o"), # Enhanced capability for Multimodal Vision and human-like reasoning
            tts=create_voice_engine(),
            vad=vad,
        )

        # Wait for candidate to join and read their intent from metadata
        participant = await ctx.wait_for_participant()
        
        # Parse metadata (Expected keys: role, company, mode, strictness, resumePromptContext)
        try:
            if participant.metadata:
                metadata = json.loads(participant.metadata)
                user_role = metadata.get("role", "Candidate")
                company = metadata.get("company", "the company")
                mode = metadata.get("mode", "general")
                strictness = int(metadata.get("strictness", 3))
                resume_context = metadata.get("resumePromptContext", "")
            else:
                raise ValueError("Empty metadata")
        except (json.JSONDecodeError, ValueError):
            user_role = participant.metadata or "Candidate"
            company = "the company"
            mode = "general"
            strictness = 3
            resume_context = ""

        from prompts import (BEHAVIORAL_INTERVIEW_PROMPT, TECHNICAL_INTERVIEW_PROMPT, 
                             SYSTEM_DESIGN_PROMPT, RESUME_DEEP_DIVE_PROMPT)
                             
        # Select base instruction based on mode
        mode = metadata.get("mode", "behavioral")
        
        mode_prompts = {
            "behavioral": BEHAVIORAL_INTERVIEW_PROMPT,
            "technical": TECHNICAL_INTERVIEW_PROMPT,
            "system_design": SYSTEM_DESIGN_PROMPT,
            "resume_deep_dive": RESUME_DEEP_DIVE_PROMPT
        }
        
        base_instruction = mode_prompts.get(mode, BEHAVIORAL_INTERVIEW_PROMPT)
        
        # Inject context into instructions
        final_instructions = base_instruction.replace("{role}", user_role).replace("{company}", company)
        
        # Inject strictness level
        strictness_level = max(1, min(5, strictness))  # clamp 1-5
        final_instructions += STRICTNESS_INSTRUCTIONS.get(strictness_level, STRICTNESS_INSTRUCTIONS[3])
        
        # Inject closing assessment instructions
        final_instructions += CLOSING_ASSESSMENT_PROMPT
        
        if "google" in company.lower():
            final_instructions += "\n\n**IMPORTANT:** This is for GOOGLE. Be extremely rigorous. Focus on scale and algorithmic efficiency."
            
        # Inject Resume Context if the candidate uploaded one
        if resume_context:
            final_instructions += f"\n\n**CANDIDATE RESUME CONTEXT:**\n{resume_context}\n\n*Note to Interviwer: Do not just read the resume back to them. Treat it as contextual background knowledge. You may choose to bring it up naturally if a question relates to their prior experience, or just keep it in mind as you assess their answers.*"
            
        # Initialize Monica Assistant now that context is built
        assistant = MonicaAssistant(state, final_instructions, room=ctx.room)

        # 3. Mount Tavus 3D Avatar
        # This takes the AgentSession's TTS stream and uses it to render the 
        # visual Avatar directly back into the LiveKit Room as a VideoTrack.
        tavus_api_key = os.getenv("TAVUS_API_KEY")
        replica_id = os.getenv("TAVUS_REPLICA_ID")
        persona_id = os.getenv("TAVUS_PERSONA_ID")
        
        if tavus_api_key and replica_id and persona_id:
            logger.info(f"Mounting Tavus Avatar (Replica '{replica_id}') to AgentSession...")
            avatar = tavus.AvatarSession(
                api_key=tavus_api_key,
                replica_id=replica_id,
                persona_id=persona_id,
                avatar_participant_name="Monica (Interviewer)",
            )
            # Start the Session in the background so it doesn't block Monica from listening/speaking
            async def start_tavus():
                try:
                    await avatar.start(agent_session=session, room=ctx.room)
                    logger.info("Tavus Avatar session connected and streaming.")
                except Exception as e:
                    logger.error(f"Failed to start Tavus avatar: {e}")
            
            asyncio.create_task(start_tavus())
        else:
            logger.warning("Missing Tavus configuration in .env. Running in Voice-Only mode.")

        # 4. Start Core Session
        await session.start(
            agent=assistant,
            room=ctx.room,
            room_options=room_io.RoomOptions(audio_input=True, video_input=True),
        )

        import time
        import openai as openai_client
        oai_client = openai_client.AsyncOpenAI()
        last_speech_time = time.time()

        async def silence_watchdog():
            nonlocal last_speech_time
            while ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
                await asyncio.sleep(5)
                # If 30 seconds pass without user input
                if time.time() - last_speech_time > 30.0:
                    logger.info("Silence watchdog triggered: 30s elapsed without user speech.")
                    # Inject a system prompt to the LLM to nudge the user naturally
                    asyncio.create_task(
                        session.generate_reply(
                            user_msg="[SYSTEM: The candidate has been silent for 30 seconds. In 1 short sentence, gently ask if they are still there, if they need more time, or if they need a hint.]"
                        )
                    )
                    # Reset timer to 60 extra seconds to avoid spamming them
                    last_speech_time = time.time() + 60.0

        async def live_grading_engine():
            while ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
                await asyncio.sleep(60)
                transcript = database.get_transcript_text(ctx.room.name)
                if not transcript or len(transcript) < 100:
                    continue
                try:
                    response = await oai_client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[
                            {"role": "system", "content": "You are a live interview rater. Based on the transcript so far, rate the candidate's performance out of 100. Return ONLY the integer score."},
                            {"role": "user", "content": transcript}
                        ]
                    )
                    score = int(response.choices[0].message.content.strip())
                    payload = json.dumps({"type": "live_grade", "score": score})
                    await ctx.room.local_participant.publish_data(payload.encode("utf-8"), reliable=True)
                    logger.info(f"Live grade dispatched via data channel: {score}/100")
                except Exception as e:
                    logger.warning(f"Live grading failed: {e}")

        ctx.room.on("disconnected", lambda: logger.info("Room disconnected, watchdog will terminate"))
        asyncio.create_task(silence_watchdog())
        asyncio.create_task(live_grading_engine())

        # Force terminate after 30 minutes to protect API costs (OpenAI + Tavus + LiveKit)
        async def enforce_duration_limit():
            await asyncio.sleep(30 * 60)
            if ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
                logger.warning(f"Session {ctx.room.name} hit 30-minute cost limit. Terminating.")
                try:
                    await session.say("I'm sorry, but we've reached the maximum duration for this practice session. Thank you for your time, I'll be sharing your feedback report shortly.")
                    await asyncio.sleep(10) # wait for her to finish speaking
                except:
                    pass
                await ctx.room.disconnect()
                
        asyncio.create_task(enforce_duration_limit())

        # Hook into Speech Events to log transcripts to the SQLite Database
        @assistant.on("user_speech_committed")
        def on_user_speech(msg):
            nonlocal last_speech_time
            last_speech_time = time.time()
            try:
                # Dispatch typing indicator while LLM processes the user's speech
                try:
                    payload = json.dumps({"type": "typing", "status": "start"})
                    asyncio.create_task(ctx.room.local_participant.publish_data(payload.encode("utf-8"), reliable=True))
                except Exception as e:
                    pass
                
                text = msg.content if hasattr(msg, 'content') else str(msg)
                if text:
                    database.append_to_transcript(ctx.room.name, "Candidate", text)
            except Exception as e:
                logger.error(f"Failed to log user transcript: {e}")

        @assistant.on("agent_speech_committed")
        def on_agent_speech(msg):
            try:
                text = msg.content if hasattr(msg, 'content') else str(msg)
                if text:
                    database.append_to_transcript(ctx.room.name, "Monica", text)
            except Exception as e:
                logger.error(f"Failed to log agent transcript: {e}")

        # 4. Data channel handler for receiving code submissions and emotion data
        @ctx.room.on("data_received")
        def on_data_received(data_packet: rtc.DataPacket):
            try:
                text = data_packet.data.decode("utf-8")
                payload = json.loads(text)
                p_type = payload.get("type")
                
                if p_type == "code_submission" and mode == "technical":
                    code = payload.get("content", "")
                    q = payload.get("question", "")
                    logger.info(f"Received code submission ({len(code)} chars)")
                    
                    try:
                        database.append_code_submission(ctx.room.name, q, code)
                    except Exception as e:
                        logger.error(f"Failed to log code submission: {e}")

                    asyncio.create_task(
                        session.generate_reply(
                            user_msg=f"[SUBMISSION]\nQ: {q}\n\nAnswer:\n```\n{code}\n```\n\nEvaluate briefly: correctness, edge cases, improvements. Then ask a follow-up."
                        )
                    )
                
                elif p_type == "emotion":
                    summary = payload.get("summary", "")
                    logger.info(f"Received emotion summary: {summary}")
                    try:
                        # Append the emotion data as a silent system log into the transcript for final grading
                        database.append_to_transcript(ctx.room.name, "System", f"[Emotion Tracking Update] The candidate has predominantly shown the following facial expressions over the last 15 seconds: {summary}")
                    except Exception as e:
                        logger.error(f"Failed to log emotion data: {e}")
                        
            except Exception as e:
                logger.error(f"Error processing data: {e}")

        # Proactive Greeting based on the role and mode
        if mode == "technical":
            greeting = f"Hello, I'm Monica. I'll be conducting your technical evaluation for the '{user_role}' position at {company}. I'll present questions on your screen — you can type your solution in the editor below while explaining your thought process to me. Let me know when you're ready and I'll send the first question."
        else:
            greeting = f"Hello, I'm Monica. I see you're here to discuss the '{user_role}' position at {company}. I've reviewed your resume. Tell me why you are the exceptional choice for this specific environment."
            
        await session.say(greeting, allow_interruptions=True)
        
        while ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
            await asyncio.sleep(1)
            
    except Exception as e:
        logger.error(f"Monica encountered a session error: {e}", exc_info=True)
    finally:
        await state.cleanup()

if __name__ == "__main__":
    from livekit.agents import WorkerOptions
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))