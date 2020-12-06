FROM node:15-alpine

ENV NODE_ENV=production

WORKDIR /opt

COPY package.json yarn.lock

RUN yarn

COPY . .

CMD yarn start