/**
 * Hand Tracking Debug Tool
 * Specifically for diagnosing hand preference data recording issues
 */

// Debug: Monitor hand data recording
window.debugHandTracking = function() {
    console.log('[Debug] Starting hand data recording monitoring...');
    
    if (!window.gameResultManager) {
        console.error('[Debug] GameResultManager not found');
        return;
    }
    
    // Save original recordBubblePop method
    const originalRecordBubblePop = window.gameResultManager.recordBubblePop;
    
    // Wrap method to add debug info
    window.gameResultManager.recordBubblePop = function(handType) {
        console.log('[Debug] recordBubblePop called:', {
            handType: handType,
            isActive: this.isActive,
            currentHandStats: this.gameData.handStats
        });
        
        // Call original method
        const result = originalRecordBubblePop.call(this, handType);
        
        console.log('[Debug] Hand stats after recording:', this.gameData.handStats);
        
        return result;
    };
    
    console.log('[Debug] Hand data monitoring started');
};

// Debug: Check collision callback
window.debugCollisionCallback = function() {
    console.log('[Debug] Checking collision callback setup...');
    
    if (!window.game || !window.game.collisionDetector) {
        console.error('[Debug] Game or collision detector not found');
        return;
    }
    
    console.log('[Debug] Collision detector state:');
    console.log('  - Callback count:', window.game.collisionDetector.collisionCallbacks.length);
    console.log('  - Callback functions:', window.game.collisionDetector.collisionCallbacks);
    
    // Check if handleBubblePop exists
    if (window.game.handleBubblePop) {
        console.log('[Debug] handleBubblePop method exists');
    } else {
        console.error('[Debug] handleBubblePop method does not exist');
    }
};

// Debug: Manually trigger collision
window.debugManualCollision = function(handType = 'rightHand') {
    console.log('[Debug] Manually triggering collision - hand type:', handType);
    
    if (!window.game || !window.game.bubbleManager) {
        console.error('[Debug] Game or bubble manager not found');
        return;
    }
    
    const bubbles = window.game.bubbleManager.bubbles;
    if (bubbles.length === 0) {
        console.warn('[Debug] No bubbles to pop');
        return;
    }
    
    const bubble = bubbles[0];
    
    // Create mock collision object
    const mockCollision = {
        handType: handType,
        hand: { x: bubble.x, y: bubble.y, visible: true },
        bubble: bubble,
        timestamp: performance.now()
    };
    
    console.log('[Debug] Mock collision object:', mockCollision);
    
    // Directly call handleBubblePop
    if (window.game.handleBubblePop) {
        window.game.handleBubblePop(mockCollision);
        console.log('[Debug] handleBubblePop called');
    } else {
        console.error('[Debug] handleBubblePop method does not exist');
    }
};

// Debug: Check hand position updates
window.debugHandPositions = function() {
    console.log('[Debug] Checking hand position updates...');
    
    if (!window.game) {
        console.error('[Debug] Game object not found');
        return;
    }
    
    console.log('[Debug] Current hand positions:', window.game.handPositions);
    
    // Monitor hand position changes
    let lastPositions = JSON.stringify(window.game.handPositions);
    
    const checkInterval = setInterval(() => {
        const currentPositions = JSON.stringify(window.game.handPositions);
        if (currentPositions !== lastPositions) {
            console.log('[Debug] Hand position updated:', window.game.handPositions);
            lastPositions = currentPositions;
        }
    }, 1000);
    
    // Stop monitoring after 10 seconds
    setTimeout(() => {
        clearInterval(checkInterval);
        console.log('[Debug] Hand position monitoring stopped');
    }, 10000);
    
    console.log('[Debug] Hand position monitoring started (10 seconds)');
};

console.log('[Debug] Hand tracking debug tool loaded');
console.log('[Debug] Debug commands:');
console.log('  - debugHandTracking() : Monitor hand data recording');
console.log('  - debugCollisionCallback() : Check collision callback');
console.log('  - debugManualCollision("leftHand") : Manually trigger collision');
console.log('  - debugHandPositions() : Monitor hand position changes');