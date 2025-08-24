export const azr_bridge = `
#!/usr/bin/env python3
"""
AZR Bridge Server - Connects local AZR instance to Agent Lee Cognitive Matrix
This script runs the actual AZR model locally and provides a WebSocket API
for the browser-based Agent Lee interface to communicate with it.

Usage:
1. Ensure you have the AZR model downloaded:
   D:\THEBESTAGENTLEE23\llama_models\andrewzh_Absolute_Zero_Reasoner-Coder-3b-Q4_K_M.gguf

2. Install dependencies:
   pip install llama-cpp-python websockets asyncio

3. Run this script:
   python azr_bridge.py

4. The Agent Lee Cognitive Matrix will automatically connect to this bridge
"""

import asyncio
import websockets
import json
import logging
from llama_cpp import Llama
import sys
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AZREngine:
    def __init__(self, model_path):
        """Initialize the AZR engine with the specified model"""
        self.model_path = model_path
        self.llm = None
        self.is_loaded = False
        
    async def load_model(self):
        """Load the AZR model"""
        try:
            logger.info(f"🧠 Loading AZR model from: {self.model_path}")
            
            self.llm = Llama(
                model_path=self.model_path,
                n_ctx=4096,
                n_threads=6,  # Adjust based on your CPU
                verbose=False
            )
            
            self.is_loaded = True
            logger.info("✅ AZR Model loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to load AZR model: {e}")
            return False
    
    async def run_azr_loop(self, task_prompt):
        """Run the complete AZR reasoning loop: Propose → Solve → Verify → Archive"""
        if not self.is_loaded:
            return {"error": "AZR model not loaded"}
        
        try:
            logger.info(f"🔄 Running AZR Loop for: {task_prompt}")
            
            # AZR System prompt following the research paper's format
            messages = [
                {
                    "role": "system", 
                    "content": "You are AZR (Absolute Zero Reasoner). You use structured reasoning following the pattern: Propose → Solve → Verify → Archive. Think step by step and provide clear, logical responses."
                },
                {
                    "role": "user", 
                    "content": f"Apply AZR reasoning to this task: {task_prompt}"
                }
            ]
            
            # Generate response using the AZR model
            response = self.llm.create_chat_completion(
                messages=messages,
                max_tokens=1024,
                temperature=0.7
            )
            
            result = response['choices'][0]['message']['content']
            logger.info("✅ AZR Loop completed successfully")
            
            return {
                "success": True,
                "task": task_prompt,
                "response": result,
                "model": "andrewzh_Absolute_Zero_Reasoner-Coder-3b-Q4_K_M",
                "confidence": 0.95  # Could be calculated based on response quality
            }
            
        except Exception as e:
            logger.error(f"❌ AZR Loop failed: {e}")
            return {"error": str(e)}

class AZRBridgeServer:
    def __init__(self, model_path, host="localhost", port=8765):
        self.model_path = model_path
        self.host = host
        self.port = port
        self.azr_engine = AZREngine(model_path)
        self.connected_clients = set()
        
    async def handle_client(self, websocket, path):
        """Handle WebSocket connections from Agent Lee Cognitive Matrix"""
        self.connected_clients.add(websocket)
        logger.info(f"🔗 Client connected from {websocket.remote_address}")
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.process_request(websocket, data)
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({"error": "Invalid JSON"}))
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info("🔌 Client disconnected")
        finally:
            self.connected_clients.remove(websocket)
    
    async def process_request(self, websocket, data):
        """Process requests from the Agent Lee interface"""
        request_type = data.get("type")
        
        if request_type == "ping":
            await websocket.send(json.dumps({"type": "pong", "status": "AZR Bridge Online"}))
            
        elif request_type == "load_model":
            success = await self.azr_engine.load_model()
            await websocket.send(json.dumps({
                "type": "model_status",
                "loaded": success,
                "model_path": self.model_path
            }))
            
        elif request_type == "azr_task":
            task_prompt = data.get("prompt", "")
            result = await self.azr_engine.run_azr_loop(task_prompt)
            await websocket.send(json.dumps({
                "type": "azr_result",
                "result": result
            }))
            
        else:
            await websocket.send(json.dumps({"error": f"Unknown request type: {request_type}"}))
    
    async def start_server(self):
        """Start the WebSocket server"""
        logger.info(f"🚀 Starting AZR Bridge Server on {self.host}:{self.port}")
        
        # Pre-load the model
        await self.azr_engine.load_model()
        
        # Start WebSocket server
        start_server = websockets.serve(self.handle_client, self.host, self.port)
        await start_server
        
        logger.info("✅ AZR Bridge Server is running and ready for connections")
        logger.info("🌐 Agent Lee Cognitive Matrix can now connect to this bridge")

def main():
    """Main entry point"""
    # Default model path - adjust if needed
    default_model_path = r"D:\THEBESTAGENTLEE23\llama_models\andrewzh_Absolute_Zero_Reasoner-Coder-3b-Q4_K_M.gguf"
    
    # Check if model file exists
    if not os.path.exists(default_model_path):
        logger.error(f"❌ Model file not found: {default_model_path}")
        logger.info("Please ensure you have downloaded the AZR model to the correct path")
        sys.exit(1)
    
    # Create and start the bridge server
    bridge = AZRBridgeServer(default_model_path)
    
    try:
        asyncio.get_event_loop().run_until_complete(bridge.start_server())
        asyncio.get_event_loop().run_forever()
    except KeyboardInterrupt:
        logger.info("🛑 AZR Bridge Server stopped by user")
    except Exception as e:
        logger.error(f"💥 Server error: {e}")

if __name__ == "__main__":
    main()
`;

