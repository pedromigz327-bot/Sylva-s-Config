import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

app.post('/api/ai/optimize-bedwars', async (req, res) => {
  try {
    const { hardwareProfile, telemetryStats, userChallenges } = req.body;

    const prompt = `
Você é um Engenheiro de Performance de Esports e Especialista Técnico em Minecraft 1.8.9 (Bedwars / PvP Competitivo — mecânicas de Hit-Select, W-Tap, S-Tap, Block-Hit, Speed Bridge, Godbridge, Knockback e Hit Registration de 20 ticks/segundo).

Analise os dados reais de hardware do dispositivo (Computador ou Telemóvel/PojavLauncher) e as métricas de telemetria medidas nos testes práticos do jogador:

PERFIL DO DISPOSITIVO (COMPUTADOR / TELEMÓVEL):
- Plataforma: ${hardwareProfile?.deviceType || 'Computador (PC)'}
- CPU / SoC: ${hardwareProfile?.cpuModel || 'Não especificado'} (${hardwareProfile?.cpuCores || 4} threads lógicas)
- Memória RAM: ${hardwareProfile?.ramGb || 8} GB
- GPU / Renderizador: ${hardwareProfile?.gpuModel || 'Integrada'}
- Monitor / Tela: ${hardwareProfile?.resolution || '1920x1080'} @ ${hardwareProfile?.refreshRateHz || 60}Hz
- Periférico / Controle: ${hardwareProfile?.mouseOrTouchModel || 'Mouse Gamer Óptico'}
- Polling Rate / Amostragem de Toque: ${hardwareProfile?.pollingRateHz || 1000}Hz
- DPI Atual / Sensibilidade Base: ${hardwareProfile?.currentDpi || 800} DPI · Sensibilidade MC 1.8.9: ${hardwareProfile?.currentMcSens || 50}%
- Técnica de Clique Principal: ${hardwareProfile?.clickTechnique || 'Normal / Butterfly'}
- Estilo no Bedwars: ${hardwareProfile?.playstyle || 'Rusher / First-Rush'}
- Cliente Utilizado: ${hardwareProfile?.mcClient || 'Lunar Client / Forge 1.8.9 OptiFine'}

TELEMETRIA MEDIDA NO LABORATÓRIO DO JOGADOR:
- Precisão de Mira 1.8.9: ${telemetryStats?.aimAccuracy ?? 'Não testado'}%
- Taxa de Rastreio (Strafe Tracking): ${telemetryStats?.trackingScore ?? 'Não testado'}%
- Tendência de Erro de Mira: ${telemetryStats?.aimBias || 'Equilibrada'}
- Velocidade de Reação Média: ${telemetryStats?.reactionTimeMs ?? 'Não testado'} ms
- CPS Médio (Left Click PvP): ${telemetryStats?.leftCps ?? 'Não testado'} CPS (Pico: ${telemetryStats?.peakLeftCps ?? 'N/A'} CPS)
- CPS Médio (Right Click Bridge): ${telemetryStats?.rightCps ?? 'Não testado'} CPS
- Estabilidade do Ritmo de Clique: ${telemetryStats?.clickConsistency ?? 'Não testado'}%
- Tremor da Mira durante Clique (Aim Jitter): ${telemetryStats?.aimJitterPx ?? 'Não testado'} px
- DPI Calibrado/Calculado: ${telemetryStats?.calibratedDpi ?? hardwareProfile?.currentDpi ?? 800} DPI

DIFICULDADE RELATADA PELO JOGADOR:
"${userChallenges || 'Quero melhorar a estabilidade da mira durante combos em 1.8.9, diminuir o tremor ao clicar rápido e otimizar o registro de hits e FPS.'}"

Gere um relatório técnico completo, preciso e específico para o motor do Minecraft 1.8.9 em Português. Calcule o valor exato de mouseSensitivity para o arquivo options.txt usando a fórmula real da 1.8.9 (options.txt = (Sensibilidade% / 200)). Se for Telemóvel (PojavLauncher / Bedrock-Geyser / Touch ou OTG), adapte todas as recomendações para resolução escala, giroscópio/touch split controls, renderizador (Holy GL4ES / VirGL / Angle) e alocação de memória JVM mobile.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'Você responde exclusivamente em JSON estruturado seguindo o schema fornecido, com linguagem técnica, direta e autêntica de Minecraft 1.8.9 competitivo.',
        temperature: 0.4,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summaryDiagnosis: {
              type: Type.STRING,
              description:
                'Diagnóstico técnico direto (2-3 frases) relacionando o hardware do usuário, sua velocidade de reação, CPS e tremor de mira no Bedwars 1.8.9.',
            },
            sensitivityConfig: {
              type: Type.OBJECT,
              properties: {
                mcSensitivityPercent: {
                  type: Type.STRING,
                  description: 'Sensibilidade recomendada dentro do Minecraft 1.8.9 em porcentagem (ex: 44%)',
                },
                optionsTxtValue: {
                  type: Type.STRING,
                  description: 'Valor exato da linha mouseSensitivity no arquivo options.txt (ex: mouseSensitivity:0.22000000)',
                },
                recommendedDpi: {
                  type: Type.STRING,
                  description: 'DPI ideal no mouse ou configuração de velocidade de ponteiro/toque no telemóvel',
                },
                cmPer360: {
                  type: Type.STRING,
                  description: 'Distância física estimada em cm/360° para 1.8.9',
                },
                fovSetting: {
                  type: Type.STRING,
                  description: 'FOV ideal e recomendação sobre Dynamic FOV para julgar alcance de 3.0 blocos',
                },
                rawInputAndOs: {
                  type: Type.STRING,
                  description: 'Configuração de Raw Input (Mod 1.8.9), Windows Pointer Speed (6/11) ou amostragem touch',
                },
                explanation: {
                  type: Type.STRING,
                  description: 'Explicação técnica do porquê essa combinação elimina o overflick/underflick do usuário',
                },
              },
              required: [
                'mcSensitivityPercent',
                'optionsTxtValue',
                'recommendedDpi',
                'cmPer360',
                'fovSetting',
                'rawInputAndOs',
                'explanation',
              ],
            },
            aimStabilityAdjustments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  parameter: { type: Type.STRING },
                  impact: { type: Type.STRING },
                  instruction: { type: Type.STRING },
                },
                required: ['title', 'parameter', 'impact', 'instruction'],
              },
            },
            clickAndHitRegOptimizations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  recommendedSetting: { type: Type.STRING },
                  mechanicsTip: { type: Type.STRING },
                  technicalReason: { type: Type.STRING },
                },
                required: ['title', 'recommendedSetting', 'mechanicsTip', 'technicalReason'],
              },
            },
            clientPerformanceConfig: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  settingName: { type: Type.STRING },
                  optimalValue: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['settingName', 'optimalValue', 'reason'],
              },
            },
            customTrainingRoutine: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  step: { type: Type.STRING },
                  moduleName: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  targetGoal: { type: Type.STRING },
                  focusNote: { type: Type.STRING },
                },
                required: ['step', 'moduleName', 'duration', 'targetGoal', 'focusNote'],
              },
            },
          },
          required: [
            'summaryDiagnosis',
            'sensitivityConfig',
            'aimStabilityAdjustments',
            'clickAndHitRegOptimizations',
            'clientPerformanceConfig',
            'customTrainingRoutine',
          ],
        },
      },
    });

    const rawText = response.text;
    if (!rawText) {
      return res.status(500).json({ error: 'Resposta vazia do modelo de IA.' });
    }

    const parsed = JSON.parse(rawText.trim());
    return res.json(parsed);
  } catch (error: any) {
    console.error('Erro na rota /api/ai/optimize-bedwars:', error);
    return res.status(500).json({
      error: error?.message || 'Falha ao processar recomendações de otimização com IA.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BedwarsLab 1.8.9 server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
