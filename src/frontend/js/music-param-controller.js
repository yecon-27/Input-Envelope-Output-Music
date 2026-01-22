/**
 * Music Parameter Controller
 * Supports test mode and converge mode for experts to adjust music parameters and converge safe ranges
 */
class MusicParamController {
    constructor() {
        // Mode: 'test' | 'converge' | 'spectrum'
        this.mode = 'test';
        
        // Default safe range definitions
        this.safeRanges = {
            tempo: { min: 120, max: 130, absMin: 100, absMax: 140, unit: 'BPM' },
            contrast: { min: 0, max: 20, absMin: 0, absMax: 50, unit: '%' },
            volume: { min: 60, max: 80, absMin: 0, absMax: 100, unit: '%' },
            density: { min: 30, max: 70, absMin: 0, absMax: 100, unit: '%' },
            duration: { min: 8, max: 20, absMin: 8, absMax: 20, unit: 's' },
        };
        
        // Three-tier presets
        this.presets = {
            relaxed: {
                tempo: { min: 60, max: 180, absMin: 40, absMax: 200, unit: 'BPM' },
                contrast: { min: 0, max: 100, absMin: 0, absMax: 100, unit: '%' },   // Accent ratio 0.0-1.0 displayed as 0-100%
                volume: { min: 0, max: 100, absMin: 0, absMax: 100, unit: '%' }      // Gain dB mapped to percentage slider
            },
            default: {
                tempo: { min: 120, max: 130, absMin: 80, absMax: 160, unit: 'BPM' },
                contrast: { min: 0, max: 50, absMin: 0, absMax: 100, unit: '%' },
                volume: { min: 20, max: 80, absMin: 0, absMax: 100, unit: '%' }
            },
            tight: {
                tempo: { min: 124, max: 126, absMin: 100, absMax: 140, unit: 'BPM' },
                contrast: { min: 0, max: 10, absMin: 0, absMax: 100, unit: '%' },
                volume: { min: 45, max: 75, absMin: 0, absMax: 100, unit: '%' }
            }
        };
        this.currentPreset = 'default';
        
        // Safe harmony options
        this.safeHarmony = ['I-V'];
        this.allHarmonyOptions = ['I-V', 'I-IV', 'I-VI', 'I-IV-V', 'I-VI-IV-V'];
        
        // Current parameters
        this.currentParams = {
            tempo: 125,
            contrast: 10,
            volume: 70,
            harmony: 'I-V',
            instrument: 'piano',
            durationSec: 10,
            segmentStartSec: 0,
            segmentEndSec: 10
        };
        
        // Converged parameters (for database submission)
        this.convergedParams = null;
        
        // Callbacks
        this.onParamChange = null;
        this.onWarning = null;
        this.onSubmit = null;
        
        // Playback state
        this.isPlaying = false;
        
        this.initialized = false;
    }
    
    /**
     * Initialize controller
     */
    init() {
        if (this.initialized) return;
        
        try {
            this.bindModeToggle();
            this.bindPresets();
            this.bindSliders();
            this.bindHarmonyOptions();
            this.bindInstrumentOptions();
            this.bindDurationAndSegment();
            this.bindActionButtons();
            this.updateAllSliderStyles();
            
            // Initial text update
            this.updateTexts();
            this.applyPreset(this.currentPreset);

            // Subscribe to language changes
            if (window.i18n) {
                window.i18n.subscribe(() => {
                    this.updateTexts();
                });
            }
            
            this.initialized = true;
            console.log('[MusicParamController] Initialized');
        } catch (e) {
            console.error('[MusicParamController] Initialization failed:', e);
        }
    }

    t(key) {
        return window.i18n ? window.i18n.t(key) : key;
    }

