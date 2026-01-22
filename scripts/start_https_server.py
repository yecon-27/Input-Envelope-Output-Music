#!/usr/bin/env python3
"""
Simple HTTPS server for camera access permissions
Modern browsers typically require HTTPS to access camera
"""

import http.server
import ssl
import socketserver
import os
import sys
from pathlib import Path

def create_self_signed_cert():
    """Create self-signed certificate"""
    try:
        import subprocess
        
        # Check if certificate already exists
        if os.path.exists('server.crt') and os.path.exists('server.key'):
            print("Found existing certificate files")
            return True
            
        print("Creating self-signed certificate...")
        
        # Use openssl to create self-signed certificate
        cmd = [
            'openssl', 'req', '-x509', '-newkey', 'rsa:4096', 
            '-keyout', 'server.key', '-out', 'server.crt', 
            '-days', '365', '-nodes', '-subj', 
            '/C=US/ST=State/L=City/O=Organization/CN=localhost'
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("Certificate created successfully")
            return True
        else:
            print(f"Certificate creation failed: {result.stderr}")
            return False
            
    except FileNotFoundError:
        print("openssl command not found")
        print("Please install OpenSSL or use HTTP mode (camera may not work)")
        return False
    except Exception as e:
        print(f"Certificate creation failed: {e}")
        return False

def start_https_server(port=8443):
    """Start HTTPS server"""
    
    # Try to create certificate
    if not create_self_signed_cert():
        print("\nCannot create HTTPS certificate, starting HTTP server")
        print("Note: Camera may not work in HTTP mode")
        start_http_server(port=8080)
        return
    
    try:
        # Create HTTP handler
        handler = http.server.SimpleHTTPRequestHandler
        
        # Create server
        with socketserver.TCPServer(("", port), handler) as httpd:
            # Configure SSL
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain('server.crt', 'server.key')
            httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
            
            print(f"HTTPS server started successfully!")
            print(f"Game URL: https://localhost:{port}/src/frontend/index.html")
            print(f"Test page: https://localhost:{port}/test.html")
            print("\nNote: Browser will show security warning on first visit, click 'Advanced' -> 'Proceed' to continue")
            print("Press Ctrl+C to stop server")
            
            httpd.serve_forever()
            
    except Exception as e:
        print(f"HTTPS server failed to start: {e}")
        print("Trying HTTP server...")
        start_http_server(port=8080)

def start_http_server(port=8080):
    """Start HTTP server (fallback)"""
    try:
        handler = http.server.SimpleHTTPRequestHandler
        
        with socketserver.TCPServer(("", port), handler) as httpd:
            print(f"HTTP server started successfully!")
            print(f"Game URL: http://localhost:{port}/src/frontend/index.html")
            print(f"Test page: http://localhost:{port}/test.html")
            print("\nNote: Camera may not work in HTTP mode")
            print("Tip: Use Chrome's --allow-running-insecure-content flag")
            print("Press Ctrl+C to stop server")
            
            httpd.serve_forever()
            
    except Exception as e:
        print(f"HTTP server failed to start: {e}")

if __name__ == "__main__":
    print("Bubble Game HTTPS Server")
    print("=" * 50)
    
    # Check port argument
    port = 8443
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("Invalid port number, using default port 8443")
    
    try:
        start_https_server(port)
    except KeyboardInterrupt:
        print("\nServer stopped")
    except Exception as e:
        print(f"Server error: {e}")
