/**
 * Collision Detector - Handles collision detection between hands and bubbles
 * Provides smooth, autism-friendly interaction feedback
 */
class CollisionDetector {
    constructor() {
        // Collision configuration - increased tolerance for wrist detection
        this.config = {
            handRadius: 35, // Increased virtual hand size
            tolerance: 25,  // Increased tolerance for wrist position
            cooldownTime: 100, // Prevent multiple pops of same bubble (ms)
            vibrationEnabled: false // Haptic feedback (if supported)
        };
        
        // Collision state tracking
        this.recentCollisions = new Map(); // bubbleId -> timestamp
        this.collisionCallbacks = [];
        
        // Visual feedback state
        this.handEffects = {
            leftHand: { active: false, startTime: 0, bubbleColor: null },
            rightHand: { active: false, startTime: 0, bubbleColor: null }
        };
    }
    
    /**
     * Check collisions between hands and all bubbles
     */
    checkCollisions(handPositions, bubbles) {
        const currentTime = performance.now();
        const collisions = [];
        
        // Check each hand against all bubbles
        ['leftHand', 'rightHand'].forEach(handType => {
            const hand = handPositions[handType];
            
            if (hand && hand.visible) {
                bubbles.forEach(bubble => {
                    if (this.isColliding(hand, bubble, currentTime)) {
                        collisions.push({
                            handType: handType,
                            hand: hand,
                            bubble: bubble,
                            timestamp: currentTime
                        });
                        
                        // Record collision to prevent immediate re-collision
                        this.recentCollisions.set(bubble.id, currentTime);
                        
                        // Trigger visual effect
                        this.triggerHandEffect(handType, bubble.color);
                        
                        // Haptic feedback if supported
                        this.triggerHapticFeedback();
                    }
                });
            }
        });
        
        // Clean up old collision records
        this.cleanupOldCollisions(currentTime);
        
        // Notify callbacks
        collisions.forEach(collision => {
            this.notifyCollisionCallbacks(collision);
            
            // Record success event to autism-friendly features module
            if (window.autismFeatures) {
                window.autismFeatures.recordSuccess({
                    bubbleId: collision.bubble.id,
                    handType: collision.handType,
                    position: { x: collision.bubble.x, y: collision.bubble.y },
                    size: collision.bubble.radius
                });
            }
            
            // Record bubble pop event to hand data tracker
            if (window.gameApp?.poseDetector?.handDataTracker) {
                window.gameApp.poseDetector.handDataTracker.recordPop(true);
            }
        });
        
        return collisions;
    }
    
    /**
     * Check if a hand is colliding with a specific bubble
     */
    isColliding(hand, bubble, currentTime) {
        // Skip if bubble is already popping
        if (bubble.isPopping) {
            return false;
        }
        
        // Skip if we recently collided with this bubble
        if (this.recentCollisions.has(bubble.id)) {
            const lastCollision = this.recentCollisions.get(bubble.id);
            if (currentTime - lastCollision < this.config.cooldownTime) {
                return false;
            }
        }
        
        // Calculate distance between hand and bubble center
        const distance = this.calculateDistance(hand.x, hand.y, bubble.x, bubble.y);
        
        // Check if collision occurs
        const collisionDistance = this.config.handRadius + bubble.radius + this.config.tolerance;
        return distance <= collisionDistance;
    }
    
