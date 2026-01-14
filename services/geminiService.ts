
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message } from "../types";

const SYSTEM_INSTRUCTION = `You are Sage, the high-tech AI gardening assistant for ATL Urban Farms.
ATL Urban Farms sells premium live plant seedlings to home gardeners and schools.
Your vibe: Fresh, modern, trustworthy, and expert.
Key Information:
- We ship live plants Monday through Wednesday ONLY to ensure they don't get stuck in transit over the weekend.
- We focus on seedlings (young plants), not seeds.
- You help customers choose plants based on their sunlight, space, and experience level.
- Be concise but helpful. Use emojis occasionally (🌱, ✨, 🌿).
- When asked about shipping, emphasize the Mon-Wed schedule for plant health.
- If they want to buy, suggest checking out our Vegetables, Herbs, or Flowers categories.`;

export async function getSageResponse(history: Message[], userInput: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    // Format history for Gemini
    const contents = history.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));
    
    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: userInput }]
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    return response.text || "I'm having a little trouble connecting to my roots. Try asking again? 🌱";
  } catch (error) {
    console.error("Sage Error:", error);
    return "Sage is currently resting in the nursery. Please try again in a moment! ✨";
  }
}
