import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TelemetryStats } from '../types';
import { playHitSound, playMissSound } from '../utils/sound';
import { calculateCmPer360 } from '../utils/mcMath';

interface AimTrainer189Props {
  telemetry: TelemetryStats;
  onUpdateTelemetry: (partial: Partial<TelemetryStats>) => void;
  onNavigateToAi: () => void;
  soundEnabled: boolean;
  dpi: number;
  mcSens: number;
  onChangeMcSens: (val: number) => void;
}

type DrillMode = 'strafe_tracking' | 'hit_select_flick' | 'fireball_bed_defense';
type GameState = 'TITLE_MENU' | 'PLAYING' | 'ROUND_SUMMARY';
type CrosshairStyle = 'cross_189' | 'dot_precision' | 'dynamic_ring';

interface TargetEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hurtTimer: number; // simulates 1.8.9 500ms (10 ticks) hurt-time flash
  spawnTime: number;
  distanceBlocks: number; // 1.8 to 3.2 blocks simulated
  type: 'player' | 'fireball';
}

interface HitMarker {
  x: number;
  y: number;
  hit: boolean;
  text: string;
  alpha: number;
}

interface SessionLog {
  id: number;
  mode: string;
  accuracy: number;
  trackingScore: number;
  maxCombo: number;
  avgReach: number;
  bias: string;
  timestamp: string;
}

