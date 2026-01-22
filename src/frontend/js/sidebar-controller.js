/**
 * Sidebar Controller - Real-time monitoring panel controller
 * Manages real-time data updates and lane distribution visualization
 */

(function() {
    'use strict';

    class SidebarController {
        constructor() {
            this.updateInterval = null;
            this.laneStats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            this.totalAttempts = 0;  // Total attempts (including misses)
            this.successfulClicks = 0;  // Successful hit count
            this.recentClicks = [];
            this.maxRecentClicks = 16;  // Larger window to reduce jitter
            this.prevPatternProbs = { seq: 0.33, rep: 0.33, exp: 0.33 };
            this.lastPatternType = 'mixed';
            this.hysteresis = { seqOn: 0.7, seqOff: 0.4 }; // Sequential on/hold threshold
            
            this.elements = {};
            this.init();
        }

        init() {
            // Wait for DOM to load
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setup());
            } else {
                this.setup();
            }
        }

        setup() {
            this.cacheElements();
            this.bindEvents();
            this.startUpdates();
            
            // Initial static text update
            this.updateStaticTexts();

            // Subscribe to language changes
            if (window.i18n) {
                window.i18n.subscribe(() => {
                    this.updateDisplay();
                    this.updateStaticTexts();
                });
            }

            console.log('[Sidebar] Controller initialized');
        }

        cacheElements() {
            this.elements = {
                sidebar: document.getElementById('game-sidebar'),
                toggleBtn: document.getElementById('sidebar-toggle-btn'),
                rtClicks: document.getElementById('rt-clicks'),
                // rtAccuracy & rtBpm removed
                rtDominant: document.getElementById('rt-dominant'),
                rtLaneBars: document.getElementById('rt-lane-bars'),
                rtPattern: document.getElementById('rt-pattern'),
                rtRecentClicks: document.getElementById('rt-recent-clicks'),
                devSessionReport: null,
                
                // Static label containers (using querySelector within sidebar)
                sidebarTitle: document.querySelector('.sidebar-title'),
                // Section titles
                sectionTitles: document.querySelectorAll('.section-title'),
                // Mini stat labels
                miniLabels: document.querySelectorAll('.mini-stat .mini-label')
            };
        }

        updateStaticTexts() {
            if (!this.elements.sidebar) return;

            // Sidebar Title
            if (this.elements.sidebarTitle) {
                this.elements.sidebarTitle.textContent = this.t('sidebar.title');
            }

            // Section Titles (Need to preserve SVG icons)
            // 1. Real-time Data
            const rtDataTitle = this.elements.sectionTitles[0];
            if (rtDataTitle) {
                const icon = rtDataTitle.querySelector('svg');
                rtDataTitle.innerHTML = '';
                if (icon) rtDataTitle.appendChild(icon.cloneNode(true));
                rtDataTitle.appendChild(document.createTextNode(' ' + this.t('sidebar.realtimeData')));
            }

            // 2. Lane Dist
            const laneDistTitle = this.elements.sectionTitles[1];
            if (laneDistTitle) {
                const icon = laneDistTitle.querySelector('svg');
                laneDistTitle.innerHTML = '';
                if (icon) laneDistTitle.appendChild(icon.cloneNode(true));
                laneDistTitle.appendChild(document.createTextNode(' ' + this.t('sidebar.laneDist')));
            }

            // 3. Pattern Predict
            const patternTitle = this.elements.sectionTitles[2];
            if (patternTitle) {
                const icon = patternTitle.querySelector('svg');
                const tooltipTrigger = patternTitle.querySelector('.bubble-tooltip-trigger');
                patternTitle.innerHTML = '';
                if (icon) patternTitle.appendChild(icon.cloneNode(true));
                patternTitle.appendChild(document.createTextNode(' ' + this.t('sidebar.patternPredict') + ' '));
                if (tooltipTrigger) patternTitle.appendChild(tooltipTrigger.cloneNode(true));
            }

            // 4. Recent Clicks
            const recentClicksTitle = this.elements.sectionTitles[3];
            if (recentClicksTitle) {
                const icon = recentClicksTitle.querySelector('svg');
                recentClicksTitle.innerHTML = '';
                if (icon) recentClicksTitle.appendChild(icon.cloneNode(true));
                recentClicksTitle.appendChild(document.createTextNode(' ' + this.t('sidebar.recentClicks')));
            }

            // Mini Stat Labels
            const miniLabels = this.elements.miniLabels;
            if (miniLabels && miniLabels.length >= 2) {
                miniLabels[0].textContent = this.t('sidebar.clickCount');
                miniLabels[1].textContent = this.t('sidebar.dominant');
            }
        }

        bindEvents() {
            // Sidebar collapse/expand
            if (this.elements.toggleBtn) {
                this.elements.toggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleSidebar();
                });
            }

            // Listen for bubble pop events (successful hits)
            window.addEventListener('bubble:popped', (e) => this.onBubblePopped(e.detail));
            
            // Listen for click attempt events (including misses)
            window.addEventListener('click:attempt', (e) => this.onClickAttempt(e.detail));
            
            // Listen for game round events
            window.addEventListener('round:started', () => this.resetStats());
            window.addEventListener('round:ended', (ev) => {
                this.onRoundEnded();
                const session = ev.detail;
                const data = this.buildSessionReportData(session);
                this.consoleLogSessionReport(data);
            });
        }

        toggleSidebar() {
            if (this.elements.sidebar) {
                const isCollapsed = this.elements.sidebar.classList.toggle('collapsed');
                console.log('[Sidebar] Toggle:', isCollapsed ? 'collapsed' : 'expanded');
            }
        }

        resetStats() {
            this.laneStats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            this.totalAttempts = 0;
            this.successfulClicks = 0;
            this.recentClicks = [];
            this.updateDisplay();
        }

        onBubblePopped(bubble) {
            if (!bubble) return;

            this.successfulClicks++;
            this.totalAttempts++;

            // Update lane statistics
            if (bubble.laneId && this.laneStats[bubble.laneId] !== undefined) {
                this.laneStats[bubble.laneId]++;
            }

            // Record recent click
            this.recentClicks.unshift({
                laneId: bubble.laneId,
                note: bubble.note?.name || '?',
                time: Date.now(),
                success: true
            });
            if (this.recentClicks.length > this.maxRecentClicks) {
                this.recentClicks.pop();
            }
        }

        onClickAttempt(detail) {
            // Record missed click attempts
            if (detail && !detail.success) {
                this.totalAttempts++;
            }
        }

        onRoundEnded() {
            console.log('[Sidebar] Round ended, final stats:', this.laneStats);
        }

        startUpdates() {
            this.updateInterval = setInterval(() => this.updateDisplay(), 500);
        }

        t(key, params) {
            return window.i18n ? window.i18n.t(key, params) : key;
        }

        updateDisplay() {
            this.updateStats();
            this.updateLaneBars();
            this.updatePatternPrediction();
            this.updateRecentClicks();
        }

        updateStats() {
            // Click count (successful hits)
            if (this.elements.rtClicks) {
                this.elements.rtClicks.textContent = this.successfulClicks;
            }

            // Accuracy and BPM display removed as requested

            // Dominant lane
            if (this.elements.rtDominant) {
                const dominant = this.getDominantLane();
                if (dominant) {
                    const laneNames = { 1: 'C', 2: 'D', 3: 'E', 4: 'G', 5: 'A' };
                    this.elements.rtDominant.textContent = `${laneNames[dominant.lane]} (${dominant.percent}%)`;
                } else {
                    this.elements.rtDominant.textContent = '-';
                }
            }
        }

        updateLaneBars() {
            if (!this.elements.rtLaneBars) return;

            const bars = this.elements.rtLaneBars.querySelectorAll('.lane-bar');
            const total = Object.values(this.laneStats).reduce((a, b) => a + b, 0);
            const maxCount = Math.max(...Object.values(this.laneStats), 1);

            bars.forEach((bar) => {
                const laneId = parseInt(bar.dataset.lane);
                const count = this.laneStats[laneId] || 0;
                const height = total > 0 ? (count / maxCount) * 100 : 10;
                
                bar.style.height = Math.max(height, 10) + '%';
                bar.classList.toggle('active', count > 0);
            });
        }

        updatePatternPrediction() {
            if (!this.elements.rtPattern) return;

            const pattern = this.detectPattern();
            const patternEl = this.elements.rtPattern;

            if (pattern.type === 'unknown') {
                patternEl.innerHTML = `<span class="pattern-label">${this.t('sidebar.waitingForData')}</span>`;
            } else {
                const typeLabels = {
                    sequential: this.t('sidebar.pattern.sequential'),
                    repetitive: this.t('sidebar.pattern.repetitive'),
                    exploratory: this.t('sidebar.pattern.exploratory'),
                    mixed: this.t('sidebar.pattern.mixed')
                };
                patternEl.innerHTML = `
                    <span class="pattern-type">${typeLabels[pattern.type] || pattern.type}</span>
                    <span class="pattern-confidence">${Math.round(pattern.confidence * 100)}%</span>
                `;
            }
        }

        updateRecentClicks() {
            if (!this.elements.rtRecentClicks) return;

            if (this.recentClicks.length === 0) {
                this.elements.rtRecentClicks.innerHTML = `<span class="no-data">${this.t('sidebar.noData')}</span>`;
                return;
            }

            const laneColors = {
                1: '#F87171', 2: '#FB923C', 3: '#FBBF24',
                4: '#60A5FA', 5: '#A78BFA'
            };

            // Show max 12 items
            const html = this.recentClicks.slice(0, 12).map(click => {
                const color = laneColors[click.laneId] || '#999';
                return `<span class="click-item" style="background: ${color};">${click.note}</span>`;
            }).join('');
            this.elements.rtRecentClicks.innerHTML = html;
        }

        buildSessionReportData(session) {
            const traceId = window.sessionLogger?.sessionId || `legacy_${Date.now()}`;
            const cfg = { ...(window.sessionConfig || {}) };
            const hash = (obj) => {
                try {
                    const s = JSON.stringify(obj || {});
                    let h = 0;
                    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
                    return h.toString(16);
                } catch { return '00000000'; }
            };
            const configHash = hash(cfg);
            const envelopeId = hash(window.safetyEnvelope?.safeRanges || {});
            const gen = window._lastMusicGenerator || null;
            const raw = gen?.lastRawParams || null;
            const constrained = gen?.lastConstrainedParams || null;
            const clampLog = constrained?.clampLog || [];
            const compliance = clampLog.length === 0 ? 'PASS' : 'CLAMPED';
            const params = {
                tempo: constrained?.safeBpm ?? raw?.rawBpm ?? cfg.rewardBpm ?? 125,
                contrast: constrained?.safeContrast ?? raw?.rawContrast ?? cfg.dynamicContrast ?? null,
                duration: session?.durationSec ?? cfg.rewardDurationSec ?? null,
            };
            const explanation = clampLog.length
                ? clampLog.map(c => `${c.param} ${c.original} → ${c.clamped} (${c.rule})`).join('; ')
                : 'None';
            return { traceId, configHash, envelopeId, compliance, params, explanation };
        }

        consoleLogSessionReport(data) {
            const lines = [
                `[SessionReport] traceId=${data.traceId}`,
                `configHash=${data.configHash} envelopeId=${data.envelopeId}`,
                `compliance=${data.compliance}`,
                `params: tempo=${data.params.tempo} BPM, contrast=${data.params.contrast ?? '--'}, duration=${data.params.duration ?? '--'}s`,
                `changelog: ${data.explanation}`
            ];
            console.log(lines.join(' | '));
            console.table({
                traceId: data.traceId,
                configHash: data.configHash,
                envelopeId: data.envelopeId,
                compliance: data.compliance,
                tempo: data.params.tempo,
                contrast: data.params.contrast ?? '--',
                duration: data.params.duration ?? '--'
            });
        }

        estimateBPM() {
            if (this.recentClicks.length < 3) return 0;

            const intervals = [];
            for (let i = 1; i < Math.min(this.recentClicks.length, 6); i++) {
                const interval = this.recentClicks[i - 1].time - this.recentClicks[i].time;
                if (interval > 0 && interval < 3000) {
                    intervals.push(interval);
                }
            }

            if (intervals.length === 0) return 0;

            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            return (60 * 1000) / avgInterval;
        }

        getDominantLane() {
            const total = Object.values(this.laneStats).reduce((a, b) => a + b, 0);
            if (total === 0) return null;

            let maxLane = 1;
            let maxCount = 0;

            for (const [lane, count] of Object.entries(this.laneStats)) {
                if (count > maxCount) {
                    maxCount = count;
                    maxLane = parseInt(lane);
                }
            }

            return {
                lane: maxLane,
                count: maxCount,
                percent: Math.round((maxCount / total) * 100)
            };
        }

        detectPattern() {
            if (this.recentClicks.length < 5) {
                return { type: 'unknown', confidence: 0 };
            }

            const lanes = this.recentClicks.slice(0, 12).map(c => c.laneId);
            
            let covered = new Set();
            for (let i = 0; i < lanes.length; i++) {
                if (lanes[i] !== 1) continue;
                let last = i;
                let ok = true;
                const idxs = [i];
                for (let step = 2; step <= 5; step++) {
                    let found = -1;
                    for (let j = last + 1; j < lanes.length && j <= last + 6; j++) {
                        if (lanes[j] === step) { found = j; break; }
                    }
                    if (found < 0) { ok = false; break; }
                    idxs.push(found);
                    last = found;
                }
                if (ok) { idxs.forEach(k => covered.add(k)); }
            }
            let coveredDown = new Set();
            for (let i = 0; i < lanes.length; i++) {
                if (lanes[i] !== 5) continue;
                let last = i;
                let ok = true;
                const idxs = [i];
                for (let step = 4; step >= 1; step--) {
                    let found = -1;
                    for (let j = last + 1; j < lanes.length && j <= last + 6; j++) {
                        if (lanes[j] === step) { found = j; break; }
                    }
                    if (found < 0) { ok = false; break; }
                    idxs.push(found);
                    last = found;
                }
                if (ok) { idxs.forEach(k => coveredDown.add(k)); }
            }
            const seqRatio = Math.max(covered.size, coveredDown.size) / lanes.length;

            // Detect repetitive pattern
            const laneCounts = {};
            lanes.forEach(l => laneCounts[l] = (laneCounts[l] || 0) + 1);
            const maxRepeat = Math.max(...Object.values(laneCounts));
            const repRatio = maxRepeat / lanes.length;

            // Detect exploratory pattern
            // Lower threshold: from 5 to 4 (using 4 notes counts as exploratory)
            const uniqueLanes = new Set(lanes).size;
            const expRatio = uniqueLanes / 5;

            // Normalize scores (consistent with report panel)
            // Adjust weights, increase exploratory relative score
            const seqRaw = Math.min(1, (seqRatio / 0.8) * 0.7 + (uniqueLanes / 5) * 0.3);
            const repRaw = Math.min(1, repRatio / 0.6);
            // Increase laneDiversity weight (0.6 -> 0.7), reduce repRatio penalty (0.4 -> 0.3)
            const expRaw = Math.min(1, (uniqueLanes / 5) * 0.7 + (1 - repRatio) * 0.3);
            
            const total = seqRaw + repRaw + expRaw || 1;
            let probs = {
                seq: seqRaw / total,
                rep: repRaw / total,
                exp: expRaw / total,
            };
            
            const alpha = 0.6; // Stronger smoothing to avoid frequent jumps
            probs = {
                seq: alpha * this.prevPatternProbs.seq + (1 - alpha) * probs.seq,
                rep: alpha * this.prevPatternProbs.rep + (1 - alpha) * probs.rep,
                exp: alpha * this.prevPatternProbs.exp + (1 - alpha) * probs.exp,
            };
            this.prevPatternProbs = { ...probs };
            
            const entries = Object.entries(probs).sort((a, b) => b[1] - a[1]);
            const [topKey, topProb] = entries[0];
            const typeMap = { seq: 'sequential', rep: 'repetitive', exp: 'exploratory' };
            const forceSequential = (seqRatio >= this.hysteresis.seqOn) ||
                                    (this.lastPatternType === 'sequential' && seqRatio >= this.hysteresis.seqOff);
            let type = 'exploratory';
            if (forceSequential) {
                type = 'sequential';
            } else if (topKey === 'rep' || (repRatio >= 0.6 && probs.rep >= 0.5)) {
                type = 'repetitive';
            } else {
                type = 'exploratory';
            }
            const confidence = forceSequential ? Math.max(topProb, seqRatio) : topProb;
            this.lastPatternType = type;
            return { type, confidence };
        }
    }

    window.sidebarController = new SidebarController();

})();
