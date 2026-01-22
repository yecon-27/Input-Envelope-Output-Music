/**
 * ExpertSideDrawer - Expert Debug Drawer Component (Enhanced)
 * Frosted glass effect + Global state management + High-performance parameter updates
 */

// ============================================
// Global State Management Context
// ============================================
const ExpertSettingsContext = {
    state: {
        tempo: 125,
        volume: 0.7,
        density: 1.0,
        isUnsafeMode: false,
        isPreviewing: false,
        isMuted: true,
    },
    
    // Initial safe preset values
    safePreset: {
        tempo: 125,
        volume: 0.7,
        density: 1.0,
        isUnsafeMode: false,
        isPreviewing: false,
        isMuted: true,
    },
    
    listeners: new Set(),
    
    dispatch(action) {
        const prevState = { ...this.state };
        
        switch (action.type) {
            case 'SET_TEMPO':
                this.state.tempo = action.value;
                break;
            case 'SET_VOLUME':
                this.state.volume = action.value;
                break;
            case 'SET_DENSITY':
                this.state.density = action.value;
                break;
            case 'SET_UNSAFE_MODE':
                this.state.isUnsafeMode = action.value;
                break;
            case 'SET_PREVIEW_MODE':
                this.state.isPreviewing = action.value;
                this.state.isMuted = !action.value;
                break;
            case 'CLAMP_VALUE':
                // Removed safety clamp for BPM as per user request
                break;
            case 'RESET_TO_SAFE':
                Object.assign(this.state, { ...this.safePreset });
                break;
        }
        
        // Notify all listeners
        this.listeners.forEach(cb => cb(this.state, prevState, action));
        
        // Sync to Web Audio engine
        this._syncToAudioEngine(action);
    },
    
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    },
    
    getState() {
        return { ...this.state };
    },
    
    _syncToAudioEngine(action) {
        // Immediately sync to safety layer and audio engine
        const se = window.safetyEnvelope;
        if (!se) return;
        
        switch (action.type) {
            case 'SET_TEMPO':
                se.setParam('tempo', action.value);
                break;
            case 'SET_VOLUME':
                se.setParam('volume', action.value);
                if (window.popSynth) window.popSynth.setVolume(action.value);
                break;
            case 'SET_DENSITY':
                se.setParam('density', action.value);
                break;
            case 'SET_UNSAFE_MODE':
                se.setUnsafeMode(action.value, action.confirmed);
                break;
            case 'SET_PREVIEW_MODE':
                se.setPreviewMode(action.value);
                break;
            case 'RESET_TO_SAFE':
                se.setUnsafeMode(false);
                se.setPreviewMode(false);
                se.setParam('tempo', this.safePreset.tempo);
                se.setParam('volume', this.safePreset.volume);
                se.setParam('density', this.safePreset.density);
                break;
        }
    }
};

// Export global hook
window.useExpertSettings = () => ExpertSettingsContext;

// ============================================
// High-performance Parameter Updater (RAF + Debounce)
// ============================================
class ParameterUpdater {
    constructor() {
        this.pendingUpdates = new Map();
        this.rafId = null;
        this.lastUpdateTime = 0;
        this.minInterval = 30; // 30ms minimum update interval
    }
    
    scheduleUpdate(paramName, value, callback) {
        this.pendingUpdates.set(paramName, { value, callback });
        
        if (!this.rafId) {
            this.rafId = requestAnimationFrame(() => this.flush());
        }
    }
    
    flush() {
        const now = performance.now();
        const elapsed = now - this.lastUpdateTime;
        
        if (elapsed >= this.minInterval) {
            this.pendingUpdates.forEach(({ value, callback }, paramName) => {
                callback(paramName, value);
            });
            this.pendingUpdates.clear();
            this.lastUpdateTime = now;
        } else {
            // Delay to next frame
            this.rafId = requestAnimationFrame(() => this.flush());
            return;
        }
        
        this.rafId = null;
    }
    
    cancel() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.pendingUpdates.clear();
    }
}

const paramUpdater = new ParameterUpdater();

// ============================================
// ExpertSideDrawer Main Class
// ============================================
class ExpertSideDrawer {
    constructor() {
        this.isOpen = false;
        this.isExpertMode = false;
        this.element = null;
        this.warningTimeout = null;
        this.ctx = ExpertSettingsContext;
        
        this.init();
    }
    
