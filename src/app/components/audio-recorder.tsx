import useDebounce from "@/hooks/use-debounce";
import { useEffect, useRef, useState } from "react";

const THRESHOLD = -24; // Threshold in dB over which the user is speaking
const SILENCE_DURATION = 3000; // Duration of silence before sending (in ms)

export function Speak({
  generateResponse,
  onRecordingComplete,
}: {
  generateResponse: (file: File) => Promise<string>;
  onRecordingComplete?: () => void;
}) {
  const [microphoneOn, setMicrophoneOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0); // How long did the audio take to process
  const [hasSpokeOnce, setHasSpokeOnce] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  const [responseAudioURL, setResponseAudioURL] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Use debounce to detect sustained silence
  const [debouncedIsSpeaking] = useDebounce(isSpeaking, SILENCE_DURATION);

  useEffect(() => {
    if (responseAudioURL && audioRef.current) {
      audioRef.current.play().catch((error) => {
        console.error("Error playing audio:", error);
      });
    }
  }, [responseAudioURL]);

  const startRecording = async () => {
    setError(null);
    setResponseAudioURL(null);
    setHasSpokeOnce(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Initialize Web Audio API components
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      // Configure analyzer
      analyser.fftSize = 256;
      source.connect(analyser);

      // Store references
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;

      // Initialize MediaRecorder
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        await handleRecordingComplete();
      };

      // Start recording and monitoring
      recorder.start();
      monitorAudioLevels();
      setMicrophoneOn(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start recording"
      );
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      setMicrophoneOn(false);
    }
    cleanup();
  };

  const handleRecordingComplete = async () => {
    if (audioChunksRef.current.length === 0) return;

    setIsProcessing(true);
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
      const file = new File([audioBlob], "recording.wav", {
        type: "audio/wav",
      });

      await sendAudio();
      onRecordingComplete?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to process recording"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const monitorAudioLevels = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkLevels = () => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      const average =
        dataArray.reduce((acc, value) => acc + value, 0) / dataArray.length;

      // Convert to decibels
      const db = 20 * Math.log10(average / 255);

      // Update speaking state based on threshold
      const isAboveThreshold = db >= THRESHOLD;
      setIsSpeaking(isAboveThreshold);

      // Track if they've spoken at least once
      if (isAboveThreshold) {
        setHasSpokeOnce(true);
      }

      animationFrameIdRef.current = requestAnimationFrame(checkLevels);
    };

    animationFrameIdRef.current = requestAnimationFrame(checkLevels);
  };

  const cleanup = () => {
    // Cancel animation frame
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }

    // Close audio context
    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close();
    }

    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Clear references
    analyserRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
  };

  // Handle silence detection
  useEffect(() => {
    // Only stop recording if:
    // 1. They've spoken at least once
    // 2. They're not currently speaking (and haven't for SILENCE_DURATION ms)
    // 3. We're still recording
    // 4. We're not already processing
    console.log(
      "hasSpokeOnce:",
      hasSpokeOnce,
      "Is Speaking (Debounced):",
      debouncedIsSpeaking
    );
    if (hasSpokeOnce && !debouncedIsSpeaking && microphoneOn && !isProcessing) {
      console.log("Detected silence after speaking - stopping recording");
      stopRecording();
      // And send off audio
      console.log("Sending audio");
      sendAudio();
    }
  }, [debouncedIsSpeaking]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, []);

  // Send the audio to the AI to generate a response
  async function sendAudio() {
    const blob = audioChunksRef.current[0];

    const file = new File([blob], "audio.wav", {
      type: "audio/wav",
    });

    // Get the processing time
    const oldProcessingTime = Date.now();
    setIsProcessing(true);

    await generateResponse(file).then((res) => setResponseAudioURL(res));

    setIsProcessing(false);
    setProcessingTime(Date.now() - oldProcessingTime);
  }

  return (
    <div className="space-y-4">
      {error && <p>{error}</p>}

      <div className="flex flex-col items-center gap-4">
        <button
          onClick={microphoneOn ? stopRecording : startRecording}
          className={`px-4 py-2 rounded-md font-medium transition-colors
            ${
              microphoneOn
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            }`}
          disabled={isProcessing}
        >
          {isProcessing
            ? "Processing..."
            : microphoneOn
            ? "Stop Recording"
            : "Start Recording"}
        </button>

        {microphoneOn && !isSpeaking && (
          <div className="text-red-500 font-medium">
            Not speaking detected - recording will stop in
            {SILENCE_DURATION / 1000} seconds
          </div>
        )}

        {responseAudioURL && (
          <>
            <audio
              ref={audioRef}
              controls
              src={responseAudioURL ?? ""}
              className="w-full max-w-md"
            />
            <p>This took {processingTime}ms to process</p>
          </>
        )}
      </div>
    </div>
  );
}
