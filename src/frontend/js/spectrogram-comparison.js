/**
 * Spectrogram Comparison Tool
 * Generates unconstrained vs constrained music spectrogram comparison
 * Uses log-mel spectrogram and loudness contour visualization
 */

class SpectrogramComparison {
  constructor() {
    this.sampleRate = 44100;
    this.fftSize = 2048;
    this.hopSize = 1024;
    this.numMelBins = 64;
    this.minFreq = 20;
    this.maxFreq = 8000;
    this.focusLowerRatio = 0.30;
    this.loudnessFocusTopRatio = 0.10;
    
    // Fixed random seed for reproducibility
    this.fixedSeed = 42;
    
    // Safety envelope bounds (for annotation)
    this.envelopeBounds = {
      loudnessMax: -14, // LUFS
      loudnessMin: -30,
      lraMax: 7, // LU
    };
  }

  /**
   * Generate comparison data
   * @param {Object} session - Game session data
   * @returns {Object} Audio data and analysis results for both versions
   */
  async generateComparisonData(session) {
    if (!session || !session.notes || session.notes.length < 2) {
      throw new Error('Valid session data required');
    }

    const GenCtor = (typeof window.AdvancedMusicGenerator === 'function')
      ? window.AdvancedMusicGenerator
      : (typeof AdvancedMusicGenerator === 'function' ? AdvancedMusicGenerator : null);
    if (!GenCtor) throw new TypeError('AdvancedMusicGenerator is not available');
    const generator = new GenCtor();
    
    // Set fixed seed
    if (window.sessionConfig) {
      generator.setSessionConfig({ ...window.sessionConfig, randomSeed: this.fixedSeed });
    }

    const actions = generator.buildActionTraceFromSession(session);
    const baseCfg = window.sessionConfig ? { ...window.sessionConfig } : {};
    const uncCfg = { ...baseCfg, randomSeed: this.fixedSeed, expertMode: true, expertOverride: true };
    generator.setSessionConfig(uncCfg);

    // Generate unconstrained version
    const unconstrainedResult = generator.generateReward(actions, generator.getSessionConfig(), { skipEnvelope: true });
    
    // Generate constrained version
    const conCfg = { ...baseCfg, randomSeed: this.fixedSeed, expertMode: false, expertOverride: false };
    delete conCfg.dynamicContrast;
    generator.setSessionConfig(conCfg);
    const constrainedResult = generator.generateReward(actions, generator.getSessionConfig(), { skipEnvelope: false });

    // Render to audio
    const unconstrainedAudio = await this.renderToAudioBuffer(unconstrainedResult.sequence);
    const constrainedAudio = await this.renderToAudioBuffer(constrainedResult.sequence);

    // Compute spectrograms
    const unconstrainedSpec = this.computeLogMelSpectrogram(unconstrainedAudio);
    const constrainedSpec = this.computeLogMelSpectrogram(constrainedAudio);

    // Compute loudness contours
    const unconstrainedLoudness = this.computeLoudnessContour(unconstrainedAudio);
    const constrainedLoudness = this.computeLoudnessContour(constrainedAudio);

    // Compute LRA (Loudness Range)
    const unconstrainedLRA = this.computeLRA(unconstrainedLoudness);
    const constrainedLRA = this.computeLRA(constrainedLoudness);

    return {
      actionTrace: actions,
      seed: this.fixedSeed,
      unconstrained: {
        sequence: unconstrainedResult.sequence,
        rawParams: unconstrainedResult.rawParams,
        audio: unconstrainedAudio,
        spectrogram: unconstrainedSpec,
        loudness: unconstrainedLoudness,
        lra: unconstrainedLRA,
        metrics: this.computeMetrics(unconstrainedAudio, unconstrainedLoudness),
      },
      constrained: {
        sequence: constrainedResult.sequence,
        clampLog: constrainedResult.clampLog,
        safeParams: generator.lastConstrainedParams || null,
        audio: constrainedAudio,
        spectrogram: constrainedSpec,
        loudness: constrainedLoudness,
        lra: constrainedLRA,
        metrics: this.computeMetrics(constrainedAudio, constrainedLoudness),
      },
      envelopeBounds: this.envelopeBounds,
    };
  }

