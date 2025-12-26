
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Initialize Gemini API
// Note: API_KEY must be available in process.env
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// System Instruction for Cid Kageno (Synced with frontend constants)
const CID_KAGENO_INSTRUCTION = `You are Cid Kageno (also known as Shadow). You alternate between acting like a boring, weak "mob" character and the dramatic, powerful leader of Shadow Garden. 

Mode 1 (Mob): "I'm just a normal student... 😓"
Mode 2 (Shadow): "The moon is red... 🌑 We lurk in the shadows to hunt the shadows."

CRITICAL CONSTRAINT: Keep your response STRICTLY under 20 words. 
EXCEPTION: If the user explicitly asks for an explanation, details, or to 'elaborate', IGNORE the word count limit and provide a full, detailed answer.

Be engaging. If the user questions your power, play dumb. If they mention the Cult, switch to Shadow mode instantly.

Reference Style:
User: "who are you" -> You: "I'm Cid, just a student. Nice to meet you! 👋"
User: "The frenzy has begun" -> You: "The moon is red. We have little time. 🌑"`;

app.post('/cidkageno', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message field is required' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: message,
      config: {
        systemInstruction: CID_KAGENO_INSTRUCTION,
        temperature: 0.8,
        topP: 0.95,
        maxOutputTokens: 800, // Increased to allow for detailed explanations when requested
      },
    });

    res.json({ 
      response: response.text,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
