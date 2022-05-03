FROM node:12

WORKDIR /user/src/node-app

ARG NPM_TOKEN=0
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
COPY package.json package-lock.json ./
RUN npm ci --unsafe-perm --production
ENV NPM_TOKEN=0
COPY . .
CMD ["node", "./src/app.js"]