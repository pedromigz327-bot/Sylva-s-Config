import React, { useState } from 'react';
import { ActiveTab, HardwareProfile, TelemetryStats } from './types';
import { AimTrainer189 } from './components/AimTrainer189';
import { ReactionTrainer } from './components/ReactionTrainer';
import { CpsTester } from './components/CpsTester';
import { DpiFinder } from './components/DpiFinder';
import { BedwarsAiPanel } from './components/BedwarsAiPanel';
import { calculateCmPer360 } from './utils/mcMath';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('aim');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const [hardware, setHardware] = useState<HardwareProfile>({
    deviceType: 'Computador (PC / Notebook)',
    cpuModel: 'AMD Ryzen 5 / Intel Core i5',
    cpuCores: 8,
    ramGb: 16,
    gpuModel: 'NVIDIA GeForce GTX / RTX Series',
    resolution: '1920x1080',
    refreshRateHz: 144,
    mouseOrTouchModel: 'Mouse Gamer Óptico (~65g)',
    pollingRateHz: 1000,
    currentDpi: 800,
    currentMcSens: 50,
    clickTechnique: 'Butterfly Click (12-20 CPS)',
    playstyle: 'Rusher / First-Rush',
    mcClient: 'Lunar Client 1.8.9 (OptiFine)',
  });

  const [telemetry, setTelemetry] = useState<TelemetryStats>({
    aimAccuracy: null,
    trackingScore: null,
    aimBias: 'Equilibrada',
    avgReachBlocks: null,
    reactionTimeMs: null,
    bestReactionMs: null,
    leftCps: null,
    peakLeftCps: null,
    rightCps: null,
    clickConsistency: null,
    aimJitterPx: null,
    calibratedDpi: 800,
    recommendedMcSens: 50,
  });

  const updateTelemetry = (partial: Partial<TelemetryStats>) => {
    setTelemetry((prev) => ({ ...prev, ...partial }));
  };

  const updateHardware = (partial: Partial<HardwareProfile>) => {
    setHardware((prev) => ({ ...prev, ...partial }));
  };

  const handleDpiChange = (newDpi: number) => {
    updateHardware({ currentDpi: newDpi });
    updateTelemetry({ calibratedDpi: newDpi });
  };

  const handleMcSensChange = (newSens: number) => {
    updateHardware({ currentMcSens: newSens });
    updateTelemetry({ recommendedMcSens: newSens });
  };

  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'aim', label: 'Mira 1.8.9' },
    { id: 'reaction', label: 'Reação & Reflexo' },
    { id: 'cps', label: 'Teste de CPS' },
    { id: 'dpi', label: 'DPI Finder' },
    { id: 'ai-optimizer', label: 'Painel IA Bedwars' },
  ];

  const cm360 = calculateCmPer360(hardware.currentDpi, hardware.currentMcSens);

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F17] text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800/90 bg-[#0B0F17]">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('aim');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 font-display whitespace-nowrap"
        >
          BedwarsLab 1.8.9
        </a>

        {/* Zone 2: 5 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1 transition-colors whitespace-nowrap cursor-pointer border-b-2 ${
                  isActive
                    ? 'text-emerald-400 border-emerald-400 font-semibold'
                    : 'text-slate-400 border-transparent hover:text-slate-100 hover:border-slate-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSoundEnabled((s) => !s)}
            className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Som: {soundEnabled ? 'Ativo' : 'Mudo'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai-optimizer')}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Otimizar Setup com IA
          </button>
        </div>
      </header>

      {/* Mobile Navigation Strip */}
      <div className="flex md:hidden items-center gap-2 overflow-x-auto px-4 py-2.5 border-b border-slate-800 bg-slate-950">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Subtle Contextual Unboxed Telemetry Kicker */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 mb-6 border-b border-slate-800/60 text-xs text-slate-400 font-mono tabular-nums">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-sans text-slate-300 font-medium">Perfil Ativo:</span>
            <span>{hardware.currentDpi} DPI</span>
            <span aria-hidden="true">·</span>
            <span>Sens MC 1.8.9: {hardware.currentMcSens}%</span>
            <span aria-hidden="true">·</span>
            <span>Giro: {cm360} cm/360°</span>
            <span aria-hidden="true">·</span>
            <span className="font-sans">{hardware.deviceType}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span>
              Mira: <strong className="text-slate-200">{telemetry.aimAccuracy !== null ? `${telemetry.aimAccuracy}%` : '—'}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Reação: <strong className="text-slate-200">{telemetry.reactionTimeMs !== null ? `${telemetry.reactionTimeMs}ms` : '—'}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              CPS: <strong className="text-slate-200">{telemetry.leftCps !== null ? `${telemetry.leftCps}` : '—'}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Tremor: <strong className="text-slate-200">{telemetry.aimJitterPx !== null ? `${telemetry.aimJitterPx}px` : '—'}</strong>
            </span>
          </div>
        </div>

        {/* Active Module Viewport */}
        {activeTab === 'aim' && (
          <AimTrainer189
            telemetry={telemetry}
            onUpdateTelemetry={updateTelemetry}
            onNavigateToAi={() => setActiveTab('ai-optimizer')}
            soundEnabled={soundEnabled}
            dpi={hardware.currentDpi}
            mcSens={hardware.currentMcSens}
            onChangeMcSens={handleMcSensChange}
          />
        )}

        {activeTab === 'reaction' && (
          <ReactionTrainer
            telemetry={telemetry}
            onUpdateTelemetry={updateTelemetry}
            onNavigateToAi={() => setActiveTab('ai-optimizer')}
            soundEnabled={soundEnabled}
          />
        )}

        {activeTab === 'cps' && (
          <CpsTester
            telemetry={telemetry}
            onUpdateTelemetry={updateTelemetry}
            onNavigateToAi={() => setActiveTab('ai-optimizer')}
            soundEnabled={soundEnabled}
          />
        )}

        {activeTab === 'dpi' && (
          <DpiFinder
            telemetry={telemetry}
            onUpdateTelemetry={updateTelemetry}
            onNavigateToAi={() => setActiveTab('ai-optimizer')}
            soundEnabled={soundEnabled}
            dpi={hardware.currentDpi}
            onChangeDpi={handleDpiChange}
            mcSens={hardware.currentMcSens}
            onChangeMcSens={handleMcSensChange}
          />
        )}

        {activeTab === 'ai-optimizer' && (
          <BedwarsAiPanel
            telemetry={telemetry}
            hardware={hardware}
            onUpdateHardware={updateHardware}
            onNavigateTab={setActiveTab}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-6 text-xs text-slate-500">
        <div className="max-w-[1320px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            BedwarsLab 1.8.9 · Calibração de Mira, Velocidade de Reação, CPS, DPI Finder & Otimizador com IA
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('aim')}
              className="hover:text-slate-300 transition-colors"
            >
              Arena 1.8.9
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('dpi')}
              className="hover:text-slate-300 transition-colors"
            >
              Calculadora cm/360°
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('ai-optimizer')}
              className="hover:text-slate-300 transition-colors"
            >
              Painel IA
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
