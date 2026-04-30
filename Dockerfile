# Use the official Bun image
FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Install dependencies into a temporary directory
# This caches them and speeds up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Install with --production (excludes devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# Copy the production dependencies and source code into the final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY . .

# Set the environment to production
ENV NODE_ENV=production

# Render assigns a dynamic port via the PORT environment variable. 
# Ensure your Bun app listens on this port (usually defaults to 3000 if not set).
ENV PORT=3000
EXPOSE $PORT
RUN mkdir logs && chown bun:bun logs

# Run the app
# Replace 'index.ts' with your actual entry point if it's different
USER bun
ENTRYPOINT [ "bun", "run", "index.ts" ]