import React from 'react';
import { RoadZone } from '../game/types';

interface SpeedMeterProps {
  speedKmh: number;
  rpmRatio: number;
  gear: number;
  roadZone: RoadZone;
}

const TOTAL_SEGMENTS = 18;

export const SpeedMeter: React.FC<SpeedMeterProps> = ({
  speedKmh,
  rpmRatio,
  gear,
  roadZone,
}) => {
  const litSegments =
    speedKmh === 0
      ? 2
      : Math.round(Math.max(2, Math.min(TOTAL_SEGMENTS, rpmRatio * TOTAL_SEGMENTS)));

  const zoneTitle =
    roadZone === 'black'
      ? 'BLACK ROAD'
      : roadZone === 'red'
        ? 'RED ROAD'
        : 'NORMAL ROAD';

  const zoneColorClass =
    roadZone === 'black'
      ? 'text-amber-300'
      : roadZone === 'red'
        ? 'text-red-400'
        : 'text-sky-200';

  const casingClass =
    roadZone === 'black'
      ? 'border-amber-400/80 bg-[#07080d]/92 shadow-[0_0_26px_rgba(251,191,36,0.25)]'
      : roadZone === 'red'
        ? 'border-red-500/85 bg-[#1b080a]/92 shadow-[0_0_26px_rgba(239,68,68,0.32)]'
        : 'border-white/20 bg-[#0c111c]/88';

  const speedTextColor =
    roadZone === 'black'
      ? 'text-amber-300'
      : roadZone === 'red'
        ? 'text-red-400'
        : 'text-white';

  return (
    <div
      className={`pointer-events-none select-none rounded-2xl border px-3.5 py-2.5 sm:px-5 sm:py-3.5 w-[196px] sm:w-[244px] transition-colors duration-300 ${casingClass}`}
    >
      {/* Radial RPM Tachometer Arc */}
      <div className="relative h-14 sm:h-16 w-full flex items-end justify-center overflow-hidden">
        <svg viewBox="0 0 200 100" className="w-full h-full overflow-visible" aria-hidden="true">
          {Array.from({ length: TOTAL_SEGMENTS }).map((_, idx) => {
            const frac = idx / (TOTAL_SEGMENTS - 1);
            const angleDeg = 192 - frac * 204;
            const rad = (angleDeg * Math.PI) / 180;
            const cx = 100;
            const cy = 92;
            const rInner = 64;
            const rOuter = 86;

            const x1 = cx + Math.cos(rad) * rInner;
            const y1 = cy - Math.sin(rad) * rInner;
            const x2 = cx + Math.cos(rad) * rOuter;
            const y2 = cy - Math.sin(rad) * rOuter;

            const isLit = idx < litSegments;
            let stroke = 'rgba(255,255,255,0.14)';
            if (isLit) {
              if (frac >= 0.78) {
                stroke = roadZone === 'black' ? '#fbbf24' : '#ef4444';
              } else if (frac >= 0.5) {
                stroke = '#f59e0b';
              } else {
                stroke = '#22c55e';
              }
            }

            return (
              <line
                key={idx}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={isLit ? 6.5 : 5}
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-1 text-[10px] sm:text-xs font-display font-semibold tracking-wider text-white/65">
          <span>RPM</span>
          <span className="text-white font-bold">{speedKmh === 0 ? 'IDLE' : `GEAR ${gear}`}</span>
        </div>
      </div>

      {/* Large Digital Speed Readout */}
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <span
          className={`font-display font-bold tabular-nums leading-none text-5xl sm:text-6xl tracking-tight transition-colors duration-200 ${speedTextColor}`}
        >
          {speedKmh}
        </span>
        <div className="flex flex-col items-end">
          <span className="font-display font-bold text-xs sm:text-sm tracking-widest text-white/80">
            KM/H
          </span>
          <span className={`font-display font-bold text-[10px] sm:text-xs tracking-wide ${zoneColorClass}`}>
            {zoneTitle}
          </span>
        </div>
      </div>

      {/* Speed Zone Progress Bar (150 RED / 200 BLACK markers) */}
      <div className="mt-2">
        <div className="relative h-1.5 w-full rounded-full bg-white/12 overflow-hidden">
          <div
            className={`h-full transition-[width] duration-75 ${
              roadZone === 'black'
                ? 'bg-gradient-to-r from-red-500 via-amber-400 to-white'
                : roadZone === 'red'
                  ? 'bg-gradient-to-r from-amber-500 to-red-500'
                  : 'bg-gradient-to-r from-emerald-400 to-sky-400'
            }`}
            style={{ width: `${Math.min(100, (speedKmh / 240) * 100)}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-400/95"
            style={{ left: `${(150 / 240) * 100}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/95"
            style={{ left: `${(200 / 240) * 100}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-white/60 font-display tabular-nums">
          <span>0</span>
          <span className={speedKmh >= 150 ? 'text-red-400 font-bold' : ''}>150 RED</span>
          <span className={speedKmh >= 200 ? 'text-amber-300 font-bold' : ''}>200 BLACK</span>
        </div>
      </div>
    </div>
  );
};
