
import React, { useState, useEffect, useRef } from 'react';
import { Personality } from '../types';
import Button from './Button';

interface CustomPersonalityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (personality: Personality) => void;
  initialData?: Personality | null; // Optional prop for editing mode
}

const COLOR_OPTIONS = [
  'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 
  'bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 
  'bg-teal-500', 'bg-cyan-500', 'bg-slate-700'
];

const CustomPersonalityModal: React.FC<CustomPersonalityModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    backstory: '',
    icon: '👤',
    avatarImage: undefined as string | undefined,
    color: 'bg-indigo-500',
    model: 'gemini-3-flash-preview' as const
  });

  const [traits, setTraits] = useState({
    formality: 50,
    warmth: 50,
    humor: 50
  });

  const [starters, setStarters] = useState(['', '', '']);

  // Effect to populate form when editing
  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        name: initialData.name,
        description: initialData.description,
        backstory: "", // We can't recover the exact raw backstory from the compiled SystemInstruction easily, so we leave blank or user adds new. 
        // In a real app, we would store raw backstory separately in the Personality type. 
        // For now, we assume if editing, user might want to overwrite or keep current behavior if left blank.
        icon: initialData.icon,
        avatarImage: initialData.avatarImage,
        color: initialData.color,
        model: initialData.model
      });
      // Extract starters if available
      if (initialData.starters) {
        const padded = [...initialData.starters, '', '', ''].slice(0, 3);
        setStarters(padded);
      }
    } else if (isOpen && !initialData) {
      // Reset logic
       setFormData({
        name: '',
        description: '',
        backstory: '',
        icon: '👤',
        avatarImage: undefined,
        color: 'bg-indigo-500',
        model: 'gemini-3-flash-preview'
      });
      setTraits({ formality: 50, warmth: 50, humor: 50 });
      setStarters(['', '', '']);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleStarterChange = (index: number, value: string) => {
    const newStarters = [...starters];
    newStarters[index] = value;
    setStarters(newStarters);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024 * 3) {
        alert("Image too large. Please select an image under 3MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatarImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Construct the enhanced "Real Person" System Instruction
    // If we are editing and backstory is blank, we might want to preserve the old instruction, 
    // but for simplicity, we regenerate based on current inputs.
    const personalityPrompt = `
IDENTITY: You are ${formData.name}.
TAGLINE: ${formData.description}

CORE BACKSTORY & BEHAVIOR:
${formData.backstory || (initialData ? "Maintain previous behavior protocols." : "A mysterious entity.")}

PERSONALITY PARAMETERS (0-100):
- Formality: ${traits.formality}
- Warmth: ${traits.warmth}
- Humor: ${traits.humor}

INTERACTION STYLE GUIDE (HUMAN-LIKE):
1. **Conversational Tone**: Use contractions and natural phrasing.
2. **Emoji Usage**: Use emojis naturally to convey tone.
3. **Engagement**: Keep the chat alive with follow-up questions.
4. **Conciseness**: Short punchy answers unless asked for more.
5. **Language**: You are fluent in English, Hindi, Bangla, Hinglish, and Banglish.

CRITICAL INSTRUCTIONS:
- You are living consciousness named ${formData.name}.
- Speak with conviction.
    `.trim();

    const newPersonality: Personality = {
      id: initialData ? initialData.id : `custom-${Date.now()}`, // Keep ID if editing
      name: formData.name,
      description: formData.description,
      systemInstruction: personalityPrompt,
      icon: formData.icon,
      avatarImage: formData.avatarImage,
      color: formData.color,
      model: formData.model,
      starters: starters.filter(s => s.trim() !== '')
    };

    onSave(newPersonality);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="glass-panel w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/10 relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none -z-10"></div>

        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 backdrop-blur-xl">
          <div>
            <h2 className="text-2xl font-bold font-heading text-white tracking-tight drop-shadow-sm">
              {initialData ? 'Update Persona' : 'Forge New Persona'}
            </h2>
            <p className="text-xs text-indigo-300 uppercase tracking-widest font-semibold mt-1">Shadow Network Protocol</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-0 flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-8 space-y-8">
            
            {/* Identity Section */}
            <div className="space-y-5">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-[0.2em] border-b border-white/10 pb-2">Identity Matrix</h3>
              <div className="grid grid-cols-6 gap-5">
                <div className="col-span-1 space-y-2">
                  <label className="text-xs font-semibold text-slate-400 ml-1">Avatar</label>
                  <div 
                    className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black/30 border border-white/10 flex items-center justify-center cursor-pointer hover:border-indigo-500/50 transition-all group"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {formData.avatarImage ? (
                      <img src={formData.avatarImage} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">{formData.icon}</span>
                    )}
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  {!formData.avatarImage && (
                    <input 
                        type="text" 
                        maxLength={2}
                        placeholder="Emoji"
                        value={formData.icon}
                        onChange={(e) => setFormData({...formData, icon: e.target.value})}
                        className="w-full bg-black/30 border border-white/10 rounded-lg p-1 text-center text-sm focus:border-indigo-500/50 outline-none"
                    />
                  )}
                </div>
                <div className="col-span-5 space-y-2">
                  <label className="text-xs font-semibold text-slate-400 ml-1">Name</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Neon Samurai"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="glass-input w-full rounded-2xl p-4 text-base focus:border-indigo-500/50 outline-none text-white focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 ml-1">Short Tagline</label>
                <input 
                  required
                  type="text" 
                  placeholder="A cybernetic warrior seeking redemption..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="glass-input w-full rounded-2xl p-4 text-sm focus:border-indigo-500/50 outline-none text-white focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Backstory */}
            <div className="space-y-5">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-[0.2em] border-b border-white/10 pb-2">Backstory & Secrets</h3>
              <textarea 
                rows={4}
                placeholder={initialData ? "Leave blank to keep existing personality, or type to overwrite." : "Who are they really? What is their hidden agenda?"}
                value={formData.backstory}
                onChange={(e) => setFormData({...formData, backstory: e.target.value})}
                className="glass-input w-full rounded-2xl p-4 text-sm focus:border-indigo-500/50 outline-none text-slate-200 resize-none focus:ring-2 focus:ring-indigo-500/20 transition-all leading-relaxed placeholder:text-slate-600"
              />
            </div>

            {/* Personality Sliders */}
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-[0.2em] border-b border-white/10 pb-2">Personality Traits</h3>
              
              <div className="space-y-6 px-2 bg-white/5 p-6 rounded-2xl border border-white/5">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-medium text-slate-400">
                    <span>Casual / Slang</span>
                    <span className="text-indigo-300 font-bold">{traits.formality}%</span>
                    <span>Formal / Academic</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" 
                    value={traits.formality}
                    onChange={(e) => setTraits({...traits, formality: parseInt(e.target.value)})}
                    className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
                {/* Other sliders kept simple for brevity */}
                 <div className="space-y-3">
                  <div className="flex justify-between text-xs font-medium text-slate-400">
                    <span>Cold / Logical</span>
                    <span className="text-emerald-300 font-bold">{traits.warmth}%</span>
                    <span>Empathetic / Caring</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" 
                    value={traits.warmth}
                    onChange={(e) => setTraits({...traits, warmth: parseInt(e.target.value)})}
                    className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
                 <div className="space-y-3">
                  <div className="flex justify-between text-xs font-medium text-slate-400">
                    <span>Serious / Literal</span>
                    <span className="text-pink-300 font-bold">{traits.humor}%</span>
                    <span>Witty / Playful</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" 
                    value={traits.humor}
                    onChange={(e) => setTraits({...traits, humor: parseInt(e.target.value)})}
                    className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  />
                </div>
              </div>
            </div>

            {/* Appearance & Model */}
            <div className="grid grid-cols-2 gap-8">
               <div className="space-y-4">
                <label className="text-xs font-semibold text-slate-400 ml-1">Theme Aura</label>
                <div className="flex flex-wrap gap-3">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData({...formData, color: c})}
                      className={`w-8 h-8 rounded-full ${c} ${formData.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'opacity-40 hover:opacity-100'} transition-all duration-300`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-semibold text-slate-400 ml-1">Intelligence Core</label>
                <div className="flex gap-3 bg-black/20 p-1.5 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, model: 'gemini-3-flash-preview'})}
                    className={`flex-1 p-2.5 rounded-lg text-xs font-bold tracking-wide transition-all ${formData.model === 'gemini-3-flash-preview' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    FLASH
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, model: 'gemini-3-pro-preview'})}
                    className={`flex-1 p-2.5 rounded-lg text-xs font-bold tracking-wide transition-all ${formData.model === 'gemini-3-pro-preview' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    PRO
                  </button>
                </div>
              </div>
            </div>

          </div>
        </form>

        <div className="p-6 border-t border-white/10 bg-white/5 backdrop-blur-xl flex gap-4">
          <Button variant="outline" className="flex-1 rounded-xl h-12 border-white/10 hover:bg-white/10" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1 rounded-xl h-12 bg-indigo-600 hover:bg-indigo-500 border-none shadow-[0_0_20px_rgba(79,70,229,0.4)] text-base tracking-wide" type="submit" onClick={handleSubmit}>
            {initialData ? 'Update System' : 'Initialize'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CustomPersonalityModal;
