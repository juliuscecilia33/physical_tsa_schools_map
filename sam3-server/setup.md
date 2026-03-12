# SAM3 Server Setup

## Prerequisites
- Python 3.10+
- conda (recommended) or pip
- NVIDIA GPU with 8GB+ VRAM (recommended) or Apple Silicon Mac

## Installation

```bash
# 1. Create Python environment
conda create -n sam3 python=3.10
conda activate sam3

# 2. Install PyTorch
# For NVIDIA GPU:
conda install pytorch torchvision pytorch-cuda=12.1 -c pytorch -c nvidia
# For Apple Silicon Mac (MPS backend):
pip install torch torchvision

# 3. Install segment-geospatial with text prompt support
pip install "segment-geospatial[samgeo3,text]"

# 4. Install server dependencies
pip install -r requirements.txt

# 5. HuggingFace auth (for model weights)
huggingface-cli login
# OR set HF_TOKEN in .env

# 6. Configure environment
cp .env.example .env
# Edit .env with your HF_TOKEN and MAPBOX_TOKEN

# 7. Start server
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

## GPU Notes
- **NVIDIA (CUDA)**: Best performance, 8GB+ VRAM recommended
- **Apple Silicon (MPS)**: Works, ~3-5x slower than CUDA
- **CPU-only**: Functional but slow (minutes per inference)
- First run downloads ~2.5GB of model checkpoints (cached after)

## Testing

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```
