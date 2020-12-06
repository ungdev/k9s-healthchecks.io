FROM node:15-alpine

ENV NODE_ENV=production

WORKDIR /opt

# Used to force ipv4
RUN echo "151.101.120.249 dl-cdn.alpinelinux.org" > /etc/hosts

RUN apk update && apk add --no-cache curl

COPY package.json yarn.lock ./

RUN yarn --verbose

COPY . .

CMD yarn start