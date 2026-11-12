FROM node:26-trixie

ENV ASTRO_TELEMETRY_DISABLED=1 \
    WRANGLER_SEND_METRICS=false \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright

WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci \
    && npx playwright install --with-deps chromium

COPY . .
EXPOSE 4321
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
