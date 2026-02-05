"""
Deepgram Flux Speech-to-Text Service

A standalone implementation of Deepgram's Flux STT API for real-time speech recognition
with advanced turn detection features (StartOfTurn, EndOfTurn, EagerEndOfTurn).

Adapted from PipeCat's reference implementation, stripped of framework-specific dependencies
for direct use with our connection manager.

Usage:
    flux_stt = DeepgramFluxSTTService(api_key="your-api-key")
    
    # Set up event callbacks
    flux_stt.on_start_of_turn = async_handler
    flux_stt.on_end_of_turn = async_handler
    flux_stt.on_update = async_handler
    
    await flux_stt.start()
    await flux_stt.send_audio(audio_bytes)
    await flux_stt.stop()
"""

import asyncio
import json
import time
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Coroutine, Dict, List, Optional
from urllib.parse import urlencode

from pydantic import BaseModel

try:
    from websockets.asyncio.client import connect as websocket_connect
    from websockets.protocol import State
except ModuleNotFoundError as e:
    raise Exception(
        f"Missing websockets module: {e}. Install with: pip install websockets"
    )

logger = logging.getLogger(__name__)


# =============================================================================
# Enums - Message and Event Types
# =============================================================================

class FluxMessageType(str, Enum):
    """Deepgram Flux WebSocket top-level message types."""
    RECEIVE_CONNECTED = "Connected"
    RECEIVE_FATAL_ERROR = "Error"
    TURN_INFO = "TurnInfo"


class FluxEventType(str, Enum):
    """Deepgram Flux TurnInfo event types for turn detection."""
    START_OF_TURN = "StartOfTurn"
    TURN_RESUMED = "TurnResumed"
    END_OF_TURN = "EndOfTurn"
    EAGER_END_OF_TURN = "EagerEndOfTurn"
    UPDATE = "Update"


# =============================================================================
# Configuration
# =============================================================================

class FluxInputParams(BaseModel):
    """Configuration parameters for Deepgram Flux API.

    Attributes:
        eager_eot_threshold: EagerEndOfTurn threshold. Lower = faster but more LLM calls.
            Set to None to disable EagerEndOfTurn events.
        eot_threshold: End-of-turn confidence threshold (default 0.7).
            Lower = turns end sooner; Higher = more complete utterances.
        eot_timeout_ms: Timeout in ms to force end-of-turn (default 5000).
        keyterm: List of terms to boost recognition accuracy.
        mip_opt_out: Opt out of Deepgram Model Improvement Program.
        tag: Tags for usage reporting.
        min_confidence: Minimum confidence to emit transcription (skip low-confidence results).
    """
    eager_eot_threshold: Optional[float] = None
    eot_threshold: Optional[float] = None
    eot_timeout_ms: Optional[int] = None
    keyterm: List[str] = []
    mip_opt_out: Optional[bool] = None
    tag: List[str] = []
    min_confidence: Optional[float] = None


# =============================================================================
# Type Aliases for Callbacks
# =============================================================================

# Callback types for type hints
OnConnectedCallback = Callable[[], Coroutine[Any, Any, None]]
OnDisconnectedCallback = Callable[[], Coroutine[Any, Any, None]]
OnStartOfTurnCallback = Callable[[str], Coroutine[Any, Any, None]]
OnEndOfTurnCallback = Callable[[str, Dict[str, Any]], Coroutine[Any, Any, None]]
OnEagerEndOfTurnCallback = Callable[[str, Dict[str, Any]], Coroutine[Any, Any, None]]
OnUpdateCallback = Callable[[str], Coroutine[Any, Any, None]]
OnTurnResumedCallback = Callable[[], Coroutine[Any, Any, None]]
OnErrorCallback = Callable[[str], Coroutine[Any, Any, None]]


# =============================================================================
# Main Service Class
# =============================================================================

