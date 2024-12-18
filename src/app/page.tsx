import { AudioRecorder } from "@/app/components/audio-recorder";

export default function Home() {
  return (
    <div className="px-32 py-16">
      <h1 className="text-3xl font-bold">Jabber</h1>
      <p className="font-medium py-4">
        Speak to your own AI. Simply press the button, and start a conversation.
      </p>
      <AudioRecorder />
    </div>
  );
}
