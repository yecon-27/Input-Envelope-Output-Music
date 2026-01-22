/**
 * Bubble Manager - Handles bubble creation, movement, and lifecycle management
 */


const BUBBLE_LANES = [
    { id: 1, color: '#F87171', note: { name: 'C4', midi: 60, freq: 261.6256 } }, // Soft Red
    { id: 2, color: '#FB923C', note: { name: 'D4', midi: 62, freq: 293.6648 } }, // Soft Orange
    { id: 3, color: '#FBBF24', note: { name: 'E4', midi: 64, freq: 329.6276 } }, // Soft Yellow
    { id: 4, color: '#60A5FA', note: { name: 'G4', midi: 67, freq: 391.9954 } }, // Soft Blue
    { id: 5, color: '#A78BFA', note: { name: 'A4', midi: 69, freq: 440.0 } }, // Soft Purple
];
// Left to right height ratio (normalized 0-1), descending from left to right
// Unified generation from bottom with same starting height (avoid gradient)
const LANE_HEIGHT_RATIO = [1.05, 1.05, 1.05, 1.05, 1.05];

class BubbleManager {
    constructor(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        
        // Bubble collection
        this.bubbles = [];
        this.nextBubbleId = 0;
        this.spawnTimers = [];
        
        // On-screen bubble control: slow down speed, reduce on-screen count for regular clicking
        this.minOnScreen = 3;
        this.maxOnScreen = 4;
        this.targetBubbleCount = 4;
        this.spawnSequenceIndex = 0; // For sequential generation
        
        // Time control (only need a few bubbles, no need for frequent spawn timers)
        this.lastSpawnTime = 0;
        this.baseSpawnInterval = 2000; // Increase spawn interval to separate heights
        
        // Bubble configuration: slow down, increase vertical spacing
        this.config = {
            minRadius: 30,
            maxRadius: 30,
            baseSpeed: 1.2, // px per frame @60fps, about 7-8s to cross screen
            spawnMargin: 40
        };
        
        // ★ Hit callback placeholder (external can subscribe)
        this.onPop = null;
        
        // Autism-friendly features
        this.predictableMode = false;
        this.predictablePattern = [];
        this.patternIndex = 0;
        this.initPredictablePattern();
    }

    /**
     * Set bubble density (rhythmDensity)
     * @param {'sparse' | 'normal' | number} density - String enum or number multiplier (1.0 = normal)
     */
    setDensity(density) {
        if (typeof density === 'number') {
            // Number multiplier mode (expert mode)
            // 1.0 = 2000ms interval, 4 bubbles
            // 2.0 = 1000ms interval, 8 bubbles (clamped by maxOnScreen)
            const multiplier = Math.max(0.1, density);
            this.baseSpawnInterval = 2000 / multiplier;
            this.targetBubbleCount = Math.max(2, Math.min(10, Math.round(4 * multiplier)));
            this.minOnScreen = Math.max(1, this.targetBubbleCount - 1);
            this.maxOnScreen = this.targetBubbleCount + 2;
            console.log(`🫧 Bubble density: multiplier ${multiplier.toFixed(2)}x (interval ${this.baseSpawnInterval.toFixed(0)}ms)`);
        } else if (density === 'sparse') {
            this.minOnScreen = 2;
            this.maxOnScreen = 3;
            this.targetBubbleCount = 2;
            this.baseSpawnInterval = 3000; // Longer spawn interval
            console.log('🫧 Bubble density: sparse (2)');
        } else {
            this.minOnScreen = 3;
            this.maxOnScreen = 4;
            this.targetBubbleCount = 4;
            this.baseSpawnInterval = 2000;
            console.log('🫧 Bubble density: normal (4)');
        }
    }
    
    /**
     * Initialize predictable bubble appearance pattern
     */
    initPredictablePattern() {
        // 7 equally spaced lanes, from left to right
        this.predictablePattern = BUBBLE_LANES.map((lane, idx) => ({
            x: (idx + 1) / (BUBBLE_LANES.length + 1),
            y: 1.0,
            color: lane.id - 1,
            size: 1.0
        }));
    }
    
