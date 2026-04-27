FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /workspace/apps/api

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    tesseract-ocr tesseract-ocr-ben tesseract-ocr-eng \
    libmupdf-dev \
    && rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY . /workspace
