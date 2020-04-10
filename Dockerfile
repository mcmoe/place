FROM node:dubnium
LABEL maintainer="applebetas@dynastic.co"

# Create app directory
WORKDIR /usr/src/app

# Copy over package.json (and package-lock.json, if applicable)
COPY package*.json yarn.lock ./

# Install app dependencies
RUN yarn install && \
    yarn cache clean

# Bundle app source
COPY . .

CMD [ "yarn", "start" ]