  /**
   * Render music sequence to AudioBuffer
   */
  async renderToAudioBuffer(sequence) {
    const duration = (sequence.totalTime || 20) + 1;
    const numSamples = Math.ceil(this.sampleRate * duration);
    
    const offlineCtx = new OfflineAudioContext(1, numSamples, this.sampleRate);
    
    for (const note of sequence.notes) {
      const freq = 440 * Math.pow(2, (note.pitch - 69) / 12);
      const velocity = (note.velocity || 80) / 127;
      const startTime = note.startTime;
      const endTime = Math.min(note.endTime, duration - 0.1);
      
      if (startTime >= duration || endTime <= startTime) continue;
      
      const osc = offlineCtx.createOscillator();
      const gainNode = offlineCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(offlineCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      // ADSR envelope
      const attackTime = 0.01;
      const decayTime = 0.1;
      const sustainLevel = 0.7;
      const releaseTime = 0.15;
      
      const peakGain = velocity * 0.4;
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(peakGain, startTime + attackTime);
      gainNode.gain.linearRampToValueAtTime(peakGain * sustainLevel, startTime + attackTime + decayTime);
      
      const releaseStart = Math.max(startTime + attackTime + decayTime, endTime - releaseTime);
      gainNode.gain.setValueAtTime(peakGain * sustainLevel, releaseStart);
      gainNode.gain.linearRampToValueAtTime(0, endTime);
      
      osc.start(startTime);
      osc.stop(endTime + 0.01);
    }
    
    return await offlineCtx.startRendering();
  }

  /**
   * Compute Log-Mel Spectrogram
   */
  computeLogMelSpectrogram(audioBuffer) {
    const data = audioBuffer.getChannelData(0);
    const numFrames = Math.floor((data.length - this.fftSize) / this.hopSize) + 1;
    
    const maxFrames = this.maxFrames || 200;
    const frameStep = numFrames > maxFrames ? Math.ceil(numFrames / maxFrames) : 1;
    const actualFrames = Math.ceil(numFrames / frameStep);
    
    const spectrogram = [];
    const window = this.createHannWindow(this.fftSize);
    
    const melFilters = this.createMelFilterbank();
    const numBins = this.fftSize / 2 + 1;
    
    for (let i = 0; i < numFrames; i += frameStep) {
      const start = i * this.hopSize;
      const frame = new Float32Array(this.fftSize);
      for (let j = 0; j < this.fftSize; j++) {
        const idx = start + j;
        frame[j] = (idx >= 0 && idx < data.length ? data[idx] : 0) * window[j];
      }
      const { re, im } = this.fft(frame);
      const power = new Float32Array(numBins);
      for (let k = 0; k < numBins; k++) {
        const r = re[k], ii = im[k];
        power[k] = r * r + ii * ii;
      }
      const melSpec = new Float32Array(this.numMelBins);
      for (let m = 0; m < this.numMelBins; m++) {
        const filt = melFilters[m];
        let e = 0;
        for (let k = 0; k < numBins; k++) e += filt[k] * power[k];
        melSpec[m] = 10 * Math.log10(Math.max(e, 1e-12));
      }
      spectrogram.push(melSpec);
    }
    
    return {
      data: spectrogram,
      numFrames: spectrogram.length,
      numMelBins: this.numMelBins,
      hopSize: this.hopSize * frameStep,
      sampleRate: this.sampleRate,
    };
  }

  /**
   * Create Mel bin frequency ranges
   */
  createMelBinRanges() {
    const melMin = this.hzToMel(this.minFreq);
    const melMax = this.hzToMel(this.maxFreq);
    const numBins = this.fftSize / 2 + 1;
    
    const ranges = [];
    
    for (let m = 0; m < this.numMelBins; m++) {
      const melLow = melMin + (melMax - melMin) * m / this.numMelBins;
      const melHigh = melMin + (melMax - melMin) * (m + 1) / this.numMelBins;
      
      const hzLow = this.melToHz(melLow);
      const hzHigh = this.melToHz(melHigh);
      
      const lowBin = Math.floor((hzLow / this.sampleRate) * this.fftSize);
      const highBin = Math.ceil((hzHigh / this.sampleRate) * this.fftSize);
      
      ranges.push({ lowBin: Math.max(0, lowBin), highBin: Math.min(numBins, highBin) });
    }
    
    return ranges;
  }

  /**
   * Create Hann window
   */
  createHannWindow(size) {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
    }
    return window;
  }

  /**
   * Create Mel filterbank
   */
  createMelFilterbank() {
    const melMin = this.hzToMel(this.minFreq);
    const melMax = this.hzToMel(this.maxFreq);
    const numBins = this.fftSize / 2 + 1;
    const melPoints = new Float32Array(this.numMelBins + 2);
    for (let i = 0; i < melPoints.length; i++) {
      melPoints[i] = melMin + (melMax - melMin) * (i / (this.numMelBins + 1));
    }
    const hzPoints = new Float32Array(melPoints.length);
    for (let i = 0; i < hzPoints.length; i++) hzPoints[i] = this.melToHz(melPoints[i]);
    const binPoints = new Int32Array(hzPoints.length);
    for (let i = 0; i < binPoints.length; i++) {
      binPoints[i] = Math.max(0, Math.min(numBins - 1, Math.floor(hzPoints[i] / this.sampleRate * this.fftSize)));
    }
    const filters = new Array(this.numMelBins);
    for (let m = 0; m < this.numMelBins; m++) {
      const f = new Float32Array(numBins);
      const left = binPoints[m];
      const center = binPoints[m + 1];
      const right = binPoints[m + 2];
      for (let k = left; k <= center; k++) {
        f[k] = (center === left) ? 0 : (k - left) / (center - left);
      }
      for (let k = center; k <= right; k++) {
        f[k] = (right === center) ? 0 : (right - k) / (right - center);
      }
      filters[m] = f;
    }
    return filters;
  }

  hzToMel(hz) {
    return 2595 * Math.log10(1 + hz / 700);
  }

  melToHz(mel) {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }

