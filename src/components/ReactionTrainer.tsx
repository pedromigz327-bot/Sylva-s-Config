import React, { useState, useRef, useEffect } from 'react';
import { TelemetryStats } from '../types';
import { playReactionCue, playHitSound, playMissSound } from '../utils/sound';

interface ReactionTrainerProps {
  telemetry: TelemetryStats;
  onUpdateTelemetry: (partial: Partial<TelemetryStats>) => void;
  onNavigateToAi: () => void;
  soundEnabled: boolean;
}

type ReactionMode = 'visual_pure' | 'spatial_clutch';
type TestStage = 'IDLE' | 'WAITING' | 'CUE_ACTIVE' | 'TOO_EARLY' | 'ROUND_RESULT' | 'SERIES_SUMMARY';

interface ReactionAttempt {
  attemptNumber: number;
  mode: string;
  timeMs: number;
  rating: string;
  timestamp: string;
}

export const ReactionTrainer: React.FC<ReactionTrainerProps> = ({
  onUpdateTelemetry,
  onNavigateToAi,
  soundEnabled,
}) => {
  const [mode, setMode] = useState<ReactionMode>('visual_pure');
  const [stage, setStage] = useState<TestStage>('IDLE');
  const [currentSeries, setCurrentSeries] = useState<number[]>([]);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [history, setHistory] = useState<ReactionAttempt[]>([]);
  const [targetCoord, setTargetCoord] = useState<{ xPct: number; yPct: number }>({ xPct: 50, yPct: 50 });

  const timeoutRef = useRef<number | null>(null);
  const cueTimestampRef = useRef<number>(0);

  const clearTimer = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const getRatingLabel = (ms: number, currentMode: ReactionMode) => {
    const thresholdOffset = currentMode === 'spatial_clutch' ? 140 : 0;
    if (ms < 175 + thresholdOffset) return 'Elite (Hit-Select Perfeito)';
    if (ms < 210 + thresholdOffset) return 'Competitivo (Ranked 1.8.9)';
    if (ms < 255 + thresholdOffset) return 'Consistente (Padrão PvP)';
    return 'Em Calibração';
  };

  const triggerWaitingPhase = () => {
    clearTimer();
    setStage('WAITING');
    const randomDelay = 1400 + Math.random() * 2600;

    timeoutRef.current = window.setTimeout(() => {
      if (mode === 'spatial_clutch') {
        setTargetCoord({
          xPct: 18 + Math.random() * 64,
          yPct: 22 + Math.random() * 56,
        });
      }
      cueTimestampRef.current = performance.now();
      setStage('CUE_ACTIVE');
      playReactionCue(soundEnabled);
    }, randomDelay);
  };

  const startNewSeries = () => {
    setCurrentSeries([]);
    setLastMs(null);
    triggerWaitingPhase();
  };

  const recordValidReaction = (measuredMs: number) => {
    playHitSound(soundEnabled, 2);
    setLastMs(measuredMs);

    const updatedSeries = [...currentSeries, measuredMs];
    setCurrentSeries(updatedSeries);

    const rating = getRatingLabel(measuredMs, mode);
    setHistory((prev) => [
      {
        attemptNumber: prev.length + 1,
        mode: mode === 'visual_pure' ? 'Reflexo Visual Puro' : 'Clutch & Aquisição Espacial',
        timeMs: measuredMs,
        rating,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
      ...prev.slice(0, 9),
    ]);

    const avg = Math.round(updatedSeries.reduce((a, b) => a + b, 0) / updatedSeries.length);
    const best = Math.min(...updatedSeries);

    onUpdateTelemetry({
      reactionTimeMs: avg,
      bestReactionMs: best,
    });

    if (updatedSeries.length >= 5) {
      setStage('SERIES_SUMMARY');
    } else {
      setStage('ROUND_RESULT');
    }
  };

  const handleArenaMouseDown = () => {
    if (stage === 'IDLE' || stage === 'SERIES_SUMMARY') {
      startNewSeries();
      return;
    }

    if (stage === 'WAITING') {
      clearTimer();
      playMissSound(soundEnabled);
      setStage('TOO_EARLY');
      return;
    }

    if (stage === 'TOO_EARLY' || stage === 'ROUND_RESULT') {
      triggerWaitingPhase();
      return;
    }

    if (stage === 'CUE_ACTIVE' && mode === 'visual_pure') {
      const elapsed = Math.max(80, Math.round(performance.now() - cueTimestampRef.current));
      recordValidReaction(elapsed);
    }
  };

  const handleSpatialTargetMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (stage === 'CUE_ACTIVE' && mode === 'spatial_clutch') {
      const elapsed = Math.max(110, Math.round(performance.now() - cueTimestampRef.current));
      recordValidReaction(elapsed);
    }
  };

  const seriesAvg =
    currentSeries.length > 0
      ? Math.round(currentSeries.reduce((a, b) => a + b, 0) / currentSeries.length)
      : null;

  const seriesBest = currentSeries.length > 0 ? Math.min(...currentSeries) : null;

  const seriesStdDev =
    currentSeries.length > 1 && seriesAvg !== null
      ? Math.round(
          Math.sqrt(
            currentSeries.reduce((acc, v) => acc + Math.pow(v - seriesAvg, 2), 0) /
              currentSeries.length
          )
        )
      : null;

  return (
    <div className="space-y-8">
      {/* Header & Mode Selector */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div>
          <p className="text-xs text-slate-400 mb-1">
            Cronômetro de Alta Precisão (Sub-Milissegundo) · Janela de Tick 1.8.9 (50ms / Tick)
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-100">
            02. Velocidade de Reação & Reflexo de Clutch
          </h1>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => {
              clearTimer();
              setMode('visual_pure');
              setStage('IDLE');
              setCurrentSeries([]);
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              mode === 'visual_pure'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Reflexo Visual Puro (Sinal)
          </button>
          <button
            type="button"
            onClick={() => {
              clearTimer();
              setMode('spatial_clutch');
              setStage('IDLE');
              setCurrentSeries([]);
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              mode === 'spatial_clutch'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Reflexo + Flick (Alvo Súbito)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Interactive Reaction Pad (8 cols) */}
        <div className="xl:col-span-8 space-y-4">
          <div
            onMouseDown={handleArenaMouseDown}
            className={`relative w-full min-h-[430px] rounded-xl border transition-colors select-none flex flex-col items-center justify-center p-8 text-center cursor-pointer ${
              stage === 'WAITING'
                ? 'bg-red-950/55 border-red-800/80 text-red-100'
                : stage === 'CUE_ACTIVE'
                ? 'bg-emerald-950/70 border-emerald-500 text-emerald-50'
                : stage === 'TOO_EARLY'
                ? 'bg-amber-950/60 border-amber-700 text-amber-100'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-100'
            }`}
          >
            {/* Top Status Strip inside Arena */}
            <div className="absolute top-4 left-5 right-5 flex items-center justify-between text-xs font-mono tabular-nums text-slate-400">
              <span>Progresso da Série: {currentSeries.length} / 5</span>
              <span>
                {seriesAvg !== null ? `Média Atual: ${seriesAvg} ms` : 'Aguardando 1ª tentativa'}
              </span>
            </div>

            {stage === 'IDLE' && (
              <div className="max-w-lg space-y-4">
                <p className="text-xs font-mono text-emerald-400">
                  {mode === 'visual_pure'
                    ? 'Modo 01 · Latência Neuromuscular Pura'
                    : 'Modo 02 · Reação + Deslocamento de Cursor'}
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold">
                  {mode === 'visual_pure'
                    ? 'Clique para Iniciar a Série de 5 Disparos'
                    : 'Clique para Iniciar o Reflexo de Aquisição'}
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {mode === 'visual_pure'
                    ? 'Assim que o painel mudar do estado de espera (vermelho) para o sinal verde de ação, clique com o botão esquerdo o mais rápido possível.'
                    : 'Aguarde o sinal e clique exatamente sobre o bloco tático assim que ele surgir em posição aleatória na arena.'}
                </p>
                <div className="pt-2">
                  <span className="inline-block px-5 py-2.5 text-sm font-semibold bg-emerald-500 text-slate-950 rounded-lg">
                    Começar Teste de Reação
                  </span>
                </div>
              </div>
            )}

            {stage === 'WAITING' && (
              <div className="space-y-2">
                <p className="text-xs font-mono uppercase tracking-wider text-red-300">
                  Atenção · Mantenha o Dedo Pronto
                </p>
                <h2 className="text-3xl font-semibold text-white">
                  Aguarde o Sinal Verde...
                </h2>
                <p className="text-xs text-red-200/80">
                  Não clique antes da mudança de estado.
                </p>
              </div>
            )}

            {stage === 'CUE_ACTIVE' && mode === 'visual_pure' && (
              <div className="space-y-2">
                <p className="text-xs font-mono text-emerald-300">SINAL ATIVO</p>
                <h2 className="text-4xl sm:text-5xl font-bold text-white">
                  CLIQUE AGORA!
                </h2>
              </div>
            )}

            {stage === 'CUE_ACTIVE' && mode === 'spatial_clutch' && (
              <>
                <p className="text-xs font-mono text-emerald-300 pointer-events-none">
                  ACERTE O ALVO TÁTICO!
                </p>
                <button
                  type="button"
                  onMouseDown={handleSpatialTargetMouseDown}
                  style={{
                    left: `${targetCoord.xPct}%`,
                    top: `${targetCoord.yPct}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-lg bg-emerald-400 hover:bg-emerald-300 border-2 border-white shadow-lg flex flex-col items-center justify-center text-slate-950 font-mono font-bold text-xs cursor-crosshair"
                >
                  <span>CLUTCH</span>
                  <span className="text-[10px]">1.8.9</span>
                </button>
              </>
            )}

            {stage === 'TOO_EARLY' && (
              <div className="space-y-3">
                <p className="text-xs font-mono text-amber-300">QUEIMA DE LARGADA</p>
                <h2 className="text-2xl sm:text-3xl font-semibold text-white">
                  Você clicou antes do sinal!
                </h2>
                <p className="text-sm text-amber-200/80">
                  No Bedwars 1.8.9, clicar cedo demais gera penalidade de hit-delay de 10 ticks. Clique para tentar novamente.
                </p>
              </div>
            )}

            {stage === 'ROUND_RESULT' && lastMs !== null && (
              <div className="space-y-3">
                <p className="text-xs font-mono text-emerald-400">
                  Disparo {currentSeries.length} de 5 Registrado
                </p>
                <div className="text-5xl font-bold font-mono tabular-nums text-white">
                  {lastMs} <span className="text-2xl font-normal text-slate-400">ms</span>
                </div>
                <p className="text-sm text-slate-300">
                  Classificação: <strong className="text-emerald-400">{getRatingLabel(lastMs, mode)}</strong> · Equivalente a{' '}
                  <span className="font-mono tabular-nums">{(lastMs / 50).toFixed(1)} ticks</span> do servidor
                </p>
                <p className="text-xs text-slate-400 pt-2">
                  Clique em qualquer lugar para o próximo disparo ({5 - currentSeries.length} restantes)
                </p>
              </div>
            )}

            {stage === 'SERIES_SUMMARY' && seriesAvg !== null && (
              <div className="max-w-lg w-full space-y-5">
                <div>
                  <p className="text-xs font-mono text-emerald-400 mb-1">
                    Série de 5 Tentativas Finalizada
                  </p>
                  <h2 className="text-2xl font-semibold text-white">
                    Média Final: <span className="font-mono tabular-nums text-emerald-400">{seriesAvg} ms</span>
                  </h2>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-slate-950/90 border border-slate-800 rounded-lg p-4 text-left font-mono tabular-nums">
                  <div>
                    <span className="text-xs font-sans text-slate-400 block">Melhor Tempo</span>
                    <span className="text-lg font-semibold text-emerald-400">{seriesBest} ms</span>
                  </div>
                  <div>
                    <span className="text-xs font-sans text-slate-400 block">Consistência (Desvio)</span>
                    <span className="text-lg font-semibold text-slate-100">±{seriesStdDev ?? 0} ms</span>
                  </div>
                  <div>
                    <span className="text-xs font-sans text-slate-400 block">Ticks de Jogo</span>
                    <span className="text-lg font-semibold text-amber-400">{(seriesAvg / 50).toFixed(2)}t</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startNewSeries();
                    }}
                    className="px-5 py-2.5 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Nova Série de 5
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToAi();
                    }}
                    className="px-5 py-2.5 text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Enviar Reflexo ao Painel IA
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Benchmarks & Attempt Log (4 cols) */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-100">
              Referência de Ticks no Minecraft 1.8.9
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              O motor do Minecraft 1.8.9 processa pacotes de combate a <strong>20 ticks por segundo</strong> (1 tick a cada 50ms). Sua velocidade de reação determina quantos ticks você leva para responder a um Block-In ou Fireball:
            </p>
            <div className="space-y-2.5 text-xs border-t border-slate-800 pt-3 font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="font-sans text-slate-300">150ms – 180ms (Elite)</span>
                <span className="text-emerald-400">3.0 a 3.6 ticks</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-300">181ms – 215ms (Ranked)</span>
                <span className="text-slate-200">3.6 a 4.3 ticks</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-300">216ms – 260ms (Médio)</span>
                <span className="text-amber-400">4.3 a 5.2 ticks</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-100 mb-3">
              Registro de Tentativas Recentes
            </h3>
            {history.length === 0 ? (
              <p className="text-xs text-slate-400">
                Clique no painel principal ao lado para registrar seus tempos de reação em milissegundos.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 font-medium">#</th>
                      <th className="py-2 font-medium">Modo</th>
                      <th className="py-2 font-medium text-right">Tempo</th>
                      <th className="py-2 font-medium text-right">Ticks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                    {history.map((item) => (
                      <tr key={item.attemptNumber} className="hover:bg-slate-800/30">
                        <td className="py-2 text-slate-400">#{item.attemptNumber}</td>
                        <td className="py-2 font-sans text-slate-200 truncate max-w-[130px]">
                          {item.mode}
                        </td>
                        <td className="py-2 text-right text-emerald-400 font-semibold">
                          {item.timeMs} ms
                        </td>
                        <td className="py-2 text-right text-slate-400">
                          {(item.timeMs / 50).toFixed(1)}t
                        </td>
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
