/**
 * Safe Music Reward Generator (Mouse Bubble Task)
 * Per PRD: fixed lane→note mapping, record actionTrace, pattern analysis, generate 10-15s safe music reward.
 */

const LANE_DEFS = [
  { id: 1, color: "#e34f4f", note: "C4" }, // red
  { id: 2, color: "#f28c28", note: "D4" }, // orange
  { id: 3, color: "#f2c14f", note: "E4" }, // yellow
  { id: 4, color: "#3e7ab8", note: "G4" }, // blue
  { id: 5, color: "#4b4ba8", note: "A4" }, // indigo
];

const DEFAULT_SESSION_CONFIG = {
  volumeLevel: "medium", // low | medium | high
  rhythmDensity: "normal", // sparse | normal
  timbre: "piano", // piano | epiano | guitar
  feedbackLatencyMs: 0, // 0 | 500
  immediateToneMode: "full", // full | visual | off
  rewardEnabled: true,
  rewardBpm: 125,
  rewardDurationSec: 10,
  expertMode: false,
  // Additional parameters
  dynamicContrast: 0.1, // 0-0.5, dynamic contrast
  harmonyType: 'I-V', // harmony type: 'I-V', 'I-IV', 'I-vi', 'I-IV-V', 'I-vi-IV-V'
  instrument: 'piano', // instrument: 'piano', 'epiano', 'guitar'
};

const REWARD_SETTINGS = {
  minDurationSec: 10,
  maxDurationSec: 20,
  // 安全范围由 SafetyEnvelope 控制，这里只定义绝对边界
  absoluteMinBpm: 100,
  absoluteMaxBpm: 140,
  baseBpm: 125,
  pentatonic: ["C4", "D4", "E4", "G4", "A4"],
};

const INSTRUMENT_DEFS = {
  'piano': 0,    // Acoustic Grand Piano
  'epiano': 4,   // Electric Piano 1
  'guitar': 24,  // Acoustic Guitar (nylon)
};

const NOTE_TO_SEMITONE = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const LANES_BY_NOTE = {
  C: 1,
  D: 2,
  E: 3,
  G: 4,
  A: 5,
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function midiFromNoteName(name) {
  const match = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!match) return 60;
  const [, letter, accidental, octaveStr] = match;
  const base = NOTE_TO_SEMITONE[letter] ?? 0;
  const shift = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  const octave = parseInt(octaveStr, 10);
  return base + shift + (octave + 1) * 12;
}

