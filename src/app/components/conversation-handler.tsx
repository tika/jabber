import { useMicVAD, utils } from "@ricky0123/vad-react";
import { LoaderPinwheel } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import MicAudioVisualizer from "./mic-audio-visualizer";

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
  generateAgentResponse: (file: File) => Promise<{
    transcript: string;
    url: string;
  }>;
}) {
  // =========== State Management ===========
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [agentResponseAudio, setAgentResponseAudio] = useState<{
    url: string;
    file: File;
    transcript: string;
  } | null>(null);
  const [inConversation, setInConversation] = useState(false);

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
      // Stop listening if we're processing
      vad.pause();
      const { url, transcript } = await generateAgentResponse(file);
      setIsProcessing(false);

      setProcessingTime(Date.now() - startTime);

      setAgentResponseAudio({ url, file, transcript });
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
      setAgentSpeaking(true);
      vad.pause();

      audioRef.current.play().catch(console.error);

      // After audio finishes playing, resume listening
      audioRef.current.addEventListener("ended", () => {
        setAgentSpeaking(false);
        vad.start();
      });
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
        {!isProcessing &&
          (!agentSpeaking && !vad.listening ? (
            <button
              onClick={() => {
                vad.start();
                setInConversation(true);
              }}
              className="px-4 py-2 rounded-md font-medium transition-colors outline-offset-2 bg-blue-500 hover:bg-blue-600 text-white"
            >
              Start Conversation
            </button>
          ) : (
            <button
              onClick={() => {
                vad.pause();
                setInConversation(false);
                setAgentResponseAudio(null);
                setAgentSpeaking(false);
              }}
              className="px-4 py-2 rounded-md font-medium transition-colors outline-offset-2 bg-red-500 hover:bg-red-600 text-white"
            >
              Stop Conversation
            </button>
          ))}

        {/* Audio Playback Section */}
        {agentResponseAudio && (
          <>
            <audio
              ref={audioRef}
              src={agentResponseAudio.url}
              className="w-full max-w-md hidden"
            />
            {agentSpeaking && (
              <p className="text-gray-600 font-bold">
                This took {Math.round(processingTime / 10) / 100}s to process
                (that&apos;s slow...)
              </p>
            )}
          </>
        )}
        {inConversation && (
          <div>
            {isProcessing && <LoaderPinwheel className="animate-spin" />}

            {agentSpeaking && agentResponseAudio && (
              <p className="w-full">{agentResponseAudio?.transcript}</p>
            )}

            {vad.listening && (
              <MicAudioVisualizer
                color="blue"
                mediaStream={mediaStream.current}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
