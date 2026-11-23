import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Lock,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trophy,
  Upload,
  Volume2,
} from 'lucide-react';
import {
  BIKE_CATALOG,
  BikeSpec,
  getMilestoneProgress,
  isBikeUnlocked,
  isMilestoneMet,
  SaveData,
} from '../game/types';

interface BikeShopModalProps {
  mode: 'shop' | 'select';
  saveData: SaveData;
  previewBikeId: string;
  customGlbFiles: Record<string, string>;
  onSelectPreview: (bikeId: string) => void;
  onUnlockBike: (bike: BikeSpec) => void;
  onEquipBike: (bikeId: string) => void;
  onImportGlb: (bikeId: string, file: File) => Promise<void>;
  onResetGlb: (bikeId: string) => Promise<void>;
  onRotateShowroom: (deltaRad: number) => void;
  onSetShowroomDragging: (dragging: boolean) => void;
  onPlayNow: () => void;
  onSwitchMode: (mode: 'shop' | 'select') => void;
  onBack: () => void;
}

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export const BikeShopModal: React.FC<BikeShopModalProps> = ({
  mode,
  saveData,
  previewBikeId,
  customGlbFiles,
  onSelectPreview,
  onUnlockBike,
  onEquipBike,
  onImportGlb,
  onResetGlb,
  onRotateShowroom,
  onSetShowroomDragging,
  onPlayNow,
  onSwitchMode,
  onBack,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const lastDragXRef = useRef<number>(0);

  const [glbBusy, setGlbBusy] = useState(false);
  const [glbStatus, setGlbStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const bikesToList =
    mode === 'select'
      ? BIKE_CATALOG.filter((b) => isBikeUnlocked(b.id, saveData))
      : BIKE_CATALOG;

  const activeBike =
    bikesToList.find((b) => b.id === previewBikeId) ??
    BIKE_CATALOG.find((b) => b.id === previewBikeId) ??
    bikesToList[0] ??
    BIKE_CATALOG[0];

  const isUnlocked = isBikeUnlocked(activeBike.id, saveData);
  const isEquipped = saveData.equippedBikeId === activeBike.id;
  const milestoneReady = isMilestoneMet(activeBike, saveData);
  const progress = getMilestoneProgress(activeBike, saveData);
  const activeCustomGlbName = customGlbFiles[activeBike.id];
  const unlockedCount = saveData.settings.unlockAllBikes
    ? BIKE_CATALOG.length
    : saveData.unlockedBikeIds.length;

  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragPointerIdRef.current = e.pointerId;
    lastDragXRef.current = e.clientX;
    onSetShowroomDragging(true);
  };

  const handleViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragPointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - lastDragXRef.current;
    lastDragXRef.current = e.clientX;
    onRotateShowroom(dx * 0.011);
  };

  const handleViewportPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragPointerIdRef.current !== e.pointerId) return;
    dragPointerIdRef.current = null;
    onSetShowroomDragging(false);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setGlbBusy(true);
    setGlbStatus(null);
    try {
      await onImportGlb(activeBike.id, file);
      setGlbStatus({ type: 'ok', text: `Loaded 3D model: ${file.name}` });
    } catch (err) {
      setGlbStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not load GLB/GLTF file.',
      });
    } finally {
      setGlbBusy(false);
    }
  };

  const handleResetCustomModel = async () => {
    setGlbBusy(true);
    setGlbStatus(null);
    try {
      await onResetGlb(activeBike.id);
      setGlbStatus({ type: 'ok', text: 'Restored built-in 3D superbike model.' });
    } finally {
      setGlbBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between pointer-events-none">
      {/* Hidden native .glb/.gltf file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Compact Top Showroom Bar */}
      <header className="pointer-events-auto flex items-center justify-between gap-2.5 px-4 py-3 sm:px-6 bg-gradient-to-b from-[#0a101b]/92 via-[#0a101b]/65 to-transparent">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] min-w-[44px] px-3.5 rounded-xl bg-[#0e1422]/92 border border-white/15 hover:bg-white/18 active:scale-95 transition flex items-center gap-2 text-sm font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* Segmented Switch between Bike Selection & Bike Shop */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0e1422]/94 border border-white/15">
          <button
            type="button"
            onClick={() => onSwitchMode('select')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-display font-bold tracking-wide transition whitespace-nowrap cursor-pointer ${
              mode === 'select'
                ? 'bg-red-600 text-white'
                : 'text-white/70 hover:text-white'
            }`}
          >
            BIKE SELECTION
          </button>
          <button
            type="button"
            onClick={() => onSwitchMode('shop')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-display font-bold tracking-wide transition whitespace-nowrap cursor-pointer ${
              mode === 'shop'
                ? 'bg-red-600 text-white'
                : 'text-white/70 hover:text-white'
            }`}
          >
            SUPERBIKE SHOWROOM
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 min-h-[44px] px-3.5 rounded-xl bg-[#0e1422]/92 border border-white/15 text-xs font-display text-white/85 tabular-nums whitespace-nowrap">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>
            {unlockedCount}/{BIKE_CATALOG.length} Unlocked
          </span>
        </div>
      </header>

      {/* Interactive 360° Touch/Mouse Drag Viewport for Live 3D Motorcycle Inspection */}
      <div
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={handleViewportPointerUp}
        onPointerCancel={handleViewportPointerUp}
        className="pointer-events-auto flex-1 relative touch-none cursor-grab active:cursor-grabbing flex flex-col justify-between px-4 py-2"
      >
        <div className="flex items-start justify-between gap-2 pointer-events-none">
          {/* Reference photo preview badge for attached real-world bikes */}
          {activeBike.referenceImageUrl ? (
            <div className="hidden sm:flex items-center gap-2.5 p-1.5 pr-3 rounded-xl bg-[#0b101b]/88 border border-white/15">
              <img
                src={activeBike.referenceImageUrl}
                alt={activeBike.name}
                referrerPolicy="no-referrer"
                className="w-16 h-11 object-cover rounded-lg border border-white/10"
              />
              <div className="text-[11px] leading-tight">
                <div className="font-display font-bold text-white">{activeBike.brand}</div>
                <div className="text-white/60">Reference Photo</div>
              </div>
            </div>
          ) : (
            <div />
          )}

          {/* Custom GLB indicator badge when user uploaded a real GLB for this slot */}
          {activeCustomGlbName && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-950/90 border border-emerald-400/40 text-[11px] font-display font-semibold text-emerald-200 truncate max-w-[220px]">
              Custom GLB: {activeCustomGlbName}
            </div>
          )}
        </div>

        <div className="self-center pointer-events-none flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0b101b]/75 border border-white/12 text-[11px] text-white/75 font-medium">
          <RotateCw className="w-3.5 h-3.5 text-sky-400" />
          <span>Drag left or right to rotate 360°</span>
        </div>
      </div>

      {/* Bottom Showroom Specification, GLB Import & Progression Deck */}
      <section className="pointer-events-auto bg-[#0b101b]/95 border-t border-white/14 px-4 pt-3 pb-3.5 sm:px-6 sm:pt-4 sm:pb-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-white/10">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-white/65">
                <span className="font-semibold text-red-400">{activeBike.subtitle}</span>
                <span aria-hidden="true">·</span>
                <span className="font-display text-white/85">{activeBike.engineCc}</span>
                <span aria-hidden="true">·</span>
                <span className="font-display text-white/85">{activeBike.horsepower}</span>
                <span aria-hidden="true">·</span>
                <span className="font-display tabular-nums text-white/85">
                  {activeBike.weightKg} kg
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-sky-300 font-medium">
                  <Volume2 className="w-3.5 h-3.5" />
                  {activeBike.soundLabel}
                </span>
              </div>

              <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-white truncate">
                {activeBike.name}
              </h2>
              <p className="text-xs sm:text-sm text-white/65 mt-0.5 line-clamp-1">
                {activeBike.tagline}
              </p>

              {/* Performance Stat Bars */}
              <div className="mt-2 grid grid-cols-3 gap-3 max-w-md">
                {[
                  { label: `Top ${activeBike.topSpeedKmh} KM/H`, val: activeBike.statSpeed },
                  { label: 'Acceleration', val: activeBike.statAccel },
                  { label: 'Stability', val: activeBike.statStability },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className="flex items-center justify-between text-[11px] text-white/70 mb-1">
                      <span className="truncate">{stat.label}</span>
                      <span className="font-display font-bold tabular-nums text-white ml-1">
                        {stat.val}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/12 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-600 to-amber-400 transition-all duration-300"
                        style={{ width: `${stat.val}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Progression Milestone Bar (for locked bikes) */}
              {!isUnlocked && (
                <div className="mt-2.5 max-w-md">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-amber-300 font-semibold">{activeBike.unlock.label}</span>
                    <span className="font-display font-bold tabular-nums text-white/80">
                      {progress.text}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        milestoneReady ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {glbStatus && (
                <div
                  className={`mt-2 text-xs font-medium ${
                    glbStatus.type === 'ok' ? 'text-emerald-300' : 'text-red-300'
                  }`}
                >
                  {glbStatus.text}
                </div>
              )}
            </div>

            {/* Action Cluster: Custom GLB Import + Primary Select/Unlock/Ride Button */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={glbBusy}
                onClick={() => fileInputRef.current?.click()}
                title="Import a real .GLB or .GLTF 3D motorcycle model for this bike"
                className="min-h-[44px] px-3.5 rounded-xl bg-white/[0.08] hover:bg-white/15 border border-white/15 active:scale-[0.98] transition text-white/90 font-display font-semibold text-xs tracking-wider flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>{activeCustomGlbName ? 'REPLACE .GLB' : 'IMPORT .GLB'}</span>
              </button>

              {activeCustomGlbName && (
                <button
                  type="button"
                  disabled={glbBusy}
                  onClick={handleResetCustomModel}
                  title="Restore built-in 3D model"
                  className="min-h-[44px] px-3 rounded-xl bg-white/[0.05] hover:bg-red-500/20 border border-white/12 text-white/75 hover:text-red-200 transition text-xs font-display font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>RESET 3D</span>
                </button>
              )}

              {isEquipped ? (
                <button
                  type="button"
                  onClick={onPlayNow}
                  className="min-h-[48px] px-6 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] transition text-white font-display font-bold text-sm sm:text-base tracking-wider flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-lg shadow-red-600/25"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>RIDE THIS BIKE</span>
                </button>
              ) : isUnlocked ? (
                <button
                  type="button"
                  onClick={() => onEquipBike(activeBike.id)}
                  className="min-h-[48px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition text-white font-display font-bold text-sm sm:text-base tracking-wider flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>SELECT BIKE</span>
                </button>
              ) : milestoneReady ? (
                <button
                  type="button"
                  onClick={() => onUnlockBike(activeBike)}
                  className="min-h-[48px] px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] transition text-neutral-950 font-display font-bold text-sm sm:text-base tracking-wider flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-lg shadow-emerald-500/25"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>UNLOCK BIKE</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPlayNow}
                  className="min-h-[48px] px-5 rounded-xl bg-white/10 hover:bg-white/16 transition text-white/85 font-display font-bold text-xs sm:text-sm tracking-wider flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>RIDE TO UNLOCK</span>
                </button>
              )}
            </div>
          </div>

          {/* Horizontal 10-Motorcycle Real-World Collection Strip */}
          <div className="shop-scroll mt-3 flex gap-2.5 overflow-x-auto pb-1">
            {bikesToList.map((bike) => {
              const unlocked = isBikeUnlocked(bike.id, saveData);
              const equipped = saveData.equippedBikeId === bike.id;
              const selected = activeBike.id === bike.id;
              const ready = !unlocked && isMilestoneMet(bike, saveData);
              const hasCustomGlb = Boolean(customGlbFiles[bike.id]);

              return (
                <button
                  key={bike.id}
                  type="button"
                  onClick={() => {
                    setGlbStatus(null);
                    onSelectPreview(bike.id);
                  }}
                  className={`min-w-[162px] sm:min-w-[180px] text-left rounded-xl p-2.5 border transition cursor-pointer shrink-0 ${
                    selected
                      ? 'bg-white/14 border-red-500'
                      : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {bike.referenceImageUrl ? (
                        <img
                          src={bike.referenceImageUrl}
                          alt={bike.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-5 object-cover rounded border border-white/20"
                        />
                      ) : (
                        <span
                          className="w-7 h-2.5 rounded-sm border border-white/25"
                          style={{
                            background: `linear-gradient(90deg, ${hexToCss(bike.primaryColor)} 60%, ${hexToCss(bike.accentColor)} 100%)`,
                          }}
                        />
                      )}
                      {hasCustomGlb && (
                        <span className="text-[9px] font-display font-bold px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/35">
                          GLB
                        </span>
                      )}
                    </div>
                    <span className="font-display font-bold text-[11px] tabular-nums text-white/80">
                      {bike.topSpeedKmh} KM/H
                    </span>
                  </div>

                  <div className="mt-1.5 font-display font-bold text-sm text-white truncate">
                    {bike.name}
                  </div>

                  <div className="mt-1 flex items-center justify-between text-xs">
                    {equipped ? (
                      <span className="text-emerald-400 font-semibold">Selected</span>
                    ) : unlocked ? (
                      <span className="text-sky-300 font-medium">Unlocked</span>
                    ) : ready ? (
                      <span className="text-emerald-300 font-semibold">Ready to Unlock</span>
                    ) : (
                      <span className="text-amber-300/90 font-medium truncate">
                        {bike.unlock.label}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
