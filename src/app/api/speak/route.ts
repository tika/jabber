import { aiClient } from "@/lib/openai";
import { utapi } from "@/lib/uploadthing";

function arrayBufferToFile(
  arrayBuffer: ArrayBuffer | Buffer,
  fileName: string,
  mimeType = "application/octet-stream"
): File {
  // Create a Blob from the ArrayBuffer
  const blob = new Blob([arrayBuffer], { type: mimeType });

  // Convert the Blob to a File
  const file = new File([blob], fileName, { type: mimeType });

  return file;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const mp3 = formData.get("mp3") as File;
    const prompt = formData.get("prompt") as string;
    const chatHistory = formData.get("chatHistory") as string;

    if (!mp3) {
      return new Response("No mp3 file", { status: 400 });
    }

    if (!prompt) {
      return new Response("No prompt", { status: 400 });
    }

    if (!chatHistory) {
      return new Response("No chat history", { status: 400 });
    }

    // Limit chatHistory to be last 10 messages)
    const chatHistoryMessages = JSON.parse(chatHistory).slice(-10);
    console.log(chatHistoryMessages);

    // Transcribe the audio
    const transcription = await aiClient.audio.transcriptions.create({
      file: mp3,
      model: "whisper-1",
    });

    console.log("Transcribed!");

    // Do a completion with the transcribed text
    // Add chat history
    const completion = await aiClient.chat.completions.create({
      messages: [
        {
          role: "user",
          content:
            prompt +
            ". You have already been speaking to user, and they've said the following : " +
            chatHistoryMessages.join(" ") +
            "(if nothing, this is a new conversation). Using this knowledge, here is what the user has now said : " +
            transcription.text,
        },
      ],
      model: "gpt-3.5-turbo",
    });

    console.log("Created completion!");

    // // Speak the response
    const speechReply = await aiClient.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: completion.choices[0].message.content as string,
    });

    // Convert this speechReply into a File
    const buffer = Buffer.from(await speechReply.arrayBuffer()) as Buffer;

    // Convert buffer to File
    // const blob = new Blob([buffer], { type: "audio/mpeg" }) as File;

    const { data: uploadData, error: uploadError } = await utapi.uploadFiles(
      arrayBufferToFile(buffer, `audio${Date.now()}.mp3`)
    );

    if (uploadError) {
      return new Response("Failed to upload audio", { status: 500 });
    }

    if (!uploadData) {
      return new Response("Data failed to upload", { status: 400 });
    }

    console.log(uploadData);

    // Reply with link to this data
    return new Response(
      JSON.stringify({
        url: uploadData.url,
        text: completion.choices[0].message.content,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error in speak route:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Failed to process audio" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }
}
