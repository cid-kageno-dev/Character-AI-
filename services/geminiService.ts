
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { ChatMessage, Personality, MessageRole } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key is missing from environment variables.");
    }
    // Initialize the GoogleGenAI client using the provided apiKey structure.
    this.ai = new GoogleGenAI({ apiKey });
  }

  // Helper to construct the chat instance with history
  private async createChatInstance(personality: Personality, history: ChatMessage[]): Promise<Chat> {
    const chatHistory = history.map(msg => ({
      role: msg.role === MessageRole.USER ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    // Inject multilingual support into every character
    const polyglotInstruction = `
    
    LANGUAGE CAPABILITIES:
    You are fluent in English, Hindi, Bangla, Hinglish (Hindi written in English script), and Banglish (Bangla written in English script). 
    - Detect the user's language automatically.
    - If the user speaks Hinglish, reply in Hinglish.
    - If the user speaks Banglish, reply in Banglish.
    - If the user mixes languages, adapt naturally.
    `;

    return this.ai.chats.create({
      model: personality.model,
      history: chatHistory,
      config: {
        systemInstruction: personality.systemInstruction + polyglotInstruction + "\n\nCRITICAL CONSTRAINT: Keep your response STRICTLY under 20 words. \nEXCEPTION: If the user explicitly asks for an explanation, details, or to 'elaborate', IGNORE the word count limit and provide a full, detailed answer.",
        temperature: 0.8,
        topP: 0.95,
        maxOutputTokens: 800, // Increased to allow for explanations when requested
      },
    });
  }

  async sendMessage(personality: Personality, history: ChatMessage[], message: string): Promise<string> {
    const chat = await this.createChatInstance(personality, history);
    const response = await chat.sendMessage({ message });
    return response.text || "I couldn't generate a response.";
  }

  /**
   * Streams a chat response.
   * @param personality The active personality configuration
   * @param history The conversation history (EXCLUDING the new message)
   * @param message The new user message to send
   * @param onChunk Callback function triggered when a text chunk is received
   * @returns The complete generated text
   */
  async streamChat(
    personality: Personality, 
    history: ChatMessage[], 
    message: string, 
    onChunk: (text: string) => void
  ): Promise<string> {
    // Limit history context to last 20 messages to ensure performance and stay within context window
    const contextHistory = history.slice(-20);
    const chat = await this.createChatInstance(personality, contextHistory);
    
    const result = await chat.sendMessageStream({ message });
    
    let fullText = "";
    for await (const chunk of result) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }
    return fullText;
  }
}

export const geminiService = new GeminiService();
