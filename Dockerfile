FROM node:alpine

WORKDIR /app

COPY package.json /app

RUN sudo apt-get install imagemagick ghostscript poppler-utils

RUN npm install
RUN npm build

COPY . /app

CMD npm start

EXPOSE 8050