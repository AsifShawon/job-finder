FROM node:22-alpine

WORKDIR /workspace/apps/web

COPY apps/web/package*.json ./
RUN npm install

COPY . /workspace