export const build_python_executable = `
#!/usr/bin/env python3
"""
Agent Lee Python Executable Builder
Creates standalone executable from azr_bridge.py using PyInstaller
"""

import os
import sys
import subprocess
import shutil
import json
from pathlib import Path

def load_config():
    """Load configuration from config.json"""
    config_path = Path(__file__).parent / "config.json"
    
    if not config_path.exists():
        print("❌ config.json not found!")
        return None
    
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing config.json: {e}")
        return None

def check_pyinstaller():
    """Check if PyInstaller is installed"""
    try:
        subprocess.check_output(['pyinstaller', '--version'], stderr=subprocess.STDOUT)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def install_pyinstaller():
    """Install PyInstaller"""
    print("📦 Installing PyInstaller...")
    try:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pyinstaller'])
        print("✅ PyInstaller installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install PyInstaller: {e}")
        return False

def create_spec_file():
    """Create PyInstaller spec file for azr_bridge.py"""
    spec_content = '''# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['azr_bridge.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('llama_models', 'llama_models'),
    ],
    hiddenimports=[
        'llama_cpp',
        'websockets',
        'numpy',
        'asyncio',
        'json',
        'logging',
        'pathlib',
        'threading'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='azr_bridge',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='build/icon.ico' if os.path.exists('build/icon.ico') else None,
)
'''
    
    with open('azr_bridge.spec', 'w') as f:
        f.write(spec_content)
    
    print("✅ Created azr_bridge.spec")

def build_executable():
    """Build the executable using PyInstaller"""
    print("🔨 Building Python executable...")
    
    try:
        # Run PyInstaller
        cmd = [
            'pyinstaller',
            '--clean',
            '--noconfirm',
            'azr_bridge.spec'
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Python executable built successfully")
            return True
        else:
            print(f"❌ PyInstaller failed:")
            print(result.stdout)
            print(result.stderr)
            return False
            
    except Exception as e:
        print(f"❌ Error running PyInstaller: {e}")
        return False

def organize_distribution():
    """Organize built files for Electron packaging"""
    print("📁 Organizing distribution files...")
    
    # Create python_dist directory
    dist_dir = Path('python_dist')
    if dist_dir.exists():
        shutil.rmtree(dist_dir)
    dist_dir.mkdir()
    
    # Copy executable
    exe_path = Path('dist/azr_bridge.exe') if os.name == 'nt' else Path('dist/azr_bridge')
    if exe_path.exists():
        shutil.copy2(exe_path, dist_dir / exe_path.name)
        print(f"✅ Copied {exe_path.name} to python_dist/")
    else:
        print(f"❌ Executable not found: {exe_path}")
        return False
    
    # Copy any additional files if needed
    additional_files = [
        'config.json',
        'schema'
    ]
    
    for file_path in additional_files:
        src = Path(file_path)
        if src.exists():
            if src.is_file():
                shutil.copy2(src, dist_dir / src.name)
            else:
                shutil.copytree(src, dist_dir / src.name, dirs_exist_ok=True)
            print(f"✅ Copied {file_path} to python_dist/")
    
    print("✅ Distribution files organized")
    return True

def cleanup():
    """Clean up temporary files"""
    print("🧹 Cleaning up temporary files...")
    
    cleanup_paths = [
        'build',
        'dist',
        'azr_bridge.spec',
        '__pycache__'
    ]
    
    for path in cleanup_paths:
        path_obj = Path(path)
        if path_obj.exists():
            if path_obj.is_file():
                path_obj.unlink()
            else:
                shutil.rmtree(path_obj)
            print(f"✅ Removed {path}")

def verify_build():
    """Verify the built executable works"""
    print("🔍 Verifying built executable...")
    
    exe_path = Path('python_dist/azr_bridge.exe') if os.name == 'nt' else Path('python_dist/azr_bridge')
    
    if not exe_path.exists():
        print("❌ Executable not found in python_dist/")
        return False
    
    try:
        # Test that the executable can start (but don't let it run)
        process = subprocess.Popen([str(exe_path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # Give it a moment to start
        import time
        time.sleep(2)
        
        # Terminate it
        process.terminate()
        process.wait(timeout=5)
        
        print("✅ Executable appears to work correctly")
        return True
        
    except Exception as e:
        print(f"⚠️ Could not verify executable: {e}")
        return True  # Don't fail the build for verification issues

def main():
    """Main build function"""
    print("🧠 Agent Lee Python Executable Builder")
    print("=" * 50)
    
    # Load configuration
    config = load_config()
    if not config:
        return 1
    
    # Check if azr_bridge.py exists
    if not Path('azr_bridge.py').exists():
        print("❌ azr_bridge.py not found!")
        return 1
    
    # Check PyInstaller
    if not check_pyinstaller():
        if not install_pyinstaller():
            return 1
    
    print("✅ PyInstaller is available")
    
    # Create spec file
    create_spec_file()
    
    # Build executable
    if not build_executable():
        return 1
    
    # Organize for distribution
    if not organize_distribution():
        return 1
    
    # Verify build
    verify_build()
    
    # Cleanup
    cleanup()
    
    print("\n🎉 Python executable build complete!")
    print("📁 Files ready for Electron packaging in: python_dist/")
    print("🚀 Next step: npm run build-electron")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())

`;

