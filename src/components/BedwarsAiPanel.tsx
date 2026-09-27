import React, { useState, useEffect } from 'react';
import { ActiveTab, AIOptimizationReport, HardwareProfile, TelemetryStats } from '../types';

interface BedwarsAiPanelProps {
  telemetry: TelemetryStats;
  hardware: HardwareProfile;
  onUpdateHardware: (partial: Partial<HardwareProfile>) => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

export const BedwarsAiPanel: React.FC<BedwarsAiPanelProps> = ({
  telemetry,
  hardware,
  onUpdateHardware,
  onNavigateTab,
}) => {
  const [userChallenges, setUserChallenges] = useState<string>(
    'Sinto que minha mira treme quando faço Butterfly/Jitter Click acima de 12 CPS e às vezes passo do alvo (over-flick) durante strafes rápidos na ponte.'
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [report, setReport] = useState<AIOptimizationReport | null>(null);
  const [copiedConfig, setCopiedConfig] = useState<boolean>(false);
  const [autoDetectedNote, setAutoDetectedNote] = useState<string>('Hardware detectado automaticamente via navegador');

  // Auto-detect real browser hardware specs & refresh rate on mount
  useEffect(() => {
    const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const cores = navigator.hardwareConcurrency || 6;
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 8;
    const res = `${window.screen.width}x${window.screen.height}`;

    let detectedGpu = hardware.gpuModel;
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl') ||
        (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          if (renderer && typeof renderer === 'string') {
            detectedGpu = renderer.replace(/ANGLE \((.+)\)/, '$1').slice(0, 65);
          }
        }
      }
    } catch {
      // keep default
    }

    onUpdateHardware({
      deviceType: isMobileUA
        ? 'Telemóvel / Tablet (PojavLauncher / Touch / OTG)'
        : 'Computador (PC / Notebook)',
      cpuCores: cores,
      ramGb: mem,
      resolution: res,
      gpuModel: detectedGpu,
    });

    // Measure approximate screen refresh rate via rAF
    let frameCount = 0;
    let startStamp = 0;
    let rafId = 0;

    const measureHz = (timestamp: number) => {
      if (frameCount === 0) {
        startStamp = timestamp;
      }
      frameCount += 1;
      if (frameCount < 25) {
        rafId = window.requestAnimationFrame(measureHz);
      } else {
        const elapsed = timestamp - startStamp;
        if (elapsed > 0) {
          const rawFps = Math.round((24 * 1000) / elapsed);
          const standardHz = [60, 75, 90, 120, 144, 165, 240, 360].reduce((prev, curr) =>
            Math.abs(curr - rawFps) < Math.abs(prev - rawFps) ? curr : prev
          );
          onUpdateHardware({ refreshRateHz: standardHz });
          setAutoDetectedNote(
            `Detectado: ${cores} threads · ~${mem}GB RAM · Tela ${res} @ ${standardHz}Hz`
          );
        }
      }
    };

    rafId = window.requestAnimationFrame(measureHz);
    return () => window.cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (presetType: 'pc_comp' | 'pc_low' | 'mobile_pojav' | 'mobile_otg') => {
    if (presetType === 'pc_comp') {
      onUpdateHardware({
        deviceType: 'Computador (PC / Notebook)',
        cpuModel: 'AMD Ryzen 5 5600X / Intel i5-12400F',
        cpuCores: 12,
        ramGb: 16,
        gpuModel: 'NVIDIA GeForce RTX 3060 / GTX 1660 Super',
        resolution: '1920x1080',
        refreshRateHz: 144,
        mouseOrTouchModel: 'Mouse Gamer Leve (~60g · Sensor PAW3395)',
        pollingRateHz: 1000,
        currentDpi: 800,
        currentMcSens: 48,
        clickTechnique: 'Butterfly Click (14-18 CPS)',
        playstyle: 'Rusher Agressivo / First-Rush',
        mcClient: 'Lunar Client 1.8.9 (OptiFine)',
      });
    } else if (presetType === 'pc_low') {
      onUpdateHardware({
        deviceType: 'Computador (PC / Notebook)',
        cpuModel: 'Intel Core i3 / Ryzen 3 Integrado',
        cpuCores: 4,
        ramGb: 8,
        gpuModel: 'Intel UHD Graphics / Vega 8 Integrada',
        resolution: '1366x768',
        refreshRateHz: 60,
        mouseOrTouchModel: 'Mouse Óptico 125g',
        pollingRateHz: 500,
        currentDpi: 1000,
        currentMcSens: 65,
        clickTechnique: 'Normal / Jitter Click (9-12 CPS)',
        playstyle: 'All-Rounder / Estratégico',
        mcClient: 'Forge 1.8.9 + OptiFine + Patcher',
      });
    } else if (presetType === 'mobile_pojav') {
      onUpdateHardware({
        deviceType: 'Telemóvel / Tablet (PojavLauncher / Touch / OTG)',
        cpuModel: 'Snapdragon 8 Gen 1 / Dimensity 8200 (ARM64)',
        cpuCores: 8,
        ramGb: 8,
        gpuModel: 'Adreno / Mali (Renderizador Holy GL4ES 1.8.9)',
        resolution: '2400x1080 (Escala 75%)',
        refreshRateHz: 120,
        mouseOrTouchModel: 'Tela Touch 6.6" (Split Controls + Botão Dedicado LMB/RMB)',
        pollingRateHz: 240,
        currentDpi: 450,
        currentMcSens: 58,
        clickTechnique: 'Toque Duplo com 3/4 Dedos (HUD Customizado)',
        playstyle: 'Rusher / Speed Bridger Mobile',
        mcClient: 'PojavLauncher 1.8.9 + OptiFine HD U M5',
      });
    } else {
      onUpdateHardware({
        deviceType: 'Telemóvel / Tablet (PojavLauncher / Touch / OTG)',
        cpuModel: 'Processador Octa-Core Intermediário (Helio G99 / Snapdragon 695)',
        cpuCores: 8,
        ramGb: 6,
        gpuModel: 'Mali-G57 / Adreno 619',
        resolution: '1600x720 (Escala 65%)',
        refreshRateHz: 90,
        mouseOrTouchModel: 'Adaptador OTG + Mouse/Teclado no Telemóvel',
        pollingRateHz: 500,
        currentDpi: 800,
        currentMcSens: 52,
        clickTechnique: 'Butterfly Click via OTG',
        playstyle: 'Bridger / Clutch',
        mcClient: 'PojavLauncher 1.8.9 (JVM 2048MB)',
      });
    }
  };

  const handleGenerateOptimization = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/ai/optimize-bedwars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hardwareProfile: hardware,
          telemetryStats: telemetry,
          userChallenges,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao consultar o motor de IA.');
      }

      setReport(data as AIOptimizationReport);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro de conexão ao gerar relatório com IA.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyOptions = (val: string) => {
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedConfig(true);
    window.setTimeout(() => setCopiedConfig(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div>
          <p className="text-xs text-slate-400 mb-1">
            Diagnóstico Inteligente de Hardware & Telemetria · {autoDetectedNote}
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-100">
            05. Painel IA de Melhorias ao Bedwars 1.8.9
          </h1>
        </div>

        {/* Platform Switcher: PC vs Mobile */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() =>
              onUpdateHardware({ deviceType: 'Computador (PC / Notebook)' })
            }
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              hardware.deviceType === 'Computador (PC / Notebook)'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Computador (PC / Notebook)
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdateHardware({
                deviceType: 'Telemóvel / Tablet (PojavLauncher / Touch / OTG)',
              })
            }
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              hardware.deviceType === 'Telemóvel / Tablet (PojavLauncher / Touch / OTG)'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Telemóvel / Tablet (Pojav / Mobile)
          </button>
        </div>
      </div>

      {/* Live Telemetry Summary Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Telemetria Real Capturada nos Seus Testes Práticos
            </h2>
            <p className="text-xs text-slate-400">
              A IA combina as especificações do seu {hardware.deviceType.includes('Telemóvel') ? 'telemóvel' : 'computador'} com os seus resultados reais nos módulos do site:
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Perfis Rápidos:</span>
            <button
              type="button"
              onClick={() => applyPreset('pc_comp')}
              className="px-2.5 py-1 text-xs bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 transition-colors whitespace-nowrap"
            >
              PC 144Hz
            </button>
            <button
              type="button"
              onClick={() => applyPreset('pc_low')}
              className="px-2.5 py-1 text-xs bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 transition-colors whitespace-nowrap"
            >
              Notebook 60Hz
            </button>
            <button
              type="button"
              onClick={() => applyPreset('mobile_pojav')}
              className="px-2.5 py-1 text-xs bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 transition-colors whitespace-nowrap"
            >
              Telemóvel Touch (Pojav)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('mobile_otg')}
              className="px-2.5 py-1 text-xs bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 transition-colors whitespace-nowrap"
            >
              Telemóvel + Mouse OTG
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-3 border-t border-slate-800/80 font-mono tabular-nums text-xs">
          <div>
            <span className="font-sans text-slate-400 block">Precisão Mira 1.8.9</span>
            <span className="text-base font-semibold text-emerald-400">
              {telemetry.aimAccuracy !== null ? `${telemetry.aimAccuracy}%` : 'Não medido'}
            </span>
          </div>
          <div>
            <span className="font-sans text-slate-400 block">Strafe Tracking</span>
            <span className="text-base font-semibold text-slate-100">
              {telemetry.trackingScore !== null ? `${telemetry.trackingScore}%` : 'Não medido'}
            </span>
          </div>
          <div>
            <span className="font-sans text-slate-400 block">Velocidade Reação</span>
            <span className="text-base font-semibold text-amber-400">
              {telemetry.reactionTimeMs !== null ? `${telemetry.reactionTimeMs} ms` : 'Não medido'}
            </span>
          </div>
          <div>
            <span className="font-sans text-slate-400 block">CPS Médio (PvP)</span>
            <span className="text-base font-semibold text-emerald-400">
              {telemetry.leftCps !== null ? `${telemetry.leftCps} CPS` : 'Não medido'}
            </span>
          </div>
          <div>
            <span className="font-sans text-slate-400 block">Tremor no Clique</span>
            <span className="text-base font-semibold text-slate-100">
              {telemetry.aimJitterPx !== null ? `${telemetry.aimJitterPx} px` : 'Não medido'}
            </span>
          </div>
          <div>
            <span className="font-sans text-slate-400 block">Tendência de Flick</span>
            <span className="text-xs font-sans font-semibold text-slate-200 truncate block">
              {telemetry.aimBias}
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Grid: Hardware Form (5 cols) + AI Output Report (7 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Hardware & Setup Configuration Form (5 cols) */}
        <form
          onSubmit={handleGenerateOptimization}
          className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-100">
            Especificações do {hardware.deviceType.includes('Telemóvel') ? 'Telemóvel / Tablet' : 'Computador'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div className="sm:col-span-2">
              <label className="text-slate-300 font-medium block mb-1">
                Processador (CPU) / Chipset Mobile
              </label>
              <input
                type="text"
                value={hardware.cpuModel}
                onChange={(e) => onUpdateHardware({ cpuModel: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Núcleos / Threads
              </label>
              <input
                type="number"
                min={2}
                max={64}
                value={hardware.cpuCores}
                onChange={(e) => onUpdateHardware({ cpuCores: Number(e.target.value) || 4 })}
                className="w-full px-3 py-2 font-mono tabular-nums bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Memória RAM (GB)
              </label>
              <input
                type="number"
                min={2}
                max={128}
                value={hardware.ramGb}
                onChange={(e) => onUpdateHardware({ ramGb: Number(e.target.value) || 8 })}
                className="w-full px-3 py-2 font-mono tabular-nums bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-slate-300 font-medium block mb-1">
                Placa de Vídeo (GPU) / Renderizador OpenGL
              </label>
              <input
                type="text"
                value={hardware.gpuModel}
                onChange={(e) => onUpdateHardware({ gpuModel: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Resolução / Escala
              </label>
              <input
                type="text"
                value={hardware.resolution}
                onChange={(e) => onUpdateHardware({ resolution: e.target.value })}
                className="w-full px-3 py-2 font-mono tabular-nums bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Taxa da Tela (Hz)
              </label>
              <select
                value={hardware.refreshRateHz}
                onChange={(e) => onUpdateHardware({ refreshRateHz: Number(e.target.value) })}
                className="w-full px-3 py-2 font-mono tabular-nums bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value={60}>60 Hz</option>
                <option value={75}>75 Hz</option>
                <option value={90}>90 Hz</option>
                <option value={120}>120 Hz</option>
                <option value={144}>144 Hz</option>
                <option value={165}>165 Hz</option>
                <option value={240}>240 Hz+</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-slate-300 font-medium block mb-1">
                Mouse / Sensor (ou Controle Touch / Giroscópio no Telemóvel)
              </label>
              <input
                type="text"
                value={hardware.mouseOrTouchModel}
                onChange={(e) => onUpdateHardware({ mouseOrTouchModel: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                DPI / Sensibilidade Base
              </label>
              <input
                type="number"
                value={hardware.currentDpi}
                onChange={(e) => onUpdateHardware({ currentDpi: Number(e.target.value) || 800 })}
                className="w-full px-3 py-2 font-mono tabular-nums bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Sensibilidade MC 1.8.9 (%)
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={hardware.currentMcSens}
                onChange={(e) => onUpdateHardware({ currentMcSens: Number(e.target.value) || 50 })}
                className="w-full px-3 py-2 font-mono tabular-nums bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Técnica de Clique Principal
              </label>
              <select
                value={hardware.clickTechnique}
                onChange={(e) => onUpdateHardware({ clickTechnique: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="Normal Click (6-9 CPS)">Normal Click (6-9 CPS)</option>
                <option value="Butterfly Click (12-20 CPS)">Butterfly Click (12-20 CPS)</option>
                <option value="Jitter Click (11-15 CPS)">Jitter Click (11-15 CPS)</option>
                <option value="Drag Click (Godbridge / Clutch)">Drag Click (Godbridge / Clutch)</option>
                <option value="Toque Mobile / HUD 3-4 Dedos">Toque Mobile / HUD 3-4 Dedos</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Cliente Minecraft 1.8.9
              </label>
              <input
                type="text"
                value={hardware.mcClient}
                onChange={(e) => onUpdateHardware({ mcClient: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-slate-300 font-medium block mb-1">
                O que você mais deseja corrigir na mira ou nos cliques?
              </label>
              <textarea
                rows={3}
                value={userChallenges}
                onChange={(e) => setUserChallenges(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-5 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {loading
              ? 'Analisando Hardware & Telemetria com IA...'
              : 'Gerar Configuração Ideal 1.8.9 com IA'}
          </button>
        </form>

        {/* Right Column: AI Optimization Output (7 cols) */}
        <div className="xl:col-span-7 space-y-6">
          {errorMsg && (
            <div className="bg-red-950/50 border border-red-800 rounded-xl p-5 text-xs text-red-200">
              <p className="font-semibold text-red-100 mb-1">Erro ao Processar Otimização</p>
              <p>{errorMsg}</p>
            </div>
          )}

          {loading && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 animate-pulse">
              <div className="h-5 w-2/3 bg-slate-800 rounded" />
              <div className="h-16 w-full bg-slate-800/70 rounded-lg" />
              <div className="grid grid-cols-3 gap-4">
                <div className="h-20 bg-slate-800 rounded-lg" />
                <div className="h-20 bg-slate-800 rounded-lg" />
                <div className="h-20 bg-slate-800 rounded-lg" />
              </div>
              <div className="space-y-3">
                <div className="h-14 bg-slate-800/60 rounded-lg" />
                <div className="h-14 bg-slate-800/60 rounded-lg" />
                <div className="h-14 bg-slate-800/60 rounded-lg" />
              </div>
            </div>
          )}

          {!loading && !report && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4">
              <p className="text-xs font-mono text-emerald-400">
                Motor de Otimização Tática 1.8.9 Pronto
              </p>
              <h3 className="text-xl font-semibold text-slate-100 max-w-lg mx-auto">
                Descubra a Sensibilidade, FOV, Ajustes de Clique e Configurações Exatas para o Seu Dispositivo
              </h3>
              <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
                Clique em <strong>"Gerar Configuração Ideal 1.8.9 com IA"</strong> no formulário ao lado. A inteligência artificial cruzará o processador, RAM, taxa de atualização (Hz) e periférico do seu computador ou telemóvel com os seus dados reais de CPS, velocidade de reação e precisão de mira.
              </p>
            </div>
          )}

          {!loading && report && (
            <div className="space-y-6">
              {/* Block 1: Executive Diagnosis & Sensitivity Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
                <div>
                  <span className="text-xs font-mono text-emerald-400 block mb-1">
                    Diagnóstico de Engenharia 1.8.9 · {hardware.deviceType}
                  </span>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {report.summaryDiagnosis}
                  </p>
                </div>

                {/* Key Sensitivity Numbers */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono tabular-nums">
                  <div>
                    <span className="text-xs font-sans text-slate-400 block">
                      Sensibilidade MC 1.8.9
                    </span>
                    <span className="text-2xl font-bold text-emerald-400">
                      {report.sensitivityConfig.mcSensitivityPercent}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-sans text-slate-400 block">
                      DPI / Toque Recomendado
                    </span>
                    <span className="text-lg font-semibold text-slate-100">
                      {report.sensitivityConfig.recommendedDpi}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-sans text-slate-400 block">
                      Distância de Giro 360°
                    </span>
                    <span className="text-lg font-semibold text-amber-400">
                      {report.sensitivityConfig.cmPer360}
                    </span>
                  </div>
                </div>

                {/* Secondary Sensitivity Details + options.txt copy */}
                <div className="space-y-2.5 text-xs border-t border-slate-800 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">
                      Linha exata para <code className="font-mono text-slate-200">.minecraft/options.txt</code>:
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded font-mono text-emerald-400">
                        {report.sensitivityConfig.optionsTxtValue}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopyOptions(report.sensitivityConfig.optionsTxtValue)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium transition-colors whitespace-nowrap"
                      >
                        {copiedConfig ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>

                  <p className="text-slate-300">
                    <strong className="text-slate-100">FOV & Alcance Visual:</strong>{' '}
                    {report.sensitivityConfig.fovSetting}
                  </p>
                  <p className="text-slate-300">
                    <strong className="text-slate-100">Entrada de Mouse / Sistema:</strong>{' '}
                    {report.sensitivityConfig.rawInputAndOs}
                  </p>
                  <p className="text-slate-400 pt-1 leading-relaxed">
                    {report.sensitivityConfig.explanation}
                  </p>
                </div>
              </div>

              {/* Block 2: Aim Stability Adjustments */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-slate-100">
                  Ajustes para Estabilidade na Mira & Rastreio (Strafe Tracking)
                </h3>
                <div className="divide-y divide-slate-800">
                  {report.aimStabilityAdjustments.map((item, idx) => (
                    <div key={idx} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-100">{item.title}</span>
                        <span className="text-xs font-mono text-emerald-400">
                          {item.parameter} · {item.impact}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{item.instruction}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Block 3: Click & 1.8.9 Hit-Reg Optimizations */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-slate-100">
                  Otimização de Cliques, CPS & Registro de Hits 1.8.9
                </h3>
                <div className="divide-y divide-slate-800">
                  {report.clickAndHitRegOptimizations.map((opt, idx) => (
                    <div key={idx} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-100">{opt.title}</span>
                        <span className="text-xs font-mono text-amber-400">
                          {opt.recommendedSetting}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">{opt.mechanicsTip}</p>
                      <p className="text-xs text-slate-400">{opt.technicalReason}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Block 4: Client & Hardware Performance Config Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-slate-100">
                  Configurações de Vídeo & Latência para o Seu Hardware
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2 font-medium">Parâmetro no Cliente 1.8.9</th>
                        <th className="py-2 font-medium">Valor Ideal</th>
                        <th className="py-2 font-medium">Impacto Técnico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {report.clientPerformanceConfig.map((cfg, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="py-2.5 font-semibold text-slate-200 pr-3">
                            {cfg.settingName}
                          </td>
                          <td className="py-2.5 font-mono text-emerald-400 pr-3 whitespace-nowrap">
                            {cfg.optimalValue}
                          </td>
                          <td className="py-2.5 text-slate-300">{cfg.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Block 5: Custom Daily Routine */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-100">
                    Plano de Treino Recomendado pela IA
                  </h3>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('aim')}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors whitespace-nowrap"
                  >
                    Iniciar Treino na Arena 1.8.9 →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {report.customTrainingRoutine.map((drill, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2"
                    >
                      <span className="text-xs font-mono text-emerald-400 block">
                        {drill.step} · {drill.duration}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-100">
                        {drill.moduleName}
                      </h4>
                      <p className="text-xs font-mono text-amber-400">
                        Meta: {drill.targetGoal}
                      </p>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {drill.focusNote}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
