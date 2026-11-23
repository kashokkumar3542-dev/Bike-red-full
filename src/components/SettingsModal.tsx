import React, { useState } from 'react';
import {
  ArrowLeft,
  Music,
  RotateCcw,
  Smile,
  Smartphone,
  Unlock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AudioSettings } from '../game/types';

interface SettingsModalProps {
  settings: AudioSettings;
  onUpdateSettings: (patch: Partial<AudioSettings>) => void;
  onResetProgress: () => void;
  onBack: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onResetProgress,
  onBack,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  const toggles: Array<{
    key: keyof AudioSettings;
    label: string;
    description: string;
    icon: React.ReactNode;
    value: boolean;
  }> = [
    {
      key: 'soundEnabled',
      label: 'Master Sound',
      description: 'Motorcycle engine, exhaust, collision impacts, and all audio',
      icon: settings.soundEnabled ? (
        <Volume2 className="w-5 h-5 text-emerald-400" />
      ) : (
        <VolumeX className="w-5 h-5 text-white/45" />
      ),
      value: settings.soundEnabled,
    },
    {
      key: 'musicEnabled',
      label: 'Background Music',
      description: 'Energetic highway riding soundtrack',
      icon: <Music className="w-5 h-5 text-sky-400" />,
      value: settings.musicEnabled,
    },
    {
      key: 'oldManVoiceEnabled',
      label: 'Old Man "HA HA!" Voice',
      description: 'Funny laughing voice synced with acceleration',
      icon: <Smile className="w-5 h-5 text-amber-400" />,
      value: settings.oldManVoiceEnabled,
    },
    {
      key: 'vibrationEnabled',
      label: 'Collision Vibration',
      description: 'Short mobile haptic pulse on divider impact',
      icon: <Smartphone className="w-5 h-5 text-red-400" />,
      value: settings.vibrationEnabled,
    },
    {
      key: 'unlockAllBikes',
      label: 'Unlock All 10 Superbikes',
      description: 'Free-ride access to Ninja H2R, Panigale V4, Hayabusa & all bikes',
      icon: <Unlock className="w-5 h-5 text-emerald-400" />,
      value: settings.unlockAllBikes,
    },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#070b14]/82">
      <div className="w-full max-w-md rounded-3xl bg-[#0e1422] border border-white/15 p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-white/10 hover:bg-white/16 active:scale-95 transition flex items-center gap-1.5 text-sm font-semibold text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <h2 className="font-display font-bold text-2xl tracking-wider text-white">
            SETTINGS
          </h2>
          <div className="w-[76px]" />
        </div>

        <div className="mt-4 space-y-2.5">
          {toggles.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onUpdateSettings({ [item.key]: !item.value })}
              className="w-full min-h-[60px] px-4 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 flex items-center justify-between gap-3 text-left transition cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0">{item.icon}</div>
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm sm:text-base text-white">
                    {item.label}
                  </div>
                  <div className="text-xs text-white/60 truncate">{item.description}</div>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-lg font-display font-bold text-xs tracking-wider shrink-0 ${
                  item.value
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35'
                    : 'bg-white/10 text-white/55 border border-white/10'
                }`}
              >
                {item.value ? 'ON' : 'OFF'}
              </span>
            </button>
          ))}
        </div>

        {/* Reset Saved Progress */}
        <div className="mt-5 pt-4 border-t border-white/10">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="w-full min-h-[44px] rounded-xl bg-white/[0.04] hover:bg-red-500/15 border border-white/10 hover:border-red-500/40 text-xs sm:text-sm font-semibold text-white/70 hover:text-red-300 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Saved Progress &amp; Unlocks</span>
            </button>
          ) : (
            <div className="rounded-xl bg-red-950/60 border border-red-500/50 p-3 space-y-2.5">
              <div className="text-xs text-red-200 text-center">
                Reset best speed, total distance, and unlocked motorcycles?
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-[40px] rounded-lg bg-white/10 hover:bg-white/16 text-xs font-bold text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResetProgress();
                    setConfirmReset(false);
                  }}
                  className="min-h-[40px] rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white cursor-pointer"
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
