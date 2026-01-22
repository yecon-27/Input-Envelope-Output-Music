/**
 * Hand Tracker - MediaPipe Hands integration for finger position detection
 * Handles webcam access, hand detection, and provides hand position data
 */
class HandTracker {
    constructor() {
        // MediaPipe components
        this.hands = null;
        this.camera = null;
        
        // Video elements
        this.videoElement = null;
        this.canvasElement = null;
        
        // Hand tracking state
        this.isTracking = false;
        this.isInitialized = false;
        this.currentHandPosition = null;
        this.handDetected = false;
        this.lastHandDetectionTime = 0;
        
        // UI elements
        this.handCursor = null;
        this.cameraStatus = null;
        
        // Configuration
        this.config = {
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5,
            handLostTimeout: 5000 // 5 seconds
        };
        
        // Event callbacks
        this.onHandDetected = null;
        this.onHandLost = null;
        this.onPositionUpdate = null;
        this.onError = null;
        
        // Bind methods
        this.onResults = this.onResults.bind(this);
        this.checkHandTimeout = this.checkHandTimeout.bind(this);
        
        console.log('HandTracker initialized');
    }
    
    /**
     * Initialize MediaPipe Hands and webcam
     */
    async initialize() {
        try {
            console.log('Initializing hand tracking...');
            
            // Get UI elements
            this.videoElement = document.getElementById('webcam-video');
            this.handCursor = document.getElementById('hand-cursor');
            this.cameraStatus = document.getElementById('camera-status');
            
            if (!this.videoElement || !this.handCursor || !this.cameraStatus) {
                throw new Error('Required UI elements not found');
            }
            
            // Show loading status
            this.showCameraStatus('Initializing camera...', false);
            
            // Initialize MediaPipe Hands
            await this.initializeMediaPipe();
            
            // Initialize camera
            await this.initializeCamera();
            
            this.isInitialized = true;
            this.hideCameraStatus();
            
            console.log('Hand tracking initialized successfully');
            return true;
            
        } catch (error) {
            console.error('Failed to initialize hand tracking:', error);
            this.showCameraStatus(this.getErrorMessage(error), true);
            
            if (this.onError) {
                this.onError(error);
            }
            
            return false;
        }
    }
    