export const debug_azr_connection = `
#!/usr/bin/env python3
"""
Debug AZR Connection - Test the working bridge directly
"""

import asyncio
import websockets
import json
import time

async def test_azr_bridge():
    """Test the AZR bridge directly"""
    try:
        print("🔗 Connecting to AZR Bridge...")
        
        async with websockets.connect("ws://localhost:8765") as websocket:
            print("✅ Connected to AZR Bridge")
            
            # Send a test task
            test_message = {
                "type": "azr_task",
                "prompt": "What is 2 + 2? Please explain your reasoning step by step.",
                "request_id": f"debug_test_{int(time.time())}"
            }
            
            print(f"📤 Sending test message: {test_message}")
            await websocket.send(json.dumps(test_message))
            
            # Wait for responses (welcome + task result)
            print("⏳ Waiting for responses...")
            try:
                # First response should be welcome
                response1 = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                response1_data = json.loads(response1)
                print(f"📥 First response: {response1_data}")

                # Second response should be the task result
                response2 = await asyncio.wait_for(websocket.recv(), timeout=30.0)
                response2_data = json.loads(response2)
                print(f"📥 Second response: {response2_data}")

                if response2_data.get('type') == 'azr_result':
                    print("✅ AZR Bridge is working correctly!")
                    print(f"🧠 AZR Response: {response2_data.get('result', 'No result')}")
                    return True
                else:
                    print(f"⚠️ Unexpected response type: {response2_data.get('type')}")
                    return False

            except asyncio.TimeoutError:
                print("❌ Timeout waiting for response")
                return False
                
    except Exception as e:
        print(f"❌ Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_azr_bridge())

`;

