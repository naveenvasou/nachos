# Use official lightweight Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (needed for psycopg2 sometimes, though binary handles most)
# Also curl for healthchecks if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (Cloud Run expects 8080 by default)
EXPOSE 8080

# Run the application
# Use 0.0.0.0 to bind to all interfaces
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