    init() {
        this.createDrawerElement();
        this.bindEvents();
        this.setupKeyboardShortcut();
        this.subscribeToContext();

        // Subscribe to language changes
        if (window.i18n) {
            window.i18n.subscribe(() => this.updateTexts());
        }
        // Initial text update
        this.updateTexts();
    }

    t(key, params) {
        return window.i18n ? window.i18n.t(key, params) : key;
    }

    updateTexts() {
        if (!this.element) return;
        
        // Title & Tooltip
        const handle = this.element.querySelector('.drawer-handle');
        if (handle) handle.title = this.t('expert.titleTooltip');
        
        const title = this.element.querySelector('.drawer-header h3');
        if (title) title.textContent = this.t('expert.title');
        
        const closeBtn = this.element.querySelector('.drawer-close');
        if (closeBtn) closeBtn.title = this.t('expert.close');
        
        // Sections
        const tempoTitle = this.element.querySelector('.tempo-section h4');
        if (tempoTitle) tempoTitle.textContent = this.t('expert.tempo');
        
        const audioTitle = this.element.querySelectorAll('.drawer-section h4')[1];
        if (audioTitle) audioTitle.textContent = this.t('expert.audioParams');
        
        // Labels
        // We use IDs or structure. Here using label[for] is robust.
        const volumeLabel = this.element.querySelector('label[for="param-volume"]');
        if (volumeLabel) volumeLabel.textContent = this.t('expert.volume');
        
        const densityLabel = this.element.querySelector('label[for="param-density"]');
        if (densityLabel) densityLabel.textContent = this.t('expert.density');
    }
    
    subscribeToContext() {
        this.ctx.subscribe((state, prevState, action) => {
            this.syncUIFromState(state);
        });
    }
    
    triggerVisualWarning() {
        const drawer = this.element;
        if (!drawer) return;
        
        drawer.classList.add('warning-flash');
        clearTimeout(this.warningTimeout);
        this.warningTimeout = setTimeout(() => {
            drawer.classList.remove('warning-flash');
        }, 600);
    }
    
    resetToSafePreset() {
        this.ctx.dispatch({ type: 'RESET_TO_SAFE' });
        this.syncUIFromState(this.ctx.getState());
        
        // Visual feedback
        const panicBtn = this.element?.querySelector('#panic-reset-btn');
        if (panicBtn) {
            panicBtn.classList.add('activated');
            setTimeout(() => panicBtn.classList.remove('activated'), 300);
        }
    }

    syncUIFromState(state) {
        if (!this.element) return;
        
        // Tempo slider
        const tempoSlider = this.element.querySelector('#param-tempo');
        const tempoValue = this.element.querySelector('#param-tempo-value');
        if (tempoSlider && tempoValue) {
            tempoSlider.value = state.tempo;
            tempoValue.textContent = state.tempo;
        }
        
        // Volume slider
        const volumeSlider = this.element.querySelector('#param-volume');
        const volumeValue = this.element.querySelector('#param-volume-value');
        if (volumeSlider && volumeValue) {
            volumeSlider.value = Math.round(state.volume * 100);
            volumeValue.textContent = `${Math.round(state.volume * 100)}%`;
        }
        
        // Density slider
        const densitySlider = this.element.querySelector('#param-density');
        const densityValue = this.element.querySelector('#param-density-value');
        if (densitySlider && densityValue) {
            densitySlider.value = Math.round(state.density * 100);
            densityValue.textContent = state.density.toFixed(1);
        }
    }