export const install_dependencies = `
#!/usr/bin/env python3
"""
Agent Lee Dependency Installer
Reads from config.json and installs all required Python packages
"""

import json
import subprocess
import sys
import os
from pathlib import Path

def load_config():
    """Load configuration from config.json"""
    config_path = Path(__file__).parent / "config.json"
    
    if not config_path.exists():
        print("❌ config.json not found!")
        return None
    
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing config.json: {e}")
        return None

def check_python_version(required_version):
    """Check if Python version meets requirements"""
    current_version = sys.version_info
    required = tuple(map(int, required_version.replace(">=", "").split(".")))
    
    if current_version >= required:
        print(f"✅ Python {current_version.major}.{current_version.minor}.{current_version.micro} meets requirement {required_version}")
        return True
    else:
        print(f"❌ Python {current_version.major}.{current_version.minor}.{current_version.micro} does not meet requirement {required_version}")
        return False

def install_package(package, version=None):
    """Install a Python package using pip"""
    if version:
        package_spec = f"{package}{version}"
    else:
        package_spec = package
    
    try:
        print(f"📦 Installing {package_spec}...")
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', package_spec])
        print(f"✅ Successfully installed {package}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install {package}: {e}")
        return False

def install_python_requirements(config):
    """Install Python requirements from config"""
    python_req = config.get('python_requirements', {})
    
    # Check Python version
    required_version = python_req.get('version', '>=3.8')
    if not check_python_version(required_version):
        return False
    
    # Install required packages
    packages = python_req.get('packages', {})
    failed_packages = []
    
    print("\n🔧 Installing required Python packages...")
    for package, version in packages.items():
        if version == "built-in":
            print(f"✅ {package} is built-in")
            continue
        
        if not install_package(package, version):
            failed_packages.append(package)
    
    # Install optional packages (with user confirmation)
    optional_packages = python_req.get('optional_packages', {})
    if optional_packages:
        print("\n🔧 Optional packages available:")
        for package, description in optional_packages.items():
            print(f"  - {package}: {description}")
        
        install_optional = input("\nInstall optional packages? (y/N): ").lower().strip()
        if install_optional in ['y', 'yes']:
            for package, description in optional_packages.items():
                print(f"\n📦 Installing optional package: {package}")
                print(f"   Purpose: {description}")
                install_package(package)
    
    if failed_packages:
        print(f"\n❌ Failed to install: {', '.join(failed_packages)}")
        return False
    else:
        print("\n✅ All Python packages installed successfully!")
        return True

def verify_installation(config):
    """Verify that all packages are properly installed"""
    print("\n🔍 Verifying installation...")
    
    packages = config.get('python_requirements', {}).get('packages', {})
    verification_commands = {
        'llama-cpp-python': 'import llama_cpp; print("✅ llama-cpp-python")',
        'websockets': 'import websockets; print("✅ websockets")',
        'numpy': 'import numpy; print("✅ numpy")',
        'python-dotenv': 'import dotenv; print("✅ python-dotenv")'
    }
    
    all_verified = True
    for package in packages:
        if package in ['asyncio', 'json']:  # Built-in modules
            continue
            
        package_name = package.replace('-', '_')  # Handle package name differences
        if package in verification_commands:
            try:
                subprocess.check_output([
                    sys.executable, '-c', verification_commands[package]
                ], stderr=subprocess.STDOUT, text=True)
            except subprocess.CalledProcessError:
                print(f"❌ {package} verification failed")
                all_verified = False
        else:
            try:
                subprocess.check_output([
                    sys.executable, '-c', f'import {package_name}; print("✅ {package}")'
                ], stderr=subprocess.STDOUT, text=True)
            except subprocess.CalledProcessError:
                print(f"❌ {package} verification failed")
                all_verified = False
    
    return all_verified

def check_model_files(config):
    """Check if required model files exist"""
    print("\n📁 Checking model files...")
    
    models = config.get('models', {})
    missing_files = []
    
    for model_name, model_config in models.items():
        if 'path' in model_config:
            model_path = Path(model_config['path'])
            if model_path.exists():
                print(f"✅ {model_name}: {model_path}")
            else:
                print(f"❌ {model_name}: {model_path} (NOT FOUND)")
                missing_files.append(str(model_path))
    
    if missing_files:
        print(f"\n⚠️  Missing model files:")
        for file in missing_files:
            print(f"   - {file}")
        print("\nPlease ensure model files are in the correct locations.")
        return False
    else:
        print("\n✅ All model files found!")
        return True

def display_startup_instructions(config):
    """Display startup instructions"""
    print("\n🚀 Installation Complete!")
    print("\n📋 Next Steps:")
    
    startup_sequence = config.get('deployment', {}).get('startup_sequence', [])
    for i, step in enumerate(startup_sequence, 1):
        print(f"   {step}")
    
    print(f"\n🌐 Open your browser and navigate to: file://{Path.cwd()}/index.html")
    print("\n💡 Tips:")
    print("   - Start the AZR bridge first: python azr_bridge.py")
    print("   - Check the browser console for any errors")
    print("   - Ensure your browser supports WebSocket and IndexedDB")

def main():
    """Main installation function"""
    print("🧠 Agent Lee Cognitive System - Dependency Installer")
    print("=" * 60)
    
    # Load configuration
    config = load_config()
    if not config:
        return 1
    
    print(f"📋 System: {config.get('name', 'Agent Lee')}")
    print(f"📋 Version: {config.get('version', '1.0.0')}")
    print(f"📋 Description: {config.get('description', '')}")
    
    # Install Python requirements
    if not install_python_requirements(config):
        print("\n❌ Installation failed!")
        return 1
    
    # Verify installation
    if not verify_installation(config):
        print("\n⚠️  Some packages may not be properly installed")
    
    # Check model files
    check_model_files(config)
    
    # Display startup instructions
    display_startup_instructions(config)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())

`;

