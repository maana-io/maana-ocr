FROM node:alpine

WORKDIR /app

COPY package.json /app

RUN apk add imagemagick ghostscript poppler-utils

RUN npm install
RUN npm build

COPY . /app

CMD npm start

EXPOSE 8050