    /**
     * Set predictable mode
     */
    setPredictableMode(enabled) {
        this.predictableMode = enabled;
        if (enabled) {
            this.patternIndex = 0;
            console.log('🔄 Regular mode enabled - bubbles will appear at fixed positions');
        } else {
            console.log('🎲 Random mode enabled - bubbles will appear randomly');
        }
    }

    /**
     * Initialize on-screen bubbles (called at start of a round)
     */
    seedBubbles(count = 1) {
        const n = Math.max(1, Math.min(count, this.maxOnScreen));
        for (let i = 0; i < n; i++) {
            this.spawnBubble();
        }
    }
    
    /**
     * Update all bubbles - movement, lifecycle, and spawning
     */
    update(deltaTime, gameSpeed = 1.0) {
        const currentTime = performance.now();
        
        // Spawn new bubbles based on timing
        this.handleBubbleSpawning(currentTime, gameSpeed);
        
        // Update existing bubbles
        this.updateBubblePositions(deltaTime, gameSpeed);
        
        // Remove bubbles that have left the screen
        this.removeOffscreenBubbles();
    }
    
    /**
     * Handle spawning of new bubbles
     */
    handleBubbleSpawning(currentTime, gameSpeed) {
        if (this.bubbles.length >= this.maxOnScreen) return;

        const adjustedSpawnInterval = this.baseSpawnInterval / gameSpeed;

        if (this.bubbles.length < this.targetBubbleCount &&
            currentTime - this.lastSpawnTime >= adjustedSpawnInterval) {
            this.scheduleSpawn(null, 0);
            this.lastSpawnTime = currentTime;
            return;
        }
    }
    
    /**
    * Create a new bubble at the bottom of the screen
    */
    spawnBubble(laneId = null) {
        let lane;
        if (laneId) {
            lane = BUBBLE_LANES.find((l) => l.id === laneId);
        } else {
            // Generate sequentially from left to right (C-D-E-G-A), cycling
            lane = BUBBLE_LANES[this.spawnSequenceIndex % BUBBLE_LANES.length];
            this.spawnSequenceIndex++;
        }
        if (!lane) return;

        // If this lane already has an unpopped bubble, delay and retry to avoid overlap
        const occupied = this.bubbles.some(
            (b) => b.laneId === lane.id && !b.isPopping
        );
        if (occupied) {
            // Delay a short time and retry
            this.scheduleSpawn(lane.id, 200);
            return;
        }

        const laneIndex = lane.id - 1;
        const laneWidth = this.canvasWidth / (BUBBLE_LANES.length + 1);
        const x = laneWidth * (laneIndex + 1);
        // Fixed starting height: descending from left to right, queue offset downward
        const laneQueueSize = this.bubbles.filter(b => b.laneId === lane.id && !b.isPopping).length;
        const y = this.getLaneY(lane.id, laneQueueSize);
        const radius = this.config.minRadius;
        const speed = this.config.baseSpeed;

        const bubble = {
            id: this.nextBubbleId++,
            x,
            y,
            radius,
            color: lane.color,
            speed,
            laneId: lane.id,
            isPopping: false,
            popAnimation: null,
            floatOffset: 0,
            floatAmplitude: 0,
            note: lane.note,
            lastHitAt: 0,
        };

        this.bubbles.push(bubble);
    }

    /**
     * Delayed spawn to avoid multiple bubbles at same horizontal line
     */
    scheduleSpawn(laneId = null, delayMs = 0) {
        const timer = setTimeout(() => {
            this.spawnBubble(laneId);
        }, delayMs);
        this.spawnTimers.push(timer);
    }

    /**
     * Calculate base height for a lane (normalized to canvas), with queue offset
     */
    getLaneY(laneId, queueIndex = 0) {
        const ratio = LANE_HEIGHT_RATIO[(laneId - 1) % LANE_HEIGHT_RATIO.length] || 1.05;
        const baseY = this.canvasHeight * ratio; // Unified below canvas
        const step = this.config.minRadius * 3; // Queue offset downward slightly to avoid overlap
        return baseY + queueIndex * step;
    }
    
    /**
     * Update positions of all bubbles
     */
    updateBubblePositions(deltaTime, gameSpeed) {
        const time = performance.now() * 0.001; // Convert to seconds for smooth animation
        
        this.bubbles.forEach(bubble => {
            if (!bubble.isPopping) {
                bubble.y -= bubble.speed * gameSpeed;
            }
        });
    }
    
