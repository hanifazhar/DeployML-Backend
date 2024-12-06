# Use official Node.js image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application
COPY . .

# Expose the port that your app will run on
EXPOSE 8080

# Start the app
CMD ["node", "index.js"]
