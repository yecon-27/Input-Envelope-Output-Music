# Docker Deployment Guide

## Quick Start

### Development Mode
```bash
cd bubble-popping-game-clean
docker-compose -f docker/docker-compose.yml up --build
```

### Production Mode (with Nginx)
```bash
cd bubble-popping-game-clean
docker-compose -f docker/docker-compose.yml --profile production up --build
```

## Access URLs

- **Development Mode**: http://localhost:8080/src/frontend/index.html
- **Production Mode**: http://localhost/
- **WebSocket**: ws://localhost:8765

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DISPLAY` | `:0` | X11 display (Linux GUI support) |
| `PYTHONUNBUFFERED` | `1` | Unbuffered Python output |

## Port Mapping

| Container Port | Host Port | Service |
|----------------|-----------|---------|
| 8080 | 8080 | HTTP Server |
| 8765 | 8765 | WebSocket Server |
| 80 | 80 | Nginx (Production) |
| 443 | 443 | Nginx HTTPS (Production) |

## Common Commands

### Build Image
```bash
docker build -f docker/Dockerfile -t bubble-game .
```

### Run Container
```bash
docker run -p 8080:8080 -p 8765:8765 bubble-game
```

### View Logs
```bash
docker-compose -f docker/docker-compose.yml logs -f
```

### Stop Services
```bash
docker-compose -f docker/docker-compose.yml down
```

### Rebuild
```bash
docker-compose -f docker/docker-compose.yml up --build --force-recreate
```

## Troubleshooting

### Camera Permission Issues
Camera access in Docker containers requires special configuration:

```bash
# Linux systems
docker run --device=/dev/video0 -p 8080:8080 bubble-game

# Or use privileged mode
docker run --privileged -p 8080:8080 bubble-game
```

### Network Issues
Check if ports are in use:
```bash
netstat -tulpn | grep :8080
netstat -tulpn | grep :8765
```

### Performance Optimization
Production recommendations:
- Use multi-stage builds to reduce image size
- Configure resource limits
- Enable health checks

## Security Considerations

1. **Production**: Use HTTPS and secure WebSocket connections
2. **Firewall**: Only expose necessary ports
3. **Updates**: Regularly update base images and dependencies
4. **Monitoring**: Configure logging and monitoring systems
