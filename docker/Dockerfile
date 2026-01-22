FROM python:3.9-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgtk-3-0 \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080 8765

ENV PYTHONPATH=/app/src/backend
ENV DISPLAY=:0

RUN echo '#!/bin/bash\n\
echo "================================"\n\
\n\
cd /app/src/backend\n\
python pose_websocket_server.py --host 0.0.0.0 &\n\
\n\
sleep 3\n\
\n\
cd /app\n\
python -m http.server 8080 --bind 0.0.0.0\n\
' > /app/start.sh && chmod +x /app/start.sh

# 默认命令
CMD ["/app/start.sh"]