    createDrawerElement() {
        const drawer = document.createElement('div');
        drawer.id = 'expert-drawer';
        drawer.className = 'expert-drawer';
        drawer.innerHTML = `
            <div class="drawer-handle">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
            </div>
            <div class="drawer-content">
                <div class="drawer-header">
                    <h3></h3>
                    <button class="drawer-close">×</button>
                </div>
                <div class="drawer-section" id="dev-session-report-section">
                    <h4>Developer Session Report</h4>
                    <pre id="dev-session-report-text" class="dev-report"></pre>
                    <div class="drawer-actions">
                        <button id="dev-report-download" class="drawer-btn">Download JSON</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(drawer);
        this.element = drawer;
        this.injectStyles();
    }

    injectStyles() {
        if (document.getElementById('expert-drawer-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'expert-drawer-styles';
        style.textContent = `
            /* Expert drawer - Frosted glass effect + Brand colors */
            .expert-drawer {
                position: fixed;
                top: 50%;
                right: -340px;
                transform: translateY(-50%);
                width: 320px;
                max-height: 90vh;
                background: rgba(30, 30, 45, 0.85);
                backdrop-filter: blur(24px) saturate(180%);
                -webkit-backdrop-filter: blur(24px) saturate(180%);
                border: 1px solid rgba(99, 102, 241, 0.2);
                border-right: none;
                border-radius: 16px 0 0 16px;
                z-index: 5000;
                transition: right 0.35s cubic-bezier(0.4, 0, 0.2, 1);
                display: flex;
                flex-direction: column;
                color: #E5E7EB;
                font-size: 13px;
                box-shadow: -8px 0 32px rgba(0, 0, 0, 0.3),
                            inset 0 0 0 1px rgba(255, 255, 255, 0.05);
                pointer-events: auto;
            }
            
            .expert-drawer.open {
                right: 0;
            }
            
            /* Warning flash animation */
            .expert-drawer.warning-flash {
                animation: warningFlash 0.6s ease-out;
            }
            
            @keyframes warningFlash {
                0%, 100% { border-color: rgba(99, 102, 241, 0.2); }
                25%, 75% { border-color: rgba(239, 68, 68, 0.8); box-shadow: -8px 0 32px rgba(239, 68, 68, 0.4); }
                50% { border-color: rgba(239, 68, 68, 1); box-shadow: -8px 0 48px rgba(239, 68, 68, 0.6); }
            }
            
            .drawer-handle {
                position: absolute;
                left: -44px;
                top: 50%;
                transform: translateY(-50%);
                width: 44px;
                height: 52px;
                background: rgba(30, 30, 45, 0.9);
                backdrop-filter: blur(16px);
                border-radius: 12px 0 0 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                border: 1px solid rgba(99, 102, 241, 0.3);
                border-right: none;
                transition: all 0.2s ease;
                z-index: 5001;
            }
            
            .drawer-handle:hover {
                background: rgba(99, 102, 241, 0.8);
                transform: translateY(-50%) translateX(-2px);
            }
            
            .drawer-handle svg { color: #A5B4FC; }
            
            .drawer-content {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                scrollbar-width: thin;
                scrollbar-color: rgba(99, 102, 241, 0.3) transparent;
            }
            
            .drawer-content::-webkit-scrollbar { width: 6px; }
            .drawer-content::-webkit-scrollbar-track { background: transparent; }
            .drawer-content::-webkit-scrollbar-thumb { 
                background: rgba(99, 102, 241, 0.3); 
                border-radius: 3px; 
            }
            
            .drawer-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid rgba(99, 102, 241, 0.2);
            }
            
            .drawer-header h3 {
                margin: 0;
                font-size: 15px;
                font-weight: 600;
                color: #F9FAFB;
                background: linear-gradient(135deg, #A5B4FC, #818CF8);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .drawer-close {
                background: none;
                border: none;
                color: #9CA3AF;
                font-size: 24px;
                cursor: pointer;
                padding: 0 8px;
                line-height: 1;
                transition: color 0.2s;
            }
            
            .drawer-close:hover { color: #F9FAFB; }
            
            .drawer-section {
                margin-bottom: 20px;
            }
            
            .drawer-section h4 {
                margin: 0 0 12px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: #A5B4FC;
            }
            
            /* Panic Button styles */
            .panic-button {
                width: 100%;
                padding: 14px 20px;
                background: linear-gradient(135deg, #DC2626, #B91C1C);
                border: none;
                border-radius: 10px;
                color: white;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                transition: all 0.2s ease;
                box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
            }
            
            .panic-button:hover {
                background: linear-gradient(135deg, #EF4444, #DC2626);
                transform: translateY(-1px);
                box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4);
            }
            
            .panic-button:active,
            .panic-button.activated {
                transform: scale(0.96);
                box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
            }
            
            /* Toggle Switch */
            .toggle-switch {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
                cursor: pointer;
            }
            
            .toggle-switch input { display: none; }
            
            .toggle-slider {
                width: 40px;
                height: 22px;
                background: #374151;
                border-radius: 11px;
                position: relative;
                transition: background 0.2s;
            }
            
            .toggle-slider::after {
                content: '';
                position: absolute;
                top: 2px;
                left: 2px;
                width: 18px;
                height: 18px;
                background: #9CA3AF;
                border-radius: 50%;
                transition: all 0.2s;
            }
            
            .toggle-switch input:checked + .toggle-slider {
                background: #6366F1;
            }
            
            .toggle-switch input:checked + .toggle-slider::after {
                left: 20px;
                background: #F9FAFB;
            }
            
            .toggle-label { font-size: 13px; }
            
            /* Vertical Tempo Slider */
            .tempo-section {
                padding: 16px;
                background: rgba(99, 102, 241, 0.08);
                border-radius: 12px;
                border: 1px solid rgba(99, 102, 241, 0.15);
            }
            
            .vertical-slider-container {
                display: flex;
                align-items: center;
                gap: 16px;
                height: 180px;
            }
            
            .slider-track {
                position: relative;
                height: 100%;
                width: 32px;
                display: flex;
                justify-content: center;
            }
            
            .vertical-slider {
                writing-mode: vertical-lr;
                direction: rtl;
                width: 180px;
                height: 8px;
                transform: rotate(180deg);
                appearance: none;
                background: linear-gradient(to right, 
                    #10B981 0%, #10B981 50%, 
                    #F59E0B 50%, #F59E0B 62.5%, 
                    #EF4444 62.5%, #EF4444 100%);
                border-radius: 4px;
                cursor: pointer;
            }
            
            .vertical-slider::-webkit-slider-thumb {
                appearance: none;
                width: 20px;
                height: 20px;
                background: #6366F1;
                border-radius: 50%;
                cursor: grab;
                box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
                transition: transform 0.1s, box-shadow 0.1s;
            }
            
            .vertical-slider::-webkit-slider-thumb:hover {
                transform: scale(1.15);
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.5);
            }
            
            .vertical-slider::-webkit-slider-thumb:active {
                cursor: grabbing;
            }
            
            /* 72 BPM snap marker */
            .snap-marker {
                position: absolute;
                left: 50%;
                bottom: 40%;
                transform: translateX(-50%);
                width: 28px;
                height: 4px;
                background: #A5B4FC;
                border-radius: 2px;
                pointer-events: none;
                box-shadow: 0 0 8px rgba(165, 180, 252, 0.5);
            }
            
            /* Safe zone indicator */
            .safe-zone-indicator {
                position: absolute;
                left: 50%;
                bottom: 25%;
                transform: translateX(-50%);
                width: 28px;
                height: 2px;
                background: #F59E0B;
                border-radius: 1px;
                pointer-events: none;
            }
            
            .slider-labels {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                height: 100%;
                font-size: 11px;
                color: #9CA3AF;
            }
            
            .slider-labels .label-snap {
                color: #A5B4FC;
                font-weight: 600;
            }
            
            .slider-labels .label-safe {
                color: #F59E0B;
                font-weight: 500;
            }
            
            .tempo-value {
                font-size: 28px;
                font-weight: 700;
                color: #A5B4FC;
                min-width: 50px;
                text-align: center;
                font-variant-numeric: tabular-nums;
            }
            
            /* Other parameter sliders */
            .param-row {
                display: grid;
                grid-template-columns: 50px 1fr 45px 20px;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
            }
            
            .param-row label {
                font-size: 12px;
                color: #D1D5DB;
            }
            
            .param-row input[type="range"] {
                width: 100%;
                height: 6px;
                background: #374151;
                border-radius: 3px;
                appearance: none;
                cursor: pointer;
            }
            
            .param-row input[type="range"]::-webkit-slider-thumb {
                appearance: none;
                width: 16px;
                height: 16px;
                background: #6366F1;
                border-radius: 50%;
                cursor: pointer;
                transition: transform 0.1s;
            }
            
            .param-row input[type="range"]::-webkit-slider-thumb:hover {
                transform: scale(1.15);
            }
            
            .param-row input[type="range"].warning::-webkit-slider-thumb {
                background: #F59E0B;
            }
            
            .param-row input[type="range"].danger::-webkit-slider-thumb {
                background: #EF4444;
            }
            
            .param-value {
                font-size: 12px;
                font-weight: 600;
                color: #A5B4FC;
                text-align: right;
            }
            
            .param-warning {
                color: #F59E0B;
                font-size: 14px;
            }
            
            #dev-session-report-section .dev-report {
                background: rgba(17, 24, 39, 0.6);
                border: 1px solid rgba(148, 163, 184, 0.15);
                color: #E5E7EB;
                padding: 10px 12px;
                border-radius: 8px;
                white-space: pre-wrap;
                word-break: break-word;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: 12px;
                line-height: 1.5;
            }
            .drawer-actions {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }
            .drawer-btn {
                background: #4F46E5;
                color: #FFFFFF;
                border: none;
                border-radius: 8px;
                padding: 6px 10px;
                cursor: pointer;
            }
            
            /* Confirm box */
            .confirm-box {
                background: rgba(239, 68, 68, 0.15);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 8px;
                padding: 12px;
                margin: 10px 0;
            }
            
            .confirm-box p {
                margin: 0 0 10px;
                font-size: 12px;
                color: #FCA5A5;
            }
            
            .btn-danger {
                background: #EF4444;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .btn-danger:hover { background: #DC2626; }
            
            .btn-secondary {
                background: rgba(55, 65, 81, 0.8);
                color: #E5E7EB;
                border: 1px solid rgba(75, 85, 99, 0.5);
                padding: 10px 16px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                width: 100%;
                transition: all 0.2s;
            }
            
            .btn-secondary:hover {
                background: rgba(75, 85, 99, 0.8);
            }
            
            /* Real-time status */
            .stat-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }
            
            .stat-row span:last-child {
                font-weight: 600;
                color: #A5B4FC;
                font-variant-numeric: tabular-nums;
            }
            
            /* Safety checks */
            .check-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 10px;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 6px;
                margin-bottom: 6px;
                transition: background 0.2s;
            }
            
            .check-item.pass { background: rgba(16, 185, 129, 0.1); }
            .check-item.pass .check-icon { color: #10B981; }
            
            .check-item.fail { background: rgba(239, 68, 68, 0.1); }
            .check-item.fail .check-icon { color: #EF4444; }
            
            .check-icon { font-size: 14px; }
            
            .drawer-actions {
                padding-top: 16px;
                border-top: 1px solid rgba(99, 102, 241, 0.2);
            }
            
            .hidden { display: none !important; }
        `;
        
        document.head.appendChild(style);
    }

    bindEvents() {
        // Drawer toggle
        this.element.querySelector('.drawer-handle').addEventListener('click', () => this.toggle());
        this.element.querySelector('.drawer-close').addEventListener('click', () => this.close());

        const downloadBtn = this.element.querySelector('#dev-report-download');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                const data = this._buildSessionReportData(window.game?.getLastSession?.() || null);
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `session_report_${data.traceId}.json`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        window.addEventListener('round:ended', (ev) => {
            const session = ev.detail;
            const data = this._buildSessionReportData(session);
            this._renderDevSessionReport(data);
            this.open();
        });
    }

    bindTempoSlider() {
        const slider = this.element.querySelector('#param-tempo');
        const valueEl = this.element.querySelector('#param-tempo-value');
        const warningEl = this.element.querySelector('#param-tempo-warning');
        const SNAP_VALUE = 125;
        const SNAP_THRESHOLD = 2;
        
        let isDragging = false;
        
        const updateTempo = (rawValue) => {
            let value = rawValue;
            
            // 72 BPM snap logic
            if (Math.abs(value - SNAP_VALUE) <= SNAP_THRESHOLD) {
                value = SNAP_VALUE;
                slider.value = SNAP_VALUE;
            }
            
            // Use RAF optimized updater
            paramUpdater.scheduleUpdate('tempo', value, (name, val) => {
                this.ctx.dispatch({ type: 'SET_TEMPO', value: val });
            });
            
            // 即时 UI 反馈
            valueEl.textContent = value;
            
            // 越界警告：超过安全区间显示警告（120-130）
            const isOverLimit = value < 120 || value > 130;
            if (isOverLimit) {
                warningEl.textContent = this.t('expert.warning.unsafe');
                warningEl.style.fontSize = "12px";
                warningEl.style.color = "#EF4444";
                warningEl.classList.remove('hidden');
                slider.classList.add('danger');
            } else {
                warningEl.classList.add('hidden');
                slider.classList.remove('danger');
                slider.classList.remove('warning');
            }
        };
        
        slider.addEventListener('input', (e) => {
            isDragging = true;
            updateTempo(parseInt(e.target.value));
        });
        
        slider.addEventListener('change', (e) => {
            isDragging = false;
            updateTempo(parseInt(e.target.value));
        });
        
        // 触摸设备优化
        slider.addEventListener('touchstart', () => { isDragging = true; }, { passive: true });
        slider.addEventListener('touchend', () => { isDragging = false; }, { passive: true });
    }

    _hashConfig(obj) {
        try {
            const s = JSON.stringify(obj || {});
            let h = 0;
            for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
            return h.toString(16);
        } catch { return '00000000'; }
    }

    _buildSessionReportData(session) {
        const traceId = window.sessionLogger?.sessionId || `legacy_${Date.now()}`;
        const cfg = { ...(window.sessionConfig || {}) };
        const configHash = this._hashConfig(cfg);
        const envelopeId = this._hashConfig(window.safetyEnvelope?.safeRanges || {});
        const lastGen = window._lastMusicGenerator || null;
        const raw = lastGen?.lastRawParams || null;
        const constrained = lastGen?.lastConstrainedParams || null;
        const clampLog = constrained?.clampLog || [];
        const compliance = clampLog.length === 0 ? 'PASS' : 'CLAMPED';
        const params = {
            tempo: constrained?.safeBpm ?? raw?.rawBpm ?? cfg.rewardBpm ?? 125,
            contrast: constrained?.safeContrast ?? raw?.rawContrast ?? cfg.dynamicContrast ?? null,
            duration: session?.durationSec ?? cfg.rewardDurationSec ?? null,
            avgLoudness: window._spectroInstance?._lastData?.constrained?.metrics?.avgLoudness ?? null
        };
        const explanation = clampLog.length
            ? clampLog.map(c => `${c.param} clamped ${c.original} → ${c.clamped} (${c.rule})`).join('; ')
            : 'None';
        return {
            traceId,
            configHash,
            envelopeId,
            compliance,
            params,
            changelog: clampLog,
            explanation,
            generatedAt: new Date().toISOString()
        };
    }

    _renderDevSessionReport(data) {
        const pre = this.element.querySelector('#dev-session-report-text');
        if (!pre) return;
        const lines = [
            `traceId: ${data.traceId}`,
            `configHash: ${data.configHash}`,
            `envelopeId: ${data.envelopeId}`,
            `compliance: ${data.compliance}`,
            `params: tempo=${data.params.tempo} BPM, contrast=${data.params.contrast ?? '--'}, duration=${data.params.duration ?? '--'}s, avgLoudness=${data.params.avgLoudness ?? '--'} LUFS`,
            `changelog: ${data.explanation}`
        ];
        pre.textContent = lines.join('\n');
    }
    
    bindSlider(name, toInternal, toDisplay, actionType) {
        const slider = this.element.querySelector(`#param-${name}`);
        const valueEl = this.element.querySelector(`#param-${name}-value`);
        const warningEl = this.element.querySelector(`#param-${name}-warning`);
        
        slider.addEventListener('input', (e) => {
            const rawValue = parseInt(e.target.value);
            const internalValue = toInternal(rawValue);
            
            // RAF 优化更新
            paramUpdater.scheduleUpdate(name, internalValue, (n, val) => {
                this.ctx.dispatch({ type: actionType, value: val });
            });
            
            valueEl.textContent = toDisplay(rawValue);
        });
    }

    updateSliderRanges() {
        const tempoRange = window.safetyEnvelope?.getParamRange('tempo');
        if (tempoRange) {
            const slider = this.element.querySelector('#param-tempo');
            slider.min = tempoRange.min;
            slider.max = tempoRange.max;
        }
    }
    
    setupKeyboardShortcut() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+E 切换专家模式
            if (e.ctrlKey && e.shiftKey && e.key === 'E') {
                e.preventDefault();
                this.toggle();
            }
            // Escape 关闭抽屉
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }
    
    toggle() {
        this.isOpen ? this.close() : this.open();
    }
    
    open() {
        this.isOpen = true;
        this.isExpertMode = true;
        this.element.classList.add('open');
        window.sessionLogger?.startRecording();
        this.startRealtimeUpdates();
        this.syncUIFromState(this.ctx.getState());
    }
    
    close() {
        this.isOpen = false;
        this.element.classList.remove('open');
        this.stopRealtimeUpdates();
        paramUpdater.cancel();
    }
    
    startRealtimeUpdates() {
        // Feature removed in simplified view
    }
    
    stopRealtimeUpdates() {
        // Feature removed in simplified view
    }

    updateRealtimeStats() {
        // Feature removed in simplified view
    }
    
    updateSafetyChecks(checks) {
        // Feature removed in simplified view
    }
    
    isExpert() {
        return this.isExpertMode;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ExpertSettingsContext = ExpertSettingsContext;
});

window.ExpertSideDrawer = ExpertSideDrawer;
window.ExpertSettingsContext = ExpertSettingsContext;