    /**
     * Initialize MediaPipe Hands
     */
    async initializeMediaPipe() {
        // Check if MediaPipe is available
        if (typeof Hands === 'undefined') {
            throw new Error('MediaPipe Hands library not loaded');
        }
        
        // Create MediaPipe Hands instance
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`;
            }
        });
        
        // Configure MediaPipe Hands
        this.hands.setOptions({
            maxNumHands: this.config.maxNumHands,
            modelComplexity: this.config.modelComplexity,
            minDetectionConfidence: this.config.minDetectionConfidence,
            minTrackingConfidence: this.config.minTrackingConfidence,
        });
        
        // Set up results callback
        this.hands.onResults(this.onResults);
        
        console.log('MediaPipe Hands configured');
    }
    
    /**
     * Initialize camera and video stream
     */
    async initializeCamera() {
        // Check if Camera is available
        if (typeof Camera === 'undefined') {
            throw new Error('MediaPipe Camera utility not loaded');
        }
        
        // Create camera instance
        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                if (this.hands && this.isTracking) {
                    try {
                        await this.hands.send({ image: this.videoElement });
                    } catch (error) {
                        console.error('Error sending frame to MediaPipe:', error);
                    }
                }
            },
            width: 640,
            height: 480
        });
        
        // Start camera
        await this.camera.start();
        
        console.log('Camera initialized and started');
    }
    
    /**
     * Start hand tracking
     */
    startTracking() {
        if (!this.isInitialized) {
            console.warn('Hand tracker not initialized');
            return false;
        }
        
        if (this.isTracking) {
            console.log('Hand tracking already active');
            return true;
        }
        
        console.log('Starting hand tracking...');
        this.isTracking = true;
        
        // Start timeout checking
        this.timeoutInterval = setInterval(this.checkHandTimeout, 1000);
        
        return true;
    }
    
    /**
     * Stop hand tracking
     */
    stopTracking() {
        console.log('Stopping hand tracking...');
        this.isTracking = false;
        
        // Clear timeout checking
        if (this.timeoutInterval) {
            clearInterval(this.timeoutInterval);
            this.timeoutInterval = null;
        }
        
        // Hide hand cursor
        this.hideHandCursor();
        
        // Reset state
        this.currentHandPosition = null;
        this.handDetected = false;
    }
    
    /**
     * Handle MediaPipe results
     */
    onResults(results) {
        if (!this.isTracking) return;
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            const indexFingerTip = landmarks[8];

            const canvas = document.getElementById('game-canvas');
            const handPosition = {
                x: (1 - indexFingerTip.x) * canvas.width,
                y: indexFingerTip.y * canvas.height,
                confidence: results.multiHandedness[0].score
            };

            this.currentHandPosition = handPosition;
            this.lastHandDetectionTime = performance.now();

            if (!this.handDetected) {
                this.handDetected = true;
                if (this.onHandDetected) this.onHandDetected(handPosition);
            }

            this.updateHandCursor(handPosition);
            if (this.onPositionUpdate) this.onPositionUpdate(handPosition);
            
            // Record movement data to autism-friendly features module
            if (window.autismFeatures) {
                window.autismFeatures.recordMovement(handPosition.x, handPosition.y);
            }
        } else {
            // No hand detected in this frame
        }
    }
    
    /**
     * Check for hand detection timeout
     */
    checkHandTimeout() {
        if (!this.handDetected) return;
        
        const currentTime = performance.now();
        const timeSinceLastDetection = currentTime - this.lastHandDetectionTime;
        
        if (timeSinceLastDetection > this.config.handLostTimeout) {
            // Hand lost
            this.handDetected = false;
            this.currentHandPosition = null;
            
            console.log('Hand tracking lost');
            this.hideHandCursor();
            
            if (this.onHandLost) {
                this.onHandLost();
            }
        }
    }
    
    /**
     * Update hand cursor position and visibility
     */
    updateHandCursor(position) {
        if (!this.handCursor) return;
        
        // Convert canvas coordinates to screen coordinates
        const canvas = document.getElementById('game-canvas');
        const canvasRect = canvas.getBoundingClientRect();
        const gameArea = canvas.parentElement;
        
        // Calculate cursor position relative to the canvas
        const cursorX = canvasRect.left + (position.x / canvas.width) * canvasRect.width;
        const cursorY = canvasRect.top + (position.y / canvas.height) * canvasRect.height;
        
        // Update cursor position (fixed positioning relative to viewport)
        this.handCursor.style.position = 'fixed';
        this.handCursor.style.left = `${cursorX}px`;
        this.handCursor.style.top = `${cursorY}px`;
        
        // Show cursor
        this.handCursor.classList.add('visible');
    }
    
    /**
     * Hide hand cursor
     */
    hideHandCursor() {
        if (this.handCursor) {
            this.handCursor.classList.remove('visible');
        }
    }
    
    /**
     * Show camera status message
     */
    showCameraStatus(message, isError = false) {
        if (!this.cameraStatus) return;
        
        this.cameraStatus.querySelector('p').textContent = message;
        
        if (isError) {
            this.cameraStatus.classList.add('error');
        } else {
            this.cameraStatus.classList.remove('error');
        }
        
        this.cameraStatus.classList.remove('hidden');
    }
    
    /**
     * Hide camera status message
     */
    hideCameraStatus() {
        if (this.cameraStatus) {
            this.cameraStatus.classList.add('hidden');
        }
    }
    
    /**
     * Get user-friendly error message
     */
    getErrorMessage(error) {
        if (error.name === 'NotAllowedError') {
            return 'Camera access denied. Please allow camera access and refresh the page.';
        } else if (error.name === 'NotFoundError') {
            return 'No camera found. Please connect a camera and refresh the page.';
        } else if (error.name === 'NotSupportedError') {
            return 'Camera not supported in this browser. Please try Chrome or Firefox.';
        } else if (error.message && error.message.includes('MediaPipe')) {
            return 'Failed to load hand tracking. Please check your internet connection.';
        } else {
            return 'Camera initialization failed. Please refresh the page and try again.';
        }
    }
    
    /**
     * Get current hand position
     */
    getHandPosition() {
        return this.currentHandPosition;
    }
    
    /**
     * Check if hand is currently detected
     */
    isHandDetected() {
        return this.handDetected;
    }
    
    /**
     * Get tracking status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isTracking: this.isTracking,
            handDetected: this.handDetected,
            currentPosition: this.currentHandPosition
        };
    }
    
    /**
     * Set event callbacks
     */
    setCallbacks(callbacks) {
        this.onHandDetected = callbacks.onHandDetected || null;
        this.onHandLost = callbacks.onHandLost || null;
        this.onPositionUpdate = callbacks.onPositionUpdate || null;
        this.onError = callbacks.onError || null;
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        console.log('Destroying hand tracker...');
        
        this.stopTracking();
        
        if (this.camera) {
            this.camera.stop();
            this.camera = null;
        }
        
        if (this.hands) {
            this.hands.close();
            this.hands = null;
        }
        
        this.isInitialized = false;
        console.log('Hand tracker destroyed');
    }
}

// Export for use in other modules
window.HandTracker = HandTracker;