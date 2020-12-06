FROM node:15-alpine

ENV NODE_ENV=production

WORKDIR /opt

COPY package.json yarn.lock ./

RUN yarn --verbose

COPY . .

CMD yarn start