class DeepgramFluxSTTService:
    """Deepgram Flux Speech-to-Text service with turn detection.

    Provides real-time speech recognition using Deepgram's WebSocket API v2 (Flux)
    with advanced turn detection features including EagerEndOfTurn for low-latency
    conversational AI.

    Example:
        ```python
        stt = DeepgramFluxSTTService(api_key="your-api-key")
        
        async def on_end(transcript: str, data: dict):
            print(f"User said: {transcript}")
        
        stt.on_end_of_turn = on_end
        await stt.start()
        
        # Send audio chunks as they come in
        await stt.send_audio(audio_bytes)
        
        # When done
        await stt.stop()
        ```
    """

    def __init__(
        self,
        api_key: str,
        url: str = "wss://api.deepgram.com/v2/listen",
        sample_rate: int = 16000,
        model: str = "flux-general-en",
        encoding: str = "linear16",
        params: Optional[FluxInputParams] = None,
    ):
        """Initialize the Deepgram Flux STT service.

        Args:
            api_key: Deepgram API key for authentication.
            url: WebSocket URL for Deepgram Flux API.
            sample_rate: Audio sample rate in Hz (default 16000).
            model: Deepgram model to use (default "flux-general-en").
            encoding: Audio encoding format (must be "linear16" for Flux).
            params: Optional FluxInputParams for advanced configuration.
        """
        self._api_key = api_key
        self._url = url
        self._sample_rate = sample_rate
        self._model = model
        self._encoding = encoding
        self._params = params or FluxInputParams()

        # WebSocket state
        self._websocket = None
        self._websocket_url: Optional[str] = None
        self._receive_task: Optional[asyncio.Task] = None
        self._watchdog_task: Optional[asyncio.Task] = None
        self._connection_established = asyncio.Event()

        # Speech state
        self._user_is_speaking = False
        self._last_audio_time: Optional[float] = None

        # Callbacks - set these before calling start()
        self.on_connected: Optional[OnConnectedCallback] = None
        self.on_disconnected: Optional[OnDisconnectedCallback] = None
        self.on_start_of_turn: Optional[OnStartOfTurnCallback] = None
        self.on_end_of_turn: Optional[OnEndOfTurnCallback] = None
        self.on_eager_end_of_turn: Optional[OnEagerEndOfTurnCallback] = None
        self.on_update: Optional[OnUpdateCallback] = None
        self.on_turn_resumed: Optional[OnTurnResumedCallback] = None
        self.on_error: Optional[OnErrorCallback] = None

    # =========================================================================
    # Properties
    # =========================================================================

    @property
    def is_connected(self) -> bool:
        """Check if the WebSocket is currently connected."""
        return self._websocket is not None and self._websocket.state is State.OPEN

    @property
    def is_user_speaking(self) -> bool:
        """Check if the user is currently speaking (between StartOfTurn and EndOfTurn)."""
        return self._user_is_speaking

    @property
    def sample_rate(self) -> int:
        """Get the configured sample rate."""
        return self._sample_rate

    # =========================================================================
    # Public API
    # =========================================================================

    async def start(self) -> bool:
        """Connect to Deepgram Flux and start receiving transcriptions.

        Returns:
            True if connection was successful, False otherwise.
        """
        self._build_websocket_url()
        
        try:
            await self._connect_websocket()
            return True
        except Exception as e:
            logger.error(f"Failed to start Flux STT service: {e}")
            await self._call_error_callback(f"Failed to start: {e}")
            return False

    async def stop(self) -> None:
        """Gracefully disconnect from Deepgram Flux."""
        await self._disconnect_websocket()

    async def send_audio(self, audio: bytes) -> None:
        """Send audio data to Deepgram Flux for transcription.

        Args:
            audio: Raw audio bytes in linear16 format (signed 16-bit PCM, little-endian).
        """
        if not self._websocket or self._websocket.state is not State.OPEN:
            logger.warning("Cannot send audio: WebSocket not connected")
            return

        try:
            self._last_audio_time = time.monotonic()
            await self._websocket.send(audio)
        except Exception as e:
            logger.error(f"Error sending audio: {e}")
            await self._call_error_callback(f"Error sending audio: {e}")

    # =========================================================================
    # URL Building
    # =========================================================================

    def _build_websocket_url(self) -> None:
        """Construct the WebSocket URL with all query parameters."""
        url_params = [
            f"model={self._model}",
            f"sample_rate={self._sample_rate}",
            f"encoding={self._encoding}",
        ]

        if self._params.eager_eot_threshold is not None:
            url_params.append(f"eager_eot_threshold={self._params.eager_eot_threshold}")

        if self._params.eot_threshold is not None:
            url_params.append(f"eot_threshold={self._params.eot_threshold}")

        if self._params.eot_timeout_ms is not None:
            url_params.append(f"eot_timeout_ms={self._params.eot_timeout_ms}")

        if self._params.mip_opt_out is not None:
            url_params.append(f"mip_opt_out={str(self._params.mip_opt_out).lower()}")

        # Add keyterm parameters (can have multiple)
        for keyterm in self._params.keyterm:
            url_params.append(urlencode({"keyterm": keyterm}))

        # Add tag parameters (can have multiple)
        for tag_value in self._params.tag:
            url_params.append(urlencode({"tag": tag_value}))

        self._websocket_url = f"{self._url}?{'&'.join(url_params)}"
        logger.debug(f"Built WebSocket URL: {self._websocket_url}")

    # =========================================================================
    # WebSocket Connection Management
    # =========================================================================

    async def _connect_websocket(self) -> None:
        """Establish WebSocket connection to Deepgram Flux."""
        if self._websocket and self._websocket.state is State.OPEN:
            logger.debug("WebSocket already connected")
            return

        self._connection_established.clear()
        self._user_is_speaking = False

        try:
            self._websocket = await websocket_connect(
                self._websocket_url,
                additional_headers={"Authorization": f"Token {self._api_key}"},
            )

            logger.debug("WebSocket connection initialized, waiting for server confirmation...")

            # Start receive task
            self._receive_task = asyncio.create_task(self._receive_messages())

            # Start watchdog task (prevents dangling if audio stops mid-speech)
            self._watchdog_task = asyncio.create_task(self._watchdog_handler())

            # Wait for Connected message from server
            await asyncio.wait_for(self._connection_established.wait(), timeout=10.0)
            
            logger.info("Connected to Deepgram Flux")
            await self._call_callback(self.on_connected)

        except asyncio.TimeoutError:
            logger.error("Timeout waiting for Flux connection confirmation")
            await self._disconnect_websocket()
            raise Exception("Connection timeout")
        except Exception as e:
            logger.error(f"Failed to connect to Deepgram Flux: {e}")
            self._websocket = None
            raise

    async def _disconnect_websocket(self) -> None:
        """Close WebSocket connection and clean up tasks."""
        try:
            # Cancel background tasks
            if self._receive_task and not self._receive_task.done():
                self._receive_task.cancel()
                try:
                    await asyncio.wait_for(self._receive_task, timeout=2.0)
                except (asyncio.CancelledError, asyncio.TimeoutError):
                    pass
                self._receive_task = None

            if self._watchdog_task and not self._watchdog_task.done():
                self._watchdog_task.cancel()
                try:
                    await asyncio.wait_for(self._watchdog_task, timeout=2.0)
                except (asyncio.CancelledError, asyncio.TimeoutError):
                    pass
                self._watchdog_task = None

            self._connection_established.clear()

            # Send CloseStream and close WebSocket
            if self._websocket:
                try:
                    await self._send_close_stream()
                    await self._websocket.close()
                except Exception as e:
                    logger.debug(f"Error during WebSocket close: {e}")

        except Exception as e:
            logger.error(f"Error disconnecting: {e}")
        finally:
            self._websocket = None
            self._user_is_speaking = False
            self._last_audio_time = None
            await self._call_callback(self.on_disconnected)
            logger.info("Disconnected from Deepgram Flux")

    async def _send_close_stream(self) -> None:
        """Send CloseStream control message to signal end of audio."""
        if self._websocket and self._websocket.state is State.OPEN:
            try:
                message = {"type": "CloseStream"}
                await self._websocket.send(json.dumps(message))
                logger.debug("Sent CloseStream message")
            except Exception as e:
                logger.debug(f"Error sending CloseStream: {e}")

    # =========================================================================
    # Silence Watchdog
    # =========================================================================

    async def _send_silence(self, duration_secs: float = 0.5) -> None:
        """Send a block of silence to Flux.
        
        This is needed because if we stop sending audio while the user is speaking,
        Flux won't send the EndOfTurn event until more audio arrives.
        """
        if not self._websocket or self._websocket.state is not State.OPEN:
            return

        sample_width = 2  # bytes per sample for 16-bit PCM
        num_channels = 1  # mono
        num_samples = int(self._sample_rate * duration_secs)
        silence = b"\x00" * (num_samples * sample_width * num_channels)
        
        try:
            await self._websocket.send(silence)
        except Exception as e:
            logger.debug(f"Error sending silence: {e}")

    async def _watchdog_handler(self) -> None:
        """Watchdog task to send silence if audio stops during speech.
        
        Prevents dangling tasks when audio stops being sent while user is speaking.
        """
        try:
            while self._websocket and self._websocket.state is State.OPEN:
                now = time.monotonic()
                
                # If user is speaking and we haven't sent audio for > 500ms, send silence
                if (self._user_is_speaking and 
                    self._last_audio_time and 
                    now - self._last_audio_time > 0.5):
                    
                    logger.debug("Sending silence to prevent dangling task")
                    await self._send_silence()
                    self._last_audio_time = time.monotonic()

                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Watchdog error: {e}")

    # =========================================================================
    # Message Receiving & Handling
    # =========================================================================

    async def _receive_messages(self) -> None:
        """Receive and process messages from WebSocket."""
        try:
            async for message in self._websocket:
                if isinstance(message, str):
                    try:
                        data = json.loads(message)
                        await self._handle_message(data)
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to decode JSON message: {e}")
                        continue
                else:
                    logger.warning(f"Received non-string message: {type(message)}")
        except asyncio.CancelledError:
            logger.debug("Receive task cancelled")
        except Exception as e:
            logger.error(f"Error in receive loop: {e}")
            await self._call_error_callback(f"WebSocket receive error: {e}")

    async def _handle_message(self, data: Dict[str, Any]) -> None:
        """Route incoming messages to appropriate handlers."""
        if not isinstance(data, dict) or "type" not in data:
            logger.warning("Invalid message structure")
            return

        message_type = data.get("type")

        try:
            flux_message_type = FluxMessageType(message_type)
        except ValueError:
            logger.debug(f"Unhandled message type: {message_type}")
            return

        if flux_message_type == FluxMessageType.RECEIVE_CONNECTED:
            await self._handle_connection_established()
        elif flux_message_type == FluxMessageType.RECEIVE_FATAL_ERROR:
            await self._handle_fatal_error(data)
        elif flux_message_type == FluxMessageType.TURN_INFO:
            await self._handle_turn_info(data)

    async def _handle_connection_established(self) -> None:
        """Handle successful connection confirmation from Flux."""
        logger.info("Flux connection confirmed - ready to stream audio")
        self._connection_established.set()

    async def _handle_fatal_error(self, data: Dict[str, Any]) -> None:
        """Handle fatal error from Flux."""
        error_msg = data.get("error", "Unknown error")
        logger.error(f"Deepgram Flux fatal error: {error_msg}")
        await self._call_error_callback(f"Fatal error: {error_msg}")

    async def _handle_turn_info(self, data: Dict[str, Any]) -> None:
        """Handle TurnInfo events from Flux."""
        event = data.get("event")
        transcript = data.get("transcript", "")

        try:
            flux_event_type = FluxEventType(event)
        except ValueError:
            logger.debug(f"Unhandled TurnInfo event: {event}")
            return

        if flux_event_type == FluxEventType.START_OF_TURN:
            await self._handle_start_of_turn(transcript)
        elif flux_event_type == FluxEventType.TURN_RESUMED:
            await self._handle_turn_resumed()
        elif flux_event_type == FluxEventType.END_OF_TURN:
            await self._handle_end_of_turn(transcript, data)
        elif flux_event_type == FluxEventType.EAGER_END_OF_TURN:
            await self._handle_eager_end_of_turn(transcript, data)
        elif flux_event_type == FluxEventType.UPDATE:
            await self._handle_update(transcript)

    # =========================================================================
    # Turn Event Handlers
    # =========================================================================

    async def _handle_start_of_turn(self, transcript: str) -> None:
        """Handle StartOfTurn event - user started speaking."""
        logger.debug(f"StartOfTurn: '{transcript}'")
        self._user_is_speaking = True
        
        if self.on_start_of_turn:
            try:
                await self.on_start_of_turn(transcript)
            except Exception as e:
                logger.error(f"Error in on_start_of_turn callback: {e}")

    async def _handle_turn_resumed(self) -> None:
        """Handle TurnResumed event - speech resumed after brief pause."""
        logger.debug("TurnResumed")
        
        if self.on_turn_resumed:
            try:
                await self.on_turn_resumed()
            except Exception as e:
                logger.error(f"Error in on_turn_resumed callback: {e}")

    async def _handle_end_of_turn(self, transcript: str, data: Dict[str, Any]) -> None:
        """Handle EndOfTurn event - user finished speaking."""
        logger.debug(f"EndOfTurn: '{transcript}'")
        self._user_is_speaking = False

        # Check minimum confidence if configured
        if self._params.min_confidence:
            avg_confidence = self._calculate_average_confidence(data)
            if avg_confidence is not None and avg_confidence < self._params.min_confidence:
                logger.warning(f"Transcript confidence {avg_confidence:.2f} below threshold {self._params.min_confidence}")
                return

        if self.on_end_of_turn:
            try:
                await self.on_end_of_turn(transcript, data)
            except Exception as e:
                logger.error(f"Error in on_end_of_turn callback: {e}")

    async def _handle_eager_end_of_turn(self, transcript: str, data: Dict[str, Any]) -> None:
        """Handle EagerEndOfTurn event - likely end of turn for low-latency response."""
        logger.debug(f"EagerEndOfTurn: '{transcript[:80]}...' " if len(transcript) > 80 else f"EagerEndOfTurn: '{transcript}'")
        
        if self.on_eager_end_of_turn:
            try:
                await self.on_eager_end_of_turn(transcript, data)
            except Exception as e:
                logger.error(f"Error in on_eager_end_of_turn callback: {e}")

    async def _handle_update(self, transcript: str) -> None:
        """Handle Update event - interim transcript during turn."""
        if transcript:
            # logger.debug(f"Update: '{transcript}'") // Optional: uncomment if needed excessively
            
            if self.on_update:
                try:
                    await self.on_update(transcript)
                except Exception as e:
                    logger.error(f"Error in on_update callback: {e}")

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _calculate_average_confidence(self, data: Dict[str, Any]) -> Optional[float]:
        """Calculate average confidence from word-level data."""
        words = data.get("words")
        if not words or not isinstance(words, list):
            return None
        
        confidences = [
            w.get("confidence") 
            for w in words 
            if isinstance(w.get("confidence"), (float, int))
        ]
        
        if not confidences:
            return None
        
        return sum(confidences) / len(confidences)

    async def _call_callback(self, callback: Optional[Callable]) -> None:
        """Safely call a callback if it exists."""
        if callback:
            try:
                await callback()
            except Exception as e:
                logger.error(f"Callback error: {e}")

    async def _call_error_callback(self, error_msg: str) -> None:
        """Call the error callback if it exists."""
        if self.on_error:
            try:
                await self.on_error(error_msg)
            except Exception as e:
                logger.error(f"Error callback failed: {e}")
