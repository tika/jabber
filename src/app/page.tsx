"use client";

import { Speak } from "@/app/components/audio-recorder";

export default function Home() {
  async function generateResponse(file: File): Promise<string> {
    const formData = new FormData();

    formData.append("mp3", file);

    const response = await fetch("/api/speak", {
      method: "POST",
      body: formData,
    }).then((response) => response.json());

    console.log(response.url);

    return response.url;
  }

  return (
    <div className="px-32 py-16">
      <h1 className="text-3xl font-bold">Jabber</h1>
      <p className="font-medium py-4">
        Speak to your own AI. Simply press the button, and start a conversation.
      </p>
      <Speak generateResponse={generateResponse} />
    </div>
  );
}
