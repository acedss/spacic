FROM python:3.12-slim

WORKDIR /app

# Build tools required by the `implicit` library (C extension via CMake/scikit-build)
# libopenblas-dev: fast linear algebra (speeds up ALS matrix ops significantly)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
# Poll /admin/health every 30 s; 60 s start-period covers ALS model loading on cold start.
# Uses Python stdlib urllib — always available, zero extra dependencies.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/admin/health')" || exit 1
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
