import { useMicVAD, utils } from "@ricky0123/vad-react";
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [agentResponseAudio, setAgentResponseAudio] = useState<string | null>(
    null
  );

  const mediaStream = useRef<MediaStream>();

  // initialise mediastream (microphone)
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        mediaStream.current = stream;
      })
      .catch((err) => {
        setError(err.message);
      });

    return () => {
      mediaStream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const vad = useMicVAD({
    startOnLoad: false,
    onSpeechEnd: async (audio) => {
      const wavBuffer = utils.encodeWAV(audio);

      const file = new File([wavBuffer], "audio.wav", {
        type: "audio/wav",
      });

      const startTime = Date.now();
      setIsProcessing(true);
      const response = await generateAgentResponse(file);
      setIsProcessing(false);

      setProcessingTime(Date.now() - startTime);

      setAgentResponseAudio(response);
    },
    minSpeechFrames: 10, // 10 frames = 200ms
    stream: mediaStream.current,
  });

  // =========== Refs ===========
  // Audio element reference for playing agent responses
  const audioRef = useRef<HTMLAudioElement>(null);

  // =========== Effects ===========
  // Auto-play agent response when available
  useEffect(() => {
    if (agentResponseAudio && audioRef.current) {
      audioRef.current.play().catch(console.error);
    }
  }, [agentResponseAudio]);

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
          onClick={vad.listening ? vad.pause : vad.start}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            vad.listening
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
          disabled={isProcessing}
        >
          {isProcessing
            ? "Processing..."
            : vad.listening
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