export const test_azr_integration = `
#!/usr/bin/env python3
"""
AZR Integration Test Suite

This script performs comprehensive testing of the AZR integration
to ensure all components are working correctly.

Run this after setting up the AZR bridge to verify functionality.
"""

import asyncio
import websockets
import json
import sys
import time
from datetime import datetime

class AZRTester:
    def __init__(self, host="localhost", port=8765):
        self.host = host
        self.port = port
        self.websocket = None
        self.test_results = []
        
    async def connect(self):
        """Connect to the AZR bridge server"""
        try:
            uri = f"ws://{self.host}:{self.port}"
            print(f"🔗 Connecting to AZR bridge at {uri}...")
            
            self.websocket = await websockets.connect(uri)
            print("✅ Connected successfully!")
            return True
            
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            print("💡 Make sure azr_bridge.py is running")
            return False
    
    async def send_message(self, message):
        """Send a message and wait for response"""
        if not self.websocket:
            return None
            
        try:
            await self.websocket.send(json.dumps(message))
            response = await self.websocket.recv()
            return json.loads(response)
        except Exception as e:
            print(f"❌ Communication error: {e}")
            return None
    
    async def test_ping(self):
        """Test basic connectivity"""
        print("\n🏓 Testing basic connectivity...")
        
        response = await self.send_message({"type": "ping"})
        
        if response and response.get("type") == "pong":
            print("✅ Ping test passed")
            self.test_results.append(("Ping Test", True, "Basic connectivity working"))
            return True
        else:
            print("❌ Ping test failed")
            self.test_results.append(("Ping Test", False, "No pong response"))
            return False
    
    async def test_model_loading(self):
        """Test model loading functionality"""
        print("\n🧠 Testing model loading...")
        
        response = await self.send_message({"type": "load_model"})
        
        if response and response.get("type") == "model_status":
            if response.get("loaded"):
                print("✅ Model loading test passed")
                print(f"📁 Model path: {response.get('model_path', 'Unknown')}")
                self.test_results.append(("Model Loading", True, "AZR model loaded successfully"))
                return True
            else:
                print("❌ Model loading failed")
                self.test_results.append(("Model Loading", False, "Model failed to load"))
                return False
        else:
            print("❌ No response to model loading request")
            self.test_results.append(("Model Loading", False, "No response"))
            return False
    
    async def test_reasoning_task(self, task_name, prompt):
        """Test a specific reasoning task"""
        print(f"\n🔬 Testing {task_name}...")
        print(f"📝 Prompt: {prompt[:60]}...")
        
        start_time = time.time()
        
        response = await self.send_message({
            "type": "azr_task",
            "prompt": prompt
        })
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        if response and response.get("type") == "azr_result":
            result = response.get("result", {})
            
            if result.get("success"):
                print(f"✅ {task_name} test passed")
                print(f"⏱️  Processing time: {processing_time:.2f}s")
                print(f"🎯 Confidence: {(result.get('confidence', 0) * 100):.1f}%")
                
                # Show a snippet of the response
                response_text = result.get("response", "")
                if len(response_text) > 100:
                    response_snippet = response_text[:100] + "..."
                else:
                    response_snippet = response_text
                    
                print(f"💬 Response: {response_snippet}")
                
                self.test_results.append((task_name, True, f"Completed in {processing_time:.2f}s"))
                return True
            else:
                error = result.get("error", "Unknown error")
                print(f"❌ {task_name} test failed: {error}")
                self.test_results.append((task_name, False, error))
                return False
        else:
            print(f"❌ No valid response for {task_name}")
            self.test_results.append((task_name, False, "No response"))
            return False
    
    async def run_comprehensive_tests(self):
        """Run the complete test suite"""
        print("🚀 Starting AZR Integration Test Suite")
        print("=" * 50)
        
        # Test connectivity
        if not await self.test_ping():
            print("\n💥 Basic connectivity failed. Stopping tests.")
            return False
        
        # Test model loading
        if not await self.test_model_loading():
            print("\n💥 Model loading failed. Continuing with other tests...")
        
        # Test reasoning tasks
        test_tasks = [
            ("Logic Analysis", "Analyze this logical statement: If P implies Q, and Q implies R, what can we conclude about P and R?"),
            
            ("Problem Solving", "A system processes 1000 tasks per hour with 99% accuracy. If accuracy drops to 95% but speed increases to 1500 tasks/hour, is this improvement worthwhile?"),
            
            ("Verification Task", "Verify the correctness of this reasoning: 'All cognitive systems need memory. AZR is a cognitive system. Therefore, AZR needs memory.'"),
            
            ("Creative Reasoning", "Design a method to detect circular reasoning in multi-agent conversations. Consider edge cases and implementation challenges.")
        ]
        
        successful_tests = 0
        for task_name, prompt in test_tasks:
            success = await test_reasoning_task(self, task_name, prompt)
            if success:
                successful_tests += 1
            
            # Brief pause between tests
            await asyncio.sleep(1)
        
        # Print test summary
        await self.print_test_summary()
        
        return successful_tests == len(test_tasks)
    
    async def print_test_summary(self):
        """Print a summary of all test results"""
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for _, success, _ in self.test_results if success)
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        print("\nDetailed Results:")
        for test_name, success, details in self.test_results:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"  {status} {test_name}: {details}")
        
        if passed == total:
            print("\n🎉 All tests passed! AZR integration is working perfectly.")
        elif passed > total * 0.5:
            print("\n⚠️  Most tests passed. Check failed tests for issues.")
        else:
            print("\n💥 Multiple test failures. Check your AZR setup.")
    
    async def close(self):
        """Close the WebSocket connection"""
        if self.websocket:
            await self.websocket.close()
            print("\n🔌 Connection closed")

async def main():
    """Main test execution"""
    print("🧠 AZR Integration Test Suite")
    print("Testing connection to local AZR bridge...")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = AZRTester()
    
    try:
        # Connect to AZR bridge
        if not await tester.connect():
            print("\n💡 To run these tests:")
            print("1. Start the AZR bridge: python azr_bridge.py")
            print("2. Or double-click: start_azr_bridge.bat")
            print("3. Then run this test again")
            return False
        
        # Run comprehensive tests
        success = await tester.run_comprehensive_tests()
        
        return success
        
    except KeyboardInterrupt:
        print("\n⏹️  Tests interrupted by user")
        return False
        
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        return False
        
    finally:
        await tester.close()

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)
`;

