import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DEFAULT_PERSONALITIES } from './constants';
import { AppState, Personality, ChatMessage, MessageRole } from './types';
import { geminiService } from './services/geminiService';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import Button from './components/Button';
import ChatMessageList from './components/ChatMessageList';
import PersonalityCard from './components/PersonalityCard';
import CustomPersonalityModal from './components/CustomPersonalityModal';
import LiveVisualizer from './components/LiveVisualizer';

const STORAGE_KEY = 'custom_personas_v1';

// Helper functions for audio encoding/decoding as per SDK requirements
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const custom = saved ? JSON.parse(saved) : [];
    // Merge defaults and custom.
    return {
      activePersonalityId: DEFAULT_PERSONALITIES[0].id,
      chats: {},
      personalities: [...DEFAULT_PERSONALITIES, ...custom],
    };
  });

  const [inputText, setInputText] = useState('');
  const [isInteracting, setIsInteracting] = useState(false); // Locks input
  const [showTypingIndicator, setShowTypingIndicator] = useState(false); // Shows "..."
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPersonality, setEditingPersonality] = useState<Personality | null>(null);

  
  // Live Session State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  
  // Transcriptions for UI
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  useEffect(() => {
    const customOnly = state.personalities.filter(
      p => !DEFAULT_PERSONALITIES.find(dp => dp.id === p.id)
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
  }, [state.personalities]);

  const activePersonality = state.personalities.find(p => p.id === state.activePersonalityId) || state.personalities[0];
  const activeMessages = state.chats[state.activePersonalityId] || [];

  const handleSendMessage = async (eOrText?: React.FormEvent | string) => {
    let textToSend = inputText;
    if (typeof eOrText === 'string') {
      textToSend = eOrText;
    } else {
      eOrText?.preventDefault();
    }
    
    if (!textToSend.trim() || isInteracting) return;

    // 1. Setup User Message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      text: textToSend,
      timestamp: Date.now(),
    };

    // 2. Optimistic Update: Add User Message immediately
    setState(prev => ({
      ...prev,
      chats: {
        ...prev.chats,
        [prev.activePersonalityId]: [...(prev.chats[prev.activePersonalityId] || []), userMessage]
      }
    }));
    
    setInputText('');
    setIsInteracting(true);
    setShowTypingIndicator(true);

    try {
      let fullResponseText = '';
      const responseId = (Date.now() + 1).toString();
      let isFirstChunk = true;

      // 3. Stream Response
      await geminiService.streamChat(
        activePersonality,
        activeMessages, 
        userMessage.text,
        (chunk) => {
          fullResponseText += chunk;
          
          setState(prev => {
            const currentChat = [...(prev.chats[prev.activePersonalityId] || [])];
            
            if (isFirstChunk) {
              // On first chunk, add the Model message to state and hide typing indicator
              setShowTypingIndicator(false);
              const modelMessage: ChatMessage = {
                id: responseId,
                role: MessageRole.MODEL,
                text: fullResponseText,
                timestamp: Date.now(),
              };
              currentChat.push(modelMessage);
              isFirstChunk = false;
            } else {
              // On subsequent chunks, update the last message
              const lastMsgIndex = currentChat.findIndex(m => m.id === responseId);
              if (lastMsgIndex > -1) {
                currentChat[lastMsgIndex] = {
                  ...currentChat[lastMsgIndex],
                  text: fullResponseText
                };
              }
            }
            
            return { 
              ...prev, 
              chats: { ...prev.chats, [prev.activePersonalityId]: currentChat } 
            };
          });
        }
      );
    } catch (error) {
      console.error("Error sending message:", error);
      setShowTypingIndicator(false);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: MessageRole.MODEL,
        text: "Connection to Shadow Network severed. Please retry.",
        timestamp: Date.now(),
      };
      setState(prev => ({
        ...prev,
        chats: {
          ...prev.chats,
          [prev.activePersonalityId]: [...(prev.chats[prev.activePersonalityId] || []), errorMsg]
        }
      }));
    } finally {
      setIsInteracting(false);
      setShowTypingIndicator(false);
    }
  };

  const stopLiveSession = useCallback(() => {
    setIsLiveActive(false);
    setIsModelSpeaking(false);
    if (liveSessionRef.current) {
      liveSessionRef.current.then((s: any) => s.close());
      liveSessionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.input.close();
      audioContextRef.current.output.close();
      audioContextRef.current = null;
    }
    for (const s of sourcesRef.current) {
      try { s.stop(); } catch(e) {}
    }
    sourcesRef.current.clear();
  }, []);

  const startLiveSession = async () => {
    if (isLiveActive) {
      stopLiveSession();
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Microphone access is not supported in this browser.");
      return;
    }

    let stream: MediaStream | null = null;

    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err: any) {
        let errorMessage = "Microphone access failed.";
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = "Microphone permission denied. Please click the lock icon in your address bar to allow access.";
        } else if (err.message?.includes('dismissed')) {
          errorMessage = "Microphone permission was dismissed. Please click 'Go Live' again and allow access when prompted.";
        } else if (err.name === 'NotFoundError') {
           errorMessage = "No microphone found on this device.";
        } else {
           errorMessage = `Microphone error: ${err.message || 'Access failed'}`;
        }

        // Add system error message to chat
        setState(prev => ({
          ...prev,
          chats: {
            ...prev.chats,
            [prev.activePersonalityId]: [
              ...(prev.chats[prev.activePersonalityId] || []),
              {
                id: Date.now().toString(),
                role: MessageRole.MODEL,
                text: `⚠️ **System Error:** ${errorMessage}`,
                timestamp: Date.now()
              }
            ]
          }
        }));
        
        throw err;
      }

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = { input: inputCtx, output: outputCtx };
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setIsLiveActive(true);
            if (!stream) return;

            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              if (liveSessionRef.current) {
                sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
              }
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              setIsModelSpeaking(true);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsModelSpeaking(false);
              });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              for (const s of sourcesRef.current) {
                try { s.stop(); } catch(e) {}
              }
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsModelSpeaking(false);
            }

            if (message.serverContent?.inputTranscription) {
              currentInputTranscription.current += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription.current += message.serverContent.outputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              const userText = currentInputTranscription.current;
              const modelText = currentOutputTranscription.current;
              
              if (userText || modelText) {
                setState(prev => ({
                  ...prev,
                  chats: {
                    ...prev.chats,
                    [prev.activePersonalityId]: [
                      ...(prev.chats[prev.activePersonalityId] || []),
                      { id: Date.now().toString() + 'u', role: MessageRole.USER, text: userText || "...", timestamp: Date.now() },
                      { id: Date.now().toString() + 'm', role: MessageRole.MODEL, text: modelText || "...", timestamp: Date.now() }
                    ]
                  }
                }));
              }
              currentInputTranscription.current = '';
              currentOutputTranscription.current = '';
            }
          },
          onclose: () => {
             console.log("Session closed");
             stopLiveSession();
          },
          onerror: (e) => {
             console.error("Live session error:", e);
             stopLiveSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: activePersonality.systemInstruction + "\n\nCRITICAL CONSTRAINT: Keep your response STRICTLY under 20 words. \nEXCEPTION: If the user explicitly asks for an explanation, details, or to 'elaborate', IGNORE the word count limit and provide a full, detailed answer.",
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        }
      });

      liveSessionRef.current = sessionPromise;

    } catch (err) {
      console.error("Failed to start live session:", err);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      stopLiveSession();
    }
  };

  const handleClearChat = () => {
    if (confirm("Clear the current conversation buffer?")) {
      setState(prev => ({
        ...prev,
        chats: {
          ...prev.chats,
          [prev.activePersonalityId]: []
        }
      }));
    }
  };

  const handleSavePersonality = (newP: Personality) => {
    setState(prev => {
      // Check if update or create
      const exists = prev.personalities.find(p => p.id === newP.id);
      let newPersonalities;
      
      if (exists) {
        // Update existing
        newPersonalities = prev.personalities.map(p => p.id === newP.id ? newP : p);
      } else {
        // Add new
        newPersonalities = [...prev.personalities, newP];
      }
      
      return {
        ...prev,
        personalities: newPersonalities,
        activePersonalityId: newP.id
      };
    });
  };

  const handleEditPersonality = (e: React.MouseEvent, p: Personality) => {
    e.stopPropagation();
    setEditingPersonality(p);
    setIsModalOpen(true);
  };

  const handleDeletePersonality = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Permanently delete this character data?")) {
      setState(prev => {
        const updatedPersonalities = prev.personalities.filter(p => p.id !== id);
        const nextId = updatedPersonalities[0]?.id || DEFAULT_PERSONALITIES[0].id;
        return {
          ...prev,
          personalities: updatedPersonalities,
          activePersonalityId: prev.activePersonalityId === id ? nextId : prev.activePersonalityId
        };
      });
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden text-slate-200">
      <CustomPersonalityModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingPersonality(null); }} 
        onSave={handleSavePersonality}
        initialData={editingPersonality}
      />

      {/* Glass Sidebar - Optimized */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-80' : 'w-0'
        } glass-panel border-r-0 border-r-white/5 transition-all duration-300 flex flex-col shrink-0 overflow-hidden relative z-20 m-4 rounded-[24px] mr-0 shadow-2xl`}
      >
        <div className="p-6 border-b border-white/5 bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/80 to-purple-600/80 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-white/20 backdrop-blur-xl">
              🔮
            </div>
            <div>
              <h1 className="text-xl font-bold font-heading text-white tracking-tight drop-shadow-sm">Character AI</h1>
              <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-[0.25em] animate-pulse">Shadow Network</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <div className="px-2">
            <Button 
              className="w-full border-dashed border-white/10 hover:border-indigo-400/50 hover:bg-indigo-500/10 text-slate-400 gap-2 h-12 rounded-xl backdrop-blur-sm transition-all shadow-none hover:shadow-lg"
              variant="outline"
              onClick={() => { setEditingPersonality(null); setIsModalOpen(true); }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Character
            </Button>
          </div>

          <div className="space-y-1">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2 opacity-70">Active Nodes</h3>
            {state.personalities.map(p => (
              <div key={p.id} className="group relative">
                <PersonalityCard 
                  personality={p}
                  isActive={state.activePersonalityId === p.id}
                  onClick={() => {
                    if (isLiveActive) stopLiveSession();
                    setState(prev => ({ ...prev, activePersonalityId: p.id }));
                  }}
                  onEdit={(e) => handleEditPersonality(e, p)}
                />
                {!DEFAULT_PERSONALITIES.find(dp => dp.id === p.id) && (
                  <button
                    onClick={(e) => handleDeletePersonality(p.id, e)}
                    className="absolute right-10 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all z-20 backdrop-blur-md hover:bg-white/10 rounded-full"
                    title="Delete Custom Character"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-md space-y-3">
          <div className="glass-panel p-3 rounded-xl border-none bg-white/5 flex items-center justify-between">
            <div className="flex gap-2 items-center">
               <span className={`inline-block w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${isLiveActive ? 'bg-indigo-400 text-indigo-400' : 'bg-emerald-400 text-emerald-400'}`}></span>
               <span className="text-[10px] text-slate-300 font-mono uppercase tracking-wide">
                 {isLiveActive ? 'Live Uplink' : 'Stable'}
               </span>
            </div>
            <div className="text-[10px] text-slate-500">v3.3</div>
          </div>
          
          <div className="text-center">
            <p className="text-[10px] text-slate-500 font-medium tracking-wide">
              Author: Cid Kageno
            </p>
            <p className="text-[9px] text-slate-600 mt-0.5 opacity-60">
              © All rights reserved by Cid Kageno
            </p>
          </div>
        </div>
      </aside>

      {/* Main Glass Chat Area - Optimized */}
      <main className="flex-1 flex flex-col relative min-w-0 m-4 rounded-[32px] glass-panel overflow-hidden border border-white/10 shadow-2xl">
        <header className="h-20 border-b border-white/5 bg-white/5 backdrop-blur-2xl flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 hover:bg-white/10 rounded-xl text-slate-300 transition-colors backdrop-blur-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${!activePersonality.avatarImage ? activePersonality.color : 'bg-black'} flex items-center justify-center text-lg shadow-lg shadow-black/30 ring-1 ring-white/20 transition-all overflow-hidden ${isModelSpeaking ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-transparent scale-105' : ''}`}>
                {activePersonality.avatarImage ? (
                  <img src={activePersonality.avatarImage} alt="Active Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{activePersonality.icon}</span>
                )}
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-none tracking-tight">{activePersonality.name}</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-[9px] text-indigo-200 uppercase tracking-wider font-semibold border border-white/5">
                    {isLiveActive ? 'Live Audio' : `Gemini ${activePersonality.model.includes('pro') ? 'Pro' : 'Flash'}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LiveVisualizer 
              isActive={isLiveActive} 
              isSpeaking={isModelSpeaking} 
              isListening={isLiveActive && !isModelSpeaking} 
            />
            <Button 
              className={`gap-2 h-10 rounded-xl transition-all border ${isLiveActive ? 'bg-indigo-600/90 hover:bg-indigo-500/90 border-indigo-400/30 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : ''}`}
              variant={isLiveActive ? 'primary' : 'outline'}
              onClick={startLiveSession}
            >
              <div className={`w-2 h-2 rounded-full ${isLiveActive ? 'bg-white animate-pulse shadow-[0_0_8px_white]' : 'bg-slate-500'}`}></div>
              {isLiveActive ? 'End Live' : 'Go Live'}
            </Button>
            <Button 
              className="h-10 w-10 p-0 rounded-xl hover:bg-rose-500/10 hover:text-rose-200 hover:border-rose-500/30"
              variant="outline"
              onClick={handleClearChat}
              title="Clear Chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </Button>
          </div>
        </header>

        <ChatMessageList 
          messages={activeMessages} 
          personality={activePersonality}
          showTypingIndicator={showTypingIndicator && !isLiveActive}
          onStarterClick={(starter) => handleSendMessage(starter)}
        />

        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            {!isLiveActive ? (
              <form 
                onSubmit={handleSendMessage}
                className="relative flex items-end gap-3 glass-input p-2 pl-6 rounded-[2rem] shadow-2xl shadow-black/50 focus-within:shadow-indigo-500/10 transition-all duration-300"
              >
                <textarea
                  rows={1}
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={`Message ${activePersonality.name}...`}
                  className="w-full bg-transparent border-none focus:ring-0 text-base py-3.5 max-h-32 resize-none custom-scrollbar text-white placeholder:text-slate-500 leading-relaxed font-light"
                />
                <Button 
                  type="submit" 
                  size="sm" 
                  className="rounded-full h-11 w-11 p-0 shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/20 mb-1"
                  disabled={!inputText.trim() || isInteracting}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 translate-x-0.5 -translate-y-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </Button>
              </form>
            ) : (
              <div className="flex items-center justify-center p-8 bg-indigo-500/10 border border-indigo-500/20 rounded-[2rem] animate-pulse backdrop-blur-xl">
                <div className="flex flex-col items-center gap-3">
                   <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                     <div className="w-4 h-4 bg-indigo-400 rounded-full animate-ping shadow-[0_0_15px_rgba(129,140,248,0.8)]"></div>
                   </div>
                   <span className="text-sm font-medium text-indigo-200 tracking-wide">Listening to your voice...</span>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;