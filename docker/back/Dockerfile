FROM node:alpine

WORKDIR /app

ENV NODE_ENV=production

# Installer Python et dépendances avec build tools
RUN apk add --no-cache \
    python3 \
    py3-pip \
    build-base \
    python3-dev \
    cairo-dev

# Copier et installer les dépendances
COPY back/package*.json ./
RUN npm ci --only=production

# Copier le code avec la bonne structure
COPY back ./back
COPY script ./script

# Installer les dépendances Python
RUN pip3 install --no-cache-dir --break-system-packages -r script/requirements.txt

EXPOSE 8080

CMD ["node", "back/server.js"]