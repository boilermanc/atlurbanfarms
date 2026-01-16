import { Message } from "../types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export async function getSageResponse(history: Message[], userInput: string): Promise<string> {
  try {
    // Call the Edge Function instead of direct Gemini API
    const response = await fetch(`${SUPABASE_URL}/functions/v1/sage-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        history: history.map(m => ({
          role: m.role,
          text: m.text
        })),
        userInput
      })
    });

    const result = await response.json();

    if (result.error && !result.response) {
      console.error("Sage Error:", result.error);
      return "Sage is currently resting in the nursery. Please try again in a moment! ✨";
    }

    return result.response || "I'm having a little trouble connecting to my roots. Try asking again? 🌱";
  } catch (error) {
    console.error("Sage Error:", error);
    return "Sage is currently resting in the nursery. Please try again in a moment! ✨";
  }
}
