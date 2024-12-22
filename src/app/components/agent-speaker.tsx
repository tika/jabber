import { useEffect, useRef } from "react";

// Auto play agent response

export function AgentSpeaker({
  agentResponseAudio,
  onFinishSpeaking,
}: {
  agentResponseAudio: string | undefined;
  onFinishSpeaking: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // When audio available, play it
  useEffect(() => {
    if (agentResponseAudio && audioRef.current) {
      // When agent has finished speaking, call onFinishSpeaking
      audioRef.current.play().catch(console.error);

      audioRef.current.onended = () => {
        onFinishSpeaking();
      };
    }
  }, [agentResponseAudio]);

  return (
    <audio
      ref={audioRef}
      controls
      src={agentResponseAudio}
      className="hidden"
    />
  );
}
