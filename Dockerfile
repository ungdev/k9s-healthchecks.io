FROM node:15-alpine

ENV NODE_ENV=production

WORKDIR /opt

RUN apk update && apk add --no-cache curl

COPY package.json yarn.lock ./

RUN yarn --verbose

COPY . .

CMD yarn start