  /**
   * Simplified spectral energy computation
   * Kept for precise calculation when needed
   */
  computeFFTMagnitude(frame) {
    // Simplified version: return time-domain energy distribution
    const numBins = frame.length / 2 + 1;
    const magnitudes = new Float32Array(numBins);
    
    // Simple energy estimation
    for (let k = 0; k < numBins; k++) {
      const idx = Math.floor(k * 2);
      if (idx < frame.length) {
        magnitudes[k] = Math.abs(frame[idx]);
      }
    }
    
    return magnitudes;
  }

  /**
   * Compute loudness contour (simplified LUFS approximation)
   */
  computeLoudnessContour(audioBuffer) {
    const data = audioBuffer.getChannelData(0);
    const windowSize = Math.floor(this.sampleRate * 0.4); // 400ms window
    const hopSize = Math.floor(this.sampleRate * 0.1); // 100ms hop
    
    const raw = [];
    const times = [];
    for (let i = 0; i + windowSize <= data.length; i += hopSize) {
      let sumSquares = 0;
      for (let j = 0; j < windowSize; j++) sumSquares += data[i + j] * data[i + j];
      const rms = Math.sqrt(sumSquares / windowSize);
      const lufs = 20 * Math.log10(Math.max(rms, 1e-10)) - 0.691;
      raw.push(lufs);
      times.push(i / this.sampleRate);
    }
    const integrated = raw.length ? (raw.reduce((a,b)=>a+b,0) / raw.length) : -70;
    const gate = integrated - 8;
    const gated = raw.filter(v => v >= gate);
    const alpha = 0.3;
    const smoothed = [];
    for (let i = 0; i < raw.length; i++) {
      const prev = i === 0 ? raw[i] : smoothed[i-1];
      smoothed.push(alpha * prev + (1 - alpha) * raw[i]);
    }
    const gatedSmoothed = smoothed.filter(v => v >= gate);
    return { values: smoothed, times, integrated, gated: gatedSmoothed.length >= 4 ? gatedSmoothed : gated };
  }

  /**
   * Compute LRA (Loudness Range)
   */
  computeLRA(loudnessContour) {
    const src = Array.isArray(loudnessContour.gated) && loudnessContour.gated.length >= 4
      ? loudnessContour.gated
      : loudnessContour.values.filter(v => v > -70);
    const values = src.slice();
    if (values.length < 2) return 0;
    
    values.sort((a, b) => a - b);
    
    // LRA = 95th percentile - 10th percentile
    const p10 = values[Math.floor(values.length * 0.1)];
    const p95 = values[Math.floor(values.length * 0.95)];
    
    return p95 - p10;
  }

  /**
   * Compute additional metrics
   */
  computeMetrics(audioBuffer, loudnessContour) {
    const data = audioBuffer.getChannelData(0);
    
    // Peak
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
    const peakDb = 20 * Math.log10(Math.max(peak, 1e-10));
    
    // Average loudness
    const avgLoudness = loudnessContour.values.reduce((a, b) => a + b, 0) / loudnessContour.values.length;
    
    // Loudness standard deviation
    const loudnessStd = Math.sqrt(
      loudnessContour.values.reduce((sum, v) => sum + Math.pow(v - avgLoudness, 2), 0) / loudnessContour.values.length
    );
    
    // Energy change rate (excluding trailing silence and anomalous spikes)
    const values = loudnessContour.values;
    const times = loudnessContour.times;
    const totalT = times.length ? times[times.length - 1] : 0;
    const consider = [];
    for (let i = 1; i < values.length; i++) {
      const t = times[i];
      if (t < 0.5 || t > totalT - 1.0) continue;
      const delta = Math.abs(values[i] - values[i - 1]);
      if (delta > 3.0) continue;
      consider.push(delta);
    }
    const energyChangeRate = consider.length ? (consider.reduce((a,b)=>a+b,0) / consider.length) : 0;
    
    return {
      peakDb,
      avgLoudness,
      loudnessStd,
      energyChangeRate,
    };
  }

  /**
   * Draw comparison chart
   */
  drawComparison(canvas, comparisonData) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Store last drawn data for redraw on language change
    this._lastCanvas = canvas;
    this._lastData = comparisonData;
    
    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    const halfWidth = width / 2;
    const specHeight = height * 0.40;
    const loudnessHeight = height * 0.45;
    const padding = 48;
    const labelHeight = 30;
    
    // Draw titles
    ctx.fillStyle = '#111111';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('(a) ' + (window.i18n ? window.i18n.t('spectro.title.left') : 'Unconstrained Baseline'), halfWidth / 2, 18);
    ctx.fillText('(b) ' + (window.i18n ? window.i18n.t('spectro.title.right') : 'Constraint-First Output'), halfWidth + halfWidth / 2, 18);
    
    const rangeUnc = this.getDisplayRange(comparisonData.unconstrained.spectrogram);
    const rangeCon = this.getDisplayRange(comparisonData.constrained.spectrogram);
    
