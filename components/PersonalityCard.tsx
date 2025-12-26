
import React from 'react';
import { Personality } from '../types';

interface PersonalityCardProps {
  personality: Personality;
  isActive: boolean;
  onClick: () => void;
  onEdit?: (e: React.MouseEvent) => void;
}

const PersonalityCard: React.FC<PersonalityCardProps> = ({ personality, isActive, onClick, onEdit }) => {
  return (
    <div
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all duration-300 border text-left group relative overflow-hidden cursor-pointer ${
        isActive 
          ? 'bg-indigo-600/20 border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.15)] backdrop-blur-md' 
          : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10 hover:shadow-lg hover:shadow-black/20 backdrop-blur-sm'
      }`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-lg ring-1 ring-white/20 transition-transform group-hover:scale-110 duration-300 overflow-hidden ${!personality.avatarImage ? personality.color : 'bg-black'}`}>
        {personality.avatarImage ? (
          <img src={personality.avatarImage} alt={personality.name} className="w-full h-full object-cover" />
        ) : (
          <span>{personality.icon}</span>
        )}
      </div>
      <div className="flex-1 min-w-0 z-10">
        <h4 className={`font-semibold text-sm truncate transition-colors ${isActive ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
          {personality.name}
        </h4>
        <p className={`text-xs truncate transition-colors font-light ${isActive ? 'text-indigo-200' : 'text-slate-400 group-hover:text-slate-300'}`}>
          {personality.description}
        </p>
      </div>
      
      {/* Edit Button - Visible on Hover */}
      {onEdit && (
        <button
          onClick={onEdit}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-all z-20 backdrop-blur-md"
          title="Edit Character"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}

      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-50 z-0 pointer-events-none"></div>
      )}
      {isActive && (
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8] animate-pulse z-10 mr-1"></div>
      )}
    </div>
  );
};

export default PersonalityCard;
