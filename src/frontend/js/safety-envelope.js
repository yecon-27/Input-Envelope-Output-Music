/**
 * SafetyEnvelope - Safety circuit breaker logic layer
 * All music generation parameters must pass through this layer for validation
 */
class SafetyEnvelope {
    constructor() {
        // Safety mode switch
        this.unsafeMode = false;
        this.unsafeConfirmed = false;
        
        // Preview mode (allows out-of-bounds parameters for temporary playback)
        this.previewMode = false;
        
        // Mute node state
        this.muted = true; // Default muted, requires expert manual Preview
        
        // Safe range definitions
        this.safeRanges = {
            tempo: { min: 120, max: 130, unsafeMin: 100, unsafeMax: 140 },
            volume: { min: 0.3, max: 0.8, unsafeMin: 0, unsafeMax: 1.0 },
            density: { min: 0.5, max: 2.0, unsafeMin: 0.1, unsafeMax: 5.0 },
            noteRange: { min: 48, max: 84, unsafeMin: 24, unsafeMax: 108 }, // MIDI
        };
        
        // Current parameter values
        this.currentParams = {
            tempo: 125,
            volume: 0.7,
            density: 1.0,
            noteRangeLow: 60,
            noteRangeHigh: 72,
        };
        
        // Intercept callbacks
        this.onIntercept = null;
        this.onParamChange = null;
        this.onWarning = null;
        
        // Subscriber list (Pub/Sub)
        this.subscribers = new Map();
    }
    
    /**
     * Enable/disable unsafe mode
     */
    setUnsafeMode(enabled, confirmed = false) {
        if (enabled && !confirmed) {
            // Requires secondary confirmation
            this.onWarning?.({
                type: 'unsafe_mode_request',
                message: 'Enabling unsafe mode requires secondary confirmation',
            });
            return false;
        }
        
        this.unsafeMode = enabled;
        this.unsafeConfirmed = confirmed;
        
        if (!enabled) {
            // When disabling unsafe mode, re-clamp all parameters
            this.revalidateAllParams();
        }
        
        this.publish('unsafeModeChanged', { enabled, confirmed });
        console.log(`[SafetyEnvelope] Unsafe mode: ${enabled ? 'enabled' : 'disabled'}`);
        return true;
    }
    
    /**
     * Set preview mode
     */
    setPreviewMode(enabled) {
        this.previewMode = enabled;
        this.muted = !enabled;
        this.publish('previewModeChanged', { enabled, muted: this.muted });
    }
    
    /**
     * Set parameter (with safety validation)
     */
    setParam(name, value) {
        const range = this.safeRanges[name];
        if (!range) {
            console.warn(`[SafetyEnvelope] Unknown parameter: ${name}`);
            return value;
        }
        
        const oldValue = this.currentParams[name];
        let newValue = value;
        let intercepted = false;
        let clampedValue = value;
        
        // Determine effective range
        const effectiveMin = this.unsafeMode && this.unsafeConfirmed ? range.unsafeMin : range.min;
        const effectiveMax = this.unsafeMode && this.unsafeConfirmed ? range.unsafeMax : range.max;
        
        // Clamp to effective range
        if (value < effectiveMin || value > effectiveMax) {
            clampedValue = Math.max(effectiveMin, Math.min(effectiveMax, value));
            intercepted = true;
            
            // Record interception
            const rule = `${name}_range_[${effectiveMin}, ${effectiveMax}]`;
            window.sessionLogger?.recordInterception(name, value, clampedValue, rule);
            
            this.onIntercept?.({
                param: name,
                original: value,
                clamped: clampedValue,
                rule,
            });
        }
        
        newValue = clampedValue;
        this.currentParams[name] = newValue;
        
        // Record parameter change
        if (oldValue !== newValue) {
            window.sessionLogger?.recordParamChange(name, oldValue, newValue, intercepted ? 'safety' : 'user');
            this.onParamChange?.({ name, oldValue, newValue, intercepted });
            this.publish('paramChanged', { name, oldValue, newValue, intercepted });
        }
        
        return newValue;
    }
    
    /**
     * Get parameter (returns safe value)
     */
    getParam(name) {
        return this.currentParams[name];
    }
    
    /**
     * Get effective range for parameter
     */
    getParamRange(name) {
        const range = this.safeRanges[name];
        if (!range) return null;
        
        return {
            min: this.unsafeMode && this.unsafeConfirmed ? range.unsafeMin : range.min,
            max: this.unsafeMode && this.unsafeConfirmed ? range.unsafeMax : range.max,
            safeMin: range.min,
            safeMax: range.max,
            unsafeMin: range.unsafeMin,
            unsafeMax: range.unsafeMax,
        };
    }
    
    /**
     * Revalidate all parameters
     */
    revalidateAllParams() {
        for (const name of Object.keys(this.currentParams)) {
            if (this.safeRanges[name]) {
                this.setParam(name, this.currentParams[name]);
            }
        }
    }
    
    /**
     * Check if note is within safe range
     */
    validateNote(midi, velocity = 80) {
        const noteRange = this.getParamRange('noteRange');
        const volumeRange = this.getParamRange('volume');
        
        let validMidi = midi;
        let validVelocity = velocity;
        let intercepted = false;
        
        // Check pitch
        if (midi < noteRange.min || midi > noteRange.max) {
            validMidi = Math.max(noteRange.min, Math.min(noteRange.max, midi));
            intercepted = true;
        }
        
        // Check velocity
        const normalizedVel = velocity / 127;
        if (normalizedVel < volumeRange.min || normalizedVel > volumeRange.max) {
            validVelocity = Math.round(Math.max(volumeRange.min, Math.min(volumeRange.max, normalizedVel)) * 127);
            intercepted = true;
        }
        
        if (intercepted) {
            window.sessionLogger?.recordInterception('note', { midi, velocity }, { midi: validMidi, velocity: validVelocity }, 'note_validation');
        }
        
        return {
            midi: validMidi,
            velocity: validVelocity,
            intercepted,
            muted: this.muted && !this.previewMode,
        };
    }
    
    /**
     * Subscribe to parameter changes (Pub/Sub)
     */
    subscribe(event, callback) {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, new Set());
        }
        this.subscribers.get(event).add(callback);
        
        return () => this.unsubscribe(event, callback);
    }
    
    unsubscribe(event, callback) {
        this.subscribers.get(event)?.delete(callback);
    }
    
    publish(event, data) {
        this.subscribers.get(event)?.forEach(cb => {
            try {
                cb(data);
            } catch (e) {
                console.error('[SafetyEnvelope] Subscriber callback error:', e);
            }
        });
    }
    
    /**
     * Get current status summary
     */
    getStatus() {
        return {
            unsafeMode: this.unsafeMode,
            unsafeConfirmed: this.unsafeConfirmed,
            previewMode: this.previewMode,
            muted: this.muted,
            params: { ...this.currentParams },
        };
    }
}

// Global singleton
window.safetyEnvelope = new SafetyEnvelope();
window.SafetyEnvelope = SafetyEnvelope;
