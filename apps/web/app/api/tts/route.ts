import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const VOICES: Record<string, string> = {
  bn: "bn-BD-NabanitaNeural",
  en: "en-US-AriaNeural",
};

export async function POST(req: Request) {
  const { text, lang } = (await req.json()) as { text: string; lang: string };

  if (!text?.trim()) {
    return new Response("Missing text", { status: 400 });
  }

  const voiceName = VOICES[lang] ?? VOICES.en;

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  const { audioStream } = tts.toStream(text);

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    audioStream.on("end", resolve);
    audioStream.on("error", reject);
  });

  tts.close();

  const audio = Buffer.concat(chunks);
  return new Response(audio, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