     updateTexts() {
         const testBtn = document.getElementById('param-mode-test');
         if (testBtn) testBtn.textContent = this.t('expert.mode.test');
 
         // Expert Right panel title
         const rightPanelTitle = document.querySelector('.expert-right .expert-panel-title');
         if (rightPanelTitle) rightPanelTitle.textContent = window.i18n ? window.i18n.t('report.musicParams') : 'Music Parameters';

        // Labels with Safe Range (only 4: Tempo, Contrast, Volume, Harmony)
        const labels = document.querySelectorAll('.music-params-grid label');
        if (labels.length >= 4) {
            // labels[0] = Tempo (BPM)
            const tempoLabel = labels[0];
            if (tempoLabel) {
                const span = tempoLabel.querySelector('span:first-child');
                if (span) {
                    span.innerHTML = `${this.t('expert.tempo')} <span class="param-safe-range">${this.t('expert.safeRange')}${this.safeRanges.tempo.min}-${this.safeRanges.tempo.max}</span>`;
                }
                const warning = tempoLabel.querySelector('.param-warning-badge');
                if (warning) warning.textContent = this.t('expert.warning.unsafe');
            }

            // labels[1] = Dynamic Contrast
            const contrastLabel = labels[1];
            if (contrastLabel) {
                const span = contrastLabel.querySelector('span:first-child');
                if (span) {
                    span.innerHTML = `${this.t('expert.contrast')} <span class="param-safe-range">${this.t('expert.safeRange')}${this.safeRanges.contrast.min}-${this.safeRanges.contrast.max}${this.safeRanges.contrast.unit}</span>`;
                }
                const warning = contrastLabel.querySelector('.param-warning-badge');
                if (warning) warning.textContent = this.t('expert.warning.unsafe');
            }

            // labels[2] = Volume
            const volumeLabel = labels[2];
            if (volumeLabel) {
                const span = volumeLabel.querySelector('span:first-child');
                if (span) {
                    span.innerHTML = `${this.t('expert.volume')} <span class="param-safe-range">${this.t('expert.safeRange')}${this.safeRanges.volume.min}-${this.safeRanges.volume.max}${this.safeRanges.volume.unit}</span>`;
                }
                const warning = volumeLabel.querySelector('.param-warning-badge');
                if (warning) warning.textContent = this.t('expert.warning.unsafe');
            }

            // labels[3] = Harmony
            const harmonyLabel = labels[3];
            if (harmonyLabel) {
                const span = harmonyLabel.querySelector('span:first-child');
                if (span) {
                    span.textContent = this.t('expert.harmony');
                }
                const warning = harmonyLabel.querySelector('.param-warning-badge');
                if (warning) warning.textContent = this.t('expert.warning.unsafe');
            }
        }

        // Action Buttons
        const previewBtn = document.getElementById('param-preview-btn');
        if (previewBtn) {
            const icon = previewBtn.querySelector('svg');
            previewBtn.innerHTML = '';
            if (icon) previewBtn.appendChild(icon.cloneNode(true));
            previewBtn.appendChild(document.createTextNode(' ' + this.t('expert.btn.preview')));
        }

        const stopBtn = document.getElementById('param-stop-btn');
        if (stopBtn) {
            const icon = stopBtn.querySelector('svg');
            stopBtn.innerHTML = '';
            if (icon) stopBtn.appendChild(icon.cloneNode(true));
            stopBtn.appendChild(document.createTextNode(' ' + this.t('expert.btn.stop')));
        }

        const resetBtn = document.getElementById('param-reset-btn');
        if (resetBtn) {
            const icon = resetBtn.querySelector('svg');
            resetBtn.innerHTML = '';
            if (icon) resetBtn.appendChild(icon.cloneNode(true));
            resetBtn.appendChild(document.createTextNode(' ' + this.t('expert.btn.reset')));
        }

        // Converge Section
        const convergeTitle = document.querySelector('.converge-title');
        if (convergeTitle) {
            const icon = convergeTitle.querySelector('svg');
            convergeTitle.innerHTML = '';
            if (icon) convergeTitle.appendChild(icon.cloneNode(true));
            convergeTitle.appendChild(document.createTextNode(' ' + this.t('expert.setSafeRange')));
        }

        // Converge Labels
        const convergeHeaders = document.querySelectorAll('.daw-range-header label');
        if (convergeHeaders.length >= 4) {
            convergeHeaders[0].textContent = 'BPM'; // Usually standard
            convergeHeaders[1].textContent = this.t('expert.contrast').replace('Dynamic ', ''); // Shorten
            convergeHeaders[2].textContent = this.t('expert.volume');
            convergeHeaders[3].textContent = this.t('expert.harmony').split(' ')[0]; // Shorten
        }

        // Save Button (only if not in success/error state)
        const submitBtn = document.getElementById('param-submit-btn');
        if (submitBtn && !submitBtn.classList.contains('success') && !submitBtn.classList.contains('error')) {
            const icon = submitBtn.querySelector('svg');
            submitBtn.innerHTML = '';
            if (icon) submitBtn.appendChild(icon.cloneNode(true));
            submitBtn.appendChild(document.createTextNode(' ' + this.t('expert.btn.save')));
        }

        // Submit Note
        const submitNote = document.querySelector('.submit-note');
        if (submitNote) {
            submitNote.textContent = this.t('expert.dbNotConfigured');
        }
        
        // Segment labels
        const segLabel = document.getElementById('segment-label');
        const segTip = document.querySelector('.segment-tip');
        if (segLabel) segLabel.textContent = this.t('expert.segment');
        if (segTip) segTip.textContent = this.t('expert.segment.tip');
    }
    
    bindDurationAndSegment() {
        const durValue = document.getElementById('report-param-duration-value');
        const segStartSlider = document.getElementById('segment-start-slider');
        const segEndSlider = document.getElementById('segment-end-slider');
        const segStartValue = document.getElementById('segment-start-value');
        const segEndValue = document.getElementById('segment-end-value');
        const segCanvas = document.getElementById('segment-canvas');
        const segLabel = document.getElementById('segment-label');
        const segTip = document.querySelector('.segment-tip');
        if (segLabel) segLabel.textContent = this.t('expert.segment');
        if (segTip) segTip.textContent = this.t('expert.segment.tip');
        
        const drawSegment = () => {
            if (!segCanvas) {
                console.warn('[Segment] Canvas not found');
                return;
            }
            const ctx = segCanvas.getContext('2d');
            
            // Get canvas CSS display dimensions
            const rect = segCanvas.getBoundingClientRect();
            let displayWidth = rect.width;
            let displayHeight = rect.height;
            
            // If dimensions are invalid, use defaults and retry later
            if (displayWidth < 10 || displayHeight < 10) {
                displayWidth = 560;
                displayHeight = 120;
                // Delayed redraw
                setTimeout(() => drawSegment(), 100);
            }
            
            // Set canvas actual pixel dimensions
            segCanvas.width = Math.floor(displayWidth);
            segCanvas.height = Math.floor(displayHeight);
            
            const w = segCanvas.width;
            const h = segCanvas.height;
            const spectrumH = h - 28; // Spectrum height, leaving space for bottom scale
            
            // Background
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, 0, w, h);
            
            // Draw waveform (placeholder or real data)
            const seq = window.lastGeneratedSequence;
            ctx.fillStyle = '#c7d2fe';
            
            if (seq && Array.isArray(seq.notes) && seq.notes.length) {
                const total = Math.max(seq.totalTime || 20, 20);
                const buckets = 80;
                const energy = new Array(buckets).fill(0);
                seq.notes.forEach(n => {
                    const startIdx = Math.floor((n.startTime / total) * buckets);
                    const endIdx = Math.floor((n.endTime / total) * buckets);
                    for (let i = startIdx; i <= endIdx && i < buckets; i++) {
                        energy[i] += (n.velocity || 80);
                    }
                });
                const barWidth = w / buckets;
                for (let i = 0; i < buckets; i++) {
                    const x = i * barWidth;
                    const barH = Math.min(spectrumH - 4, (energy[i] / 300) * (spectrumH - 4)) || 5;
                    ctx.fillRect(x, spectrumH - barH, barWidth - 2, barH);
                }
            } else {
                // Placeholder waveform - simulated audio waveform
                const barCount = 60;
                const barWidth = w / barCount;
                for (let i = 0; i < barCount; i++) {
                    const x = i * barWidth;
                    // Use multiple sine waves to simulate real waveform
                    const noise = Math.sin(i * 0.3) * 0.3 + Math.sin(i * 0.7) * 0.2 + Math.sin(i * 0.1) * 0.4;
                    const barH = (noise * 0.5 + 0.5) * (spectrumH * 0.6) + 15;
                    ctx.fillRect(x + 1, spectrumH - barH, barWidth - 2, barH);
                }
            }
            
            // Selected segment highlight
            const start = this.currentParams.segmentStartSec || 0;
            const end = this.currentParams.segmentEndSec || 15;
            const startX = (start / 20) * w;
            const endX = (end / 20) * w;
            
            ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
            ctx.fillRect(startX, 0, Math.max(2, endX - startX), spectrumH);
            
            // Boundary lines
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(startX, 0);
            ctx.lineTo(startX, spectrumH);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(endX, 0);
            ctx.lineTo(endX, spectrumH);
            ctx.stroke();
            
            // Boundary handles (triangles)
            ctx.fillStyle = '#6366f1';
            const handleSize = 6;
            
            // Left handle
            ctx.beginPath();
            ctx.moveTo(startX, spectrumH);
            ctx.lineTo(startX - handleSize, spectrumH + handleSize + 2);
            ctx.lineTo(startX + handleSize, spectrumH + handleSize + 2);
            ctx.closePath();
            ctx.fill();
            
            // Right handle
            ctx.beginPath();
            ctx.moveTo(endX, spectrumH);
            ctx.lineTo(endX - handleSize, spectrumH + handleSize + 2);
            ctx.lineTo(endX + handleSize, spectrumH + handleSize + 2);
            ctx.closePath();
            ctx.fill();
            
            // Time scale
            const rulerY = spectrumH + 16;
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, rulerY);
            ctx.lineTo(w, rulerY);
            ctx.stroke();
            
