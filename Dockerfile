FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS=--dns-result-order=ipv4first
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# pdfkit loads font data (AFM files) and ICC profiles at runtime via fs —
# these are not traced by Next.js standalone, so copy the full dependency tree.
COPY --from=builder /app/node_modules/pdfkit ./node_modules/pdfkit
COPY --from=builder /app/node_modules/fontkit ./node_modules/fontkit
COPY --from=builder /app/node_modules/linebreak ./node_modules/linebreak
COPY --from=builder /app/node_modules/crypto-js ./node_modules/crypto-js
COPY --from=builder /app/node_modules/jpeg-exif ./node_modules/jpeg-exif
COPY --from=builder /app/node_modules/png-js ./node_modules/png-js
COPY --from=builder /app/node_modules/brotli ./node_modules/brotli
COPY --from=builder /app/node_modules/clone ./node_modules/clone
COPY --from=builder /app/node_modules/dfa ./node_modules/dfa
COPY --from=builder /app/node_modules/fast-deep-equal ./node_modules/fast-deep-equal
COPY --from=builder /app/node_modules/restructure ./node_modules/restructure
COPY --from=builder /app/node_modules/tiny-inflate ./node_modules/tiny-inflate
COPY --from=builder /app/node_modules/unicode-properties ./node_modules/unicode-properties
COPY --from=builder /app/node_modules/unicode-trie ./node_modules/unicode-trie
EXPOSE 3000
CMD ["node", "server.js"]