function freqFromMidi(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * 将任意音名投影到 C 大调五声音阶（安全音域）
 */
function projectToPentatonic(noteName) {
  const letter = (noteName || "C")[0];
  switch (letter) {
    case "C":
      return "C4";
    case "D":
      return "D4";
    case "E":
    case "F":
      return "E4";
    case "G":
      return "G4";
    case "A":
    case "B":
      return "A4";
    default:
      return "C4";
  }
}

/**
 * 生成 motif 音程模板
 */
function motifTemplates(patternType) {
  if (patternType === "repetitive") return [[0, 0, 0]];
  if (patternType === "exploratory") return [[0, 2, 4], [0, -2, -4]];
  if (patternType === "dense") return [[0, 0, 2, 0], [0, 2, 0, -2]];
  if (patternType === "sparse") return [[0], [0, 2]];
  return [[0, 2, 0], [0, 2, 4]];
}

class AdvancedMusicGenerator {
  constructor() {
    this.sessionConfig = { ...DEFAULT_SESSION_CONFIG };
    // 缓存原始参数（未经约束）
    this.lastRawParams = null;
    // 缓存约束后参数
    this.lastConstrainedParams = null;
  }

  setSessionConfig(config = {}) {
    this.sessionConfig = { ...DEFAULT_SESSION_CONFIG, ...config };
    // 将 timbre 映射到 instrument（兼容设置面板）
    if (config.timbre && !config.instrument) {
      const timbreToInstrument = {
        'soft': 'piano',
        'bright': 'piano',
        'piano': 'piano',
        'epiano': 'epiano',
        'guitar': 'guitar'
      };
      this.sessionConfig.instrument = timbreToInstrument[config.timbre] || 'piano';
    }
  }

  getSessionConfig() {
    return { ...this.sessionConfig };
  }

  /**
   * 从用户行为数据计算原始音乐参数（未经安全约束）
   * @param {Array} actions - 用户点击动作序列
   * @returns {Object} 原始参数 { rawBpm, rawContrast, rawIntervals, rawVolume }
   */
  deriveRawParamsFromBehavior(actions) {
    if (!actions || actions.length < 2) {
      return {
        rawBpm: REWARD_SETTINGS.baseBpm,
        rawContrast: 0.1,
        rawIntervals: [],
        rawVolume: 0.7,
        derivationMethod: 'default',
      };
    }

    const ordered = [...actions].sort((a, b) => a.timeOffset - b.timeOffset);
    
    // 计算点击间隔序列
    const intervals = [];
    for (let i = 1; i < ordered.length; i++) {
      const dt = (ordered[i].timeOffset - ordered[i - 1].timeOffset) * 1000; // 转为毫秒
      if (dt > 0 && dt < 10000) { // 过滤异常值（>10秒视为走神）
        intervals.push(dt);
      }
    }

    if (intervals.length === 0) {
      return {
        rawBpm: REWARD_SETTINGS.baseBpm,
        rawContrast: 0.1,
        rawIntervals: [],
        rawVolume: 0.7,
        derivationMethod: 'default',
      };
    }

    // 计算中位数间隔 → 原始 BPM
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
    const rawBpm = Math.round(60000 / medianInterval);

    // 稳健对比度: 使用 MAD/median，并上限压缩
    // const sortedIntervals = [...intervals].sort((a, b) => a - b); // Removed duplicate declaration
    const medianInterval2 = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
    const absDevs = intervals.map(v => Math.abs(v - medianInterval2)).sort((a, b) => a - b);
    const mad = absDevs[Math.floor(absDevs.length / 2)] || 0;
    const robustCv = medianInterval2 > 0 ? (mad / medianInterval2) : 0;
    let rawContrast = clamp(robustCv * 0.8, 0, 0.4);
    if (intervals.length < 5) rawContrast = 0.1;

    // 计算点击密度 → 原始音量
    const totalDuration = ordered[ordered.length - 1].timeOffset - ordered[0].timeOffset;
    const hitsPerSec = totalDuration > 0 ? ordered.length / totalDuration : 1;
    // 密度越高，音量越大（0.5-1.0 范围）
    const rawVolume = clamp(0.5 + hitsPerSec * 0.1, 0.5, 1.0);

    return {
      rawBpm: clamp(rawBpm, REWARD_SETTINGS.absoluteMinBpm, REWARD_SETTINGS.absoluteMaxBpm),
      rawContrast,
      rawIntervals: intervals,
      rawVolume,
      medianInterval,
      robustCv,
      hitsPerSec,
      derivationMethod: 'behavior',
    };
  }

  /**
   * 通过 SafetyEnvelope 约束原始参数
   * @param {Object} rawParams - 原始参数
   * @returns {Object} 约束后的参数，包含 clampLog
   */
  constrainParamsWithEnvelope(rawParams) {
    const envelope = window.safetyEnvelope;
    const clampLog = [];

    let safeBpm = rawParams.rawBpm;
    let safeContrast = rawParams.rawContrast;
    let safeVolume = rawParams.rawVolume;

    if (envelope) {
      // 通过 SafetyEnvelope 约束，会自动记录拦截
      const originalBpm = rawParams.rawBpm;
      safeBpm = envelope.setParam('tempo', rawParams.rawBpm);
      if (safeBpm !== originalBpm) {
        clampLog.push({
          param: 'tempo',
          original: originalBpm,
          clamped: safeBpm,
          rule: `tempo_range_[${envelope.getParamRange('tempo')?.min}, ${envelope.getParamRange('tempo')?.max}]`,
        });
      }

      const originalVolume = rawParams.rawVolume;
      safeVolume = envelope.setParam('volume', rawParams.rawVolume);
      if (safeVolume !== originalVolume) {
        clampLog.push({
          param: 'volume',
          original: originalVolume,
          clamped: safeVolume,
          rule: `volume_range_[${envelope.getParamRange('volume')?.min}, ${envelope.getParamRange('volume')?.max}]`,
        });
      }

      // 对比度目前 SafetyEnvelope 没有直接支持，用硬编码安全范围
      const contrastSafeMax = 0.1;
      if (rawParams.rawContrast > contrastSafeMax) {
        safeContrast = contrastSafeMax;
        clampLog.push({
          param: 'contrast',
          original: rawParams.rawContrast,
          clamped: safeContrast,
          rule: `contrast_range_[0, ${contrastSafeMax}]`,
        });
      }
    } else {
      // 没有 SafetyEnvelope，使用硬编码安全范围
      const safeRanges = {
        tempo: { min: 120, max: 130 },
        volume: { min: 0.3, max: 0.8 },
        contrast: { min: 0, max: 0.1 },
      };

      if (rawParams.rawBpm < safeRanges.tempo.min || rawParams.rawBpm > safeRanges.tempo.max) {
        safeBpm = clamp(rawParams.rawBpm, safeRanges.tempo.min, safeRanges.tempo.max);
        clampLog.push({
          param: 'tempo',
          original: rawParams.rawBpm,
          clamped: safeBpm,
          rule: `tempo_range_[${safeRanges.tempo.min}, ${safeRanges.tempo.max}]`,
        });
      }

      if (rawParams.rawVolume < safeRanges.volume.min || rawParams.rawVolume > safeRanges.volume.max) {
        safeVolume = clamp(rawParams.rawVolume, safeRanges.volume.min, safeRanges.volume.max);
        clampLog.push({
          param: 'volume',
          original: rawParams.rawVolume,
          clamped: safeVolume,
          rule: `volume_range_[${safeRanges.volume.min}, ${safeRanges.volume.max}]`,
        });
      }

      if (rawParams.rawContrast > safeRanges.contrast.max) {
        safeContrast = safeRanges.contrast.max;
        clampLog.push({
          param: 'contrast',
          original: rawParams.rawContrast,
          clamped: safeContrast,
          rule: `contrast_range_[${safeRanges.contrast.min}, ${safeRanges.contrast.max}]`,
        });
      }
    }

    return {
      safeBpm,
      safeContrast,
      safeVolume,
      clampLog,
      wasConstrained: clampLog.length > 0,
    };
  }

  /**
   * 将原始间隔序列量化到 BPM 网格
   * @param {Array} rawIntervals - 原始间隔序列（毫秒）
   * @param {number} targetBpm - 目标 BPM
   * @returns {Array} 量化后的间隔序列
   */
  quantizeIntervalsToGrid(rawIntervals, targetBpm) {
    if (!rawIntervals || rawIntervals.length === 0) return [];
    
    const beatMs = 60000 / targetBpm; // 一拍的毫秒数
    const gridOptions = [0.25, 0.5, 1, 1.5, 2, 3, 4]; // 可用的拍数选项

    return rawIntervals.map(interval => {
      const beats = interval / beatMs;
      // 找到最接近的网格点
      let closest = gridOptions[0];
      let minDiff = Math.abs(beats - closest);
      for (const option of gridOptions) {
        const diff = Math.abs(beats - option);
        if (diff < minDiff) {
          minDiff = diff;
          closest = option;
        }
      }
      return {
        originalMs: interval,
        quantizedBeats: closest,
        quantizedMs: closest * beatMs,
      };
    });
  }

  /**
   * 将 GameEngine session 转换为 ActionTrace，兼容旧数据（基于 note 名推 lane）
   */
  buildActionTraceFromSession(session) {
    const notes = session?.notes || [];
    const startedAt = session?.startedAt || performance.now();
    return notes
      .map((n) => {
        const noteName = typeof n.name === "string" ? n.name : "C4";
        const letter = noteName[0];
        const laneId = LANES_BY_NOTE[letter] || 1;
        const timeOffset = typeof n.dt === "number" ? n.dt / 1000 : 0;
        return {
          timeOffset,
          laneId,
          note: LANE_DEFS[laneId - 1]?.note || projectToPentatonic(noteName),
        };
      })
      .sort((a, b) => a.timeOffset - b.timeOffset);
  }

  /**
   * 模式分析，输出 PatternSummary
   */
  analyzePatterns(actions) {
    if (!actions || actions.length === 0) {
      return {
        dominantNote: "C4",
        repetitionRatio: 0,
        diversity: 0,
        patternType: "sparse",
        detectedMotifs: [],
        hitsPerSec: 0,
        totalClicks: 0,
        dominantLaneRatio: 0,
        dominantLaneId: 1,
        avgRunLen: 0,
        maxRunLen: 0,
        laneDiversity: 0,
        transitionEntropy: 0,
        hitStrict: 0,
        coverage: 0,
        seqScore: 0,
        repScore: 0,
        expScore: 0,
      };
    }

    const ordered = [...actions].sort(
      (a, b) => (a.timeOffset || 0) - (b.timeOffset || 0)
    );
    const totalClicks = ordered.length;
    const countsByNote = {};
    const countsByLane = {};
    ordered.forEach((a) => {
      countsByNote[a.note] = (countsByNote[a.note] || 0) + 1;
      countsByLane[a.laneId] = (countsByLane[a.laneId] || 0) + 1;
    });

    const dominantNote = Object.entries(countsByNote).sort(
      (a, b) => b[1] - a[1]
    )[0][0];

    const dominantLaneEntry = Object.entries(countsByLane).sort(
      (a, b) => b[1] - a[1]
    )[0];
    const dominantLaneId = dominantLaneEntry ? parseInt(dominantLaneEntry[0], 10) : 1;
    const dominantLaneRatio = dominantLaneEntry
      ? dominantLaneEntry[1] / totalClicks
      : 0;

    // Run-length 统计
    const runLens = [];
    let run = 1;
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i].laneId === ordered[i - 1].laneId) {
        run++;
      } else {
        runLens.push(run);
        run = 1;
      }
    }
    runLens.push(run);
    const avgRunLen =
      runLens.reduce((sum, v) => sum + v, 0) / runLens.length;
    const maxRunLen = Math.max(...runLens);

    // 重复段统计：同 lane 连续 ≥3 视为重复段
    let repetitionHits = 0;
    for (let i = 0; i < ordered.length; i++) {
      let streak = 1;
      while (
        i + streak < ordered.length &&
        ordered[i + streak].laneId === ordered[i].laneId
      ) {
        streak++;
      }
      if (streak >= 3) repetitionHits += streak;
      i += streak - 1;
    }
    const repetitionRatio = clamp(
      repetitionHits / ordered.length,
      0,
      1
    );

    const laneDiversity = Object.keys(countsByLane).length;
    const diversity = laneDiversity / LANE_DEFS.length;

    // 检测最常见 3 音 motif（n-gram）
    const motifCounts = {};
    for (let i = 0; i <= ordered.length - 3; i++) {
      const key = `${ordered[i].note}-${ordered[i + 1].note}-${
        ordered[i + 2].note
      }`;
      motifCounts[key] = (motifCounts[key] || 0) + 1;
    }
    const detectedMotifs = Object.entries(motifCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map((entry) => entry[0].split("-"));

    const durationSec = Math.max(
      ordered[ordered.length - 1].timeOffset || 0,
      1
    );
    const hitsPerSec = ordered.length / durationSec;

    // 转移熵（25 种转移）
    let transitionEntropy = 0;
    if (ordered.length >= 2) {
      const transitionCounts = {};
      for (let i = 0; i < ordered.length - 1; i++) {
        const key = `${ordered[i].laneId}-${ordered[i + 1].laneId}`;
        transitionCounts[key] = (transitionCounts[key] || 0) + 1;
      }
      const totalTransitions = ordered.length - 1;
      let entropy = 0;
      Object.values(transitionCounts).forEach((count) => {
        const p = count / totalTransitions;
        entropy -= p * Math.log(p);
      });
      transitionEntropy = clamp(entropy / Math.log(25), 0, 1);
    }

    const { hitStrict, coverage } = this.detectCDEGAStrict(ordered, {
      maxWindow: 7,
      maxGapSec: 1.2,
    });
    if (hitStrict > 0) {
      detectedMotifs.push(["C", "D", "E", "G", "A"]);
    }

    const sequentialPass = hitStrict >= 2 && coverage >= 0.25 && laneDiversity >= 4;
    const repetitivePass =
      dominantLaneRatio >= 0.6 &&
      (maxRunLen >= 4 || avgRunLen >= 2.2) &&
      transitionEntropy <= 0.4;
    const exploratoryPass =
      laneDiversity >= 5 &&
      transitionEntropy >= 0.6 &&
      dominantLaneRatio <= 0.45 &&
      !sequentialPass &&
      !repetitivePass;

    const seqScore = clamp(Math.min(hitStrict / 3, coverage / 0.3, laneDiversity / 5), 0, 1);
    const runScore = clamp(Math.max(maxRunLen / 4, avgRunLen / 2.2), 0, 1);
    const repScore = clamp(
      0.4 * dominantLaneRatio + 0.3 * runScore + 0.3 * (1 - transitionEntropy),
      0,
      1
    );
    const expScore = clamp(
      0.4 * (laneDiversity / 5) + 0.3 * transitionEntropy + 0.3 * (1 - dominantLaneRatio),
      0,
      1
    );

    const scores = [
      { type: "sequential_pentatonic", score: sequentialPass ? seqScore : 0 },
      { type: "repetitive", score: repetitivePass ? repScore : 0 },
      { type: "exploratory", score: exploratoryPass ? expScore : 0 },
    ].sort((a, b) => b.score - a.score);

    // 放宽模式判断阈值，让更多情况能被识别为有模式
    // 原来要求 score >= 0.6 且差距 >= 0.15，现在放宽到 score >= 0.4 且差距 >= 0.1
    let patternType = "mixed";
    if (scores[0].score >= 0.4 && scores[0].score - scores[1].score >= 0.1) {
      patternType = scores[0].type;
    } else if (scores[0].score >= 0.3) {
      // 即使差距不够，只要有一定分数也使用该模式
      patternType = scores[0].type;
    }

    return {
      dominantNote,
      repetitionRatio,
      diversity,
      patternType,
      detectedMotifs,
      hitsPerSec,
      totalClicks,
      dominantLaneRatio,
      dominantLaneId,
      avgRunLen,
      maxRunLen,
      laneDiversity,
      transitionEntropy,
      hitStrict,
      coverage,
      seqScore,
      repScore,
      expScore,
    };
  }

  /**
   * CDEGA 严格命中检测：短窗口 + 时间约束
   */
  detectCDEGAStrict(actions, { maxWindow = 7, maxGapSec = 1.2 } = {}) {
    if (!actions || actions.length < 5) return { hitStrict: 0, coverage: 0 };
    const target = ["C", "D", "E", "G", "A"];
    const letters = actions.map((a) => (a.note || "C")[0]);
    let hitStrict = 0;
    const covered = new Set();

    for (let i = 0; i < actions.length; i++) {
      if (letters[i] !== "C") continue;
      const windowEnd = i + maxWindow - 1;
      let lastIdx = i;
      let lastTime = actions[i].timeOffset || 0;
      const indices = [i];
      let ok = true;
      for (let t = 1; t < target.length; t++) {
        let foundIdx = -1;
        for (let j = lastIdx + 1; j < actions.length && j <= windowEnd; j++) {
          if (letters[j] !== target[t]) continue;
          const dt = (actions[j].timeOffset || 0) - lastTime;
          if (dt <= maxGapSec) {
            foundIdx = j;
            break;
          }
          break;
        }
        if (foundIdx < 0) {
          ok = false;
          break;
        }
        indices.push(foundIdx);
        lastIdx = foundIdx;
        lastTime = actions[foundIdx].timeOffset || lastTime;
      }
      if (ok) {
        hitStrict += 1;
        indices.forEach((idx) => covered.add(idx));
      }
    }

    const coverage = clamp(covered.size / actions.length, 0, 1);
    return { hitStrict, coverage };
  }

  /**
   * 生成奖励音乐（主入口）
   * @param {Array} actions - 用户动作序列
   * @param {Object} sessionConfig - 会话配置
   * @param {Object} options - 额外选项 { skipEnvelope: false }
   */
  generateReward(actions, sessionConfig = {}, options = {}) {
    const config = { ...DEFAULT_SESSION_CONFIG, ...sessionConfig };
    const skipEnvelope = options.skipEnvelope || false;
    window._lastMusicGenerator = this;

    if (!config.rewardEnabled) {
      const actionTrace = actions || [];
      const patternSummary = this.analyzePatterns(actionTrace);
      const mutedBpm = REWARD_SETTINGS.baseBpm;
      const melodySpec = {
        scale: "C pentatonic",
        bpm: mutedBpm,
        durationSec: 0,
        phrases: [],
        chordTrack: [],
        rhythmDensity: config.rhythmDensity,
        timbre: config.timbre,
        styleType: "disabled",
      };
      const sequence = {
        notes: [],
        totalTime: 0,
        tempos: [{ qpm: mutedBpm, time: 0 }],
        timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
      };
      sequence.debugPayload = {
        sessionConfig: config,
        actionTrace,
        patternSummary,
        melodySpec,
      };
      return { sequence, actionTrace, patternSummary, melodySpec };
    }

    const actionTrace = actions || [];
    const patternSummary = this.analyzePatterns(actionTrace);

    // 从用户行为派生原始参数
    const rawParams = this.deriveRawParamsFromBehavior(actionTrace);
    this.lastRawParams = rawParams;

    let bpm, contrast, volume;
    let clampLog = [];

    // 检查是否有专家手动设置的参数
    // 使用 config.expertOverride 标记，或者检查 config.rewardBpm 是否被显式设置
    const isExpertMode = config.expertMode === true || config.expertOverride === true;
    const hasExplicitBpm = typeof config.rewardBpm === 'number';
    const hasExplicitContrast = typeof config.dynamicContrast === 'number';

    if (skipEnvelope) {
      // 无约束模式：直接使用原始参数（不经过任何约束）
      bpm = rawParams.rawBpm;
      contrast = rawParams.rawContrast;
      volume = rawParams.rawVolume;
      console.log('[MusicGenerator] 无约束模式，使用原始参数:', { bpm, contrast, volume });
    } else if (isExpertMode && (hasExplicitBpm || hasExplicitContrast)) {
      // 专家模式：使用专家手动设置的参数（不经过行为派生）
      bpm = hasExplicitBpm ? config.rewardBpm : rawParams.rawBpm;
      contrast = hasExplicitContrast ? config.dynamicContrast : rawParams.rawContrast;
      
      // 音量从 volumeLevel 转换
      if (config.volumeLevel) {
        volume = config.volumeLevel === 'low' ? 0.4 : config.volumeLevel === 'high' ? 0.9 : 0.7;
      } else {
        volume = rawParams.rawVolume;
      }
      
      console.log('[MusicGenerator] 专家模式，使用手动设置参数:', { 
        bpm, 
        contrast, 
        volume,
        configBpm: config.rewardBpm,
        configContrast: config.dynamicContrast
      });
    } else {
      // 默认模式：从行为派生参数，然后通过 SafetyEnvelope 约束
      const constrained = this.constrainParamsWithEnvelope(rawParams);
      this.lastConstrainedParams = constrained;
      bpm = constrained.safeBpm;
      contrast = constrained.safeContrast;
      volume = constrained.safeVolume;
      clampLog = constrained.clampLog;
      
      if (constrained.wasConstrained) {
        console.log('[MusicGenerator] 参数被约束:', clampLog);
      }
    }

    const secondsPerBeat = 60 / bpm;
    const rewardDurationSec = clamp(
      Number(config.rewardDurationSec ?? REWARD_SETTINGS.maxDurationSec),
      8,
      REWARD_SETTINGS.maxDurationSec
    );
    const beatsTotal = Math.max(8, Math.round(rewardDurationSec / secondsPerBeat));

    // 量化原始间隔到 BPM 网格
    const quantizedIntervals = this.quantizeIntervalsToGrid(rawParams.rawIntervals, bpm);

    const pitchPool = this.buildPitchPool(actionTrace, patternSummary);
    const styleType =
      patternSummary?.patternType === "sequential_pentatonic"
        ? "sequential"
        : patternSummary?.patternType === "repetitive"
        ? "repetitive"
        : patternSummary?.patternType === "exploratory"
        ? "exploratory"
        : "mixed";

    // 使用量化后的节奏生成旋律
    const phraseNotes = this.generateBehaviorDrivenMelody(
      styleType,
      pitchPool,
      actionTrace,
      quantizedIntervals,
      secondsPerBeat,
      beatsTotal,
      patternSummary,
      config.rhythmDensity
    );

    const { chordTrack, chordNotes } = this.generateSimpleChords(
      beatsTotal,
      secondsPerBeat,
      phraseNotes[0]?.notes || [],
      styleType,
      config.harmonyType || 'I-V'
    );

    const melodySpec = {
      scale: "C pentatonic",
      bpm,
      durationSec: rewardDurationSec,
      phrases: [
        {
          label: styleType === "sequential" ? "CDEGA" : styleType === "mixed" ? "MIX" : "A",
          notes: phraseNotes[0]?.notes?.map((n) => n.name) || [],
          repeats: 1,
        },
      ],
      chordTrack,
      specialMotif: styleType === "sequential" ? "C-D-E-G-A" : null,
      styleType,
      rhythmDensity: config.rhythmDensity,
      timbre: config.timbre,
      // 新增：原始参数和约束信息
      rawParams,
      constraintInfo: skipEnvelope ? null : { clampLog, wasConstrained: clampLog.length > 0 },
    };

    // 应用派生的音量和对比度
    const adjustedConfig = {
      ...config,
      volumeLevel: volume > 0.8 ? 'high' : volume < 0.5 ? 'low' : 'medium',
      dynamicContrast: contrast,
    };

    const sequence = this.toMagentaSequence(phraseNotes, chordNotes, bpm, adjustedConfig);

    sequence.debugPayload = {
      sessionConfig: adjustedConfig,
      actionTrace,
      patternSummary,
      melodySpec,
      rawParams,
      clampLog,
      skipEnvelope,
    };

    return { sequence, actionTrace, patternSummary, melodySpec, rawParams, clampLog };
  }

  /**
   * 生成无约束音乐（用于对比实验）
   */
  generateUnconstrainedReward(actions, sessionConfig = {}) {
    return this.generateReward(actions, sessionConfig, { skipEnvelope: true });
  }

  /**
   * 基于用户行为的旋律生成（使用量化后的节奏）
   */
  generateBehaviorDrivenMelody(styleType, pitchPool, actions, quantizedIntervals, secondsPerBeat, beatsTotal, patternSummary, rhythmDensity) {
    // 修复：如果检测到明显的模式（非混合），优先使用风格化生成，以增强“模式感”
    // 用户反馈“没有明显的模式感”，说明纯行为驱动（模仿用户节奏）在有明确模式时反而削弱了音乐性
    const hasStrongPattern = patternSummary && 
      ['sequential_pentatonic', 'repetitive', 'exploratory'].includes(patternSummary.patternType);

    if (hasStrongPattern) {
       return this.generateStyleMelody(styleType, pitchPool, beatsTotal, secondsPerBeat, patternSummary, rhythmDensity);
    }

    // 始终使用风格化模板生成，确保有模式感
    return this.generateStyleMelody(styleType, pitchPool, beatsTotal, secondsPerBeat, patternSummary, rhythmDensity);
  }

  /**
   * 从量化间隔生成旋律（1:1 还原用户节奏，但量化到网格）
   */
  generateMelodyFromQuantizedIntervals(pitchPool, actions, quantizedIntervals, secondsPerBeat, beatsTotal, patternSummary) {
    const notes = [];
    let currentTime = 0;
    const maxTime = beatsTotal * secondsPerBeat;

    // 使用用户实际点击的音符序列
    const orderedActions = [...actions].sort((a, b) => a.timeOffset - b.timeOffset);

    for (let i = 0; i < orderedActions.length && currentTime < maxTime; i++) {
      const action = orderedActions[i];
      const noteName = action.note || pitchPool[i % pitchPool.length];
      const midi = midiFromNoteName(noteName);

      // 使用量化后的间隔作为音符时长
      const intervalInfo = quantizedIntervals[i] || quantizedIntervals[quantizedIntervals.length - 1];
      const durationMs = intervalInfo ? intervalInfo.quantizedMs : secondsPerBeat * 1000;
      const durationSec = Math.min(durationMs / 1000, secondsPerBeat * 2); // 最长 2 拍

      notes.push({
        startTime: currentTime,
        endTime: currentTime + durationSec * 0.9, // 留 10% 空隙
        midi,
        name: noteName,
      });

      // 下一个音符的开始时间
      if (i < quantizedIntervals.length) {
        currentTime += quantizedIntervals[i].quantizedMs / 1000;
      } else {
        currentTime += secondsPerBeat;
      }
    }

    // 如果音符不够填满时长，循环填充
    if (notes.length > 0 && currentTime < maxTime) {
      const patternLength = notes.length;
      const patternDuration = currentTime;
      let loopStart = currentTime;

      while (loopStart < maxTime) {
        for (let i = 0; i < patternLength && loopStart < maxTime; i++) {
          const original = notes[i];
          const offset = loopStart - 0; // 相对于循环开始的偏移
          notes.push({
            startTime: original.startTime + loopStart,
            endTime: Math.min(original.endTime + loopStart, maxTime),
            midi: original.midi,
            name: original.name,
          });
        }
        loopStart += patternDuration;
      }
    }

    return [{ label: "BEHAVIOR", notes, repeats: 1 }];
  }

  buildPitchPool(actions, summary) {
    const base = summary?.dominantNote || "C4";
    const pool = new Set([projectToPentatonic(base)]);
    actions.forEach((a) => pool.add(projectToPentatonic(a.note)));
    if (pool.size < 3) {
      REWARD_SETTINGS.pentatonic.forEach((n) => pool.add(n));
    }
    return Array.from(pool);
  }

  /**
   * 极简儿歌风格旋律：单段 A，循环填充至目标时长
   */
  generateSimpleMelody(pitchPool, beatsTotal, secondsPerBeat, patternSummary) {
    const safePool = pitchPool.length ? pitchPool : REWARD_SETTINGS.pentatonic;
    const motif = this.buildSimpleMotif(safePool, patternSummary);
    const notes = [];
    for (let beat = 0; beat < beatsTotal; beat++) {
      const name = motif[beat % motif.length] || safePool[0];
      const midi = midiFromNoteName(name);
      const startTime = beat * secondsPerBeat;
      const duration = secondsPerBeat * 0.9; // 留一点空隙更平稳
      notes.push({
        startTime,
        endTime: startTime + duration,
        midi,
        name,
      });
    }
    return [{ label: "A", notes, repeats: 1 }];
  }

  buildSimpleMotif(pitchPool, patternSummary) {
    // 主音 + 上行/回落，确保重复性强
    const base = projectToPentatonic(patternSummary?.dominantNote || pitchPool[0] || "C4");
    const pool = [base, pitchPool[1] || base, pitchPool[0] || base, pitchPool[2] || base];
    return pool;
  }

  /**
   * 三类风格的主旋律模板
   */
  generateStyleMelody(styleType, pitchPool, beatsTotal, secondsPerBeat, patternSummary, rhythmDensity) {
    if (styleType === "sequential") {
      return this.generateCDEGAMelody(beatsTotal, secondsPerBeat, rhythmDensity);
    }
    if (styleType === "repetitive") {
      return this.generateRepetitiveMelody(pitchPool, beatsTotal, secondsPerBeat, patternSummary, rhythmDensity);
    }
    if (styleType === "mixed") {
      return this.generateMixedMelody(pitchPool, beatsTotal, secondsPerBeat, patternSummary, rhythmDensity);
    }
    return this.generateExploratoryMelody(pitchPool, beatsTotal, secondsPerBeat, rhythmDensity);
  }

  /**
   * 混合型：中性、可预测的中等结构
   */
  generateMixedMelody(pitchPool, beatsTotal, secondsPerBeat, patternSummary, rhythmDensity) {
    const phrase = this.generateSimpleMelody(pitchPool, beatsTotal, secondsPerBeat, patternSummary)[0];
    return [{
      ...phrase,
      label: "MIX",
    }];
  }

  /**
   * 重复型：1-2 个音的 loop
   */
  generateRepetitiveMelody(pitchPool, beatsTotal, secondsPerBeat, patternSummary, rhythmDensity) {
    const base = projectToPentatonic(patternSummary?.dominantNote || pitchPool[0] || "C4");
    const alt = pitchPool.find((p) => p !== base) || base;
    const template = [base, base, base, alt, base, base, base, base];
    const stepBeats = rhythmDensity === "sparse" ? 2 : 1;
    const notes = [];
    let beatCursor = 0;
    let i = 0;
    while (beatCursor < beatsTotal) {
      const name = template[i % template.length];
      const midi = midiFromNoteName(name);
      const startTime = beatCursor * secondsPerBeat;
      const duration = secondsPerBeat * stepBeats * 0.9; // 稀疏模式拉长时值
      notes.push({ startTime, endTime: startTime + duration, midi, name });
      beatCursor += stepBeats;
      i += 1;
    }
    return [{ label: "LOOP", notes, repeats: 1 }];
  }

  /**
   * 探索型：五声音阶内更“走动”的旋律
   */
  generateExploratoryMelody(pitchPool, beatsTotal, secondsPerBeat, rhythmDensity) {
    const ordered = this.getOrderedPentatonic(pitchPool);
    const template = [
      ordered[0],
      ordered[2],
      ordered[4],
      ordered[1],
      ordered[3],
      ordered[1],
      ordered[4],
      ordered[2],
      ordered[0],
      ordered[3],
      ordered[2],
      ordered[4],
      ordered[1],
      ordered[0],
      ordered[3],
      ordered[2],
    ];
    const durations = rhythmDensity === "sparse"
      ? [2, 2, 2, 2, 2, 2]
      : [
          1, 0.5, 0.5, 1,
          1, 0.5, 0.5, 1,
          1, 1, 0.5, 0.5,
          1, 0.5, 0.5, 1,
        ];
    const notes = [];
    let beatCursor = 0;
    let i = 0;
    while (beatCursor < beatsTotal) {
      const name = template[i % template.length];
      const midi = midiFromNoteName(name);
      const durationBeats = durations[i % durations.length];
      const startTime = beatCursor * secondsPerBeat;
      const duration = secondsPerBeat * durationBeats * 0.9;
      notes.push({ startTime, endTime: startTime + duration, midi, name });
      beatCursor += durationBeats;
      i += 1;
    }
    return [{ label: "WANDER", notes, repeats: 1 }];
  }

  getOrderedPentatonic(pitchPool) {
    const order = ["C4", "D4", "E4", "G4", "A4"];
    const pool = pitchPool.length ? pitchPool : REWARD_SETTINGS.pentatonic;
    const ordered = order.filter((n) => pool.includes(n));
    // 补齐缺失音
    order.forEach((n) => {
      if (!ordered.includes(n)) ordered.push(n);
    });
    return ordered.slice(0, 5);
  }

  /**
   * 特例：检测到 C-D-E-G-A 时，用固定上行/下行模板
   */
  generateCDEGAMelody(beatsTotal, secondsPerBeat, rhythmDensity) {
    const template = ["C4", "D4", "E4", "G4", "A4", "A4", "G4", "E4", "D4", "C4"]; // 上行+下行
    const notes = [];
    const stepBeats = rhythmDensity === "sparse" ? 2 : 1;
    let beatCursor = 0;
    let i = 0;
    while (beatCursor < beatsTotal) {
      const name = template[i % template.length];
      const midi = midiFromNoteName(name);
      const startTime = beatCursor * secondsPerBeat;
      const duration = secondsPerBeat * stepBeats * 0.9; // 稀疏模式拉长时值
      notes.push({
        startTime,
        endTime: startTime + duration,
        midi,
        name,
      });
      beatCursor += stepBeats;
      i += 1;
    }
    return [{ label: "CDEGA", notes, repeats: 1 }];
  }

  /**
   * 简单和弦/低音层：支持多种和声组合
   * @param {string} harmonyType - 和声类型: 'I-V', 'I-IV', 'I-vi', 'I-IV-V', 'I-vi-IV-V'
   */
  generateSimpleChords(beatsTotal, secondsPerBeat, melodyNotes, styleType, harmonyType = 'I-V') {
    const chords = [];
    const chordNotes = [];
    const barBeats = 4;
    
    // 和弦根音映射
    const chordRoots = {
      'I': 'C3',
      'IV': 'F2',
      'V': 'G2',
      'vi': 'A2'
    };
    
    // 和弦进行模式
    const progressions = {
      'I-V': ['I', 'V'],
      'I-IV': ['I', 'IV'],
      'I-vi': ['I', 'vi'],
      'I-IV-V': ['I', 'IV', 'V', 'I'],
      'I-vi-IV-V': ['I', 'vi', 'IV', 'V']
    };
    
    const progression = progressions[harmonyType] || progressions['I-V'];

    for (let b = 0; b < beatsTotal; b += barBeats) {
      const barIndex = Math.floor(b / barBeats);
      const chordType = progression[barIndex % progression.length];
      
      const barStart = b * secondsPerBeat;
      const chordRoot = chordRoots[chordType] || 'C3';
      chords.push({ beatIndex: b, chordRoot, chordType });

      const rootMidi = midiFromNoteName(chordRoot);
      const fifthMidi = rootMidi + 7; // 纯五度
      const startTime = b * secondsPerBeat;
      const endTime = Math.min((b + barBeats) * secondsPerBeat, beatsTotal * secondsPerBeat);
      const velScale = 0.7; // 约等于主音量的 70%

      chordNotes.push({
        startTime,
        endTime,
        midi: rootMidi,
        name: chordRoot,
        velocityScale: velScale,
      });
      chordNotes.push({
        startTime,
        endTime,
        midi: fifthMidi,
        name: this.getFifthNote(chordType),
        velocityScale: velScale,
      });
    }

    return { chordTrack: chords, chordNotes };
  }
  
  /**
   * 获取和弦的五度音名
   */
  getFifthNote(chordType) {
    const fifths = {
      'I': 'G3',
      'IV': 'C3',
      'V': 'D3',
      'vi': 'E3'
    };
    return fifths[chordType] || 'G3';
  }

  toMagentaSequence(phrases, chordNotes = [], bpm, config) {
    const notes = [];
    const baseVelocity =
      config.volumeLevel === "low" ? 50 : config.volumeLevel === "high" ? 95 : 75;
    const timbreScale = config.timbre === "bright" ? 1.1 : 0.85;
    
    // 动态对比度：控制音符力度的变化范围
    const dynamicContrast = config.dynamicContrast || 0.1;
    const contrastRange = baseVelocity * dynamicContrast;
    let prevVel = baseVelocity;
    
    // 获取乐器 program
    const instrumentProgram = INSTRUMENT_DEFS[config.instrument] ?? 0;

    // 乐器音域限制 (根据用户建议: 吉他不弹太高, 弦乐控制音域)
    const constrainPitch = (midi, instr) => {
      if (instr === 'guitar') {
        // Nylon Guitar range: E2(40) - B5(83). Cap high notes to avoid harshness.
        return clamp(midi, 40, 83);
      }
      return midi;
    };

    const velocityFor = (vel, noteIndex = 0) => {
      const variation = Math.sin(noteIndex * 0.5) * contrastRange;
      let target = vel + variation;
      let alpha = Math.max(0.1, Math.min(0.9, 1 - dynamicContrast));
      let smoothed = prevVel + (target - prevVel) * alpha;
      prevVel = smoothed;
      let scale = timbreScale;
      if (config.instrument === 'guitar') {
        scale *= 0.9;
      }
      return clamp(Math.round(smoothed * scale), 30, 110);
    };
    
    let noteIndex = 0;
    phrases.forEach((phrase) => {
      phrase.notes.forEach((n) => {
        notes.push({
          pitch: constrainPitch(n.midi, config.instrument),
          startTime: n.startTime,
          endTime: n.endTime,
          velocity: velocityFor(baseVelocity, noteIndex++),
          program: instrumentProgram,
          isDrum: false,
        });
      });
    });

    // 添加和弦/低音层
    chordNotes.forEach((n, idx) => {
      notes.push({
        pitch: constrainPitch(n.midi, config.instrument),
        startTime: n.startTime,
        endTime: n.endTime,
        velocity: velocityFor(baseVelocity * (n.velocityScale || 0.55), idx),
        program: instrumentProgram,
        isDrum: false,
      });
    });

    // 片段裁剪（测试模式选择窗口：左/右边界）
    const segmentStart = typeof config.segmentStartSec === 'number' ? Math.max(0, config.segmentStartSec) : 0;
    let segmentEnd = undefined;
    if (typeof config.segmentEndSec === 'number') {
      segmentEnd = Math.max(segmentStart + 0.1, Math.min(20, config.segmentEndSec));
    } else if (typeof config.rewardDurationSec === 'number') {
      segmentEnd = segmentStart + Math.max(0.1, config.rewardDurationSec);
    }
    if (segmentEnd !== undefined) {
      const cropped = [];
      for (const n of notes) {
        if (n.endTime <= segmentStart || n.startTime >= segmentEnd) continue;
        const start = Math.max(0, n.startTime - segmentStart);
        const end = Math.min(n.endTime, segmentEnd) - segmentStart;
        if (end > start) {
          cropped.push({ ...n, startTime: start, endTime: end });
        }
      }
      if (cropped.length) {
        notes.length = 0;
        notes.push(...cropped);
      }
    }

    const totalTime = (segmentEnd !== undefined)
      ? (segmentEnd - segmentStart)
      : notes.reduce((max, n) => Math.max(max, n.endTime), 0);

    return {
      notes,
      totalTime,
      tempos: [{ time: 0, qpm: bpm }],
      timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    };
  }
}