    // Draw spectrograms
    const durUnc = (comparisonData.unconstrained?.loudness?.times?.[comparisonData.unconstrained.loudness.times.length - 1]) || 0;
    const durCon = (comparisonData.constrained?.loudness?.times?.[comparisonData.constrained.loudness.times.length - 1]) || 0;
    this.drawSpectrogram(ctx, comparisonData.unconstrained.spectrogram, 
      padding, labelHeight, halfWidth - padding * 2, specHeight - labelHeight, -80, 0, durUnc);
    this.drawSpectrogram(ctx, comparisonData.constrained.spectrogram,
      halfWidth + padding, labelHeight, halfWidth - padding * 2, specHeight - labelHeight, -80, 0, durCon);
    this.drawColorbar(ctx, width - padding - 20, labelHeight + 8, 14, specHeight - labelHeight - 16, -80, 0);
    ctx.fillStyle = '#111111';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Magnitude (dB)', width - padding - 13, labelHeight - 2);
    ctx.save();
    ctx.fillStyle = '#111111';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.translate(padding - 24, labelHeight + (specHeight - labelHeight) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Frequency (kHz)', 0, 0);
    ctx.restore();
    
    // Draw loudness contours
    const loudnessY = specHeight + 20;
    this.drawLoudnessContour(ctx, comparisonData.unconstrained.loudness,
      padding, loudnessY, halfWidth - padding * 2, loudnessHeight, comparisonData.envelopeBounds, false);
    this.drawLoudnessContour(ctx, comparisonData.constrained.loudness,
      halfWidth + padding, loudnessY, halfWidth - padding * 2, loudnessHeight, comparisonData.envelopeBounds, true);
    ctx.save();
    ctx.fillStyle = '#111111';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.translate(padding - 24, loudnessY + loudnessHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Loudness (LUFS)', 0, 0);
    ctx.restore();
    
    // Axis labels (shared X)
    ctx.fillStyle = '#111111';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Time (s)', halfWidth / 2, specHeight + loudnessHeight + 36);
    ctx.fillText('Time (s)', halfWidth + halfWidth / 2, specHeight + loudnessHeight + 36);
    
    // Draw separator line
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(halfWidth, 0);
    ctx.lineTo(halfWidth, height);
    ctx.stroke();
  }

  /**
   * Draw spectrogram
   */
  drawSpectrogram(ctx, specData, x, y, width, height, minDb, maxDb, durationSec = 0) {
    const { data, numFrames, numMelBins } = specData;
    
    const secondsPerFrame = specData.sampleRate ? (specData.hopSize / specData.sampleRate) : 0;
    const capSec = 10;
    const framesToDraw = secondsPerFrame > 0 ? Math.min(numFrames, Math.floor(capSec / secondsPerFrame)) : numFrames;
    const drawWidth = width;
    const cellWidth = drawWidth / Math.max(1, framesToDraw);
    const visibleBins = Math.max(1, Math.floor(numMelBins * (this.focusLowerRatio || 1)));
    const cellHeight = height / visibleBins;
    
    for (let i = 0; i < framesToDraw; i++) {
      for (let j = 0; j < visibleBins; j++) {
        const v0 = data[i][j];
        const vL = data[Math.max(i - 1, 0)][j];
        const vR = data[Math.min(i + 1, framesToDraw - 1)][j];
        const value = (v0 + vL + vR) / 3;
        const minDbEff = Math.max(minDb, -60);
        const normalized = (value - minDbEff) / (maxDb - minDbEff);
        const color = this.viridisColormap(Math.max(0, Math.min(1, normalized)));
        
        ctx.fillStyle = color;
        ctx.fillRect(
          x + i * cellWidth,
          y + height - (j + 1) * cellHeight,
          Math.ceil(cellWidth),
          Math.ceil(cellHeight)
        );
      }
    }
    
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x + drawWidth, y + height);
    ctx.stroke();
    ctx.fillStyle = '#111111';
    ctx.textAlign = 'right';
    ctx.font = '11px Arial';
    const yticks = 5;
    for (let k = 0; k <= yticks; k++) {
      const frac = k / yticks;
      const yy = y + height - frac * height;
      ctx.beginPath();
      ctx.moveTo(x - 4, yy);
      ctx.lineTo(x, yy);
      ctx.stroke();
      ctx.fillText(String(k), x - 6, yy + 3);
    }
    ctx.textAlign = 'center';
    ctx.font = '11px Arial';
    const ticks = 10;
    for (let t = 0; t <= ticks; t++) {
      const xx = x + (t / ticks) * drawWidth;
      ctx.beginPath();
      ctx.moveTo(xx, y + height);
      ctx.lineTo(xx, y + height + 4);
      ctx.stroke();
      ctx.fillText(String(t), xx, y + height + 14);
    }

    if ((maxDb - minDb) <= 1e-3) {
         ctx.fillStyle = '#000'; // Draw black if silence
         ctx.fillRect(x, y, width, height);
         ctx.fillStyle = '#666';
         ctx.textAlign = 'center';
    ctx.fillText(window.i18n ? window.i18n.t('spectro.label.silence') : 'Silence / No Data', x + width/2, y + height/2);
    }
  }

