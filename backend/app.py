
# LEEWAY HEADER (ASCII) — DO NOT EDIT TAG LINE
# TAG: FILE.BACKEND.APP
# COLOR_ONION_HEX: NEON=#FF4D4D FLUO=#33FFA8 PASTEL=#FFD6D6 | SIG: F3B465DC
# ICON_ASCII: family=feather glyph=undefined ICON_SIG=D52F7606
# 5WH: WHAT=todo; WHY=todo; WHEN=todo; HOW=todo; WHERE=todo; WHO=todo

"""
🏷 TAG: FILE.BACKEND.APP
🎨 COLOR_ONION: ◯#39b620 ▷ ◍#3c6a1b ▷ ●#628321 | SIG: abf7bd58
WHAT: Minimal backend vacuum exposing only safe proxy endpoints for frontend escalation
WHY: Handle tasks impossible or insecure in-browser (proxy Gemini, mint TURN creds, stub payments/calls)
WHEN: When frontend needs to escalate sensitive operations
WHERE: backend/app.py (FastAPI vacuum service)
WHO: Agent Lee frontend mesh and maintainers
HOW: Small set of typed FastAPI endpoints with stubbed behaviors and validation
"""
from fastapi import FastAPI, APIRouter, HTTPException, Body, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from pathlib import Path
import re
import os
import uuid
import tempfile
from typing import List, Optional

# Try to import tool suite helpers (manage_file_system, execute_shell_command, conduct_deep_research)
try:
    # Prefer package-relative import when available
    from .tool_suite import manage_file_system, execute_shell_command, conduct_deep_research
except Exception:
    try:
        from tool_suite import manage_file_system, execute_shell_command, conduct_deep_research
    except Exception:
        manage_file_system = execute_shell_command = conduct_deep_research = None

# Try to import OpenVoice components; fail gracefully if unavailable
try:
    from OpenVoice.openvoice.api import ToneColorConverter, BaseSpeakerTTS
    import torch
    OPENVOICE_AVAILABLE = True
except Exception:
    OPENVOICE_AVAILABLE = False

app = FastAPI(title="Agent Lee Backend Vacuum", version="0.1.0")
router = APIRouter(prefix="/api", tags=["vacuum"])

# Compute public/static directory (use absolute path when possible)
ROOT = Path(__file__).resolve().parents[1]
# Prefer frontend/public (new project layout). Fall back to repo-level public if present.
FRONTEND_PUBLIC = ROOT.joinpath('frontend', 'public')
PUBLIC_DIR = ROOT.joinpath('public')
static_dir = FRONTEND_PUBLIC if FRONTEND_PUBLIC.exists() else (PUBLIC_DIR if PUBLIC_DIR.exists() else Path('./public').resolve())

# NOTE: the router will be included after the router endpoint definitions below

# Mount static files under /static to avoid shadowing API routes during tests.
# The SPA index is still served explicitly by the root GET handler below.
app.mount("/static", StaticFiles(directory=str(static_dir), html=True), name="public")
# Serve JS modules stored alongside the SPA sources so index.html can import them from /models and /scripts
models_dir = ROOT.joinpath('frontend', 'models')
scripts_dir = ROOT.joinpath('frontend', 'scripts')
if models_dir.exists():
    app.mount('/models', StaticFiles(directory=str(models_dir)), name='models')
if scripts_dir.exists():
    app.mount('/scripts', StaticFiles(directory=str(scripts_dir)), name='scripts')

# --- Models
class GeminiRequest(BaseModel):
    prompt: str = Field(..., description="User prompt to send to Gemini (proxy stub)")

class StripeIntentRequest(BaseModel):
    amount: int = Field(..., gt=0)
    currency: str = Field(default="usd")

class FreePBXCallRequest(BaseModel):
    to: str = Field(..., description="E.164 formatted target number")

# --- Helpers
E164_RE = re.compile(r"^\+?[1-9]\d{1,14}$")

# --- Endpoints
@router.post('/gemini/generate')
async def gemini_generate(req: GeminiRequest):
    """TOOL.BACKEND.GEMINI.PROXY_GENERATE

    WHAT: Secure proxy for Gemini model generation (stubbed)
    WHY: Never expose Gemini API key to clients
    WHEN: Frontend escalates complex multimodal tasks
    WHERE: backend vacuum proxy
    WHO: Agent Lee frontend
    HOW: Perform server-side call and return minimal reciprocal payload
    """
    # Stubbed response - echo prompt and minimal metadata
    return {"data": {"text": f"[gemini-stub] {req.prompt[:200]}"}, "metadata": {"source": "gemini-proxy-stub"}}

