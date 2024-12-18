// app/api/speak/route.ts

import { aiClient } from "@/lib/openai";
import { utapi } from "@/lib/uploadthing";

function arrayBufferToFile(
  arrayBuffer: ArrayBuffer,
  fileName: string,
  mimeType = "application/octet-stream"
) {
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

    if (!mp3) {
      return new Response("No mp3 file", { status: 400 });
    }

    // Transcribe the audio
    const transcription = await aiClient.audio.transcriptions.create({
      file: mp3,
      model: "whisper-1",
    });

    console.log("Transcribed!");

    // Do a completion with the transcribed text
    const completion = await aiClient.chat.completions.create({
      messages: [
        {
          role: "user",
          content:
            "You are a helpful assistant that is speaking (in human language) to a customer. Please respond to what the customer has said: " +
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
    const buffer = Buffer.from(await speechReply.arrayBuffer());

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
    return new Response(JSON.stringify({ url: uploadData.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
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
