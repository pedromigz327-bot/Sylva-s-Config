export type ActiveTab = 'aim' | 'reaction' | 'cps' | 'dpi' | 'ai-optimizer';

export interface TelemetryStats {
  aimAccuracy: number | null;
  trackingScore: number | null;
  aimBias: string;
  avgReachBlocks: number | null;
  reactionTimeMs: number | null;
  bestReactionMs: number | null;
  leftCps: number | null;
  peakLeftCps: number | null;
  rightCps: number | null;
  clickConsistency: number | null;
  aimJitterPx: number | null;
  calibratedDpi: number | null;
  recommendedMcSens: number | null;
}

export interface HardwareProfile {
  deviceType: 'Computador (PC / Notebook)' | 'Telemóvel / Tablet (PojavLauncher / Touch / OTG)';
  cpuModel: string;
  cpuCores: number;
  ramGb: number;
  gpuModel: string;
  resolution: string;
  refreshRateHz: number;
  mouseOrTouchModel: string;
  pollingRateHz: number;
  currentDpi: number;
  currentMcSens: number;
  clickTechnique: string;
  playstyle: string;
  mcClient: string;
}

export interface AIOptimizationReport {
  summaryDiagnosis: string;
  sensitivityConfig: {
    mcSensitivityPercent: string;
    optionsTxtValue: string;
    recommendedDpi: string;
    cmPer360: string;
    fovSetting: string;
    rawInputAndOs: string;
    explanation: string;
  };
  aimStabilityAdjustments: Array<{
    title: string;
    parameter: string;
    impact: string;
    instruction: string;
  }>;
  clickAndHitRegOptimizations: Array<{
    title: string;
    recommendedSetting: string;
    mechanicsTip: string;
    technicalReason: string;
  }>;
  clientPerformanceConfig: Array<{
    settingName: string;
    optimalValue: string;
    reason: string;
  }>;
  customTrainingRoutine: Array<{
    step: string;
    moduleName: string;
    duration: string;
    targetGoal: string;
    focusNote: string;
  }>;
}