// 导出到全局
window.AdvancedMusicGenerator = AdvancedMusicGenerator;

// 兼容旧入口：基于 session -> 安全 reward 序列（有约束）
window.createRichTestMusic = function (session) {
  const generator = new AdvancedMusicGenerator();
  if (window.sessionConfig) {
    generator.setSessionConfig(window.sessionConfig);
  }
  const actions = generator.buildActionTraceFromSession(session);
  const { sequence } = generator.generateReward(actions, generator.getSessionConfig());
  return sequence;
};

// 新入口：生成无约束音乐（用于对比实验）
window.createUnconstrainedMusic = function (session) {
  const generator = new AdvancedMusicGenerator();
  if (window.sessionConfig) {
    generator.setSessionConfig(window.sessionConfig);
  }
  const actions = generator.buildActionTraceFromSession(session);
  const result = generator.generateUnconstrainedReward(actions, generator.getSessionConfig());
  
  // 保存到全局以便下载
  window.lastUnconstrainedSequence = result.sequence;
  window.lastUnconstrainedRawParams = result.rawParams;
  
  return result;
};

// 获取最近一次生成的原始参数（用于调试/审计）
window.getLastRawMusicParams = function () {
  const generator = window._lastMusicGenerator;
  if (generator) {
    return {
      rawParams: generator.lastRawParams,
      constrainedParams: generator.lastConstrainedParams,
    };
  }
  return null;
};

console.log("🎵 安全音乐奖励生成器已加载（支持行为驱动参数 + 安全约束）");
