FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /workspace/apps/api

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    tesseract-ocr tesseract-ocr-ben tesseract-ocr-eng \
    libmupdf-dev \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
    libdrm2 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 \
    libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxdamage1 libxext6 \
    libxfixes3 libxkbcommon0 libxrandr2 libxshmfence1 libatspi2.0-0 \
    fonts-liberation xdg-utils \
    && rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt \
    && python -m playwright install chromium

COPY . /workspace

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
