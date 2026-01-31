import os
import subprocess
import time
import signal
import sys

def kill_process_on_port(port):
    """Finds and kills the process listening on the specified port."""
    try:
        # Find PID using lsof
        # -t: terse (pid only), -i: internet addresses
        cmd = f"lsof -ti:{port}"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        
        if result.returncode == 0 and result.stdout.strip():
            pids = result.stdout.strip().split('\n')
            for pid in pids:
                if pid:
                    pid = int(pid)
                    print(f"Killing process {pid} on port {port}...")
                    try:
                        os.kill(pid, signal.SIGKILL)
                    except ProcessLookupError:
                        print(f"Process {pid} already gone.")
        else:
            print(f"No process found listening on port {port}.")
            
    except Exception as e:
        print(f"Error checking/killing port {port}: {e}")

def main():
    print("--- Restarting Application ---")
    
    # 1. Stop existing services
    print("Stopping services...")
    kill_process_on_port(5011) # Flask Backend
    kill_process_on_port(5173) # Vite Frontend
    
    time.sleep(2) # Give OS time to release ports

    # 2. Define Paths
    # Current script is in V1/Backend/Restart_App.py
    # Root V1 is parent of parent
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(backend_dir)
    frontend_dir = os.path.join(root_dir, "Frontend")
    backend_script = os.path.join(backend_dir, "Agent.py")

    # 3. Start Backend
    print(f"\nStarting Backend Server...")
    # We use Popen to start it in the background/parallel
    # Running using python3 from the root directory to maintain path consistency if needed, 
    # though running directly on the script works too as python adds script dir to path.
    backend_env = os.environ.copy()
    backend_proc = subprocess.Popen(
        [sys.executable, backend_script],
        cwd=root_dir, # Running from V1 root
        env=backend_env
    )
    print(f"Backend started (PID: {backend_proc.pid})")

    # 4. Start Frontend
    print(f"\nStarting Frontend Server...")
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=frontend_dir
    )
    print(f"Frontend started (PID: {frontend_proc.pid})")

    print("\n--- Application Restarted ---")
    print("Backend: http://localhost:5011")
    print("Frontend: http://localhost:5173")
    print("Press Ctrl+C to stop both processes if running this script directly (though they are spawned processes).")
    
    try:
        # Keep the script running to monitor/allow easy kill? 
        # Or just exit? The user likely wants them to keep running.
        # If we exit, Popen processes *should* stay alive in standard shell execution, 
        # but in some contexts they might close.
        # Let's wait on them so the user can stick to this terminal window if they want.
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        print("\nStopping triggered by user...")
        backend_proc.terminate()
        frontend_proc.terminate()

if __name__ == "__main__":
    main()
