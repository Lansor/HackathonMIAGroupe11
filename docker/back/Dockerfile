FROM node:alpine

WORKDIR /app

ENV NODE_ENV=production

# Installer Python et les dependances de l'environement d'execution du script de generation de document
RUN apk add --no-cache \
    python3 \
    py3-pip \
    build-base \
    python3-dev \
    cairo-dev


COPY back/package*.json ./
RUN npm ci --only=production


COPY back ./back
COPY script ./script

<<<<<<< HEAD
# Installer les dépendances Python
# RUN pip3 install --no-cache-dir -r script/requirements.txt
=======
# Installer les dépendances Python de requirements.txt
# Note: --break-system-packages est utilisé pour éviter les conflits avec les packages Python préinstallés dans l'image alpine.
RUN pip3 install --no-cache-dir --break-system-packages -r script/requirements.txt
>>>>>>> 8e29b425b927e1f1c824016fa5ab5ef5b947b6bc

EXPOSE 8080

CMD ["node", "back/server.js"]