    /**
     * Remove bubbles that have moved off screen
     */
    removeOffscreenBubbles() {
        const initialCount = this.bubbles.length;
        
        // Remove bubbles that are above the screen (with some margin)
        const remaining = [];
        this.bubbles.forEach(bubble => {
            const shouldRemove = bubble.y <= -bubble.radius - 10;
            if (shouldRemove) {
                // Bubble flew off screen = miss, trigger combo reset event
                window.dispatchEvent(new CustomEvent('bubble:missed', { detail: bubble }));
                this.respawnSameLane(bubble);
            } else {
                remaining.push(bubble);
            }
        });
        this.bubbles = remaining;
    }
    
    /**
     * Render all bubbles with smooth animations
     */
    render(ctx) {
        this.bubbles.forEach(bubble => {
            this.renderBubble(ctx, bubble);
        });
    }
    
    /**
     * Render a single bubble with Modern Matte / Micro-texture styling
     * Updated: Visual noise reduction (No scale, Light envelope, Thin ripple)
     */
    renderBubble(ctx, bubble) {
        ctx.save();
        
        let alpha = 0.35;
        let radius = bubble.radius;
        let isRipple = false;
        let rippleRadius = 0;
        let rippleAlpha = 0;

        // Handle Pop Animation State
        if (bubble.isPopping && bubble.popAnimation) {
            const now = performance.now();
            const elapsed = now - bubble.popAnimation.startTime;
            const duration = bubble.popAnimation.duration; // 300ms
            const t = Math.min(1, Math.max(0, elapsed / duration)); // 0 -> 1

            // 1. Light Effect: Alpha 0.3 -> 1.0 -> 0.3 (linear decay)
            // "Trigger alpha from 0.3 jump to 1.0, then linear decay"
            alpha = 1.0 - (0.7 * t); 

            // 2. No Scale Animation (Radius stays constant)
            // "禁甩动作：去掉大幅度的 Scale（缩放）动画"
            radius = bubble.radius;

            // 3. Ripple Effect
            // "增加一个向外扩散的 0.5px 极细圆环动画"
            isRipple = true;
            // Ripple expands from radius to radius + 15px
            rippleRadius = radius + (15 * t);
            rippleAlpha = 1.0 - t; // Fade out
        }
        
        // 1. Base Fill
        ctx.fillStyle = this.hexToRgba(bubble.color, alpha); 
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // 2. Subtle Top Highlight
        // Adjust highlight intensity based on alpha state
        const highlightOpacity = bubble.isPopping ? 0.4 : 0.2;
        
        const gradient = ctx.createRadialGradient(
            bubble.x - radius * 0.25,
            bubble.y - radius * 0.25,
            0,
            bubble.x,
            bubble.y,
            radius
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${highlightOpacity})`);
        gradient.addColorStop(0.5, `rgba(255, 255, 255, ${highlightOpacity * 0.25})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // 3. Clean, Thin Border
        ctx.strokeStyle = this.hexToRgba(bubble.color, Math.min(1, alpha + 0.25));
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 4. Draw Ripple (if popping)
        if (isRipple) {
            ctx.beginPath();
            ctx.arc(bubble.x, bubble.y, rippleRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${rippleAlpha})`;
            ctx.lineWidth = 0.5; // 0.5px极细
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    /**
     * Helper to convert Hex to RGBA
     */
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Add shine effect to make bubbles look more realistic
     * (Deprecated/Unused in new style, kept for compatibility if needed later)
     */
    addBubbleShine(ctx, bubble) {
        // ... kept empty or unused
    }
    
    /**
     * Get all active bubbles
     */
    getBubbles() {
        return this.bubbles;
    }

    /**
     * Register a callback to be invoked when a bubble is popped.
     * @param {(bubble: object) => void} cb
     */
    setOnPop(cb) {
        this.onPop = (typeof cb === 'function') ? cb : null;
    }
    
    /**
     * Remove a specific bubble by ID
     */
    removeBubble(bubbleId) {
        const remaining = [];
        let removedBubble = null;
        this.bubbles.forEach(bubble => {
            if (bubble.id === bubbleId) {
                removedBubble = bubble;
            } else {
                remaining.push(bubble);
            }
        });
        this.bubbles = remaining;
        
        if (removedBubble) {
            this.respawnSameLane(removedBubble);
            console.log(`Removed bubble ${bubbleId}`);
            return true;
        }
        return false;
    }
    
    /**
     * Trigger pop animation for a bubble (will be expanded in later tasks)
     */
    popBubble(bubbleId) {
        const bubble = this.bubbles.find(b => b.id === bubbleId);
        if (bubble && !bubble.isPopping) {
            // Optional: hit cooldown to avoid duplicate triggers from same frame/jitter
            const now = performance.now();
            if (bubble.lastHitAt && (now - bubble.lastHitAt) < 120) return false;
            bubble.lastHitAt = now;

            bubble.isPopping = true;
            bubble.popAnimation = {
                startTime: performance.now(),
                duration: 300, // 300ms pop animation
                initialRadius: bubble.radius,
                initialOpacity: 1.0
            };

            // ★ Trigger hit callback (next step B will play tone + record here)
        if (this.onPop) {
            try { this.onPop(bubble); }
            catch (e) { console.warn('[BubbleManager] onPop callback error:', e); }
        }
        
            // ★ Trigger global event for sidebar and other modules
            window.dispatchEvent(new CustomEvent('bubble:popped', { detail: bubble }));
            
            console.log(`Started pop animation for bubble ${bubbleId}`);
            return true;
        }
        return false;
    }

    /**
     * Mouse click detection: find first bubble within radius and trigger pop
     */
    checkCollision(x, y) {
        for (const bubble of this.bubbles) {
            const dx = bubble.x - x;
            const dy = bubble.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= bubble.radius) {
                const ok = this.popBubble(bubble.id);
                return ok ? bubble : null;
            }
        }
        return null;
    }
    
    /**
     * Set spawn rate (bubbles per second)
     */
    setSpawnRate(bubblesPerSecond) {
        this.baseSpawnInterval = 1000 / bubblesPerSecond;
        console.log(`Spawn rate set to ${bubblesPerSecond} bubbles per second`);
    }
    
    /**
     * Clear all bubbles
     */
    clearAllBubbles() {
        const count = this.bubbles.length;
        this.bubbles = [];
        // Cancel pending spawn timers
        this.spawnTimers.forEach(t => clearTimeout(t));
        this.spawnTimers = [];
        
        // Reset spawn timing and sequence to prevent auto-spawn logic from triggering immediately and overlapping with startRound manual spawn
        this.lastSpawnTime = performance.now();
        this.spawnSequenceIndex = 0;
        
        console.log(`Cleared ${count} bubbles`);
    }
    
    /**
     * Get bubble count
     */
    getBubbleCount() {
        return this.bubbles.length;
    }
    
    /**
     * Utility function to lighten a color
     */
    lightenColor(color, amount) {
        // Convert hex to RGB, lighten, and convert back
        const hex = color.replace('#', '');
        const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + Math.round(255 * amount));
        const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + Math.round(255 * amount));
        const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + Math.round(255 * amount));
        
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    /**
     * Utility function to darken a color
     */
    darkenColor(color, amount) {
        // Convert hex to RGB, darken, and convert back
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - Math.round(255 * amount));
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - Math.round(255 * amount));
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - Math.round(255 * amount));
        
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    /**
     * Handle canvas resize
     */
    handleResize(newWidth, newHeight) {
        this.canvasWidth = newWidth;
        this.canvasHeight = newHeight;
        
        // Remove any bubbles that are now outside the new bounds
        this.bubbles = this.bubbles.filter(bubble => {
            return bubble.x >= 0 && bubble.x <= newWidth;
        });
        
        console.log(`BubbleManager resized to ${newWidth}x${newHeight}`);
    }

    /**
     * Same lane immediate respawn, maintains stable color/note mapping
     */
    respawnSameLane(bubble) {
        if (!bubble || typeof bubble.laneId !== 'number') return;
        // Random delay 150-350ms to avoid multiple bubbles appearing at same horizontal line
        const delay = 150 + Math.random() * 200;
        this.scheduleSpawn(bubble.laneId, delay);
    }
}

// Export for use in other modules
window.BubbleManager = BubbleManager;
window.BUBBLE_LANES = BUBBLE_LANES;