@router.post('/stripe/create-intent')
async def stripe_create_intent(req: StripeIntentRequest):
    """TOOL.BACKEND.STRIPE.STUB_CREATE_INTENT

    WHAT: Stubbed Stripe PaymentIntent creator
    WHY: Allow frontend integration tests without real charges
    WHEN: Checkout flows needing a client_secret
    WHERE: backend vacuum
    WHO: Frontend payment UI
    HOW: Return a mock client_secret and mock:true
    """
    return {"client_secret": f"pi_mock_{req.amount}_{req.currency}", "mock": True}

@router.post('/freepbx/call')
async def freepbx_call(req: FreePBXCallRequest):
    """TOOL.BACKEND.FREEPBX.PLACE_CALL

    WHAT: Validate E.164 and return a mock call id
    WHY: Provide safe call integration points for frontend testing
    WHEN: Frontend requests a call placement
    WHERE: backend vacuum
    WHO: Voice automation tools
    HOW: Validate number and return mock call identifier; real ARI paths commented
    """
    if not E164_RE.match(req.to):
        raise HTTPException(status_code=400, detail="Invalid E.164 number")
    # NOTE: Real FreePBX/ARI integration should be placed behind secure vaults and off by default
    return {"call_id": f"mock-call-{int(__import__('time').time())}", "mock": True}

@app.get('/health')
async def health():
    return {"status":"ok","role":"backend-vacuum"}


@router.post('/voice/upload-ref')
async def upload_ref(files: List[UploadFile] = File(...)):
    """Accept multipart uploads of reference audio and save them to public/audio/refs"""
    refs_dir = VOICE_STORE.joinpath('refs')
    refs_dir.mkdir(parents=True, exist_ok=True)
    saved = []
    try:
        for f in files:
            fname = f.filename or f"ref_{uuid.uuid4().hex[:8]}.wav"
            out_path = refs_dir.joinpath(fname)
            with out_path.open('wb') as fh:
                fh.write(await f.read())
            saved.append(str(out_path))
        return {"status": "ok", "files": saved}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"upload failed: {e}")


# Directory to save cloned speaker embeddings and generated audio
VOICE_STORE = ROOT.joinpath('frontend', 'public', 'audio')
VOICE_STORE.mkdir(parents=True, exist_ok=True)
VOICE_STORE.mkdir(parents=True, exist_ok=True)


# --- Lightweight API stubs to satisfy frontend expectations
@router.get('/capabilities')
async def capabilities():
    return {
        "providers": ["ddg","wiki","hn","so","reddit","perplexica","vespa","haystack"],
        "vision": True,
        "voice": True,
    }


@router.get('/provider/{name}')
async def provider_query(name: str, q: str = None):
    q = q or ""
    return {"results": [{"title": f"{name} result for {q}", "url": "https://example.com/", "snippet": "Sample snippet."}]}


@router.post('/provider/{name}')
async def provider_post(name: str, body: dict = Body(None)):
    q = body.get('q') if body else ''
    return {"results": [{"title": f"{name} (POST) result for {q}", "url": "https://example.com/", "snippet": "Sample snippet."}]}


@router.post('/vision/analyze')
async def vision_analyze(file: UploadFile = None):
    return {"analysis": {"objects": [], "text": "", "notes": "stubbed analysis"}}