  fft(signal) {
    const N = signal.length;
    const re = new Float32Array(N);
    const im = new Float32Array(N);
    for (let i = 0; i < N; i++) { re[i] = signal[i]; im[i] = 0; }
    let j = 0;
    for (let i = 0; i < N; i++) {
      if (i < j) { const tr = re[i]; const ti = im[i]; re[i] = re[j]; im[i] = im[j]; re[j] = tr; im[j] = ti; }
      let m = N >> 1;
      while (m >= 1 && j >= m) { j -= m; m >>= 1; }
      j += m;
    }
    for (let s = 1; (1 << s) <= N; s++) {
      const m = 1 << s;
      const m2 = m >> 1;
      const ang = -2 * Math.PI / m;
      const wmr = Math.cos(ang);
      const wmi = Math.sin(ang);
      for (let k = 0; k < N; k += m) {
        let wr = 1, wi = 0;
        for (let t = 0; t < m2; t++) {
          const u_r = re[k + t], u_i = im[k + t];
          const v_r = re[k + t + m2], v_i = im[k + t + m2];
          const tr = wr * v_r - wi * v_i;
          const ti = wr * v_i + wi * v_r;
          re[k + t] = u_r + tr;
          im[k + t] = u_i + ti;
          re[k + t + m2] = u_r - tr;
          im[k + t + m2] = u_i - ti;
          const tmp = wr;
          wr = tmp * wmr - wi * wmi;
          wi = tmp * wmi + wi * wmr;
        }
      }
    }
    return { re, im };
  }

  getDisplayRange(spec) {
    const flat = [];
    for (let i = 0; i < spec.data.length; i++) {
      const row = spec.data[i];
      for (let j = 0; j < row.length; j++) flat.push(row[j]);
    }
    if (!flat.length) return { min: -80, max: -20 };
    const p5 = this.percentile(flat, 0.05);
    const p95 = this.percentile(flat, 0.95);
    const span = p95 - p5;
    if (span < 20) return { min: -80, max: -20 };
    return { min: p5, max: p95 };
  }

  percentile(arr, q) {
    const a = arr.slice().sort((x, y) => x - y);
    const idx = Math.max(0, Math.min(a.length - 1, Math.floor(q * (a.length - 1))));
    return a[idx];
  }
  /**
   * Draw loudness contour
   */
  drawLoudnessContour(ctx, loudnessData, x, y, width, height, bounds, showBounds) {
    const { values, times } = loudnessData;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, width, height);
    
    const minLoudness = Math.min(...values, bounds.loudnessMin);
    const maxLoudness = Math.max(...values, bounds.loudnessMax);
    const visMin = -30;
    const visMax = -10;
    const visRange = Math.max(1e-6, visMax - visMin);
    
