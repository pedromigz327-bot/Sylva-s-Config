import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TelemetryStats } from '../types';
import { playClickTick, playHitSound } from '../utils/sound';

interface CpsTesterProps {
  telemetry: TelemetryStats;
  onUpdateTelemetry: (partial: Partial<TelemetryStats>) => void;
  onNavigateToAi: () => void;
  soundEnabled: boolean;
}

type ClickButtonMode = 'left_pvp' | 'right_bridge';
type TestPhase = 'READY' | 'RUNNING' | 'COOLDOWN' | 'FINISHED';

interface CpsSessionRecord {
  id: number;
  buttonType: string;
  technique: string;
  durationSec: number;
  avgCps: number;
  peakCps: number;
  consistencyPct: number;
  jitterPx: number;
  timestamp: string;
}

export const CpsTester: React.FC<CpsTesterProps> = ({
  onUpdateTelemetry,
  onNavigateToAi,
  soundEnabled,
}) => {
  const [buttonMode, setButtonMode] = useState<ClickButtonMode>('left_pvp');
  const [durationSec, setDurationSec] = useState<number>(10);
  const [technique, setTechnique] = useState<string>('Butterfly Click');
  const [phase, setPhase] = useState<TestPhase>('READY');

  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [clickCount, setClickCount] = useState<number>(0);
  const [liveCps, setLiveCps] = useState<number>(0);
  const [peakCps, setPeakCps] = useState<number>(0);
  const [consistencyPct, setConsistencyPct] = useState<number>(100);
  const [aimJitterPx, setAimJitterPx] = useState<number>(0);
  const [records, setRecords] = useState<CpsSessionRecord[]>([]);

  const startTimeRef = useRef<number>(0);
  const clickTimestampsRef = useRef<number[]>([]);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const totalJitterDistanceRef = useRef<number>(0);
  const peakCpsRef = useRef<number>(0);
  const clickCountRef = useRef<number>(0);

  const finalizeTest = useCallback(() => {
    setPhase('COOLDOWN');
    const totalClicks = clickCountRef.current;
    const finalAvgCps = Number((totalClicks / durationSec).toFixed(1));
    const finalPeak = Number(peakCpsRef.current.toFixed(1));

    // Calculate inter-click interval consistency
    const stamps = clickTimestampsRef.current;
    let calcConsistency = 92;
    if (stamps.length > 2) {
      const intervals: number[] = [];
      for (let i = 1; i < stamps.length; i++) {
        intervals.push(stamps[i] - stamps[i - 1]);
      }
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance =
        intervals.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      const cv = mean > 0 ? stdDev / mean : 0;
      calcConsistency = Math.max(35, Math.min(99, Math.round((1 - cv * 0.55) * 100)));
    }

    const avgJitterPerClick =
      totalClicks > 0 ? Number((totalJitterDistanceRef.current / totalClicks).toFixed(1)) : 0;

    setLiveCps(finalAvgCps);
    setPeakCps(finalPeak);
    setConsistencyPct(calcConsistency);
    setAimJitterPx(avgJitterPerClick);

    playHitSound(soundEnabled, 5);

    if (buttonMode === 'left_pvp') {
      onUpdateTelemetry({
        leftCps: finalAvgCps,
        peakLeftCps: finalPeak,
        clickConsistency: calcConsistency,
        aimJitterPx: avgJitterPerClick,
      });
    } else {
      onUpdateTelemetry({
        rightCps: finalAvgCps,
        clickConsistency: calcConsistency,
        aimJitterPx: avgJitterPerClick,
      });
    }

    setRecords((prev) => [
      {
        id: Date.now(),
        buttonType: buttonMode === 'left_pvp' ? 'Esquerdo (PvP)' : 'Direito (Bridge)',
        technique,
        durationSec,
        avgCps: finalAvgCps,
        peakCps: finalPeak,
        consistencyPct: calcConsistency,
        jitterPx: avgJitterPerClick,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
      ...prev.slice(0, 7),
    ]);

    window.setTimeout(() => {
      setPhase('FINISHED');
    }, 650);
  }, [buttonMode, durationSec, onUpdateTelemetry, soundEnabled, technique]);

  useEffect(() => {
    if (phase !== 'RUNNING') return;

    const interval = window.setInterval(() => {
      const now = performance.now();
      const elapsed = (now - startTimeRef.current) / 1000;

      if (elapsed >= durationSec) {
        window.clearInterval(interval);
        setElapsedSec(durationSec);
        finalizeTest();
        return;
      }

      setElapsedSec(Number(elapsed.toFixed(1)));

      // Rolling 1-second window CPS for realistic live & peak CPS
      const oneSecAgo = now - 1000;
      const recentClicks = clickTimestampsRef.current.filter((t) => t >= oneSecAgo).length;
      const instantCps = elapsed < 1 ? Number((clickCountRef.current / Math.max(0.2, elapsed)).toFixed(1)) : recentClicks;

      if (instantCps > peakCpsRef.current) {
        peakCpsRef.current = instantCps;
        setPeakCps(instantCps);
      }
      setLiveCps(instantCps);
    }, 60);

    return () => window.clearInterval(interval);
  }, [phase, durationSec, finalizeTest]);

  const resetTest = () => {
    setPhase('READY');
    setElapsedSec(0);
    setClickCount(0);
    setLiveCps(0);
    setPeakCps(0);
    setAimJitterPx(0);
    clickTimestampsRef.current = [];
    lastMousePosRef.current = null;
    totalJitterDistanceRef.current = 0;
    peakCpsRef.current = 0;
    clickCountRef.current = 0;
  };

  const handlePadMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (phase === 'COOLDOWN' || phase === 'FINISHED') return;

    // Validate if user clicked the intended button (or allow touch/any if needed)
    const isRight = e.button === 2;
    if (buttonMode === 'right_bridge' && e.button !== 2 && e.button !== 0) return;

    const now = performance.now();

    if (phase === 'READY') {
      startTimeRef.current = now;
      clickTimestampsRef.current = [now];
      clickCountRef.current = 1;
      peakCpsRef.current = 1;
      totalJitterDistanceRef.current = 0;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      setClickCount(1);
      setLiveCps(1);
      setPeakCps(1);
      setPhase('RUNNING');
      playClickTick(soundEnabled, isRight);
      return;
    }

    if (phase === 'RUNNING') {
      clickTimestampsRef.current.push(now);
      clickCountRef.current += 1;
      setClickCount(clickCountRef.current);
      playClickTick(soundEnabled, isRight);

      if (lastMousePosRef.current) {
        const dx = e.clientX - lastMousePosRef.current.x;
        const dy = e.clientY - lastMousePosRef.current.y;
        const dist = Math.hypot(dx, dy);
        totalJitterDistanceRef.current += dist;
        setAimJitterPx(
          Number((totalJitterDistanceRef.current / clickCountRef.current).toFixed(1))
        );
      }
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePadMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (phase !== 'RUNNING') return;
    if (lastMousePosRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      totalJitterDistanceRef.current += Math.hypot(dx, dy) * 0.35;
    }
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const progressPct = Math.min(100, (elapsedSec / durationSec) * 100);

  return (
    <div className="space-y-8">
      {/* Header & Button Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div>
          <p className="text-xs text-slate-400 mb-1">
            Analisador de Frequência de Cliques · Sensor de Tremor de Mira (Aim Jitter) · PvP & Pontes
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-100">
            03. Teste de CPS & Estabilidade de Clique
          </h1>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setButtonMode('left_pvp');
              resetTest();
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              buttonMode === 'left_pvp'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Botão Esquerdo (PvP / Combo)
          </button>
          <button
            type="button"
            onClick={() => {
              setButtonMode('right_bridge');
              resetTest();
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              buttonMode === 'right_bridge'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Botão Direito (Godbridge / Pontes)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Interactive Click Pad & Live Telemetry (8 cols) */}
        <div className="xl:col-span-8 space-y-4">
          {/* 4-Column Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono tabular-nums">
            <div>
              <span className="text-xs font-sans text-slate-400 block">CPS Atual / Médio</span>
              <span className="text-2xl font-semibold text-emerald-400">{liveCps} CPS</span>
            </div>
            <div>
              <span className="text-xs font-sans text-slate-400 block">Pico Máximo</span>
              <span className="text-2xl font-semibold text-slate-100">{peakCps} CPS</span>
            </div>
            <div>
              <span className="text-xs font-sans text-slate-400 block">Tremor da Mira</span>
              <span
                className={`text-2xl font-semibold ${
                  aimJitterPx <= 3.5 ? 'text-emerald-400' : aimJitterPx <= 8 ? 'text-amber-400' : 'text-red-400'
                }`}
              >
                {aimJitterPx} px
              </span>
            </div>
            <div>
              <span className="text-xs font-sans text-slate-400 block">Ritmo / Consistência</span>
              <span className="text-2xl font-semibold text-slate-100">{consistencyPct}%</span>
            </div>
          </div>

          {/* Click Pad Surface */}
          <div
            onMouseDown={handlePadMouseDown}
            onMouseMove={handlePadMouseMove}
            onContextMenu={(e) => e.preventDefault()}
            className={`relative w-full min-h-[360px] rounded-xl border select-none flex flex-col items-center justify-center p-8 text-center transition-colors ${
              phase === 'RUNNING'
                ? 'bg-slate-900/90 border-emerald-500/80 cursor-crosshair'
                : phase === 'FINISHED'
                ? 'bg-slate-900 border-slate-700'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700 cursor-pointer'
            }`}
          >
            {/* Top Progress Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-950 rounded-t-xl overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-transform duration-75 origin-left"
                style={{ transform: `scaleX(${progressPct / 100})` }}
              />
            </div>

            {phase === 'READY' && (
              <div className="max-w-md space-y-3">
                <p className="text-xs font-mono text-emerald-400">
                  {buttonMode === 'left_pvp'
                    ? `Modo Ataque · ${technique} · ${durationSec} segundos`
                    : `Modo Construção de Pontes · Botão Direito · ${durationSec} segundos`}
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold text-slate-100">
                  {buttonMode === 'left_pvp'
                    ? 'Clique Aqui para Iniciar o Teste de CPS'
                    : 'Clique com o Botão Direito (ou Esquerdo) para Iniciar'}
                </h2>
                <p className="text-sm text-slate-400">
                  Mantenha o cursor o mais firme possível no centro enquanto clica. Mediremos tanto a velocidade de cliques quanto o tremor da mira em pixels.
                </p>
              </div>
            )}

            {phase === 'RUNNING' && (
              <div className="space-y-3 pointer-events-none">
                <p className="text-xs font-mono tabular-nums text-emerald-400">
                  Tempo: {(durationSec - elapsedSec).toFixed(1)}s restantes
                </p>
                <div className="text-6xl font-bold font-mono tabular-nums text-white">
                  {clickCount}
                </div>
                <p className="text-sm text-slate-300">
                  Cliques Registrados · Mantenha a Mira Estável no Alvo Central
                </p>
              </div>
            )}

            {phase === 'COOLDOWN' && (
              <div className="space-y-2">
                <p className="text-sm font-mono text-amber-400">Calculando telemetria de cliques...</p>
              </div>
            )}

            {phase === 'FINISHED' && (
              <div className="max-w-lg w-full space-y-5">
                <div>
                  <p className="text-xs font-mono text-emerald-400 mb-1">
                    Teste de {durationSec}s Concluído · {technique}
                  </p>
                  <h2 className="text-3xl font-bold font-mono tabular-nums text-white">
                    {liveCps} CPS <span className="text-base font-normal text-slate-400">(Pico: {peakCps} CPS)</span>
                  </h2>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {aimJitterPx > 6
                    ? `Atenção: Seu tremor de mira foi de ${aimJitterPx}px por clique. No Bedwars 1.8.9, isso pode tirar sua mira da hitbox em disputas a 2.9 blocos. Use o Painel IA para calibrar sua sensibilidade.`
                    : `Excelente controle motor! Seu tremor de mira foi de apenas ${aimJitterPx}px por clique com ${consistencyPct}% de estabilidade de ritmo.`}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetTest();
                    }}
                    className="px-5 py-2.5 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Repetir Teste de CPS
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToAi();
                    }}
                    className="px-5 py-2.5 text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Otimizar Cliques com IA
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Configuration & History (4 cols) */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
            <h2 className="text-base font-semibold text-slate-100">
              Configuração da Baterias de CPS
            </h2>

            {/* Duration Selector */}
            <div className="space-y-1.5">
              <span className="text-xs text-slate-300 font-medium block">Janela de Tempo</span>
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                {[1, 5, 10, 15].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => {
                      setDurationSec(sec);
                      resetTest();
                    }}
                    className={`py-1.5 text-xs font-mono tabular-nums font-medium rounded transition-colors whitespace-nowrap ${
                      durationSec === sec
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>

            {/* Click Technique Selector */}
            <div className="space-y-1.5">
              <label htmlFor="click-tech-select" className="text-xs text-slate-300 font-medium block">
                Técnica de Clique Utilizada
              </label>
              <select
                id="click-tech-select"
                value={technique}
                onChange={(e) => setTechnique(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="Normal Click">Normal Click (6–9 CPS · Alta Precisão)</option>
                <option value="Butterfly Click">Butterfly Click (12–20 CPS · Redução de KB)</option>
                <option value="Jitter Click">Jitter Click (11–15 CPS · Vibração de Braço)</option>
                <option value="Drag Click">Drag Click (20+ CPS · Godbridge / Clutch)</option>
                <option value="Toque Mobile (Split)">Toque Mobile / PojavLauncher</option>
              </select>
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-2 text-xs text-slate-400">
              <p className="font-semibold text-slate-200">Por que o CPS importa na 1.8.9?</p>
              <p className="leading-relaxed">
                No Minecraft 1.8.9, cada pacote de ataque enviado contra um jogador reduz sua velocidade horizontal em <strong>40% (fator 0.6x)</strong>. Manter 12+ CPS reduz o knockback recebido e facilita combos, desde que o tremor da mira fique abaixo de 5px.
              </p>
            </div>
          </div>

          {/* Session History */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-100 mb-3">
              Histórico de Cliques
            </h3>
            {records.length === 0 ? (
              <p className="text-xs text-slate-400">
                Complete um teste de 1s, 5s ou 10s para comparar seu CPS e tremor de mira.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 font-medium">Técnica</th>
                      <th className="py-2 font-medium text-right">CPS</th>
                      <th className="py-2 font-medium text-right">Tremor</th>
                      <th className="py-2 font-medium text-right">Ritmo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                    {records.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/30">
                        <td className="py-2 font-sans text-slate-200 truncate max-w-[125px]">
                          {r.technique}
                        </td>
                        <td className="py-2 text-right text-emerald-400 font-semibold">
                          {r.avgCps}
                        </td>
                        <td className="py-2 text-right text-slate-300">{r.jitterPx}px</td>
                        <td className="py-2 text-right text-slate-400">{r.consistencyPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
