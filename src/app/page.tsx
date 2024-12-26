"use client";

import { ConversationHandler } from "@/app/components/conversation-handler";
import { useEffect, useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [chatHistory, setChatHistory] = useState<string[]>([]);

  useEffect(() => {
    // Clear chat history when prompt changes
    setChatHistory([]);
  }, [prompt]);

  async function generateResponse(file: File): Promise<{
    url: string;
    transcript: string;
  }> {
    const formData = new FormData();

    formData.append("mp3", file);
    formData.append("prompt", prompt);
    formData.append("chatHistory", JSON.stringify(chatHistory));

    const response = await fetch("/api/speak", {
      method: "POST",
      body: formData,
    }).then((response) => response.json());

    setChatHistory([...chatHistory, response.text]);

    return {
      url: response.url,
      transcript: response.text,
    };
  }

  return (
    <div className="lg:px-64 md:px-32 px-16 py-16 flex flex-col items-center gap-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Jabber</h1>
        <p className="font-medium mt-2 text-lg text-gray-500">
          Have natural conversations with AI. Set your context below, press the
          button, and start talking. Built using OpenAI products.
        </p>
      </div>
      <div className="w-full">
        <div className="w-full">
          <label>Set your conversation context</label>
          <textarea
            value={prompt}
            placeholder="Example: You are a helpful assistant that speaks in a friendly, conversational tone..."
            onChange={(e) => setPrompt(e.target.value)}
            className="bg-gray-200 px-4 py-2 rounded-md w-full min-h-[100px] resize-none border-gray-200 outline-offset-2 outline-slate-300 mt-4"
          ></textarea>
        </div>
        <div className="text-gray-500 text-sm flex justify-between">
          <p>
            Only the last 10 messages will be remembered in the conversation
          </p>
        </div>
      </div>

      <ConversationHandler generateAgentResponse={generateResponse} />
    </div>
  );
}
