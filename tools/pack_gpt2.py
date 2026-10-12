# Packs a Hugging Face GPT-2 checkpoint (model.safetensors + config.json + vocab.json + merges.txt) for the
# browser: every weight matrix becomes int8 with one fp32 scale per output row, biases and layer norms stay fp32,
# and everything is laid out in one byte stream split into chunks small enough to host anywhere.
#
#   python3 tools/pack_gpt2.py <snapshot dir> public/model
#
# Matrices are stored [out][in] (GPT-2's Conv1D keeps them [in][out], so they're transposed here), which makes
# each output a dot product over one contiguous row.
import json, os, shutil, sys
import numpy as np
from safetensors.numpy import load_file

src, out = sys.argv[1], sys.argv[2]
CHUNK = 14 * 1024 * 1024
cfg = json.load(open(os.path.join(src, 'config.json')))
W = load_file(os.path.join(src, 'model.safetensors'))
W = {k[len('transformer.'):] if k.startswith('transformer.') else k: v.astype(np.float32) for k, v in W.items()}
L, D, H = cfg['n_layer'], cfg['n_embd'], cfg['n_head']

blob, tensors = bytearray(), {}
def align():
    while len(blob) % 16: blob.append(0)
def f32(name, a):
    align(); tensors[name] = {'dtype': 'f32', 'shape': list(a.shape), 'offset': len(blob)}
    blob.extend(np.ascontiguousarray(a, dtype='<f4').tobytes())
def q8(name, m):                       # m: [out][in]
    m = np.ascontiguousarray(m, dtype=np.float32)
    scale = np.abs(m).max(axis=1) / 127.0
    scale[scale == 0] = 1.0
    q = np.clip(np.round(m / scale[:, None]), -127, 127).astype(np.int8)
    align(); tensors[name] = {'dtype': 'q8', 'shape': list(m.shape), 'offset': len(blob)}
    blob.extend(q.tobytes()); align()
    tensors[name]['scale'] = len(blob); blob.extend(scale.astype('<f4').tobytes())

q8('wte', W['wte.weight'])             # [vocab][D]: embedding rows, and the tied output layer
f32('wpe', W['wpe.weight'])
for l in range(L):
    p = f'h.{l}.'
    f32(p + 'ln_1.g', W[p + 'ln_1.weight']); f32(p + 'ln_1.b', W[p + 'ln_1.bias'])
    q8(p + 'attn.c_attn', W[p + 'attn.c_attn.weight'].T); f32(p + 'attn.c_attn.b', W[p + 'attn.c_attn.bias'])
    q8(p + 'attn.c_proj', W[p + 'attn.c_proj.weight'].T); f32(p + 'attn.c_proj.b', W[p + 'attn.c_proj.bias'])
    f32(p + 'ln_2.g', W[p + 'ln_2.weight']); f32(p + 'ln_2.b', W[p + 'ln_2.bias'])
    q8(p + 'mlp.c_fc', W[p + 'mlp.c_fc.weight'].T); f32(p + 'mlp.c_fc.b', W[p + 'mlp.c_fc.bias'])
    q8(p + 'mlp.c_proj', W[p + 'mlp.c_proj.weight'].T); f32(p + 'mlp.c_proj.b', W[p + 'mlp.c_proj.bias'])
f32('ln_f.g', W['ln_f.weight']); f32('ln_f.b', W['ln_f.bias'])

os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if f.startswith('weights.'): os.remove(os.path.join(out, f))
chunks = []
for i in range(0, len(blob), CHUNK):
    name = f'weights.{len(chunks)}.bin'
    open(os.path.join(out, name), 'wb').write(blob[i:i + CHUNK]); chunks.append(name)
params = sum(int(np.prod(v.shape)) for k, v in W.items() if not k.endswith('attn.bias') and not k.endswith('masked_bias') and k != 'lm_head.weight')
json.dump({'name': cfg.get('_name_or_path') or 'gpt2', 'n_layer': L, 'n_embd': D, 'n_head': H, 'n_ctx': cfg['n_positions'],
           'vocab': int(W['wte.weight'].shape[0]), 'params': params, 'bytes': len(blob), 'chunks': chunks, 'tensors': tensors},
          open(os.path.join(out, 'manifest.json'), 'w'))
for f in ('vocab.json', 'merges.txt'):
    if os.path.exists(os.path.join(src, f)): shutil.copyfile(os.path.join(src, f), os.path.join(out, f))
print(f'{params / 1e6:.1f}M params -> {len(blob) / 1e6:.1f} MB in {len(chunks)} chunks')
