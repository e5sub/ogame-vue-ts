FROM node:lts-alpine AS builder

RUN mkdir -p /workspace
WORKDIR /workspace
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.ustc.edu.cn/g' /etc/apk/repositories
RUN apk update && apk add git
RUN npm config set registry https://registry.npmmirror.com
RUN git clone https://github.com/setube/ogame-vue-ts.git
RUN mv ./ogame-vue-ts/* . ; rm -rf ./ogame-vue-ts/

RUN npm install -g pnpm ; pnpm install;
RUN pnpm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /workspace/docs /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]