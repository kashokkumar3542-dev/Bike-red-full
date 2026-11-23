import React from 'react';
import { RoadZone } from '../game/types';

export interface LaughBubble {
  id: number;
  text: string;
  offsetX: number;
  offsetY: number;
  accent: 'normal' | 'red' | 'black';
}

interface OldManCharacterProps {
  speedKmh: number;
  isAccelerating: boolean;
  roadZone: RoadZone;
  bubbles: LaughBubble[];
}

export const OldManCharacter: React.FC<OldManCharacterProps> = ({
  speedKmh,
  isAccelerating,
  roadZone,
  bubbles,
}) => {
  // Determine facial expression tier by speed & acceleration
  const mood: 'idle' | 'cruise' | 'red' | 'turbo' =
    speedKmh >= 200
      ? 'turbo'
      : speedKmh >= 150
        ? 'red'
        : isAccelerating && speedKmh >= 25
          ? 'cruise'
          : 'idle';

  const frameBorder =
    roadZone === 'black'
      ? 'border-amber-400 bg-[#090a10]/90 shadow-[0_0_24px_rgba(251,191,36,0.35)]'
      : roadZone === 'red'
        ? 'border-red-500 bg-[#1a080a]/90 shadow-[0_0_24px_rgba(239,68,68,0.4)]'
        : 'border-white/20 bg-[#0d1018]/88';

  const motionClass =
    mood === 'turbo'
      ? 'animate-oldman-turbo'
      : mood === 'red' || (mood === 'cruise' && isAccelerating)
        ? 'animate-oldman-laugh'
        : '';

  const gogglesDown = mood === 'red' || mood === 'turbo';
  const mouthOpen = mood !== 'idle' && isAccelerating;

  return (
    <div className="pointer-events-none relative flex items-end select-none">
      {/* Animated "HA HA!" speech popups floating beside his face */}
      <div className="absolute -top-12 left-14 sm:left-20 w-44 h-24 overflow-visible">
        {bubbles.map((b) => (
          <div
            key={b.id}
            style={{
              left: `${b.offsetX}px`,
              top: `${b.offsetY}px`,
            }}
            className={`animate-haha-pop absolute whitespace-nowrap font-display font-bold italic tracking-tight px-2.5 py-1 rounded-xl border text-sm sm:text-base shadow-lg ${
              b.accent === 'black'
                ? 'bg-amber-400 text-neutral-950 border-white'
                : b.accent === 'red'
                  ? 'bg-red-600 text-white border-amber-300'
                  : 'bg-white text-neutral-950 border-neutral-300'
            }`}
          >
            {b.text}
          </div>
        ))}
      </div>

      {/* Portrait Casing */}
      <div
        className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 overflow-hidden transition-colors duration-300 ${frameBorder}`}
      >
        {/* Background speed lines inside portrait at high speed */}
        {(mood === 'red' || mood === 'turbo') && (
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full opacity-45"
            aria-hidden="true"
          >
            <line
              x1="0"
              y1="20"
              x2="100"
              y2="14"
              stroke={mood === 'turbo' ? '#fbbf24' : '#ef4444'}
              strokeWidth="2.5"
              strokeDasharray="14 10"
            />
            <line
              x1="0"
              y1="48"
              x2="100"
              y2="45"
              stroke={mood === 'turbo' ? '#ffffff' : '#f87171'}
              strokeWidth="2"
              strokeDasharray="20 12"
            />
            <line
              x1="0"
              y1="78"
              x2="100"
              y2="82"
              stroke={mood === 'turbo' ? '#fbbf24' : '#ef4444'}
              strokeWidth="2.5"
              strokeDasharray="16 8"
            />
          </svg>
        )}

        {/* Expressive Grandpa Biker SVG */}
        <svg
          viewBox="0 0 120 120"
          className={`relative z-10 w-full h-full ${motionClass}`}
          role="img"
          aria-label="Funny old man co-pilot"
        >
          {/* Vintage leather jacket collar & scarf */}
          <path d="M18 122 C24 94, 96 94, 102 122 Z" fill="#2c1d15" />
          <path
            d={
              mood === 'turbo' || mood === 'red'
                ? 'M32 98 Q60 108 98 94 L112 86 L108 102 Q62 114 34 106 Z'
                : 'M36 98 Q60 108 86 98 L84 108 Q60 116 38 108 Z'
            }
            fill="#dc2626"
          />

          {/* Ears */}
          <circle cx="24" cy="64" r="9" fill="#f3c09d" />
          <circle cx="96" cy="64" r="9" fill="#f3c09d" />

          {/* Wispy white hair tufts blowing in the wind */}
          <path
            d={
              mood === 'turbo'
                ? 'M22 54 Q6 42 4 30 Q18 36 27 42 Z'
                : mood === 'red'
                  ? 'M24 55 Q10 46 10 38 Q20 42 28 45 Z'
                  : 'M24 56 Q16 50 18 44 Q24 46 28 48 Z'
            }
            fill="#f1f5f9"
          />
          <path
            d={
              mood === 'turbo'
                ? 'M98 54 Q114 42 116 30 Q102 36 93 42 Z'
                : mood === 'red'
                  ? 'M96 55 Q110 46 110 38 Q100 42 92 45 Z'
                  : 'M96 56 Q104 50 102 44 Q96 46 92 48 Z'
            }
            fill="#f1f5f9"
          />

          {/* Face shape */}
          <ellipse cx="60" cy="64" rx="34" ry="37" fill="#f7cab0" />

          {/* Vintage open-face biker helmet cap */}
          <path d="M25 50 C25 22, 95 22, 95 50 C82 40, 38 40, 25 50 Z" fill="#1e293b" />
          <path d="M54 24 L66 24 L65 42 L55 42 Z" fill="#ef4444" />

          {/* Forehead laugh wrinkles */}
          <path d="M46 47 Q60 44 74 47" stroke="#d99c79" strokeWidth="1.8" fill="none" strokeLinecap="round" />

          {/* Rosy happy cheeks */}
          <ellipse
            cx="37"
            cy="72"
            rx="7.5"
            ry="4.5"
            fill="#f87171"
            opacity={mood === 'turbo' ? 0.65 : mood === 'red' ? 0.52 : 0.3}
          />
          <ellipse
            cx="83"
            cy="72"
            rx="7.5"
            ry="4.5"
            fill="#f87171"
            opacity={mood === 'turbo' ? 0.65 : mood === 'red' ? 0.52 : 0.3}
          />

          {/* Eyes + Eyebrows (change dynamically with speed!) */}
          {gogglesDown ? (
            <>
              {/* Goggles strap */}
              <rect x="24" y="54" width="72" height="6" rx="3" fill="#334155" />
              {/* Left & Right Aviator Goggles over eyes */}
              <circle cx="45" cy="59" r="12" fill={mood === 'turbo' ? '#fbbf24' : '#fca5a5'} stroke="#cbd5e1" strokeWidth="3.2" />
              <circle cx="75" cy="59" r="12" fill={mood === 'turbo' ? '#fbbf24' : '#fca5a5'} stroke="#cbd5e1" strokeWidth="3.2" />
              <line x1="57" y1="59" x2="63" y2="59" stroke="#cbd5e1" strokeWidth="3" />
              {/* Excited wide pupils inside goggles */}
              <circle cx="45" cy="59" r={mood === 'turbo' ? '4.8' : '3.8'} fill="#0f172a" />
              <circle cx="75" cy="59" r={mood === 'turbo' ? '4.8' : '3.8'} fill="#0f172a" />
              <circle cx="47" cy="57" r="1.6" fill="#ffffff" />
              <circle cx="77" cy="57" r="1.6" fill="#ffffff" />
            </>
          ) : (
            <>
              {/* Goggles pushed up on helmet */}
              <rect x="33" y="30" width="22" height="12" rx="6" fill="#475569" stroke="#cbd5e1" strokeWidth="2.2" />
              <rect x="65" y="30" width="22" height="12" rx="6" fill="#475569" stroke="#cbd5e1" strokeWidth="2.2" />
              <line x1="55" y1="36" x2="65" y2="36" stroke="#cbd5e1" strokeWidth="2.5" />

              {/* Expressive white bushy eyebrows */}
              <path
                d={mood === 'cruise' ? 'M34 50 Q45 44 53 49' : 'M35 53 Q45 50 53 53'}
                stroke="#f8fafc"
                strokeWidth="4.2"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d={mood === 'cruise' ? 'M67 49 Q75 44 86 50' : 'M67 53 Q75 50 85 53'}
                stroke="#f8fafc"
                strokeWidth="4.2"
                fill="none"
                strokeLinecap="round"
              />

              {/* Cheerful eyes / crinkled laugh eyes */}
              {mood === 'cruise' ? (
                <>
                  <path d="M38 60 Q45 54 52 60" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
                  <path d="M68 60 Q75 54 82 60" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <circle cx="45" cy="60" r="3.6" fill="#0f172a" />
                  <circle cx="75" cy="60" r="3.6" fill="#0f172a" />
                  <circle cx="46.2" cy="58.8" r="1.2" fill="#ffffff" />
                  <circle cx="76.2" cy="58.8" r="1.2" fill="#ffffff" />
                </>
              )}
            </>
          )}

          {/* Round bulbous grandpa nose */}
          <ellipse cx="60" cy="69" rx="6.5" ry="5" fill="#eaab88" />

          {/* Big Laughing Mouth */}
          {mouthOpen ? (
            <g>
              <path
                d={
                  mood === 'turbo'
                    ? 'M42 78 Q60 105 78 78 Z'
                    : 'M45 78 Q60 98 75 78 Z'
                }
                fill="#7f1d1d"
                stroke="#450a0a"
                strokeWidth="1.5"
              />
              {/* Top teeth */}
              <rect x="49" y="79" width="22" height="4.5" rx="2" fill="#ffffff" />
              {/* Happy tongue */}
              <ellipse cx="60" cy="91" rx="8" ry="4" fill="#fb7185" />
            </g>
          ) : (
            <path
              d="M48 82 Q60 90 72 82"
              stroke="#7c2d12"
              strokeWidth="2.8"
              fill="none"
              strokeLinecap="round"
            />
          )}

          {/* Big Bushy White Mustache (flutters wildly at high speed!) */}
          <path
            d={
              mood === 'turbo'
                ? 'M60 75 Q44 68 24 72 Q36 84 60 80 Q84 84 96 72 Q76 68 60 75 Z'
                : mood === 'red'
                  ? 'M60 75 Q45 70 30 75 Q42 84 60 80 Q78 84 90 75 Q75 70 60 75 Z'
                  : 'M60 75 Q48 72 36 78 Q46 84 60 80 Q74 84 84 78 Q72 72 60 75 Z'
            }
            fill="#f8fafc"
            stroke="#cbd5e1"
            strokeWidth="1"
          />

          {/* Chin beard tuft */}
          <path d="M52 98 Q60 106 68 98 Q60 102 52 98 Z" fill="#f1f5f9" />
        </svg>

        {/* Subtle bottom name/mood strip */}
        <div className="absolute bottom-0 inset-x-0 bg-black/75 text-center py-0.5 text-[9px] font-display font-bold tracking-wider text-white/90">
          {mood === 'turbo'
            ? 'TURBO HA HA!'
            : mood === 'red'
              ? 'RED PULL!'
              : mood === 'cruise'
                ? 'HA HA!'
                : 'READY'}
        </div>
      </div>
    </div>
  );
};