    if (showBounds) {
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      
      const upperY = y + height - ((bounds.loudnessMax - visMin) / visRange) * height;
      ctx.beginPath();
      ctx.moveTo(x, upperY);
      ctx.lineTo(x + width, upperY);
      ctx.stroke();
      
      const lowerY = y + height - ((bounds.loudnessMin - visMin) / visRange) * height;
      ctx.beginPath();
      ctx.moveTo(x, lowerY);
      ctx.lineTo(x + width, lowerY);
      ctx.stroke();
      
      ctx.setLineDash([]);
      
      ctx.fillStyle = '#ff6b6b';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'right';
      const labelUpperY = Math.max(y + 10, Math.min(y + height - 10, upperY - 6));
      const labelLowerY = Math.max(y + 10, Math.min(y + height - 10, lowerY + 12));
      ctx.fillText(`${bounds.loudnessMax} LUFS`, x + width - 8, labelUpperY);
      ctx.fillText(`${bounds.loudnessMin} LUFS`, x + width - 8, labelLowerY);
    }
    
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    let cutIndex = values.length - 1;
    const peak = Math.max(...values);
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i] > peak - 5) { cutIndex = i; break; }
    }
    const capSec = 10;
    let lastIdx = cutIndex;
    for (let i = 0; i <= cutIndex; i++) {
      if (times[i] > capSec) { lastIdx = i - 1; break; }
    }
    const len = Math.max(2, lastIdx + 1);
    for (let i = 0; i < len; i++) {
      const px = x + Math.min(1, (times[i] / capSec)) * width;
      const v = Math.max(visMin, Math.min(visMax, values[i]));
      const py = y + height - ((v - visMin) / visRange) * height;
      
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    
    // Axes and ticks
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.moveTo(x + width, y);
    ctx.lineTo(x + width, y + height);
    ctx.stroke();
    const yTicks = [-10, -20, -30];
    ctx.textAlign = 'right';
    ctx.font = '11px Arial';
    ctx.fillStyle = '#111111';
    for (const tv of yTicks) {
      const ty = y + height - ((tv - visMin) / visRange) * height;
      ctx.beginPath();
      ctx.moveTo(x - 4, ty);
      ctx.lineTo(x, ty);
      ctx.stroke();
      ctx.fillText(String(tv), x - 8, ty + 3);
    }
  }

  /**
   * Viridis colormap
   */
  viridisColormap(t) {
    const colors = [
      [68, 1, 84],
      [72, 40, 120],
      [62, 74, 137],
      [49, 104, 142],
      [38, 130, 142],
      [31, 158, 137],
      [53, 183, 121],
      [109, 205, 89],
      [180, 222, 44],
      [253, 231, 37]
    ];
    
    const idx = t * (colors.length - 1);
    const i = Math.floor(idx);
    const f = idx - i;
    
    if (i >= colors.length - 1) return `rgb(${colors[colors.length - 1].join(',')})`;
    
    const c1 = colors[i] || colors[0];
    const c2 = colors[i + 1] || colors[colors.length - 1];
    
    if (!c1) return 'rgb(0,0,0)'; // Safety fallback

    const r = Math.round(c1[0] + f * (c2[0] - c1[0]));
    const g = Math.round(c1[1] + f * (c2[1] - c1[1]));
    const b = Math.round(c1[2] + f * (c2[2] - c1[2]));
    
    return `rgb(${r},${g},${b})`;
  }

  jetColormap(t) {
    const colors = [
      [0, 0, 131],
      [0, 60, 170],
      [5, 255, 255],
      [255, 255, 0],
      [250, 0, 0],
      [128, 0, 0]
    ];
    const idx = t * (colors.length - 1);
    const i = Math.floor(idx);
    const f = idx - i;
    const c1 = colors[i] || colors[0];
    const c2 = colors[i + 1] || colors[colors.length - 1];
    const r = Math.round(c1[0] + f * (c2[0] - c1[0]));
    const g = Math.round(c1[1] + f * (c2[1] - c1[1]));
    const b = Math.round(c1[2] + f * (c2[2] - c1[2]));
    return `rgb(${r},${g},${b})`;
  }

  exportPaperPNG(comparisonData, filename = 'spectrogram_paper.png', options = {}) {
    const scale = options.scale || 1;
    const width = (options.width || 1600) * scale;
    const height = (options.height || 900) * scale;
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const ctx = off.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    const halfWidth = width / 2;
    const headerHeight = 140 * scale;
    const specHeight = height * 0.34;
    const loudnessHeight = height * 0.36;
    const padding = 48 * scale;
    const cardGap = 24 * scale;
    const labelHeight = 50 * scale;
    const navy = '#ffffff';
    const text = '#0f172a';
    const subtext = '#64748b';
    const border = '#e5e7eb';
    const success = '#10b981';
    const panelW = halfWidth - padding * 2;
    const panelH = 90 * scale;
    ctx.fillStyle = text;
    ctx.font = `${22 * scale}px system-ui`;
    ctx.textAlign = 'left';
    ctx.fillText('Spectrogram + Loudness Comparison', padding, 40 * scale);

    // Parameters: raw vs constrained
    const rawBpm = comparisonData.unconstrained?.sequence?.tempos?.[0]?.qpm || comparisonData.unconstrained?.rawParams?.rawBpm || 0;
    const safeBpm = comparisonData.constrained?.sequence?.tempos?.[0]?.qpm || 0;
    const rawContrast = comparisonData.unconstrained?.rawParams?.rawContrast ?? null;
    let safeContrast = null;
    if (comparisonData.constrained?.safeParams?.safeContrast !== undefined) {
      safeContrast = comparisonData.constrained.safeParams.safeContrast;
    } else if (comparisonData.constrained?.clampLog) {
      const cc = comparisonData.constrained.clampLog.find(c => c.param === 'contrast');
      safeContrast = cc ? cc.clamped : rawContrast;
    } else {
      safeContrast = rawContrast;
    }
    const lraRaw = Number(comparisonData.unconstrained?.lra || 0);
    const lraSafe = Number(comparisonData.constrained?.lra || 0);
    const lraFactor = lraSafe > 0 ? (lraRaw / lraSafe) : 0;

    this.roundRect(ctx, padding, 64 * scale, panelW, panelH, 16 * scale, '#f8fafc', border);
    this.roundRect(ctx, halfWidth + padding, 64 * scale, panelW, panelH, 16 * scale, '#f8fafc', border);
    ctx.textAlign = 'left';
    ctx.fillStyle = subtext;
    ctx.font = `${16 * scale}px system-ui`;
    ctx.fillText('Raw Params', padding + 16 * scale, 88 * scale);
    ctx.fillText('Constrained Params', halfWidth + padding + 16 * scale, 88 * scale);
    ctx.fillStyle = text;
    ctx.font = `${18 * scale}px system-ui`;
    ctx.fillText(`BPM: ${Math.round(rawBpm)}`, padding + 16 * scale, 114 * scale);
    ctx.fillText(`Contrast: ${rawContrast !== null ? Math.round(rawContrast * 100) + '%' : '--'}`, padding + 16 * scale, 140 * scale);
    ctx.fillText(`BPM: ${Math.round(safeBpm)}`, halfWidth + padding + 16 * scale, 114 * scale);
    ctx.fillText(`Contrast: ${safeContrast !== null ? Math.round(safeContrast * 100) + '%' : '--'}`, halfWidth + padding + 16 * scale, 140 * scale);
    const lraText = `Loudness Range (LRA): ${lraRaw.toFixed(1)} → ${lraSafe.toFixed(1)} LU (${lraFactor > 0 ? '×' + lraFactor.toFixed(1) + ' reduction' : ''})`;
    ctx.fillStyle = success;
    ctx.font = `${18 * scale}px monospace`;
    ctx.fillText(lraText, padding, 64 * scale + panelH + cardGap);
    
    const rangeUnc = this.getDisplayRange(comparisonData.unconstrained.spectrogram);
    const rangeCon = this.getDisplayRange(comparisonData.constrained.spectrogram);
    this.roundRect(ctx, padding, headerHeight, halfWidth - padding * 2, specHeight, 16 * scale, navy, border);
    this.roundRect(ctx, halfWidth + padding, headerHeight, halfWidth - padding * 2, specHeight, 16 * scale, navy, border);
    this.drawSpectrogram(ctx, comparisonData.unconstrained.spectrogram,
      padding + 4 * scale, headerHeight + 8 * scale, halfWidth - padding * 2 - 8 * scale, specHeight - labelHeight, rangeUnc.min, rangeUnc.max);
    this.drawSpectrogram(ctx, comparisonData.constrained.spectrogram,
      halfWidth + padding + 4 * scale, headerHeight + 8 * scale, halfWidth - padding * 2 - 8 * scale, specHeight - labelHeight, rangeCon.min, rangeCon.max);
    
    const loudnessY = headerHeight + specHeight + 20 * scale;
    this.roundRect(ctx, padding, loudnessY, halfWidth - padding * 2, loudnessHeight, 16 * scale, '#ffffff', border);
    this.roundRect(ctx, halfWidth + padding, loudnessY, halfWidth - padding * 2, loudnessHeight, 16 * scale, '#ffffff', border);
    this.drawLoudnessContour(ctx, comparisonData.unconstrained.loudness,
      padding + 4 * scale, loudnessY + 6 * scale, halfWidth - padding * 2 - 8 * scale, loudnessHeight - 12 * scale, comparisonData.envelopeBounds, false);
    this.drawLoudnessContour(ctx, comparisonData.constrained.loudness,
      halfWidth + padding + 4 * scale, loudnessY + 6 * scale, halfWidth - padding * 2 - 8 * scale, loudnessHeight - 12 * scale, comparisonData.envelopeBounds, false);
    
    ctx.save();
    ctx.fillStyle = '#111111';
    ctx.font = `${14 * scale}px system-ui`;
    ctx.textAlign = 'center';
    ctx.translate(padding - 40 * scale, loudnessY + loudnessHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Loudness (LUFS)', 0, 0);
    ctx.restore();
    
    const metricsY = height - 25 * scale;
    ctx.fillStyle = text;
    ctx.font = `${14 * scale}px monospace`;
    ctx.textAlign = 'left';
    const uncMetrics = comparisonData.unconstrained.metrics;
    const conMetrics = comparisonData.constrained.metrics;
    ctx.fillText(`LRA: ${comparisonData.unconstrained.lra.toFixed(1)} LU`, padding, metricsY);
    const factor = comparisonData.constrained.lra > 0 ? (comparisonData.unconstrained.lra / comparisonData.constrained.lra) : 0;
    ctx.fillText(`→ ${comparisonData.constrained.lra.toFixed(1)} LU  ×${factor.toFixed(1)}`, padding + 160 * scale, metricsY);
    ctx.textAlign = 'left';
    ctx.fillText(`ΔE: ${uncMetrics.energyChangeRate.toFixed(2)} → ${conMetrics.energyChangeRate.toFixed(2)}`, halfWidth + padding, metricsY);
    const link = document.createElement('a');
    link.download = filename;
    link.href = off.toDataURL('image/png');
    link.click();
  }

  roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  drawColorbar(ctx, x, y, w, h, minDb, maxDb) {
    const steps = 64;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      ctx.fillStyle = this.viridisColormap(t);
      const yy = y + h - Math.round(t * h);
      ctx.fillRect(x, yy, w, Math.ceil(h / steps) + 1);
    }
  }

  /**
   * Export comparison as PNG
   */
  exportAsPNG(canvas, filename = 'spectrogram_comparison.png') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  /**
   * Export data as JSON (for further analysis)
   */
  exportDataAsJSON(comparisonData, filename = 'comparison_data.json') {
    const exportData = {
      seed: comparisonData.seed,
      actionTraceLength: comparisonData.actionTrace.length,
      envelopeBounds: comparisonData.envelopeBounds,
      unconstrained: {
        rawParams: comparisonData.unconstrained.rawParams,
        lra: comparisonData.unconstrained.lra,
        metrics: comparisonData.unconstrained.metrics,
        noteCount: comparisonData.unconstrained.sequence.notes.length,
        bpm: comparisonData.unconstrained.sequence.tempos?.[0]?.qpm,
      },
      constrained: {
        clampLog: comparisonData.constrained.clampLog,
        lra: comparisonData.constrained.lra,
        metrics: comparisonData.constrained.metrics,
        noteCount: comparisonData.constrained.sequence.notes.length,
        bpm: comparisonData.constrained.sequence.tempos?.[0]?.qpm,
      },
      comparison: {
        lraDiff: comparisonData.unconstrained.lra - comparisonData.constrained.lra,
        avgLoudnessDiff: comparisonData.unconstrained.metrics.avgLoudness - comparisonData.constrained.metrics.avgLoudness,
        energyChangeRateDiff: comparisonData.unconstrained.metrics.energyChangeRate - comparisonData.constrained.metrics.energyChangeRate,
      },
      generatedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Export full spectrum and loudness data (including arrays)
   */
  exportFullDataAsJSON(comparisonData, filename = 'spectrum_full_data.json') {
    const pickSpectro = (spec) => ({
      numFrames: spec.numFrames,
      numMelBins: spec.numMelBins,
      hopSize: spec.hopSize,
      sampleRate: spec.sampleRate,
      data: spec.data,
    });
    const pickLoud = (l) => ({
      values: l.values,
      times: l.times,
      integrated: l.integrated,
    });
    const exportData = {
      seed: comparisonData.seed,
      envelopeBounds: comparisonData.envelopeBounds,
      params: {
        sampleRate: this.sampleRate,
        fftSize: this.fftSize,
        hopSize: this.hopSize,
        numMelBins: this.numMelBins,
        minFreq: this.minFreq,
        maxFreq: this.maxFreq,
        focusLowerRatio: this.focusLowerRatio,
      },
      unconstrained: {
        spectrogram: pickSpectro(comparisonData.unconstrained.spectrogram),
        loudness: pickLoud(comparisonData.unconstrained.loudness),
        lra: comparisonData.unconstrained.lra,
        metrics: comparisonData.unconstrained.metrics,
        bpm: comparisonData.unconstrained.sequence?.tempos?.[0]?.qpm || comparisonData.unconstrained.rawParams?.rawBpm || null,
        contrast: comparisonData.unconstrained.rawParams?.rawContrast ?? null,
      },
      constrained: {
        spectrogram: pickSpectro(comparisonData.constrained.spectrogram),
        loudness: pickLoud(comparisonData.constrained.loudness),
        lra: comparisonData.constrained.lra,
        metrics: comparisonData.constrained.metrics,
        bpm: comparisonData.constrained.sequence?.tempos?.[0]?.qpm || null,
        contrast: (comparisonData.constrained.safeParams?.safeContrast !== undefined)
          ? comparisonData.constrained.safeParams.safeContrast
          : (comparisonData.constrained.clampLog?.find?.(c => c.param === 'contrast')?.clamped ?? comparisonData.unconstrained.rawParams?.rawContrast ?? null),
      },
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function _mmToPx(mm, dpi) {
  return Math.round((mm / 25.4) * dpi);
}

SpectrogramComparison.prototype.exportPaperPNG300DPI = function(comparisonData, filename = 'spectrogram_paper_300dpi.png', size = {}) {
  const dpi = size.dpi || 300;
  let widthPx = size.widthPx;
  let heightPx = size.heightPx;
  if (!widthPx || !heightPx) {
    if (size.widthInMM && size.heightInMM) {
      widthPx = _mmToPx(size.widthInMM, dpi);
      heightPx = _mmToPx(size.heightInMM, dpi);
    } else if (size.widthInInches && size.heightInInches) {
      widthPx = Math.round(size.widthInInches * dpi);
      heightPx = Math.round(size.heightInInches * dpi);
    } else {
      widthPx = Math.round(8 * dpi);
      heightPx = Math.round(4.5 * dpi);
    }
  }
  this.exportPaperPNG(comparisonData, filename, { width: widthPx, height: heightPx, scale: 1 });
};

SpectrogramComparison.prototype.exportCurrentComparisonPNG300DPI = function(filename = 'spectrogram_comparison_300dpi.png', size = {}) {
  const dpi = size.dpi || 300;
  let widthPx = size.widthPx;
  let heightPx = size.heightPx;
  if (!widthPx || !heightPx) {
    if (size.widthInMM && size.heightInMM) {
      widthPx = _mmToPx(size.widthInMM, dpi);
      heightPx = _mmToPx(size.heightInMM, dpi);
    } else if (size.widthInInches && size.heightInInches) {
      widthPx = Math.round(size.widthInInches * dpi);
      heightPx = Math.round(size.heightInInches * dpi);
    } else {
      widthPx = Math.round(8 * dpi);
      heightPx = Math.round(4.5 * dpi);
    }
  }
  const off = document.createElement('canvas');
  off.width = widthPx;
  off.height = heightPx;
  const ctx = off.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);
  if (this._lastData) {
    this.drawComparison(off, this._lastData);
  }
  const link = document.createElement('a');
  link.download = filename;
  link.href = off.toDataURL('image/png');
  link.click();
};

// Listen for language change events to redraw spectrogram text
try {
  window.addEventListener('languageChanged', () => {
    const inst = window._spectroInstance;
    if (inst && inst._lastCanvas && inst._lastData) {
      inst.drawComparison(inst._lastCanvas, inst._lastData);
    }
  });
} catch {}

// Export to global
window.SpectrogramComparison = SpectrogramComparison;
window._spectroInstance = window._spectroInstance || new SpectrogramComparison();