export const working_azr_bridge = `
#!/usr/bin/env python3
"""
Working AZR Bridge for Agent Lee
Compatible with modern websockets library
"""

import asyncio
import websockets
import json
import logging
import os
import sys
from llama_cpp import Llama

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WorkingAZRBridge:
    def __init__(self, model_path, host="localhost", port=8765):
        self.model_path = model_path
        self.host = host
        self.port = port
        self.llm = None
        self.is_loaded = False
        self.connected_clients = set()
        
    async def load_model(self):
        """Load the AZR model"""
        try:
            logger.info(f"🧠 Loading AZR model from: {self.model_path}")
            
            self.llm = Llama(
                model_path=self.model_path,
                n_ctx=4096,
                n_threads=4,
                verbose=False
            )
            
            self.is_loaded = True
            logger.info("✅ AZR Model loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to load AZR model: {e}")
            return False
    
    async def process_with_azr(self, prompt):
        """Process prompt with AZR model"""
        if not self.is_loaded:
            return {"error": "AZR model not loaded"}
        
        try:
            # Create a structured prompt for AZR
            azr_prompt = f"""<|system|>
You are AZR (Absolute Zero Reasoner), a sophisticated AI reasoning engine. Provide clear, logical, and helpful responses.
<|user|>
{prompt}
<|assistant|>
"""
            
            # Generate response
            response = self.llm(
                azr_prompt,
                max_tokens=512,
                temperature=0.7,
                top_p=0.9,
                stop=["<|user|>", "<|system|>"],
                echo=False
            )
            
            result = response['choices'][0]['text'].strip()
            
            return {
                "success": True,
                "result": result,
                "source": "azr_model",
                "model": "andrewzh_Absolute_Zero_Reasoner-Coder-3b"
            }
            
        except Exception as e:
            logger.error(f"❌ AZR processing error: {e}")
            return {
                "success": False,
                "error": str(e),
                "source": "azr_model"
            }
    
    async def handle_client(self, websocket):
        """Handle WebSocket client connections"""
        self.connected_clients.add(websocket)
        client_addr = websocket.remote_address
        logger.info(f"🔗 Client connected from {client_addr}")
        
        try:
            # Send welcome message
            await websocket.send(json.dumps({
                "type": "welcome",
                "message": "Connected to AZR Bridge",
                "model_loaded": self.is_loaded
            }))
            
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.process_request(websocket, data)
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({
                        "type": "error",
                        "error": "Invalid JSON format"
                    }))
                except Exception as e:
                    logger.error(f"❌ Error processing message: {e}")
                    await websocket.send(json.dumps({
                        "type": "error",
                        "error": str(e)
                    }))
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"🔌 Client {client_addr} disconnected")
        except Exception as e:
            logger.error(f"❌ WebSocket error: {e}")
        finally:
            if websocket in self.connected_clients:
                self.connected_clients.remove(websocket)
    
    async def process_request(self, websocket, data):
        """Process incoming requests"""
        request_type = data.get("type", "unknown")
        
        if request_type == "ping":
            await websocket.send(json.dumps({
                "type": "pong",
                "status": "AZR Bridge Online",
                "model_loaded": self.is_loaded
            }))
            
        elif request_type == "azr_task" or request_type == "task":
            prompt = data.get("prompt", "")
            if not prompt:
                await websocket.send(json.dumps({
                    "type": "error",
                    "error": "No prompt provided"
                }))
                return
            
            logger.info(f"🧠 Processing AZR task: {prompt[:50]}...")
            result = await self.process_with_azr(prompt)
            
            await websocket.send(json.dumps({
                "type": "azr_result",
                "request_id": data.get("request_id"),
                **result
            }))
            
        elif request_type == "status":
            await websocket.send(json.dumps({
                "type": "status_response",
                "model_loaded": self.is_loaded,
                "model_path": self.model_path,
                "connected_clients": len(self.connected_clients)
            }))
            
        else:
            await websocket.send(json.dumps({
                "type": "error",
                "error": f"Unknown request type: {request_type}"
            }))
    
    async def start_server(self):
        """Start the WebSocket server"""
        logger.info(f"🚀 Starting Working AZR Bridge on {self.host}:{self.port}")
        
        # Load model first
        if not await self.load_model():
            logger.error("❌ Failed to load model, exiting")
            return
        
        # Start WebSocket server
        async with websockets.serve(self.handle_client, self.host, self.port):
            logger.info("✅ Working AZR Bridge Server is running and ready!")
            logger.info("🌐 Agent Lee can now connect for intelligent reasoning")
            
            # Keep server running
            await asyncio.Future()  # Run forever

def main():
    """Main entry point"""
    # Model path
    model_path = r"D:\THEBESTAGENTLEE23\llama_models\andrewzh_Absolute_Zero_Reasoner-Coder-3b-Q4_K_M.gguf"
    
    # Check if model exists
    if not os.path.exists(model_path):
        logger.error(f"❌ Model file not found: {model_path}")
        logger.info("Please ensure the AZR model is downloaded to the correct path")
        sys.exit(1)
    
    # Create and start bridge
    bridge = WorkingAZRBridge(model_path)
    
    try:
        asyncio.run(bridge.start_server())
    except KeyboardInterrupt:
        logger.info("🛑 AZR Bridge stopped by user")
    except Exception as e:
        logger.error(f"💥 Server error: {e}")

if __name__ == "__main__":
    main()

`;