@router.post('/voice/clone')
async def voice_clone(payload: dict = Body(...)):
    # payload can be { "files": [base64 or URLs], "name": "lee" }
    if not OPENVOICE_AVAILABLE:
        raise HTTPException(status_code=422, detail="OpenVoice not available on server. Install OpenVoice and its requirements in OpenVoice/requirements.txt")

    files = payload.get('files') or []
    name = payload.get('name') or f"voice_{uuid.uuid4().hex[:8]}"
    if not files:
        raise HTTPException(status_code=400, detail="No reference files provided for cloning")

    # Expect files to be paths accessible on disk (for local flow), else return guidance
    saved_refs: List[str] = []
    try:
        for f in files:
            # If client provided a path under OpenVoice/resources, allow it; otherwise require upload flow
            if os.path.isabs(f) and os.path.exists(f):
                saved_refs.append(f)
            else:
                # Not a local path -- for now, ask client to upload via multipart to /api/voice/upload-ref
                raise HTTPException(status_code=400, detail=f"Reference file path '{f}' not found on server; use multipart upload instead")

        # Use ToneColorConverter to extract speaker embedding and save
        cfg_path = str(Path(__file__).resolve().parents[1].joinpath('OpenVoice', 'configs', 'config.json'))
        tcc = ToneColorConverter(config_path=cfg_path, device='cpu')
        se = tcc.extract_se(saved_refs, se_save_path=str(VOICE_STORE.joinpath(f"{name}.se.pt")))
        return {"status": "ok", "voice_id": name, "se_file": f"/audio/{name}.se.pt"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenVoice clone failed: {e}")


@router.post('/voice/synthesize')
async def voice_synthesize(payload: dict = Body(...)):
    # Expect payload: { voice_id: 'name', text: 'hello', language: 'English' (optional) }
    if not OPENVOICE_AVAILABLE:
        raise HTTPException(status_code=422, detail="OpenVoice not available on server. Install OpenVoice and its requirements in OpenVoice/requirements.txt")

    voice_id = payload.get('voice_id')
    text = payload.get('text')
    language = payload.get('language', 'English')
    if not voice_id or not text:
        raise HTTPException(status_code=400, detail="voice_id and text are required")

    se_path = VOICE_STORE.joinpath(f"{voice_id}.se.pt")
    if not se_path.exists():
        raise HTTPException(status_code=404, detail="voice_id not found; clone first")

    try:
        # Use BaseSpeakerTTS (if available) to synthesize
        cfg_path = str(Path(__file__).resolve().parents[1].joinpath('OpenVoice', 'configs', 'config.json'))
        tts = BaseSpeakerTTS(config_path=cfg_path, device='cpu')
        tts.load_ckpt(str(Path(__file__).resolve().parents[1].joinpath('OpenVoice', 'models', 'best.pth')))
        out_name = f"{voice_id}_{uuid.uuid4().hex[:8]}.wav"
        out_path = VOICE_STORE.joinpath(out_name)
        # For OpenVoice API, use tts.tts(text, output_path, speaker)
        # Here we assume speaker maps to an index; use voice_id as speaker name if present
        speaker = voice_id
        tts.tts(text, str(out_path), speaker=speaker, language=language)
        return {"status": "ok", "audio_url": f"/audio/{out_name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenVoice synth failed: {e}")


# NOTE: the router will be included after tool endpoints are defined below.

# --- Tool endpoints (migrated from backend/app1.py)
from pydantic import BaseModel


class FSRequest(BaseModel):
    action: str
    path: str
    content: Optional[str] = None
    confirmation_token: Optional[str] = None


class ShellRequest(BaseModel):
    command: str


class ResearchRequest(BaseModel):
    query: str
    max_sources: int = 5


@router.post('/tool/fs')
async def fs_tool(req: FSRequest):
    """Proxy file system operations to the tool suite managed function."""
    if manage_file_system is None:
        return {"ok": False, "error": "tool_suite unavailable"}
    return manage_file_system(action=req.action, path=req.path, content=req.content, confirmation_token=req.confirmation_token)


@router.post('/tool/shell')
async def shell_tool(req: ShellRequest):
    """Execute a shell command via tool_suite.execute_shell_command."""
    if execute_shell_command is None:
        return {"ok": False, "error": "tool_suite unavailable"}
    return await execute_shell_command(req.command)


@router.post('/tool/deep_research')
async def deep_tool(req: ResearchRequest):
    """Conduct deep research via tool_suite.conduct_deep_research."""
    if conduct_deep_research is None:
        return {"ok": False, "error": "tool_suite unavailable"}
    return await conduct_deep_research(req.query, max_sources=req.max_sources)


# Register API router so /api/* routes are available
app.include_router(router)


# Serve index.html for SPA routes when file exists (catch-all)
INDEX_FILE = static_dir.joinpath('index.html')


@app.get('/', include_in_schema=False)
async def serve_index():
    if INDEX_FILE.exists():
        return FileResponse(INDEX_FILE)
    return {"message": "index.html not found"}


@app.get('/{full_path:path}', include_in_schema=False)
async def spa_catchall(full_path: str):
    # Let API routes and static files resolve normally; this handler only returns
    # index.html for client-side routes that don't map to an existing file.
    # If index.html isn't present, return 404.
    if full_path.startswith('api'):
        raise HTTPException(status_code=404, detail='Not found')
    if INDEX_FILE.exists():
        return FileResponse(INDEX_FILE)
    raise HTTPException(status_code=404, detail='Not found')