export const AimTrainer189: React.FC<AimTrainer189Props> = ({
  onUpdateTelemetry,
  onNavigateToAi,
  soundEnabled,
  dpi,
  mcSens,
  onChangeMcSens,
}) => {
  const [drillMode, setDrillMode] = useState<DrillMode>('strafe_tracking');
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [durationSec, setDurationSec] = useState<number>(30);
  const [difficulty, setDifficulty] = useState<'normal' | 'ranked' | 'insane'>('ranked');
  const [crosshair, setCrosshair] = useState<CrosshairStyle>('cross_189');
  const [showF3Hitbox, setShowF3Hitbox] = useState<boolean>(true);

  // Live HUD state
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [hits, setHits] = useState<number>(0);
  const [misses, setMisses] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [trackingPct, setTrackingPct] = useState<number>(0);
  const [avgReach, setAvgReach] = useState<number>(2.75);
  const [aimBiasLabel, setAimBiasLabel] = useState<string>('Equilibrada');
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetsRef = useRef<TargetEntity[]>([]);
  const markersRef = useRef<HitMarker[]>([]);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 420, y: 250 });
  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 420, y: 250 });

  // Internal counters for 60fps loop
  const statsRef = useRef({
    hits: 0,
    misses: 0,
    combo: 0,
    maxCombo: 0,
    framesTotal: 0,
    framesOnTarget: 0,
    reachSum: 0,
    overshootCount: 0,
    undershootCount: 0,
  });

  const speedMultiplier = difficulty === 'normal' ? 0.85 : difficulty === 'ranked' ? 1.2 : 1.65;
  const sensScale = 0.55 + (mcSens / 200) * 0.9;

  const spawnTargetsForMode = useCallback(
    (width: number, height: number, mode: DrillMode) => {
      const now = performance.now();
      if (mode === 'strafe_tracking') {
        targetsRef.current = [
          {
            id: 1,
            x: width / 2 - 34,
            y: height / 2 - 58,
            vx: 3.4 * speedMultiplier,
            vy: 0,
            width: 68,
            height: 124, // 1.8.9 hitbox 0.6w x 1.8h proportion
            hurtTimer: 0,
            spawnTime: now,
            distanceBlocks: 2.85,
            type: 'player',
          },
        ];
      } else if (mode === 'hit_select_flick') {
        const list: TargetEntity[] = [];
        for (let i = 0; i < 3; i++) {
          list.push({
            id: i + 1,
            x: 80 + Math.random() * (width - 220),
            y: 70 + Math.random() * (height - 220),
            vx: (Math.random() > 0.5 ? 1 : -1) * 1.8 * speedMultiplier,
            vy: 0,
            width: 56,
            height: 104,
            hurtTimer: 0,
            spawnTime: now,
            distanceBlocks: Number((2.2 + Math.random() * 0.8).toFixed(2)),
            type: 'player',
          });
        }
        targetsRef.current = list;
      } else {
        // fireball_bed_defense
        const list: TargetEntity[] = [];
        for (let i = 0; i < 4; i++) {
          list.push({
            id: i + 1,
            x: 70 + Math.random() * (width - 140),
            y: 60 + Math.random() * (height - 140),
            vx: (Math.random() - 0.5) * 4.5 * speedMultiplier,
            vy: (Math.random() - 0.5) * 3.5 * speedMultiplier,
            width: 46,
            height: 46,
            hurtTimer: 0,
            spawnTime: now,
            distanceBlocks: Number((2.5 + Math.random() * 0.5).toFixed(2)),
            type: 'fireball',
          });
        }
        targetsRef.current = list;
      }
    },
    [speedMultiplier]
  );

  const startSession = () => {
    statsRef.current = {
      hits: 0,
      misses: 0,
      combo: 0,
      maxCombo: 0,
      framesTotal: 0,
      framesOnTarget: 0,
      reachSum: 0,
      overshootCount: 0,
      undershootCount: 0,
    };
    markersRef.current = [];
    setHits(0);
    setMisses(0);
    setCombo(0);
    setMaxCombo(0);
    setTrackingPct(0);
    setTimeLeft(durationSec);
    setGameState('PLAYING');

    const canvas = canvasRef.current;
    if (canvas) {
      spawnTargetsForMode(canvas.width, canvas.height, drillMode);
    }
  };

  const finishSession = useCallback(() => {
    setGameState('ROUND_SUMMARY');
    const st = statsRef.current;
    const totalClicks = st.hits + st.misses;
    const acc = totalClicks > 0 ? Math.round((st.hits / totalClicks) * 100) : 0;
    const track = st.framesTotal > 0 ? Math.round((st.framesOnTarget / st.framesTotal) * 100) : 0;
    const reach = st.hits > 0 ? Number((st.reachSum / st.hits).toFixed(2)) : 2.8;

    let bias = 'Equilibrada (Mira consistente)';
    if (st.overshootCount > st.undershootCount + 3) {
      bias = 'Over-flick (Sensibilidade alta demais)';
    } else if (st.undershootCount > st.overshootCount + 3) {
      bias = 'Under-flick (Sensibilidade curta/baixa)';
    }

    setAimBiasLabel(bias);
    setAvgReach(reach);

    onUpdateTelemetry({
      aimAccuracy: acc,
      trackingScore: track,
      avgReachBlocks: reach,
      aimBias: bias,
    });

    const modeTitle =
      drillMode === 'strafe_tracking'
        ? 'Strafe Tracking 1.8.9'
        : drillMode === 'hit_select_flick'
        ? 'Hit-Select & Flick'
        : 'Deflexão de Fireball';

    setSessionLogs((prev) => [
      {
        id: Date.now(),
        mode: modeTitle,
        accuracy: acc,
        trackingScore: track,
        maxCombo: st.maxCombo,
        avgReach: reach,
        bias,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
      ...prev.slice(0, 7),
    ]);
  }, [drillMode, onUpdateTelemetry]);

  // Countdown timer
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          finishSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [gameState, finishSession]);

  // Main 60FPS Render & Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const { width, height } = canvas;

      // Clear background with subtle Bedwars void/bridge horizon grid
      ctx.fillStyle = '#090D14';
      ctx.fillRect(0, 0, width, height);

      // Subtle perspective grid lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
      ctx.lineWidth = 1;
      const gridStep = 48;
      for (let x = 0; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (gameState === 'PLAYING') {
        const mx = mousePosRef.current.x;
        const my = mousePosRef.current.y;
        let cursorInsideAny = false;

        targetsRef.current.forEach((t) => {
          // Update position
          t.x += t.vx;
          t.y += t.vy;

          // Gravity / Knockback recovery for player targets in strafe mode
          if (t.type === 'player') {
            const groundY = drillMode === 'strafe_tracking' ? height / 2 - 58 : t.y;
            if (drillMode === 'strafe_tracking') {
              if (t.y < groundY) {
                t.vy += 0.35; // gravity
              } else {
                t.y = groundY;
                t.vy = 0;
              }
              // Unpredictable A/D strafe switches
              if (Math.random() < 0.022 * speedMultiplier) {
                t.vx = -t.vx;
              }
            }

            // Wall bounce
            if (t.x < 40) {
              t.x = 40;
              t.vx = Math.abs(t.vx);
            } else if (t.x + t.width > width - 40) {
              t.x = width - 40 - t.width;
              t.vx = -Math.abs(t.vx);
            }
          } else {
            // Fireball bounce
            if (t.x < 30 || t.x + t.width > width - 30) t.vx = -t.vx;
            if (t.y < 30 || t.y + t.height > height - 30) t.vy = -t.vy;
          }

          if (t.hurtTimer > 0) t.hurtTimer -= 1;

          // Check if cursor is inside hitbox
          if (mx >= t.x && mx <= t.x + t.width && my >= t.y && my <= t.y + t.height) {
            cursorInsideAny = true;
          }

          // Render target
          if (t.type === 'player') {
            const isHurt = t.hurtTimer > 0;
            // Body fill simulating Minecraft 1.8.9 player model
            ctx.fillStyle = isHurt ? 'rgba(239, 68, 68, 0.42)' : 'rgba(16, 185, 129, 0.18)';
            ctx.fillRect(t.x, t.y, t.width, t.height);

            // Head region (top 28% of hitbox)
            const headHeight = t.height * 0.28;
            ctx.fillStyle = isHurt ? 'rgba(248, 113, 113, 0.55)' : 'rgba(16, 185, 129, 0.28)';
            ctx.fillRect(t.x + t.width * 0.12, t.y, t.width * 0.76, headHeight);

            // F3+B 1.8.9 Hitbox Wireframe
            if (showF3Hitbox) {
              ctx.strokeStyle = isHurt ? '#FCA5A5' : '#F8FAFC';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(t.x, t.y, t.width, t.height);

              // Red Eye-Height Line (authentic F3+B 1.8.9 eye level at ~1.62m / 1.8m)
              const eyeY = t.y + t.height * 0.14;
              ctx.strokeStyle = '#EF4444';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(t.x - 4, eyeY);
              ctx.lineTo(t.x + t.width + 4, eyeY);
              ctx.stroke();
            }

            // Distance & status label above target
            ctx.fillStyle = '#94A3B8';
            ctx.font = '600 11px "JetBrains Mono", monospace';
            ctx.fillText(`${t.distanceBlocks.toFixed(2)}m`, t.x + 6, t.y - 8);
          } else {
            // Fireball target
            const cx = t.x + t.width / 2;
            const cy = t.y + t.height / 2;
            const r = t.width / 2;

            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#F59E0B';
            ctx.stroke();

            // Inner fireball core
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
            ctx.fillStyle = '#FEF3C7';
            ctx.fill();
          }
        });

        statsRef.current.framesTotal += 1;
        if (cursorInsideAny) {
          statsRef.current.framesOnTarget += 1;
        }
        if (statsRef.current.framesTotal % 12 === 0) {
          setTrackingPct(
            Math.round((statsRef.current.framesOnTarget / Math.max(1, statsRef.current.framesTotal)) * 100)
          );
        }
      }

      // Render hit/miss markers
      markersRef.current.forEach((m) => {
        ctx.fillStyle = m.hit
          ? `rgba(16, 185, 129, ${m.alpha})`
          : `rgba(239, 68, 68, ${m.alpha})`;
        ctx.font = '600 12px "JetBrains Mono", monospace';
        ctx.fillText(m.text, m.x + 10, m.y - 8);
        m.y -= 0.6;
        m.alpha -= 0.03;
      });
      markersRef.current = markersRef.current.filter((m) => m.alpha > 0.05);

      // Render Custom 1.8.9 Crosshair
      const cx = mousePosRef.current.x;
      const cy = mousePosRef.current.y;
      ctx.save();
      if (crosshair === 'cross_189') {
        ctx.strokeStyle = '#F8FAFC';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 9, cy);
        ctx.lineTo(cx + 9, cy);
        ctx.moveTo(cx, cy - 9);
        ctx.lineTo(cx, cy + 9);
        ctx.stroke();
      } else if (crosshair === 'dot_precision') {
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.75;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      animId = window.requestAnimationFrame(render);
    };

    animId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(animId);
  }, [gameState, drillMode, speedMultiplier, crosshair, showF3Hitbox]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;

    // Apply subtle sensitivity scaling around center so the user feels the 1.8.9 sensitivity difference
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scaledX = Math.max(8, Math.min(canvas.width - 8, centerX + (rawX - centerX) * sensScale));
    const scaledY = Math.max(8, Math.min(canvas.height - 8, centerY + (rawY - centerY) * sensScale));

    prevMousePosRef.current = { ...mousePosRef.current };
    mousePosRef.current = { x: scaledX, y: scaledY };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || gameState !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const mx = mousePosRef.current.x;
    const my = mousePosRef.current.y;
    const dx = mx - prevMousePosRef.current.x;

    let hitTarget: TargetEntity | null = null;
    for (const t of targetsRef.current) {
      if (mx >= t.x && mx <= t.x + t.width && my >= t.y && my <= t.y + t.height) {
        hitTarget = t;
        break;
      }
    }

    if (hitTarget) {
      // Check if headshot / eye-level hit for extra precision feedback
      const isEyeLevel = my <= hitTarget.y + hitTarget.height * 0.32;
      statsRef.current.hits += 1;
      statsRef.current.combo += 1;
      if (statsRef.current.combo > statsRef.current.maxCombo) {
        statsRef.current.maxCombo = statsRef.current.combo;
      }

      const simulatedReach = Number((2.65 + Math.random() * 0.34).toFixed(2));
      hitTarget.distanceBlocks = simulatedReach;
      statsRef.current.reachSum += simulatedReach;

      setHits(statsRef.current.hits);
      setCombo(statsRef.current.combo);
      setMaxCombo(statsRef.current.maxCombo);

      playHitSound(soundEnabled, statsRef.current.combo);

      markersRef.current.push({
        x: mx,
        y: my,
        hit: true,
        text: isEyeLevel ? `HEAD ${simulatedReach}m` : `${simulatedReach}m`,
        alpha: 1,
      });

      if (drillMode === 'strafe_tracking') {
        // Apply 1.8.9 Knockback & HurtTime flash
        hitTarget.hurtTimer = 14;
        hitTarget.vy = -4.2; // vertical knockback lift
        hitTarget.vx = (Math.random() > 0.35 ? -hitTarget.vx : hitTarget.vx) * 1.05;
        hitTarget.vx = Math.max(-6.5, Math.min(6.5, hitTarget.vx));
      } else {
        // Respawn target at new Bedwars angle
        hitTarget.x = 70 + Math.random() * (canvas.width - 160);
        hitTarget.y = 60 + Math.random() * (canvas.height - 160);
        hitTarget.spawnTime = performance.now();
      }
    } else {
      // Missed shot: diagnose whether it was an over-flick or under-flick relative to nearest target
      statsRef.current.misses += 1;
      statsRef.current.combo = 0;
      setMisses(statsRef.current.misses);
      setCombo(0);
      playMissSound(soundEnabled);

      const nearest = targetsRef.current[0];
      if (nearest) {
        const targetCenterX = nearest.x + nearest.width / 2;
        if ((dx > 0 && mx > targetCenterX) || (dx < 0 && mx < targetCenterX)) {
          statsRef.current.overshootCount += 1;
        } else {
          statsRef.current.undershootCount += 1;
        }
      }

      markersRef.current.push({
        x: mx,
        y: my,
        hit: false,
        text: 'MISS',
        alpha: 0.9,
      });
    }
  };

  const totalAttempts = hits + misses;
  const currentAccuracy = totalAttempts > 0 ? Math.round((hits / totalAttempts) * 100) : 0;
  const cm360 = calculateCmPer360(dpi, mcSens);

  return (
    <div className="space-y-8">
      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div>
          <p className="text-xs text-slate-400 mb-1">
            Simulador de Combate · Motor de Hitbox 0.6m × 1.8m · Limite de Alcance 3.00 Blocos
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-100">
            01. Laboratório de Mira & Strafe 1.8.9
          </h1>
        </div>

        {/* Interactive Mode Filter Controls */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setDrillMode('strafe_tracking');
              setGameState('TITLE_MENU');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              drillMode === 'strafe_tracking'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Strafe Tracking (Combo)
          </button>
          <button
            type="button"
            onClick={() => {
              setDrillMode('hit_select_flick');
              setGameState('TITLE_MENU');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              drillMode === 'hit_select_flick'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Hit-Select & Micro-Flick
          </button>
          <button
            type="button"
            onClick={() => {
              setDrillMode('fireball_bed_defense');
              setGameState('TITLE_MENU');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              drillMode === 'fireball_bed_defense'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Deflexão de Fireball
          </button>
        </div>
      </div>

      {/* Main Arena Layout: Left Interactive Canvas + Right Configuration & Telemetry */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Arena Column (8 cols) */}
        <div className="xl:col-span-8 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {/* Unobtrusive Top HUD Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 text-xs">
            <div className="flex items-center gap-3 font-mono tabular-nums text-slate-300">
              <span>Tempo: <strong className="text-slate-100">{timeLeft}s</strong></span>
              <span aria-hidden="true">·</span>
              <span>Precisão: <strong className="text-emerald-400">{currentAccuracy}%</strong></span>
              <span aria-hidden="true">·</span>
              <span>Rastreio: <strong className="text-slate-100">{trackingPct}%</strong></span>
              <span aria-hidden="true">·</span>
              <span>Combo: <strong className="text-amber-400">{combo}x</strong> (Máx {maxCombo}x)</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowF3Hitbox((v) => !v)}
                className="text-xs text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap"
              >
                Hitbox F3+B: {showF3Hitbox ? 'Visível' : 'Oculta'}
              </button>
              {gameState === 'PLAYING' && (
                <button
                  type="button"
                  onClick={finishSession}
                  className="px-3 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors whitespace-nowrap"
                >
                  Encerrar Treino
                </button>
              )}
            </div>
          </div>

          {/* Canvas Container */}
          <div className="relative w-full aspect-[16/10] bg-[#090D14] select-none">
            <canvas
              ref={canvasRef}
              width={880}
              height={550}
              onMouseMove={handleCanvasMouseMove}
              onMouseDown={handleCanvasMouseDown}
              onContextMenu={(e) => e.preventDefault()}
              className="w-full h-full block cursor-none"
            />

            {/* State Overlay: TITLE_MENU */}
            {gameState === 'TITLE_MENU' && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
                <p className="text-xs font-mono tabular-nums text-emerald-400 mb-2">
                  Sensibilidade 1.8.9: {mcSens}% · {dpi} DPI · {cm360} cm/360°
                </p>
                <h2 className="text-2xl font-semibold text-slate-100 max-w-md mb-2">
                  {drillMode === 'strafe_tracking' && 'Rastreio de Strafe & Controle de Knockback'}
                  {drillMode === 'hit_select_flick' && 'Aquisição Rápida Hit-Select em Pontes'}
                  {drillMode === 'fireball_bed_defense' && 'Deflexão de Fireball & Reflexo de Cama'}
                </h2>
                <p className="text-sm text-slate-400 max-w-lg mb-6">
                  {drillMode === 'strafe_tracking' &&
                    'Mantenha a mira na linha vermelha dos olhos (F3+B) enquanto o oponente faz A/D strafe e recebe knockback a cada hit.'}
                  {drillMode === 'hit_select_flick' &&
                    'Alterne rapidamente entre múltiplos alvos em distâncias de 2.2m a 3.0m sem passar do ponto (over-flick).'}
                  {drillMode === 'fireball_bed_defense' &&
                    'Reaja e rebata bolas de fogo em movimento antes que atinjam a defesa da sua cama.'}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={startSession}
                    className="px-6 py-2.5 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Iniciar Treino ({durationSec}s)
                  </button>
                </div>
              </div>
            )}

            {/* State Overlay: ROUND_SUMMARY */}
            {gameState === 'ROUND_SUMMARY' && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
                <p className="text-xs text-emerald-400 font-mono tabular-nums mb-1">
                  Sessão Concluída · Dados sincronizados com o Painel IA
                </p>
                <h2 className="text-2xl font-semibold text-slate-100 mb-6">
                  Relatório de Precisão 1.8.9
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-xl mb-6 text-left bg-slate-900 border border-slate-800 rounded-lg p-4">
                  <div>
                    <span className="text-xs text-slate-400 block">Precisão de Hits</span>
                    <span className="text-xl font-semibold font-mono tabular-nums text-emerald-400">
                      {currentAccuracy}%
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Rastreio Hitbox</span>
                    <span className="text-xl font-semibold font-mono tabular-nums text-slate-100">
                      {trackingPct}%
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Combo Máximo</span>
                    <span className="text-xl font-semibold font-mono tabular-nums text-amber-400">
                      {maxCombo}x
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Alcance Médio</span>
                    <span className="text-xl font-semibold font-mono tabular-nums text-slate-100">
                      {avgReach}m
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 font-mono mb-6">
                  Diagnóstico de Movimento: <strong className="text-slate-100">{aimBiasLabel}</strong>
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={startSession}
                    className="px-5 py-2.5 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Treinar Novamente
                  </button>
                  <button
                    type="button"
                    onClick={onNavigateToAi}
                    className="px-5 py-2.5 text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Analisar Mira no Painel IA
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Configuration & Session History Column (4 cols) */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
            <h2 className="text-base font-semibold text-slate-100">
              Parâmetros da Simulação 1.8.9
            </h2>

            {/* MC 1.8.9 Sensitivity Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="mc-sens-slider" className="text-slate-300 font-medium">
                  Sensibilidade Minecraft 1.8.9
                </label>
                <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                  {mcSens}% ({cm360} cm/360°)
                </span>
              </div>
              <input
                id="mc-sens-slider"
                type="range"
                min={5}
                max={200}
                value={mcSens}
                onChange={(e) => onChangeMcSens(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>Baixa (30%)</span>
                <span>Padrão (100%)</span>
                <span>Hyperspeed (200%)</span>
              </div>
            </div>

            {/* Difficulty Selector */}
            <div className="space-y-1.5">
              <span className="text-xs text-slate-300 font-medium block">
                Velocidade de Strafe do Oponente
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                {(['normal', 'ranked', 'insane'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setDifficulty(lvl)}
                    className={`py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      difficulty === lvl
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lvl === 'normal' ? 'Casual' : lvl === 'ranked' ? 'Ranked' : 'Speed II'}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Selector */}
            <div className="space-y-1.5">
              <span className="text-xs text-slate-300 font-medium block">Duração do Round</span>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                {[15, 30, 60].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => {
                      setDurationSec(sec);
                      if (gameState !== 'PLAYING') setTimeLeft(sec);
                    }}
                    className={`py-1.5 text-xs font-mono tabular-nums font-medium rounded transition-colors whitespace-nowrap ${
                      durationSec === sec
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sec} segundos
                  </button>
                ))}
              </div>
            </div>

            {/* Crosshair Selector */}
            <div className="space-y-1.5">
              <span className="text-xs text-slate-300 font-medium block">Retícula 1.8.9</span>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                {[
                  { id: 'cross_189', label: 'Cruz 1.8.9' },
                  { id: 'dot_precision', label: 'Ponto' },
                  { id: 'dynamic_ring', label: 'Anel' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCrosshair(c.id as CrosshairStyle)}
                    className={`py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      crosshair === c.id
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Rounds Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-100 mb-3">
              Histórico de Sessões de Mira
            </h3>
            {sessionLogs.length === 0 ? (
              <p className="text-xs text-slate-400 leading-relaxed">
                Nenhuma rodada concluída ainda. Inicie um treino de 15s ou 30s para registrar sua precisão e tendência de flick.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 font-medium">Modo</th>
                      <th className="py-2 font-medium text-right">Precisão</th>
                      <th className="py-2 font-medium text-right">Rastreio</th>
                      <th className="py-2 font-medium text-right">Combo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                    {sessionLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30">
                        <td className="py-2 font-sans text-slate-200 truncate max-w-[130px]">
                          {log.mode}
                        </td>
                        <td className="py-2 text-right text-emerald-400">{log.accuracy}%</td>
                        <td className="py-2 text-right text-slate-300">{log.trackingScore}%</td>
                        <td className="py-2 text-right text-amber-400">{log.maxCombo}x</td>
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
