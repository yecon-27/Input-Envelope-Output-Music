/**
 * SessionLogger - Expert audit mode data logging system
 * Records all parameter changes, user behavior, and safety interception events during gameplay
 */
class SessionLogger {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.startTime = null;
        this.isRecording = false;
        
        // Timeline data
        this.timeline = {
            // Causal alignment data: per-second (System_BPM, User_Click_Frequency)
            causalAlignment: [],
            // Parameter change records
            paramChanges: [],
            // User click events
            userClicks: [],
            // Safety interception logs
            interceptedEvents: [],
            // Bubble pop events
            bubblePops: [],
        };
        
        // Safety check results
        this.safetyChecks = {
            scaleCheck: { passed: true, details: [] },
            densityCheck: { passed: true, details: [] },
            tempoCheck: { passed: true, details: [] },
            volumeCheck: { passed: true, details: [] },
        };
        
        // Statistics
        this.stats = {
            totalClicks: 0,
            successfulPops: 0,
            missedClicks: 0,
            interceptedNotes: 0,
            paramAdjustments: 0,
        };
        
        // Per-second sampling timer
        this.samplingInterval = null;
        this.lastClickCount = 0;
        this.clicksThisSecond = 0;
    }
    
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Start recording
     */
    startRecording() {
        this.sessionId = this.generateSessionId();
        this.startTime = performance.now();
        this.isRecording = true;
        
        // Reset data
        this.timeline = {
            causalAlignment: [],
            paramChanges: [],
            userClicks: [],
            interceptedEvents: [],
            bubblePops: [],
        };
        this.stats = {
            totalClicks: 0,
            successfulPops: 0,
            missedClicks: 0,
            interceptedNotes: 0,
            paramAdjustments: 0,
        };
        
        // Start per-second sampling
        this.startSampling();
        
        console.log('[SessionLogger] Recording started, sessionId:', this.sessionId);
    }
    
    /**
     * Stop recording
     */
    stopRecording() {
        this.isRecording = false;
        this.stopSampling();
        
        const duration = (performance.now() - this.startTime) / 1000;
        console.log(`[SessionLogger] Recording stopped, duration: ${duration.toFixed(1)}s`);
        
        return this.exportSession();
    }
    
    /**
     * Start per-second sampling
     */
    startSampling() {
        this.samplingInterval = setInterval(() => {
            if (!this.isRecording) return;
            
            const elapsed = (performance.now() - this.startTime) / 1000;
            const currentBPM = window.sessionConfig?.rewardBpm || 125;
            const clickFrequency = this.clicksThisSecond;
            
            this.timeline.causalAlignment.push({
                t: elapsed,
                systemBPM: currentBPM,
                userClickFreq: clickFrequency,
                gameSpeed: window.game?.gameSpeed || 1.0,
            });
            
            // Reset click count for this second
            this.clicksThisSecond = 0;
        }, 1000);
    }
    
    stopSampling() {
        if (this.samplingInterval) {
            clearInterval(this.samplingInterval);
            this.samplingInterval = null;
        }
    }
    
    /**
     * Record user click
     */
    recordClick(x, y, hit = false) {
        if (!this.isRecording) return;
        
        const elapsed = (performance.now() - this.startTime) / 1000;
        this.timeline.userClicks.push({
            t: elapsed,
            x, y,
            hit,
        });
        
        this.stats.totalClicks++;
        this.clicksThisSecond++;
        
        if (hit) {
            this.stats.successfulPops++;
        } else {
            this.stats.missedClicks++;
        }
    }
    
    /**
     * Record bubble pop
     */
    recordBubblePop(bubble) {
        if (!this.isRecording) return;
        
        const elapsed = (performance.now() - this.startTime) / 1000;
        this.timeline.bubblePops.push({
            t: elapsed,
            bubbleId: bubble.id,
            laneId: bubble.laneId,
            note: bubble.note?.name,
            midi: bubble.note?.midi,
        });
    }
    
    /**
     * Record parameter change
     */
    recordParamChange(paramName, oldValue, newValue, source = 'user') {
        if (!this.isRecording) return;
        
        const elapsed = (performance.now() - this.startTime) / 1000;
        this.timeline.paramChanges.push({
            t: elapsed,
            param: paramName,
            from: oldValue,
            to: newValue,
            source, // 'user' | 'system' | 'safety'
        });
        
        this.stats.paramAdjustments++;
    }
    
    /**
     * Record safety interception event
     */
    recordInterception(eventType, originalValue, clampedValue, rule) {
        if (!this.isRecording) return;
        
        const elapsed = (performance.now() - this.startTime) / 1000;
        this.timeline.interceptedEvents.push({
            t: elapsed,
            type: eventType,
            original: originalValue,
            clamped: clampedValue,
            rule: rule,
        });
        
        this.stats.interceptedNotes++;
        
        // Update safety check status
        if (rule.includes('tempo')) {
            this.safetyChecks.tempoCheck.passed = false;
            this.safetyChecks.tempoCheck.details.push({ t: elapsed, value: originalValue });
        }
    }
    
    /**
     * Run safety checks
     */
    runSafetyChecks(melodySpec) {
        const checks = {
            scaleCheck: this.checkScale(melodySpec),
            densityCheck: this.checkDensity(melodySpec),
            tempoCheck: this.checkTempo(melodySpec),
            volumeCheck: this.checkVolume(melodySpec),
        };
        
        this.safetyChecks = checks;
        return checks;
    }
    
    checkScale(spec) {
        const pentatonic = ['C', 'D', 'E', 'G', 'A'];
        const notes = spec?.phrases?.flatMap(p => p.notes?.map(n => n.pitch?.[0])) || [];
        const violations = notes.filter(n => n && !pentatonic.includes(n));
        
        return {
            passed: violations.length === 0,
            details: violations.length > 0 ? [`${violations.length} notes outside pentatonic scale`] : [],
        };
    }
    
    checkDensity(spec) {
        const noteCount = spec?.phrases?.reduce((sum, p) => sum + (p.notes?.length || 0), 0) || 0;
        const duration = spec?.durationSec || 60;
        const density = noteCount / duration;
        
        const maxDensity = 2; // Max 2 notes per second
        return {
            passed: density <= maxDensity,
            details: density > maxDensity ? [`Density ${density.toFixed(2)}/s exceeds threshold ${maxDensity}/s`] : [],
        };
    }
    
    checkTempo(spec) {
        const bpm = spec?.bpm || window.sessionConfig?.rewardBpm || 125;
        const safeRange = { min: 120, max: 130 };
        
        return {
            passed: bpm >= safeRange.min && bpm <= safeRange.max,
            details: (bpm < safeRange.min || bpm > safeRange.max) 
                ? [`BPM ${bpm} outside safe range [${safeRange.min}, ${safeRange.max}]`] 
                : [],
        };
    }
    
    checkVolume(spec) {
        const volume = window.sessionConfig?.volumeLevel || 'medium';
        const velocities = spec?.phrases?.flatMap(p => p.notes?.map(n => n.velocity)) || [];
        const maxVel = Math.max(...velocities, 0);
        
        return {
            passed: maxVel <= 100,
            details: maxVel > 100 ? [`Max velocity ${maxVel} exceeds threshold 100`] : [],
        };
    }
    
    /**
     * Export session data
     */
    exportSession() {
        const endTime = performance.now();
        
        return {
            sessionId: this.sessionId,
            startTime: this.startTime,
            endTime: endTime,
            durationSec: (endTime - this.startTime) / 1000,
            timeline: this.timeline,
            safetyChecks: this.safetyChecks,
            stats: this.stats,
            config: { ...window.sessionConfig },
            exportedAt: new Date().toISOString(),
        };
    }
    
    /**
     * Download session JSON
     */
    downloadJSON(filename) {
        const data = this.exportSession();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `audit_${this.sessionId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Global singleton
window.sessionLogger = new SessionLogger();
window.SessionLogger = SessionLogger;
