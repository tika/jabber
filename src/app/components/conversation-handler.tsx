import { useEffect, useRef, useState } from "react";

/**
 * ConversationHandler manages audio recording and processing for a conversation interface.
 * It handles microphone input, audio level monitoring, and communication with an agent.
 *
 * @component
 * @param {Object} props
 * @param {(file: File) => Promise<string>} props.generateAgentResponse - Function to process audio and get agent's response
 */
export function ConversationHandler({
  generateAgentResponse,
}: {
  generateAgentResponse: (file: File) => Promise<string>;
}) {
  // =========== State Management ===========
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [agentResponseAudio, setAgentResponseAudio] = useState<string | null>(
    null
  );

  // =========== Refs ===========
  // Audio element reference for playing agent responses
  const audioRef = useRef<HTMLAudioElement>(null);

  // Audio recording and processing references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Web Audio API references
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // =========== Effects ===========
  // Auto-play agent response when available
  useEffect(() => {
    if (agentResponseAudio && audioRef.current) {
      audioRef.current.play().catch(console.error);
    }
  }, [agentResponseAudio]);

  // Cleanup on component unmount
  useEffect(() => {
    return cleanup;
  }, []);

  // =========== Core Recording Functions ===========
  /**
   * Initializes audio recording by setting up microphone stream and audio processing nodes
   */
  const startRecording = async () => {
    setError(null);
    setAgentResponseAudio(null);

    try {
      // Set up audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Initialize Web Audio API components
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      source.connect(analyser);

      // Store audio processing references
      audioContextRef.current = audioContext;
      sourceRef.current = source;

      // Set up MediaRecorder
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      // Configure recorder events
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = handleRecordingComplete;

      // Start recording
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start recording"
      );
    }
  };

  /**
   * Stops the current recording session and cleans up audio resources
   */
  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }
    cleanup();
  };

  // =========== Audio Processing Functions ===========
  /**
   * Handles the recorded audio when recording is complete
   */
  const handleRecordingComplete = async () => {
    if (audioChunksRef.current.length === 0) return;

    setIsProcessing(true);
    try {
      await handleAudioSubmission();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to process recording"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Processes the recorded audio and sends it to the agent
   */
  const handleAudioSubmission = async () => {
    const blob = audioChunksRef.current[0];
    const file = new File([blob], "audio.wav", { type: "audio/wav" });

    const startTime = Date.now();
    setIsProcessing(true);

    const response = await generateAgentResponse(file);
    setAgentResponseAudio(response);

    setIsProcessing(false);
    setProcessingTime(Date.now() - startTime);
  };

  /**
   * Cleans up all audio resources and references
   */
  const cleanup = () => {
    // Close audio context if it's open
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close();
    }

    // Stop all audio tracks
    streamRef.current?.getTracks().forEach((track) => track.stop());

    // Clear all refs
    sourceRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
  };

  // =========== Render ===========
  return (
    <div className="space-y-4">
      {/* Error Display */}
      {error && (
        <p className="text-red-500 p-3 rounded-md bg-red-50 border border-red-200">
          {error}
        </p>
      )}

      <div className="flex flex-col items-center gap-4">
        {/* Recording Control Button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            isRecording
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
          disabled={isProcessing}
        >
          {isProcessing
            ? "Processing..."
            : isRecording
            ? "Stop Conversation"
            : "Start Conversation"}
        </button>

        {/* Audio Playback Section */}
        {agentResponseAudio && (
          <>
            <audio
              ref={audioRef}
              controls
              src={agentResponseAudio}
              className="w-full max-w-md"
            />
            <p className="text-gray-600">
              This took {processingTime}ms to process
            </p>
          </>
        )}
      </div>
    </div>
  );
}