            ctx.fillStyle = '#9ca3af';
            ctx.font = '10px system-ui, sans-serif';
            ctx.textAlign = 'center';
            
            [0, 8, 12, 15, 20].forEach(t => {
                const tx = (t / 20) * w;
                ctx.strokeStyle = '#d1d5db';
                ctx.beginPath();
                ctx.moveTo(tx, rulerY - 3);
                ctx.lineTo(tx, rulerY + 3);
                ctx.stroke();
                ctx.fillText(`${t}s`, tx, rulerY + 14);
            });
            
            ctx.textAlign = 'left';
        };
        this.drawSegment = drawSegment;
        try {
            window.addEventListener('sequence:updated', () => this.drawSegment());
        } catch {}
        
        const updateComputedDuration = () => {
            const dur = Math.max(8, Math.min(20, this.currentParams.segmentEndSec - this.currentParams.segmentStartSec));
            this.currentParams.durationSec = dur;
            if (durValue) durValue.textContent = `${dur.toFixed(1)}s`;
        };
        
        const enforceBounds = (source) => {
            let start = this.currentParams.segmentStartSec;
            let end = this.currentParams.segmentEndSec;
            const durSafe = this.convergedParams?.duration || this.safeRanges?.duration || { min: 8, max: 20 };
            
            // Ensure minimum duration
            if (end - start < 8) {
                if (source === 'start') {
                    end = Math.min(20, start + 8);
                } else {
                    start = Math.max(0, end - 8);
                }
            }
            
            // Boundary check
            start = Math.max(0, Math.min(start, 20));
            end = Math.max(durSafe.min, Math.min(end, 20)); // Note: max is 20s
            
            // Re-ensure duration (if boundary check caused insufficient duration)
            if (end - start < 8) {
                if (start > 20 - 8) start = 20 - 8;
                end = start + 8;
            }
            
            this.currentParams.segmentStartSec = start;
            this.currentParams.segmentEndSec = end;
            
            if (segStartSlider) segStartSlider.max = String(Math.max(0, end - 8));
            if (segEndSlider) {
                segEndSlider.min = String(Math.min(20, start + 8));
                segEndSlider.max = String(20);
            }
            if (segStartSlider) segStartSlider.value = String(start);
            if (segEndSlider) segEndSlider.value = String(end);
            if (segStartValue) segStartValue.textContent = `${start.toFixed(1)}s`;
            if (segEndValue) segEndValue.textContent = `${end.toFixed(1)}s`;
            updateComputedDuration();
            drawSegment();
        };
        
        if (segStartSlider && segStartValue) {
            segStartSlider.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                this.currentParams.segmentStartSec = Math.max(0, Math.min(20, v));
                enforceBounds('start');
                try { localStorage.setItem('expert.segmentStartSec', String(this.currentParams.segmentStartSec)); } catch {}
            });
        }
        if (segEndSlider && segEndValue) {
            segEndSlider.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                this.currentParams.segmentEndSec = Math.max(8, Math.min(20, v));
                enforceBounds('end');
                try { localStorage.setItem('expert.segmentEndSec', String(this.currentParams.segmentEndSec)); } catch {}
            });
        }
        
        // Initialize
        const savedStart = parseFloat(localStorage.getItem('expert.segmentStartSec') || '0');
        const savedEnd = parseFloat(localStorage.getItem('expert.segmentEndSec') || '10');
        this.currentParams.segmentStartSec = Math.max(0, Math.min(20, savedStart));
        this.currentParams.segmentEndSec = Math.max(8, Math.min(20, savedEnd));
        enforceBounds('init');
        
        // Expose drawSegment to instance for external calls
        this.drawSegment = drawSegment;
        
        // Initial draw
        drawSegment();
        
        // Delayed redraw to ensure canvas is visible before drawing
        setTimeout(() => drawSegment(), 200);
        setTimeout(() => drawSegment(), 500);
        
        // ===== Canvas drag interaction (replaces HTML sliders) =====
        if (segCanvas) {
            const canvasWrapper = segCanvas.closest('.segment-canvas-wrapper');
            let dragging = null; // 'start' | 'end' | null
            const handleHitRadius = 15; // Handle click detection radius
            
            const getCanvasX = (e) => {
                const rect = segCanvas.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                return clientX - rect.left;
            };
            
            const xToTime = (x) => {
                const w = segCanvas.width;
                return Math.max(0, Math.min(20, (x / w) * 20));
            };
            
            const timeToX = (t) => {
                const w = segCanvas.width;
                return (t / 20) * w;
            };
            
            const getSpectrumHeight = () => {
                return segCanvas.height - 28;
            };
            
            // Detect if click position is near handle
            const hitTest = (x, y) => {
                const spectrumH = getSpectrumHeight();
                const startX = timeToX(this.currentParams.segmentStartSec || 0);
                const endX = timeToX(this.currentParams.segmentEndSec || 15);
                const handleY = spectrumH + 4; // Triangle center Y position
                
                // Detect if start handle was clicked
                const distStart = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - handleY, 2));
                if (distStart < handleHitRadius) return 'start';
                
                // Detect if end handle was clicked
                const distEnd = Math.sqrt(Math.pow(x - endX, 2) + Math.pow(y - handleY, 2));
                if (distEnd < handleHitRadius) return 'end';
                
                return null;
            };
            
            // Update cursor style
            const updateCursor = (x, y) => {
                if (dragging) {
                    segCanvas.style.cursor = 'ew-resize';
                    return;
                }
                const hit = hitTest(x, y);
                segCanvas.style.cursor = hit ? 'ew-resize' : 'default';
            };
            
            // Mouse/touch down
            const onPointerDown = (e) => {
                const rect = segCanvas.getBoundingClientRect();
                const x = getCanvasX(e);
                const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
                
                dragging = hitTest(x, y);
                if (dragging && canvasWrapper) {
                    canvasWrapper.classList.add(`dragging-${dragging}`);
                    e.preventDefault();
                }
            };
            
            // Mouse/touch move
            const onPointerMove = (e) => {
                const rect = segCanvas.getBoundingClientRect();
                const x = getCanvasX(e);
                const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
                
                if (dragging) {
                    const time = xToTime(x);
                    if (dragging === 'start') {
                        this.currentParams.segmentStartSec = Math.round(time * 2) / 2; // 0.5s step
                        enforceBounds('start');
                        try { localStorage.setItem('expert.segmentStartSec', String(this.currentParams.segmentStartSec)); } catch {}
                    } else if (dragging === 'end') {
                        this.currentParams.segmentEndSec = Math.round(time * 2) / 2; // 0.5s step
                        enforceBounds('end');
                        try { localStorage.setItem('expert.segmentEndSec', String(this.currentParams.segmentEndSec)); } catch {}
                    }
                    e.preventDefault();
                } else {
                    updateCursor(x, y);
                }
            };
            
            // Mouse/touch release
            const onPointerUp = () => {
                if (dragging && canvasWrapper) {
                    canvasWrapper.classList.remove(`dragging-start`);
                    canvasWrapper.classList.remove(`dragging-end`);
                }
                dragging = null;
                segCanvas.style.cursor = 'default';
            };
            
            // Bind events
            segCanvas.addEventListener('mousedown', onPointerDown);
            segCanvas.addEventListener('mousemove', onPointerMove);
            segCanvas.addEventListener('mouseup', onPointerUp);
            segCanvas.addEventListener('mouseleave', onPointerUp);
            
            // Touch support
            segCanvas.addEventListener('touchstart', onPointerDown, { passive: false });
            segCanvas.addEventListener('touchmove', onPointerMove, { passive: false });
            segCanvas.addEventListener('touchend', onPointerUp);
            segCanvas.addEventListener('touchcancel', onPointerUp);
            
            // Global mouse release (prevent stuck state when dragging outside canvas)
            document.addEventListener('mouseup', onPointerUp);
            document.addEventListener('touchend', onPointerUp);
        }
    }
    
    /**
     * Bind mode toggle buttons
     */
    bindModeToggle() {
        const testBtn = document.getElementById('param-mode-test');
        const spectrumBtn = document.getElementById('param-mode-spectrum');
        const spectrumArea = document.getElementById('spectrum-analysis-area');
        const paramsGrid = document.querySelector('.music-params-grid');
        const paramActions = document.querySelector('.param-actions');
        const presetsArea = document.getElementById('param-presets');
        
        const setActiveMode = (mode) => {
            testBtn?.classList.toggle('active', mode === 'test');
            spectrumBtn?.classList.toggle('active', mode === 'spectrum');
            spectrumArea?.classList.toggle('hidden', mode !== 'spectrum');
            paramsGrid?.classList.toggle('hidden', mode !== 'test');
            paramActions?.classList.toggle('hidden', mode !== 'test');
            presetsArea?.classList.toggle('hidden', mode !== 'test');
            
            // Test mode only shows three parameters, hide others
            const harmonyItem = document.getElementById('harmony-param-item');
            const instrumentItem = document.getElementById('instrument-param-item');
            const segmentSelector = document.querySelector('.segment-selector');
            if (mode === 'test') {
                harmonyItem?.classList.add('hidden');
                instrumentItem?.classList.add('hidden');
                segmentSelector?.classList.add('hidden');
            } else {
                harmonyItem?.classList.remove('hidden');
                instrumentItem?.classList.remove('hidden');
                segmentSelector?.classList.add('hidden');
            }
            document.getElementById('duration-param-item')?.classList.add('hidden');
        };
        
        
        if (testBtn) {
            testBtn.addEventListener('click', () => {
                this.setMode('test');
                setActiveMode('test');
            });
        }
        
        
        if (spectrumBtn) {
            spectrumBtn.addEventListener('click', () => {
                this.setMode('spectrum');
                setActiveMode('spectrum');
            });
        }
    }
    
    bindPresets() {
        const container = document.getElementById('param-presets');
        if (!container) return;
        const buttons = container.querySelectorAll('button[data-preset]');
        const setActive = (name) => {
            buttons.forEach(b => b.classList.toggle('active', b.dataset.preset === name));
        };
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.dataset.preset;
                this.currentPreset = name;
                setActive(name);
                this.applyPreset(name);
            });
        });
    }
    
    applyPreset(name) {
        const preset = this.presets[name];
        if (!preset) return;
        
        // Update safe ranges
        this.safeRanges.tempo = { ...preset.tempo };
        this.safeRanges.contrast = { ...preset.contrast };
        this.safeRanges.volume = { ...preset.volume };
        
        // Update slider absolute ranges and current values (set to preset range midpoint)
        const tempoSlider = document.getElementById('report-param-tempo');
        const tempoValue = document.getElementById('report-param-tempo-value');
        if (tempoSlider) {
            tempoSlider.min = String(preset.tempo.absMin);
            tempoSlider.max = String(preset.tempo.absMax);
            const tempoMid = Math.round((preset.tempo.min + preset.tempo.max) / 2);
            tempoSlider.value = String(tempoMid);
            this.currentParams.tempo = tempoMid;
            if (tempoValue) tempoValue.textContent = String(tempoMid);
            this.updateSliderStyle(tempoSlider, 'tempo', tempoMid);
        }
        
        const contrastSlider = document.getElementById('report-param-contrast');
        const contrastValue = document.getElementById('report-param-contrast-value');
        if (contrastSlider) {
            contrastSlider.min = String(preset.contrast.absMin);
            contrastSlider.max = String(preset.contrast.absMax);
            const contrastMid = Math.round((preset.contrast.min + preset.contrast.max) / 2);
            contrastSlider.value = String(contrastMid);
            this.currentParams.contrast = contrastMid;
            if (contrastValue) contrastValue.textContent = contrastMid + '%';
            this.updateSliderStyle(contrastSlider, 'contrast', contrastMid);
        }
        
        const volumeSlider = document.getElementById('report-param-volume');
        const volumeValue = document.getElementById('report-param-volume-value');
        if (volumeSlider) {
            volumeSlider.min = String(preset.volume.absMin);
            volumeSlider.max = String(preset.volume.absMax);
            const volumeMid = Math.round((preset.volume.min + preset.volume.max) / 2);
            volumeSlider.value = String(volumeMid);
            this.currentParams.volume = volumeMid;
            if (volumeValue) volumeValue.textContent = volumeMid + '%';
            this.updateSliderStyle(volumeSlider, 'volume', volumeMid);
        }
        
        // Refresh safe label text
        this.updateTexts();
        this.updateAllSliderStyles();
    }
    
    
    /**
     * Bind slider events
     */
    bindSliders() {
        const sliders = [
            { id: 'report-param-tempo', param: 'tempo', valueId: 'report-param-tempo-value', warningId: 'tempo-warning' },
            { id: 'report-param-contrast', param: 'contrast', valueId: 'report-param-contrast-value', warningId: 'contrast-warning' },
            { id: 'report-param-volume', param: 'volume', valueId: 'report-param-volume-value', warningId: 'volume-warning' },
            { id: 'report-param-density', param: 'density', valueId: 'report-param-density-value', warningId: 'density-warning' }
        ];
        
        sliders.forEach(({ id, param, valueId, warningId }) => {
            const slider = document.getElementById(id);
            const valueEl = document.getElementById(valueId);
            let warningEl = document.getElementById(warningId);
            
            if (!slider) {
                // If slider not found, skip (UI may not be loaded or param not needed)
                return;
            }
            
            if (!warningEl) {
                // Try to dynamically create warning element
                const item = slider.closest('.param-item');
                const labelEl = item?.querySelector('label');
                if (labelEl) {
                    warningEl = document.createElement('span');
                    warningEl.id = warningId;
                    warningEl.className = 'param-warning-badge hidden';
                    warningEl.textContent = this.t('expert.warning.unsafe');
                    labelEl.appendChild(warningEl);
                }
            }
            
            // Set safe range data attributes
            const range = this.safeRanges[param];
            if (range) {
                slider.dataset.safeMin = range.min;
                slider.dataset.safeMax = range.max;
                // Sync slider absolute range (Tempo)
                if (param === 'tempo') {
                    slider.min = String(range.absMin);
                    slider.max = String(range.absMax);
                    // Override initial value to avoid HTML default residue
                    slider.value = String(this.currentParams.tempo || 125);
                }
                // Non-tempo params also align with current params
                if (param !== 'tempo') {
                    slider.value = String(this.currentParams[param]);
                }
            }
            
            slider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.currentParams[param] = value;
                
                // Update display
                if (valueEl) {
                    valueEl.textContent = param === 'tempo' ? value : value + '%';
                }
                
                // Check if out of safe range
                const isUnsafe = this.isOutOfSafeRange(param, value);
                this.updateWarning(warningEl, isUnsafe);
                this.updateSliderStyle(slider, param, value);
                
                // Trigger callback
                this.onParamChange?.({ param, value, isUnsafe });
            });
            
            // Initialize style
            // Initialize display value to current slider value (if reset to default)
            const initVal = parseInt(slider.value);
            if (valueEl) {
                valueEl.textContent = param === 'tempo' ? initVal : initVal + '%';
            }
            this.updateSliderStyle(slider, param, initVal);
            // Initialize warning state
            const isUnsafe = this.isOutOfSafeRange(param, initVal);
            this.updateWarning(warningEl, isUnsafe);
        });
    }

    /**
     * Bind harmony option buttons
     */
    bindHarmonyOptions() {
        const container = document.getElementById('harmony-options');
        const warningEl = document.getElementById('harmony-warning');
        
        if (!container) return;
        
        const buttons = container.querySelectorAll('.harmony-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active state from other buttons
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const value = btn.dataset.value;
                this.currentParams.harmony = value;
                
                // Check if non-safe option
                const isUnsafe = !this.safeHarmony.includes(value);
                this.updateWarning(warningEl, isUnsafe);
                
                // Trigger callback
                this.onParamChange?.({ param: 'harmony', value, isUnsafe });
            });
        });
    }
    
    /**
     * Bind instrument option buttons
     */
    bindInstrumentOptions() {
        const container = document.getElementById('instrument-options');
        const warningEl = document.getElementById('instrument-warning');
        
        if (!container) return;
        
        const buttons = container.querySelectorAll('.instrument-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active state from other buttons
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const value = btn.dataset.value;
                this.currentParams.instrument = value;
                
                // Trigger callback
                this.onParamChange?.({ param: 'instrument', value, isUnsafe: false });
            });
        });
    }

    /**
     * Bind action buttons
     */
    bindActionButtons() {
        // Preview button
        const previewBtn = document.getElementById('param-preview-btn');
        const stopBtn = document.getElementById('param-stop-btn');
        
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                this.previewMusic();
            });
        }
        
        // Stop button
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.stopMusic();
            });
        }
        
        // Reset button
        const resetBtn = document.getElementById('param-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetToDefaults();
            });
        }
    }
    
    /**
     * Set mode
     */
    setMode(mode) {
        this.mode = mode;
        console.log(`[MusicParamController] Mode switched: ${mode}`);
    }
    
    /**
     * Check if parameter is out of safe range
     */
    isOutOfSafeRange(param, value) {
        const range = this.safeRanges[param];
        if (!range) return false;
        return value < range.min || value > range.max;
    }
    
    /**
     * Update warning display
     */
    updateWarning(warningEl, show) {
        if (!warningEl) {
            return;
        }
        if (show) {
            warningEl.classList.remove('hidden');
            // Force display using cssText to override !important
            warningEl.style.cssText = 'display: inline-block !important;';
        } else {
            warningEl.classList.add('hidden');
            warningEl.style.cssText = '';
        }
    }
    
    /**
     * Update slider style (safe range highlight)
     */
    updateSliderStyle(slider, param, value) {
        const range = this.safeRanges[param];
        if (!range || !slider) return;
        
        const min = parseInt(slider.min);
        const max = parseInt(slider.max);
        const totalRange = max - min;
        
        // Calculate safe range position percentage on slider
        const safeStartPercent = ((range.min - min) / totalRange) * 100;
        const safeEndPercent = ((range.max - min) / totalRange) * 100;
        const currentPercent = ((value - min) / totalRange) * 100;
        
        // Use CSS variables to set gradient background
        slider.style.setProperty('--safe-start', safeStartPercent + '%');
        slider.style.setProperty('--safe-end', safeEndPercent + '%');
        slider.style.setProperty('--current', currentPercent + '%');
        
        // Add/remove unsafe class
        const isUnsafe = this.isOutOfSafeRange(param, value);
        const item = slider.closest('.param-item');
        if (isUnsafe) {
            slider.classList.add('unsafe');
            if (item) item.classList.add('unsafe');
        } else {
            slider.classList.remove('unsafe');
            if (item) item.classList.remove('unsafe');
        }
    }
    
    /**
     * Update all slider styles
     */
    updateAllSliderStyles() {
        const sliders = [
            { id: 'report-param-tempo', param: 'tempo' },
            { id: 'report-param-contrast', param: 'contrast' },
            { id: 'report-param-volume', param: 'volume' }
        ];
        
        sliders.forEach(({ id, param }) => {
            const slider = document.getElementById(id);
            if (slider) {
                this.updateSliderStyle(slider, param, parseInt(slider.value));
            }
        });
    }
    
    /**
     * Update converge summary
     */
    updateConvergeSummary() {
        const tempoEl = document.getElementById('converge-tempo');
        const contrastEl = document.getElementById('converge-contrast');
        const volumeEl = document.getElementById('converge-volume');
        const harmonyEl = document.getElementById('converge-harmony');
        const durationMinEl = document.getElementById('converge-duration-min-val');
        const durationMaxEl = document.getElementById('converge-duration-max-val');
        const durationSelEl = document.getElementById('converge-duration-selected-val');
        
        if (tempoEl) tempoEl.textContent = this.currentParams.tempo;
        if (contrastEl) contrastEl.textContent = this.currentParams.contrast + '%';
        if (volumeEl) volumeEl.textContent = this.currentParams.volume + '%';
        if (harmonyEl) harmonyEl.textContent = this.currentParams.harmony;
        if (durationMinEl && this.convergedDuration) durationMinEl.textContent = this.convergedDuration.min;
        if (durationMaxEl && this.convergedDuration) durationMaxEl.textContent = this.convergedDuration.max;
        if (durationSelEl && this.selectedDuration) durationSelEl.textContent = this.selectedDuration;
    }
    
    /**
     * Preview music
     */
    previewMusic() {
        console.log('[MusicParamController] Preview music, params:', this.currentParams);
        if (this.mode !== 'test') {
            console.warn('[MusicParamController] Only test mode allows music preview');
            return;
        }
        
        // Stop current playback first
        this.stopMusic();
        
        // Apply parameters to music generator
        if (window.sessionConfig) {
            // Mark as expert mode to ensure manual parameters are used
            window.sessionConfig.expertMode = true;
            window.sessionConfig.expertOverride = true;
            
            window.sessionConfig.rewardBpm = this.currentParams.tempo;
            window.sessionConfig.dynamicContrast = this.currentParams.contrast / 100;
            window.sessionConfig.harmonyType = this.currentParams.harmony;
            window.sessionConfig.instrument = this.currentParams.instrument || 'piano'; // Default piano
            const baseDuration = Math.max(8, Math.min(20, (this.currentParams.segmentEndSec ?? 15) - (this.currentParams.segmentStartSec ?? 0)));
            const finalDuration = this.testDurationRange
                ? Math.max(this.testDurationRange.min, Math.min(this.testDurationRange.max, baseDuration))
                : baseDuration;
            window.sessionConfig.segmentStartSec = this.currentParams.segmentStartSec ?? 0;
            window.sessionConfig.segmentEndSec = this.currentParams.segmentEndSec ?? (window.sessionConfig.segmentStartSec + finalDuration);
            window.sessionConfig.rewardDurationSec = finalDuration;
            
            // Set volume level based on volume value
            if (this.currentParams.volume <= 50) {
                window.sessionConfig.volumeLevel = 'low';
            } else if (this.currentParams.volume <= 75) {
                window.sessionConfig.volumeLevel = 'medium';
            } else {
                window.sessionConfig.volumeLevel = 'high';
            }
        }
        
        // If popSynth exists, set volume directly
        if (window.popSynth) {
            window.popSynth.setVolume(this.currentParams.volume / 100);
        }
        
        // Always regenerate music based on current params (don't reuse old)
        try {
            const session = window.game?.getLastSession?.() || { notes: [] };
            if (typeof window.createRichTestMusic === 'function') {
                window.lastGeneratedSequence = window.createRichTestMusic(session);
                console.log('[MusicParamController] Regenerated music with test params', {
                    bpm: window.sessionConfig?.rewardBpm,
                    contrast: window.sessionConfig?.dynamicContrast,
                    harmony: window.sessionConfig?.harmonyType,
                    instrument: window.sessionConfig?.instrument,
                    segmentStart: window.sessionConfig?.segmentStartSec,
                    segmentEnd: window.sessionConfig?.segmentEndSec
                });
                try { 
                    window.dispatchEvent(new CustomEvent('sequence:updated', { detail: { sequence: window.lastGeneratedSequence } })); 
                } catch {}
            } else {
                console.warn('[MusicParamController] createRichTestMusic function not found');
            }
        } catch (err) {
            console.error('[MusicParamController] Failed to generate music:', err);
        }
        
        // Delayed playback to ensure previous playback has stopped
        setTimeout(() => {
            const playBtn = document.getElementById('play-music-btn');
            if (playBtn) playBtn.click();
            this.isPlaying = true;
        }, 100);
    }
    
    /**
     * Stop music
     */
    stopMusic() {
        console.log('[MusicParamController] Stop music');
        
        // Stop Magenta player (multiple possible references)
        const player = window.rewardPlayer || window.MAGENTA?.player || window.gameApp?.MAGENTA?.player;
        if (player) {
            try {
                player.stop();
            } catch (e) {
                console.warn('[stopMusic] Failed to stop Magenta player:', e);
            }
        }
        
        // Stop popSynth
        if (window.popSynth?.stopAll) {
            try {
                window.popSynth.stopAll();
            } catch (e) {
                console.warn('[stopMusic] Failed to stop popSynth:', e);
            }
        }
        
        // Try to stop Tone.js
        if (window.Tone?.Transport) {
            try {
                window.Tone.Transport.stop();
            } catch (e) {
                console.warn('[stopMusic] Failed to stop Tone.js:', e);
            }
        }
        
        this.isPlaying = false;
    }
    
    /**
     * Reset to defaults
     */
    resetToDefaults() {
        this.currentParams = {
            tempo: 130,
            contrast: 10,
            volume: 70,
            harmony: 'I-V',
            instrument: 'piano',
            durationSec: 15,
            segmentStartSec: 0,
            segmentEndSec: 15
        };
        
        // Update sliders
        const tempoSlider = document.getElementById('report-param-tempo');
        const contrastSlider = document.getElementById('report-param-contrast');
        const volumeSlider = document.getElementById('report-param-volume');
        
        if (tempoSlider) {
            tempoSlider.min = String(this.safeRanges.tempo.absMin);
            tempoSlider.max = String(this.safeRanges.tempo.absMax);
            tempoSlider.value = 125;
            document.getElementById('report-param-tempo-value').textContent = '125';
            this.updateSliderStyle(tempoSlider, 'tempo', 125);
        }
        
        if (contrastSlider) {
            contrastSlider.value = 10;
            document.getElementById('report-param-contrast-value').textContent = '10%';
            this.updateSliderStyle(contrastSlider, 'contrast', 10);
        }
        
        if (volumeSlider) {
            volumeSlider.value = 70;
            document.getElementById('report-param-volume-value').textContent = '70%';
            this.updateSliderStyle(volumeSlider, 'volume', 70);
        }
        
        // Reset harmony options
        const harmonyBtns = document.querySelectorAll('.harmony-btn');
        harmonyBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.value === 'I-V') {
                btn.classList.add('active');
            }
        });

        // Reset instrument options
        const instrumentBtns = document.querySelectorAll('.instrument-btn');
        instrumentBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.value === 'piano') {
                btn.classList.add('active');
            }
        });
        
        // Hide all warnings (use updateWarning method for consistency)
        ['tempo-warning', 'contrast-warning', 'volume-warning', 'harmony-warning', 'instrument-warning'].forEach(id => {
            const el = document.getElementById(id);
            this.updateWarning(el, false);
        });
        
        // Update converge summary
        if (this.mode === 'converge') {
            this.updateConvergeSummary();
        }
        
        console.log('[MusicParamController] Reset to defaults');
    }
    
    /**
     * Submit converged parameters to database
     */
    async submitConvergedParams() {
        // Collect upper/lower bound parameters
        const tempoMin = parseInt(document.getElementById('converge-tempo-min')?.value) || 100;
        const tempoMax = parseInt(document.getElementById('converge-tempo-max')?.value) || 140;
        const contrastMin = parseInt(document.getElementById('converge-contrast-min')?.value) || 0;
        const contrastMax = parseInt(document.getElementById('converge-contrast-max')?.value) || 20;
        const volumeMin = parseInt(document.getElementById('converge-volume-min')?.value) || 60;
        const volumeMax = parseInt(document.getElementById('converge-volume-max')?.value) || 80;
        const durationMin = parseInt(document.getElementById('converge-duration-min')?.value) || 8;
        const durationMax = parseInt(document.getElementById('converge-duration-max')?.value) || 20;
        const durationSel = parseInt(document.getElementById('converge-duration-selected')?.value) || Math.max(durationMin, Math.min(durationMax, 15));
        
        // Collect safe harmony options (from button group)
        const harmonyBtnsContainer = document.getElementById('converge-harmony-btns');
        const safeHarmonies = harmonyBtnsContainer 
            ? Array.from(harmonyBtnsContainer.querySelectorAll('.converge-harmony-btn.selected')).map(btn => btn.dataset.value)
            : ['I-V'];

        // Collect safe instrument options (from button group)
        const instrumentBtnsContainer = document.getElementById('converge-instrument-btns');
        const safeInstruments = instrumentBtnsContainer
            ? Array.from(instrumentBtnsContainer.querySelectorAll('.daw-instrument-btn.selected')).map(btn => btn.dataset.value)
            : ['piano'];
        
        this.convergedParams = {
            tempo: { min: tempoMin, max: tempoMax },
            contrast: { min: contrastMin, max: contrastMax },
            volume: { min: volumeMin, max: volumeMax },
            duration: { min: durationMin, max: durationMax, selected: durationSel },
            safeHarmonies,
            safeInstruments,
            timestamp: Date.now()
        };
        
        console.log('[MusicParamController] Submit converged params:', this.convergedParams);
        
        // Show submit result
        const submitBtn = document.getElementById('param-submit-btn');
        const originalText = submitBtn?.innerHTML;
        
        try {
            // TODO: Actual database submission logic
            // const response = await fetch('/api/converged-params', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(this.convergedParams)
            // });
            
            // Simulate successful submission
            if (submitBtn) {
                submitBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    ${this.t('expert.msg.saved')}
                `;
                submitBtn.classList.add('success');
            }
            
            // Trigger callback
            this.onSubmit?.({ params: this.convergedParams });
            
            // Restore button after 3 seconds
            setTimeout(() => {
                if (submitBtn) {
                    submitBtn.classList.remove('success');
                    
                    // Manually restore to "Save" state
                    submitBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline></svg>
                        ${this.t('expert.btn.save')}
                    `;
                }
            }, 3000);
            
        } catch (error) {
            console.error('[MusicParamController] Submit failed:', error);
            if (submitBtn) {
                submitBtn.innerHTML = this.t('expert.msg.failed');
                submitBtn.classList.add('error');
                setTimeout(() => {
                    submitBtn.classList.remove('error');
                    submitBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline></svg>
                        ${this.t('expert.btn.save')}
                    `;
                }, 3000);
            }
        }
    }
    
    /**
     * Get current parameters
     */
    getParams() {
        return { ...this.currentParams };
    }
    
    /**
     * Get converged parameters
     */
    getConvergedParams() {
        return this.convergedParams ? { ...this.convergedParams } : null;
    }
    
    /**
     * Bind DAW-style dual sliders
     */
    bindDawDualSliders() {
        const sliders = document.querySelectorAll('.daw-dual-slider');
        
        sliders.forEach(container => {
            const minSlider = container.querySelector('.daw-thumb-min');
            const maxSlider = container.querySelector('.daw-thumb-max');
            const trackFill = container.querySelector('.daw-track-fill');
            const param = container.dataset.param;
            const scope = container.dataset.scope || 'converge';
            // Override dataset range to match latest safe range
            if (param === 'tempo') {
                container.dataset.min = String(this.safeRanges.tempo.absMin);
                container.dataset.max = String(this.safeRanges.tempo.absMax);
            }
            const rangeMin = parseInt(container.dataset.min);
            const rangeMax = parseInt(container.dataset.max);
            
            if (!minSlider || !maxSlider || !trackFill) return;
            
            const minValEl = document.getElementById(`converge-${param}-min-val`);
            const maxValEl = document.getElementById(`converge-${param}-max-val`);
            
            const updateTrackFill = () => {
                const minVal = parseInt(minSlider.value);
                const maxVal = parseInt(maxSlider.value);
                const range = rangeMax - rangeMin;
                
                const leftPercent = ((minVal - rangeMin) / range) * 100;
                const rightPercent = 100 - ((maxVal - rangeMin) / range) * 100;
                
                trackFill.style.left = leftPercent + '%';
                trackFill.style.right = rightPercent + '%';
                
                // Update value display
                if (minValEl) minValEl.textContent = minVal;
                if (maxValEl) maxValEl.textContent = maxVal;
                
                // Record range
                if (param === 'duration') {
                    if (scope === 'converge') {
                        this.convergedDuration = { min: minVal, max: maxVal };
                    } else {
                        this.testDurationRange = { min: minVal, max: maxVal };
                    }
                }
            };
            
            // Ensure min doesn't exceed max
            minSlider.addEventListener('input', () => {
                const minVal = parseInt(minSlider.value);
                const maxVal = parseInt(maxSlider.value);
                if (minVal > maxVal) {
                    minSlider.value = maxVal;
                }
                updateTrackFill();
            });
            
            // Ensure max doesn't go below min
            maxSlider.addEventListener('input', () => {
                const minVal = parseInt(minSlider.value);
                const maxVal = parseInt(maxSlider.value);
                if (maxVal < minVal) {
                    maxSlider.value = minVal;
                }
                updateTrackFill();
            });
            
            // Initialize
            if (param === 'tempo') {
                minSlider.min = String(rangeMin);
                minSlider.max = String(rangeMax);
                maxSlider.min = String(rangeMin);
                maxSlider.max = String(rangeMax);
                minSlider.value = String(this.safeRanges.tempo.min);
                maxSlider.value = String(this.safeRanges.tempo.max);
            }
            updateTrackFill();
        });
        
        // Bind DAW harmony buttons
        const harmonyBtns = document.querySelectorAll('.daw-harmony-btn');
        harmonyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('selected');
            });
        });
    }
    
    /**
     * Play converge animation
     */
    playConvergeAnimation() {
        const sliders = document.querySelectorAll('.daw-dual-slider');
        
        sliders.forEach(container => {
            const trackFill = container.querySelector('.daw-track-fill');
            const minSlider = container.querySelector('.daw-thumb-min');
            const maxSlider = container.querySelector('.daw-thumb-max');
            const param = container.dataset.param;
            const rangeMin = parseInt(container.dataset.min);
            const rangeMax = parseInt(container.dataset.max);
            
            if (!trackFill || !minSlider || !maxSlider) return;
            
            // Get safe range
            const safeRange = this.safeRanges[param];
            if (!safeRange) return;
            
            const range = rangeMax - rangeMin;
            const targetLeft = ((safeRange.min - rangeMin) / range) * 100;
            const targetRight = 100 - ((safeRange.max - rangeMin) / range) * 100;
            
            // Set CSS variables for animation
            trackFill.style.setProperty('--converge-left', targetLeft + '%');
            trackFill.style.setProperty('--converge-right', targetRight + '%');
            
            // Set to fully open state first
            trackFill.style.left = '0%';
            trackFill.style.right = '0%';
            
            // Trigger animation
            trackFill.classList.add('animating');
            
            // Update slider positions after animation ends
            setTimeout(() => {
                trackFill.classList.remove('animating');
                minSlider.value = safeRange.min;
                maxSlider.value = safeRange.max;
                trackFill.style.left = targetLeft + '%';
                trackFill.style.right = targetRight + '%';
                
                // Update value display
                const minValEl = document.getElementById(`converge-${param}-min-val`);
                const maxValEl = document.getElementById(`converge-${param}-max-val`);
                if (minValEl) minValEl.textContent = safeRange.min;
                if (maxValEl) maxValEl.textContent = safeRange.max;
            }, 400);
        });
    }
}

// Global singleton
window.musicParamController = new MusicParamController();

// Initialize after DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    // Delayed initialization to ensure other components are loaded
    setTimeout(() => {
        window.musicParamController.init();
    }, 100);
});

console.log('🎵 Music Parameter Controller loaded');
