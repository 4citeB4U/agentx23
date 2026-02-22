import os
import subprocess
import sys

def run_command(command, cwd=None):
    """Runs a shell command and returns output."""
    print(f"🚀 Executing: {command}")
    try:
        # Use shell=True for Windows compatibility with npm/git
        result = subprocess.run(
            command, 
            shell=True, 
            cwd=cwd, 
            capture_output=True, 
            text=True
        )
        if result.returncode != 0:
            print(f"❌ Error: {result.stderr}")
            return False
        print(f"✅ Success: {result.stdout.strip()[:100]}...") 
        return True
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def deploy_project(project_path=".", commit_message="Agent Lee Auto-Deploy"):
    """
    The Full Pipeline: Git -> Vercel (Frontend) -> Fly (Backend)
    """
    print(f"\n📦 STARTING DEPLOYMENT FOR: {project_path}")
    
    # 1. GIT COMMIT & PUSH
    print("\n--- STEP 1: GITHUB SYNC ---")
    if not run_command("git add .", cwd=project_path): return
    if not run_command(f'git commit -m "{commit_message}"', cwd=project_path): 
        print("⚠️ No changes to commit, proceeding...")
    
    # Push to main
    if not run_command("git push origin main", cwd=project_path): 
        print("⚠️ Push failed (check remote/branch), proceeding to local build check...")
    
    # 2. VERCEL DEPLOY (Frontend)
    print("\n--- STEP 2: VERCEL DEPLOY (UI) ---")
    frontend_path = os.path.join(project_path, "agent-lee-studio")
    if os.path.exists(frontend_path):
        run_command("vercel --prod --yes", cwd=frontend_path)
    else:
        print(f"⚠️ Frontend path not found: {frontend_path}")
    
    # 3. FLY.IO DEPLOY (Backend)
    print("\n--- STEP 3: FLY.IO DEPLOY (BACKEND) ---")
    backend_path = os.path.join(project_path, "backend")
    if os.path.exists(backend_path):
        run_command("fly deploy --non-interactive", cwd=backend_path)
    else:
        print(f"⚠️ Backend path not found: {backend_path}")

    print("\n✅ MISSION COMPLETE: DEPLOYMENT FINISHED.")

if __name__ == "__main__":
    # Get project root (parent of scripts folder)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    deploy_project(root)
