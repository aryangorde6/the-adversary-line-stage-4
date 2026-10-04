# Live demo only (ours, written after the run; not part of any stage).
# Build from the repository root: docker build -f demo/Dockerfile .
# stage-4/ is copied unchanged; demo/ adds the launcher and the sample data.
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

COPY stage-4/package.json ./
COPY stage-4/src ./src
COPY demo/start.js demo/fixture.js ./demo/

USER node

EXPOSE 8080

CMD ["node", "demo/start.js"]
