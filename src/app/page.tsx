"use client";

import { ConversationHandler } from "@/app/components/conversation-handler";
import { useEffect, useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState(
    "You are a helpful assistant that is speaking (in human language) to a customer. Please respond to what the customer has said: "
  );
  const [chatHistory, setChatHistory] = useState<string[]>([]);

  useEffect(() => {
    // Clear chat history when prompt changes
    setChatHistory([]);
  }, [prompt]);

  async function generateResponse(file: File): Promise<string> {
    const formData = new FormData();

    formData.append("mp3", file);
    formData.append("prompt", prompt);
    formData.append("chatHistory", JSON.stringify(chatHistory));

    const response = await fetch("/api/speak", {
      method: "POST",
      body: formData,
    }).then((response) => response.json());

    setChatHistory([...chatHistory, response.text]);

    return response.url;
  }

  return (
    <div className="px-32 py-16">
      <h1 className="text-6xl font-bold">Jabber</h1>
      <p className="font-medium mt-2">
        Speak to your own AI. Simply press the button, and start a conversation.
      </p>
      <div className="my-4">
        <label>Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="bg-gray-900 px-4 py-2 rounded-md w-full"
        ></textarea>
      </div>
      <p>Chat is {chatHistory.length} messages long</p>
      <ConversationHandler generateAgentResponse={generateResponse} />
    </div>
  );
}
