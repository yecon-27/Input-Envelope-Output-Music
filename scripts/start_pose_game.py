#!/usr/bin/env python3
"""
Start the complete bubble game system
Including WebSocket server and HTTP server
"""

import subprocess
import sys
import time
import threading
import os

def start_websocket_server():
    """Start WebSocket server"""
    try:
        print("Starting WebSocket server...")
        os.chdir('src/backend')
        subprocess.run([sys.executable, 'pose_websocket_server.py'], check=True)
    except Exception as e:
        print(f"WebSocket server failed to start: {e}")

def start_http_server():
    """Start HTTP server"""
    try:
        print("Starting HTTP server...")
        time.sleep(2)  # Wait for WebSocket server to start
        os.chdir('../..')
        subprocess.run([sys.executable, 'scripts/start_https_server.py'], check=True)
    except Exception as e:
        print(f"HTTP server failed to start: {e}")

def main():
    print("Starting Bubble Game System")
    print("=" * 50)
    
    try:
        # Start WebSocket server (background)
        websocket_thread = threading.Thread(target=start_websocket_server)
        websocket_thread.daemon = True
        websocket_thread.start()
        
        # Start HTTP server (foreground)
        start_http_server()
        
    except KeyboardInterrupt:
        print("\nGame system stopped")
    except Exception as e:
        print(f"System failed to start: {e}")

if __name__ == "__main__":
    main()
