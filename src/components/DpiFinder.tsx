import React, { useState, useRef } from 'react';
import { TelemetryStats } from '../types';
import {
  calculateCmPer360,
  calculateMcPercentFromCm360,
  mcPercentToOptionsFloat,
  calculateEffectiveEdpi,
} from '../utils/mcMath';
import { playHitSound } from '../utils/sound';

interface DpiFinderProps {
  telemetry: TelemetryStats;
  onUpdateTelemetry: (partial: Partial<TelemetryStats>) => void;
  onNavigateToAi: () => void;
  soundEnabled: boolean;
  dpi: number;
  onChangeDpi: (val: number) => void;
  mcSens: number;
  onChangeMcSens: (val: number) => void;
}

type ToolSubMode = 'psa_finder' | 'physical_calibrator';

const STANDARD_DPIS = [400, 800, 1200, 1600, 2400, 3200];

export const DpiFinder: React.FC<DpiFinderProps> = ({
  onUpdateTelemetry,
  onNavigateToAi,
  soundEnabled,
  dpi,
  onChangeDpi,
  mcSens,
  onChangeMcSens,
}) => {
  const [subMode, setSubMode] = useState<ToolSubMode>('psa_finder');

  // PSA Finder State (converges on ideal cm/360 and MC 1.8.9 %)
  const [psaStep, setPsaStep] = useState<number>(1);
  const [baseCm360, setBaseCm360] = useState<number>(() => calculateCmPer360(dpi, mcSens));
  const [spreadFactor, setSpreadFactor] = useState<number>(0.32);
  const [psaCompleted, setPsaCompleted] = useState<boolean>(false);
  const [copiedOptions, setCopiedOptions] = useState<boolean>(false);

  // Physical DPI Calibrator State
  const [rulerCm, setRulerCm] = useState<number>(5);
  const [isDraggingRuler, setIsDraggingRuler] = useState<boolean>(false);
  const [dragPixels, setDragPixels] = useState<number>(0);
  const [measuredRawDpi, setMeasuredRawDpi] = useState<number | null>(null);
  const dragStartXRef = useRef<number>(0);

  // PSA Calculations
  const lowCm360 = Number((baseCm360 * (1 + spreadFactor)).toFixed(2)); // More cm = Lower sensitivity
  const highCm360 = Number((baseCm360 * (1 - spreadFactor)).toFixed(2)); // Less cm = Higher sensitivity

  const lowMcPercent = calculateMcPercentFromCm360(lowCm360, dpi);
  const highMcPercent = calculateMcPercentFromCm360(highCm360, dpi);
  const currentOptimalPercent = calculateMcPercentFromCm360(baseCm360, dpi);
  const optionsFloatLine = `mouseSensitivity:${mcPercentToOptionsFloat(currentOptimalPercent).toFixed(8)}`;

  const handleSelectPsaChoice = (choice: 'lower_sens' | 'higher_sens') => {
    playHitSound(soundEnabled, psaStep + 1);
    const chosenCm = choice === 'lower_sens' ? (baseCm360 + lowCm360) / 2 : (baseCm360 + highCm360) / 2;
    const nextCm = Number(chosenCm.toFixed(2));
    const nextPercent = calculateMcPercentFromCm360(nextCm, dpi);

    setBaseCm360(nextCm);
    onChangeMcSens(nextPercent);

    if (psaStep >= 6) {
      setPsaCompleted(true);
      onUpdateTelemetry({
        calibratedDpi: dpi,
        recommendedMcSens: nextPercent,
      });
    } else {
      setPsaStep((s) => s + 1);
      setSpreadFactor((f) => Number((f * 0.65).toFixed(3)));
    }
  };

  const resetPsaWizard = () => {
    setPsaStep(1);
    setSpreadFactor(0.32);
    setBaseCm360(calculateCmPer360(dpi, mcSens));
    setPsaCompleted(false);
  };

  // Physical Calibrator Handlers
  const handleTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    dragStartXRef.current = e.clientX;
    setDragPixels(0);
    setMeasuredRawDpi(null);
    setIsDraggingRuler(true);
  };

  const handleTrackMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRuler) return;
    const deltaPx = Math.abs(e.clientX - dragStartXRef.current);
    setDragPixels(deltaPx);
  };

  const handleTrackMouseUp = () => {
    if (!isDraggingRuler) return;
    setIsDraggingRuler(false);

    if (dragPixels > 40) {
      const inchesMoved = rulerCm / 2.54;
      const rawDpi = Math.round(dragPixels / inchesMoved);
      setMeasuredRawDpi(rawDpi);

      // Snap suggestion to closest standard DPI or keep exact
      const closestStandard = STANDARD_DPIS.reduce((prev, curr) =>
        Math.abs(curr - rawDpi) < Math.abs(prev - rawDpi) ? curr : prev
      );
      const finalDpi = Math.abs(closestStandard - rawDpi) <= 120 ? closestStandard : rawDpi;
      onChangeDpi(finalDpi);
      onUpdateTelemetry({ calibratedDpi: finalDpi });
      playHitSound(soundEnabled, 4);
    }
  };

  const copyOptionsTxtValue = () => {
    navigator.clipboard?.writeText(optionsFloatLine).catch(() => {});
    setCopiedOptions(true);
    window.setTimeout(() => setCopiedOptions(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div>
          <p className="text-xs text-slate-400 mb-1">
            Algoritmo PSA (Perfect Sensitivity Approximation) · Matemática de Yaw EntityRenderer 1.8.9
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-100">
            04. DPI Finder & Calibrador de Sensibilidade 1.8.9
          </h1>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setSubMode('psa_finder')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              subMode === 'psa_finder'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Descobrir Sensibilidade Ideal (PSA)
          </button>
          <button
            type="button"
            onClick={() => setSubMode('physical_calibrator')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              subMode === 'physical_calibrator'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Medidor Físico de DPI Real (Régua)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Main Interactive Tool (8 cols) */}
        <div className="xl:col-span-8 space-y-6">
          {subMode === 'psa_finder' ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-mono text-emerald-400 block">
                    Iteração {psaStep} de 6 · Convergência Binária 1.8.9
                  </span>
                  <h2 className="text-xl font-semibold text-slate-100">
                    Encontre Seu Ponto Perfeito de Mira e Giro 180°
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={resetPsaWizard}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors whitespace-nowrap"
                >
                  Reiniciar Calibração
                </button>
              </div>

              {/* Base DPI & Starting Sens Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/70 border border-slate-800/80 rounded-lg p-4">
                <div>
                  <label htmlFor="dpi-input-field" className="text-xs text-slate-400 block mb-1">
                    Seu DPI Atual do Mouse
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="dpi-input-field"
                      type="number"
                      min={100}
                      max={16000}
                      step={50}
                      value={dpi}
                      onChange={(e) => {
                        const val = Math.max(100, Number(e.target.value) || 800);
                        onChangeDpi(val);
                        setBaseCm360(calculateCmPer360(val, mcSens));
                      }}
                      className="w-28 px-3 py-1.5 text-sm font-mono tabular-nums bg-slate-900 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                    <div className="flex items-center gap-1">
                      {[400, 800, 1600].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            onChangeDpi(preset);
                            setBaseCm360(calculateCmPer360(preset, mcSens));
                          }}
                          className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                            dpi === preset
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block mb-1">
                    Referência Atual no Minecraft 1.8.9
                  </span>
                  <div className="text-sm font-mono tabular-nums text-slate-200 pt-1.5">
                    Sensibilidade: <strong className="text-emerald-400">{currentOptimalPercent}%</strong> ·{' '}
                    <span>{baseCm360} cm/360°</span> ·{' '}
                    <span>{calculateEffectiveEdpi(dpi, currentOptimalPercent)} eDPI</span>
                  </div>
                </div>
              </div>

              {!psaCompleted ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Compare as duas opções abaixo para o seu estilo de jogo no Bedwars 1.8.9 (teste no jogo ou no módulo <strong>Mira 1.8.9</strong>) e clique na opção que oferece melhor equilíbrio entre manter combos (tracking) e virar 180° na ponte:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Option A: Lower Sensitivity (More Control) */}
                    <div className="bg-slate-950 border border-slate-800 hover:border-emerald-500/60 rounded-xl p-5 flex flex-col justify-between space-y-4 transition-colors">
                      <div className="space-y-2">
                        <span className="text-xs font-mono text-emerald-400">
                          OPÇÃO A · MAIS CONTROLE DE MIRA
                        </span>
                        <div className="text-3xl font-bold font-mono tabular-nums text-white">
                          {lowMcPercent}% <span className="text-sm font-normal text-slate-400">no MC 1.8.9</span>
                        </div>
                        <p className="text-xs font-mono tabular-nums text-slate-400">
                          Giro 360°: {lowCm360} cm · options.txt: {mcPercentToOptionsFloat(lowMcPercent).toFixed(4)}
                        </p>
                        <p className="text-xs text-slate-300 pt-1">
                          Ideal se sua mira está passando do alvo (Over-flick) ou tremendo durante Jitter/Butterfly Click.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectPsaChoice('lower_sens')}
                        className="w-full py-2.5 px-4 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Prefiro Opção A ({lowMcPercent}% — Mais Firme)
                      </button>
                    </div>

                    {/* Option B: Higher Sensitivity (Faster Turn) */}
                    <div className="bg-slate-950 border border-slate-800 hover:border-amber-500/60 rounded-xl p-5 flex flex-col justify-between space-y-4 transition-colors">
                      <div className="space-y-2">
                        <span className="text-xs font-mono text-amber-400">
                          OPÇÃO B · MAIS AGILIDADE 180° / PONTES
                        </span>
                        <div className="text-3xl font-bold font-mono tabular-nums text-white">
                          {highMcPercent}% <span className="text-sm font-normal text-slate-400">no MC 1.8.9</span>
                        </div>
                        <p className="text-xs font-mono tabular-nums text-slate-400">
                          Giro 360°: {highCm360} cm · options.txt: {mcPercentToOptionsFloat(highMcPercent).toFixed(4)}
                        </p>
                        <p className="text-xs text-slate-300 pt-1">
                          Ideal se você sente a mira pesada para acompanhar strafes rápidos (Speed II) ou fazer Block-In.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectPsaChoice('higher_sens')}
                        className="w-full py-2.5 px-4 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Prefiro Opção B ({highMcPercent}% — Mais Ágil)
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 border border-emerald-500/50 rounded-xl p-6 space-y-5">
                  <div>
                    <span className="text-xs font-mono text-emerald-400 block mb-1">
                      Calibração PSA Concluída com Sucesso
                    </span>
                    <h3 className="text-2xl font-bold text-white">
                      Sensibilidade Ideal Encontrada: <span className="font-mono tabular-nums text-emerald-400">{currentOptimalPercent}%</span> ({dpi} DPI)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono tabular-nums text-xs bg-slate-900 border border-slate-800 rounded-lg p-4">
                    <div>
                      <span className="font-sans text-slate-400 block">Distância Real 360°</span>
                      <span className="text-base font-semibold text-slate-100">{baseCm360} cm/360°</span>
                    </div>
                    <div>
                      <span className="font-sans text-slate-400 block">Linha exata options.txt</span>
                      <span className="text-base font-semibold text-emerald-400">{optionsFloatLine}</span>
                    </div>
                    <div>
                      <span className="font-sans text-slate-400 block">Índice eDPI</span>
                      <span className="text-base font-semibold text-amber-400">
                        {calculateEffectiveEdpi(dpi, currentOptimalPercent)} eDPI
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={copyOptionsTxtValue}
                      className="px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {copiedOptions ? 'Copiado para Área de Transferência!' : 'Copiar Valor options.txt'}
                    </button>
                    <button
                      type="button"
                      onClick={onNavigateToAi}
                      className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Abrir Relatório Completo na IA
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Physical DPI Calibrator Sub-Mode */
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div>
                <span className="text-xs font-mono text-emerald-400 block mb-1">
                  Medição Física por Deslocamento de Pixels
                </span>
                <h2 className="text-xl font-semibold text-slate-100">
                  Descubra o DPI Real do Seu Mouse Sem Software
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Muitos mouses possuem botões de troca de DPI sem indicar o valor exato. Escolha uma distância abaixo (ex: 5 cm em uma régua no seu mousepad), clique e segure na faixa de medição e mova o mouse exatamente essa distância para a direita.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300 font-medium">Distância na Régua:</span>
                {[5, 8, 10].map((cm) => (
                  <button
                    key={cm}
                    type="button"
                    onClick={() => {
                      setRulerCm(cm);
                      setMeasuredRawDpi(null);
                      setDragPixels(0);
                    }}
                    className={`px-3 py-1.5 text-xs font-mono tabular-nums rounded-md transition-colors ${
                      rulerCm === cm
                        ? 'bg-emerald-500 text-slate-950 font-semibold'
                        : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {cm} cm ({(cm / 2.54).toFixed(2)} pol)
                  </button>
                ))}
              </div>

              {/* Interactive Drag Strip */}
              <div
                onMouseDown={handleTrackMouseDown}
                onMouseMove={handleTrackMouseMove}
                onMouseUp={handleTrackMouseUp}
                onMouseLeave={handleTrackMouseUp}
                className={`w-full min-h-[190px] rounded-xl border-2 border-dashed select-none flex flex-col items-center justify-center p-6 text-center transition-colors cursor-ew-resize ${
                  isDraggingRuler
                    ? 'bg-emerald-950/40 border-emerald-400'
                    : 'bg-slate-950 border-slate-700 hover:border-slate-500'
                }`}
              >
                <p className="text-xs font-mono tabular-nums text-emerald-400 mb-2">
                  {isDraggingRuler
                    ? `Arrastando... Deslocamento atual: ${dragPixels} pixels`
                    : `Clique, segure e mova o mouse por exatos ${rulerCm} cm no mousepad`}
                </p>
                <div className="text-3xl font-bold font-mono tabular-nums text-white">
                  {dragPixels} <span className="text-base font-normal text-slate-400">px percorridos</span>
                </div>
                {measuredRawDpi !== null && (
                  <p className="text-sm text-slate-200 mt-3">
                    DPI Físico Medido: <strong className="font-mono text-emerald-400">{measuredRawDpi} DPI</strong> ·
                    Sincronizado como <strong className="font-mono text-white">{dpi} DPI</strong> no sistema!
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Cross-DPI Equivalence Table (4 cols) */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-100">
              Tabela de Equivalência 1.8.9 ({baseCm360} cm/360°)
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Quer mudar o DPI do seu mouse para reduzir o atraso de sensor (input lag) mantendo <strong>exatamente a mesma distância de giro</strong> no Minecraft 1.8.9? Use os valores equivalentes abaixo:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 font-medium">DPI do Mouse</th>
                    <th className="py-2 font-medium text-right">Sens MC 1.8.9</th>
                    <th className="py-2 font-medium text-right">options.txt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                  {STANDARD_DPIS.map((targetDpi) => {
                    const eqPercent = calculateMcPercentFromCm360(baseCm360, targetDpi);
                    const eqFloat = mcPercentToOptionsFloat(eqPercent).toFixed(4);
                    const isCurrent = targetDpi === dpi;
                    return (
                      <tr
                        key={targetDpi}
                        className={isCurrent ? 'bg-emerald-500/10 text-emerald-300' : 'hover:bg-slate-800/30'}
                      >
                        <td className="py-2 font-semibold">
                          {targetDpi} DPI {isCurrent ? '· Atual' : ''}
                        </td>
                        <td className="py-2 text-right text-emerald-400 font-semibold">
                          {eqPercent}%
                        </td>
                        <td className="py-2 text-right text-slate-400">{eqFloat}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
