
import React from 'react';

interface LiveVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
  isListening: boolean;
}

const LiveVisualizer: React.FC<LiveVisualizerProps> = ({ isActive, isSpeaking, isListening }) => {
  if (!isActive) return null;

  return (
    <div className="flex items-center justify-center gap-1 h-8 px-4">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-300 ${
            isSpeaking ? 'bg-indigo-400 animate-bounce' : 
            isListening ? 'bg-emerald-400 h-4' : 'bg-slate-700 h-1'
          }`}
          style={{
            height: isSpeaking ? `${Math.random() * 20 + 10}px` : undefined,
            animationDelay: `${i * 0.1}s`,
            animationDuration: '0.6s'
          }}
        />
      ))}
      <span className="ml-2 text-[10px] font-mono uppercase tracking-widest text-slate-400">
        {isSpeaking ? 'Model Output' : isListening ? 'Listening' : 'Ready'}
      </span>
    </div>
  );
};

export default LiveVisualizer;
