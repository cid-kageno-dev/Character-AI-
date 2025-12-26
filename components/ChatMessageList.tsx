
import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, MessageRole, Personality } from '../types';

interface ChatMessageListProps {
  messages: ChatMessage[];
  personality: Personality;
  showTypingIndicator: boolean;
  onStarterClick: (starter: string) => void;
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages, personality, showTypingIndicator, onStarterClick }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showTypingIndicator]);

  return (
    <div 
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar scroll-smooth"
    >
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-8 fade-in animate-in duration-700">
          <div className="relative group cursor-default">
            <div className={`w-32 h-32 rounded-[2rem] ${!personality.avatarImage ? personality.color : 'bg-black'} flex items-center justify-center text-7xl shadow-[0_0_40px_rgba(0,0,0,0.3)] mb-4 relative z-10 transition-all duration-500 group-hover:scale-105 group-hover:rotate-2 border border-white/20 backdrop-blur-xl bg-opacity-80 overflow-hidden`}>
              {personality.avatarImage ? (
                <img src={personality.avatarImage} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="drop-shadow-lg">{personality.icon}</span>
              )}
            </div>
            <div className={`absolute inset-0 ${personality.color} blur-3xl opacity-20 scale-150 z-0 animate-pulse`}></div>
          </div>
          
          <div className="space-y-3 max-w-lg">
            <h3 className="text-4xl font-bold font-heading text-white tracking-tight drop-shadow-md">{personality.name}</h3>
            <p className="text-slate-300 text-base leading-relaxed font-light">
              {personality.description}
            </p>
          </div>
          
          {personality.starters && personality.starters.length > 0 && (
             <div className="w-full max-w-md space-y-5 mt-8">
                <div className="flex items-center gap-4 opacity-50">
                   <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent flex-1"></div>
                   <p className="text-[10px] font-bold text-white uppercase tracking-[0.3em]">Initialize</p>
                   <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent flex-1"></div>
                </div>
                <div className="grid gap-3">
                  {personality.starters.map((starter, idx) => (
                    <button
                      key={idx}
                      onClick={() => onStarterClick(starter)}
                      className="glass-button text-sm p-4 rounded-2xl text-left transition-all duration-300 group flex items-center justify-between text-slate-200 hover:text-white"
                    >
                      <span className="truncate font-light">{starter}</span>
                      <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-indigo-500 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
             </div>
          )}
        </div>
      )}
      
      {messages.map((message) => (
        <div 
          key={message.id}
          className={`flex ${message.role === MessageRole.USER ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 fade-in duration-500`}
        >
          {message.role === MessageRole.MODEL && (
            <div className={`w-8 h-8 rounded-full ${!personality.avatarImage ? personality.color : 'bg-black'} flex items-center justify-center text-xs shadow-md mr-3 mt-auto mb-1 ring-1 ring-white/20 overflow-hidden shrink-0`}>
              {personality.avatarImage ? (
                <img src={personality.avatarImage} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                personality.icon
              )}
            </div>
          )}
          
          <div 
            className={`max-w-[80%] px-6 py-4 rounded-3xl backdrop-blur-md shadow-lg border ${
              message.role === MessageRole.USER 
                ? 'bg-indigo-600/60 text-white rounded-br-sm border-indigo-400/30 shadow-indigo-900/20' 
                : 'bg-white/5 text-slate-100 rounded-bl-sm border-white/10 shadow-black/10'
            }`}
          >
            <div className="text-[15px] leading-relaxed font-light tracking-wide">
              <ReactMarkdown
                components={{
                  p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 mb-2 space-y-1 opacity-90" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-1 opacity-90" {...props} />,
                  li: ({node, ...props}) => <li className="pl-1" {...props} />,
                  strong: ({node, ...props}) => <strong className={`font-semibold ${message.role === MessageRole.USER ? 'text-indigo-200' : 'text-indigo-300'}`} {...props} />,
                  h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2 border-b border-white/10 pb-2 mt-2" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-base font-bold mb-2 mt-4 text-indigo-300" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-sm font-bold mb-1 mt-3" {...props} />,
                  code: ({node, ...props}) => <code className="bg-black/30 rounded-md px-1.5 py-0.5 font-mono text-xs border border-white/10" {...props} />,
                  blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-indigo-400/50 pl-4 italic opacity-80 my-2" {...props} />
                }}
              >
                {message.text}
              </ReactMarkdown>
            </div>
            <div className={`text-[9px] mt-2 opacity-40 font-mono flex items-center gap-1.5 uppercase tracking-widest ${message.role === MessageRole.USER ? 'text-indigo-100 justify-end' : 'text-slate-300 justify-start'}`}>
               <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>
      ))}
      
      {showTypingIndicator && (
        <div className="flex justify-start animate-in fade-in duration-300 items-center">
          <div className={`w-8 h-8 rounded-full ${!personality.avatarImage ? personality.color : 'bg-black'} flex items-center justify-center text-xs shadow-md mr-3 ring-1 ring-white/20 opacity-50 overflow-hidden shrink-0`}>
              {personality.avatarImage ? (
                <img src={personality.avatarImage} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                personality.icon
              )}
          </div>
          <div className="bg-white/5 text-slate-100 px-5 py-4 rounded-3xl rounded-bl-sm border border-white/10 backdrop-blur-md shadow-lg">
            <div className="flex gap-1.5">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
            </div>
          </div>
        </div>
      )}
      
      <div className="h-4"></div>
    </div>
  );
};

export default ChatMessageList;
