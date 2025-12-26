
export enum MessageRole {
  USER = 'user',
  MODEL = 'model'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: number;
}

export interface Personality {
  id: string;
  name: string;
  description: string;
  systemInstruction: string;
  icon: string;
  avatarImage?: string; // New field for base64 image string
  color: string;
  model: 'gemini-3-flash-preview' | 'gemini-3-pro-preview';
  starters?: string[];
}

export interface AppState {
  activePersonalityId: string;
  chats: Record<string, ChatMessage[]>;
  personalities: Personality[];
}