    /**
     * Calculate distance between two points
     */
    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }
    
    /**
     * Trigger visual effect for hand collision
     */
    triggerHandEffect(handType, bubbleColor) {
        this.handEffects[handType] = {
            active: true,
            startTime: performance.now(),
            bubbleColor: bubbleColor
        };
    }
    
    /**
     * Trigger haptic feedback if supported
     */
    triggerHapticFeedback() {
        if (this.config.vibrationEnabled && navigator.vibrate) {
            // Short, gentle vibration for autism-friendly feedback
            navigator.vibrate(50);
        }
    }
    
    /**
     * Clean up old collision records
     */
    cleanupOldCollisions(currentTime) {
        for (const [bubbleId, timestamp] of this.recentCollisions.entries()) {
            if (currentTime - timestamp > this.config.cooldownTime * 2) {
                this.recentCollisions.delete(bubbleId);
            }
        }
    }
    
    /**
     * Notify all collision callbacks
     */
    notifyCollisionCallbacks(collision) {
        this.collisionCallbacks.forEach(callback => {
            try {
                callback(collision);
            } catch (error) {
                console.error('Collision callback error:', error);
            }
        });
    }
    
    /**
     * Add collision callback
     */
    addCollisionCallback(callback) {
        this.collisionCallbacks.push(callback);
    }
    
    /**
     * Remove collision callback
     */
    removeCollisionCallback(callback) {
        const index = this.collisionCallbacks.indexOf(callback);
        if (index > -1) {
            this.collisionCallbacks.splice(index, 1);
        }
    }
    
    /**
     * Render hand cursors and effects
     */
    renderHandCursors(ctx, handPositions) {
        const currentTime = performance.now();
        
        ['leftHand', 'rightHand'].forEach(handType => {
            const hand = handPositions[handType];
            const effect = this.handEffects[handType];
            
            if (hand && hand.visible) {
                this.renderHandCursor(ctx, hand, handType, effect, currentTime);
            }
        });
    }
    
    /**
     * Render a single hand cursor - hand cursor
     */
    renderHandCursor(ctx, hand, handType, effect, currentTime) {
        ctx.save();
        
        // Base cursor properties
        const baseSize = this.config.handRadius;
        let size = baseSize;
        let opacity = 0.9;
        let glowColor = '#4CAF50';
        
        // Apply collision effect
        if (effect.active) {
            const effectDuration = 300; // 300ms effect
            const elapsed = currentTime - effect.startTime;
            
            if (elapsed < effectDuration) {
                // Animate collision effect
                const progress = elapsed / effectDuration;
                const easeOut = 1 - Math.pow(1 - progress, 3);
                
                // Pulse effect
                size = baseSize + (8 * (1 - easeOut));
                opacity = 1.0 - (0.2 * easeOut);
                
                // Use bubble color for feedback
                if (effect.bubbleColor) {
                    glowColor = effect.bubbleColor;
                }
            } else {
                // Effect finished
                effect.active = false;
            }
        }
        
        // Set transparency
        ctx.globalAlpha = opacity;
        
        // Draw hand emoji/icon
        this.drawHandShape(ctx, hand.x, hand.y, size, handType, glowColor);
        
        ctx.restore();
    }
    
    /**
     * Draw hand shape - draw hand shape
     */
    drawHandShape(ctx, x, y, size, handType, color) {
        // Method 1: Use emoji with enhanced effects
        ctx.font = `${size * 1.8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Add glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // Draw hand indicator (circle)
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Reset shadow
        ctx.shadowBlur = 0;
        
        // Add interaction indicator (small sparkles around active hand)
        this.drawHandEffects(ctx, x, y, size, color);
        
        // Add hand type label with better styling
        ctx.font = `500 ${size * 0.35}px "Inter", -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Background for label - using soft semi-transparent background
        const labelY = y + size * 1.3;
        const labelText = handType === 'leftHand' ? 'L' : 'R';
        const labelWidth = ctx.measureText(labelText).width + 12;
        const labelHeight = size * 0.45;
        
        // Soft rounded background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        const radius = labelHeight / 2;
        ctx.roundRect(x - labelWidth/2, labelY - labelHeight/2, labelWidth, labelHeight, radius);
        ctx.fill();
        
        // Soft border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Text using soft dark gray
        ctx.fillStyle = '#6B7280';
        ctx.fillText(labelText, x, labelY);
    }
    
    /**
     * Draw hand effects - hand effects
     */
    drawHandEffects(ctx, x, y, size, color) {
        // Draw small sparkles around the hand
        const sparkleCount = 6;
        const sparkleRadius = size * 1.5;
        
        for (let i = 0; i < sparkleCount; i++) {
            const angle = (i / sparkleCount) * Math.PI * 2 + (Date.now() * 0.002);
            const sparkleX = x + Math.cos(angle) * sparkleRadius;
            const sparkleY = y + Math.sin(angle) * sparkleRadius;
            
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() * 0.01 + i);
            
            // Draw sparkle
            ctx.beginPath();
            ctx.arc(sparkleX, sparkleY, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.globalAlpha = 1.0; // Reset alpha
    }
    
    /**
     * Draw custom hand shape - custom hand drawing (backup method)
     */
    drawCustomHandShape(ctx, x, y, size, handType, color) {
        ctx.fillStyle = color;
        ctx.strokeStyle = this.darkenColor(color, 0.3);
        ctx.lineWidth = 2;
        
        // Draw palm
        ctx.beginPath();
        ctx.ellipse(x, y, size * 0.6, size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw fingers
        const fingerPositions = [
            { dx: -size * 0.4, dy: -size * 0.7, length: size * 0.5 }, // Pinky
            { dx: -size * 0.15, dy: -size * 0.9, length: size * 0.7 }, // Ring
            { dx: size * 0.1, dy: -size * 0.95, length: size * 0.8 }, // Middle
            { dx: size * 0.35, dy: -size * 0.85, length: size * 0.7 }, // Index
        ];
        
        fingerPositions.forEach(finger => {
            ctx.beginPath();
            ctx.ellipse(
                x + finger.dx, 
                y + finger.dy, 
                size * 0.12, 
                finger.length, 
                0, 0, Math.PI * 2
            );
            ctx.fill();
            ctx.stroke();
        });
        
        // Draw thumb
        const thumbX = handType === 'leftHand' ? x - size * 0.7 : x + size * 0.7;
        const thumbY = y - size * 0.2;
        ctx.beginPath();
        ctx.ellipse(thumbX, thumbY, size * 0.15, size * 0.4, Math.PI * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Add hand type indicator
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${size * 0.3}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            handType === 'leftHand' ? 'L' : 'R',
            x,
            y + size * 0.2
        );
    }
    
    /**
     * Utility function to darken a color
     */
    darkenColor(color, amount) {
        // Simple color darkening (works with hex colors)
        if (color.startsWith('#')) {
            const hex = color.replace('#', '');
            const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - Math.round(255 * amount));
            const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - Math.round(255 * amount));
            const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - Math.round(255 * amount));
            
            return `rgb(${r}, ${g}, ${b})`;
        }
        return color;
    }
    
    /**
     * Set collision configuration
     */
    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    
    /**
     * Get collision statistics
     */
    getStats() {
        return {
            activeCollisions: this.recentCollisions.size,
            handRadius: this.config.handRadius,
            tolerance: this.config.tolerance,
            cooldownTime: this.config.cooldownTime
        };
    }
    
    /**
     * Reset collision state
     */
    reset() {
        this.recentCollisions.clear();
        this.handEffects.leftHand.active = false;
        this.handEffects.rightHand.active = false;
    }
}

// Export for use in other modules
window.CollisionDetector = CollisionDetector;