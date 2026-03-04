FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package.json ./
COPY package-lock.json ./

RUN npm install

COPY . .

EXPOSE 3003