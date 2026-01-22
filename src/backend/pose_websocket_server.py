#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
WebSocket server to bridge MediaPipe pose detection with bubble game
Sends real-time hand positions to the JavaScript game
"""
import asyncio
import websockets
import json
import cv2 as cv
import numpy as np
import mediapipe as mp
from utils import CvFpsCalc
import argparse
import threading
import time

class PoseWebSocketServer:
    def __init__(self, host='localhost', port=8765):
        self.host = host
        self.port = port
        self.clients = set()
        
        # MediaPipe setup
        self.mp_pose = mp.solutions.pose
        self.pose = None
        self.cap = None
        
        # Pose detection config
        self.config = {
            'model_complexity': 1,
            'min_detection_confidence': 0.5,
            'min_tracking_confidence': 0.5,
            'canvas_width': 1024,
            'canvas_height': 768
        }
        
        # Hand tracking state
        self.hand_positions = {
            'leftHand': {'x': 0, 'y': 0, 'visible': False},
            'rightHand': {'x': 0, 'y': 0, 'visible': False}
        }
        
        self.running = False
        
    def init_camera_and_pose(self, device=0, width=640, height=480):
        """Initialize camera and MediaPipe pose detection"""
        try:
            # Setup camera
            self.cap = cv.VideoCapture(device)
            self.cap.set(cv.CAP_PROP_FRAME_WIDTH, width)
            self.cap.set(cv.CAP_PROP_FRAME_HEIGHT, height)
            
            # Setup MediaPipe
            self.pose = self.mp_pose.Pose(
                static_image_mode=False,
                model_complexity=self.config['model_complexity'],
                min_detection_confidence=self.config['min_detection_confidence'],
                min_tracking_confidence=self.config['min_tracking_confidence']
            )
            
            print(f"Camera and pose detection initialized (device: {device})")
            return True
            
        except Exception as e:
            print(f"Failed to initialize camera/pose: {e}")
            return False
    
    def process_pose_landmarks(self, landmarks):
        """Extract hand positions from pose landmarks"""
        if not landmarks:
            return
            
        # MediaPipe landmark indices
        LEFT_WRIST = 15
        RIGHT_WRIST = 16
        LEFT_INDEX = 19
        RIGHT_INDEX = 20
        
        canvas_width = self.config['canvas_width']
        canvas_height = self.config['canvas_height']
        
        # Process left hand
        left_wrist = landmarks.landmark[LEFT_WRIST]
        if left_wrist.visibility > 0.5:
            # Mirror x coordinate for natural interaction
            x = canvas_width - (left_wrist.x * canvas_width)
            y = left_wrist.y * canvas_height
            
            self.hand_positions['leftHand'] = {
                'x': max(0, min(canvas_width, x)),
                'y': max(0, min(canvas_height, y)),
                'visible': True
            }
        else:
            self.hand_positions['leftHand']['visible'] = False
            
        # Process right hand
        right_wrist = landmarks.landmark[RIGHT_WRIST]
        if right_wrist.visibility > 0.5:
            # Mirror x coordinate for natural interaction
            x = canvas_width - (right_wrist.x * canvas_width)
            y = right_wrist.y * canvas_height
            
            self.hand_positions['rightHand'] = {
                'x': max(0, min(canvas_width, x)),
                'y': max(0, min(canvas_height, y)),
                'visible': True
            }
        else:
            self.hand_positions['rightHand']['visible'] = False
    
    async def register_client(self, websocket, path):
        """Register a new WebSocket client"""
        self.clients.add(websocket)
        print(f"Client connected: {websocket.remote_address}")
        
        try:
            await websocket.wait_closed()
        finally:
            self.clients.remove(websocket)
            print(f"Client disconnected: {websocket.remote_address}")
    
    async def broadcast_hand_positions(self):
        """Broadcast hand positions to all connected clients"""
        if self.clients:
            message = json.dumps({
                'type': 'handPositions',
                'data': self.hand_positions,
                'timestamp': time.time()
            })
            
            # Send to all clients
            disconnected = set()
            for client in self.clients:
                try:
                    await client.send(message)
                except websockets.exceptions.ConnectionClosed:
                    disconnected.add(client)
            
            # Remove disconnected clients
            self.clients -= disconnected
    
    def pose_detection_loop(self):
        """Main pose detection loop running in separate thread"""
        if not self.cap or not self.pose:
            print("Camera or pose detection not initialized")
            return
            
        print("Starting pose detection loop...")
        
        while self.running:
            ret, image = self.cap.read()
            if not ret:
                continue
                
            # Flip image for mirror effect
            image = cv.flip(image, 1)
            
            # Convert BGR to RGB
            rgb_image = cv.cvtColor(image, cv.COLOR_BGR2RGB)
            
            # Process pose
            results = self.pose.process(rgb_image)
            
            # Extract hand positions
            if results.pose_landmarks:
                self.process_pose_landmarks(results.pose_landmarks)
            
            # Small delay to prevent excessive CPU usage
            time.sleep(0.016)  # ~60 FPS
    
    async def broadcast_loop(self):
        """Broadcast hand positions at regular intervals"""
        while self.running:
            await self.broadcast_hand_positions()
            await asyncio.sleep(0.016)  # ~60 FPS
    
    async def start_server(self):
        """Start the WebSocket server"""
        print(f"Starting WebSocket server on {self.host}:{self.port}")
        
        # Start pose detection in separate thread
        self.running = True
        pose_thread = threading.Thread(target=self.pose_detection_loop)
        pose_thread.daemon = True
        pose_thread.start()
        
        # Start WebSocket server and broadcast loop
        server = await websockets.serve(self.register_client, self.host, self.port)
        
        # Start broadcasting loop
        broadcast_task = asyncio.create_task(self.broadcast_loop())
        
        print(f"Server running on ws://{self.host}:{self.port}")
        print("Connect your bubble game to start pose detection!")
        
        try:
            await server.wait_closed()
        except KeyboardInterrupt:
            print("\nShutting down server...")
        finally:
            self.running = False
            if self.cap:
                self.cap.release()
            cv.destroyAllWindows()
    
    def cleanup(self):
        """Clean up resources"""
        self.running = False
        if self.cap:
            self.cap.release()
        cv.destroyAllWindows()

def get_args():
    parser = argparse.ArgumentParser(description='Pose WebSocket Server for Bubble Game')
    parser.add_argument("--device", type=int, default=0, help="Camera device number")
    parser.add_argument("--width", type=int, default=640, help="Camera width")
    parser.add_argument("--height", type=int, default=480, help="Camera height")
    parser.add_argument("--host", type=str, default='localhost', help="WebSocket host")
    parser.add_argument("--port", type=int, default=8765, help="WebSocket port")
    return parser.parse_args()

async def main():
    args = get_args()
    
    # Create server instance
    server = PoseWebSocketServer(args.host, args.port)
    
    # Initialize camera and pose detection
    if not server.init_camera_and_pose(args.device, args.width, args.height):
        print("Failed to initialize. Exiting...")
        return
    
    try:
        # Start the server
        await server.start_server()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        server.cleanup()

if __name__ == '__main__':
    asyncio.run(main())