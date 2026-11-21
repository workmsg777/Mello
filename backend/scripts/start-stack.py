import os
import secrets
import signal
import subprocess
import time


stop_requested = False


def request_stop(_signum, _frame):
    global stop_requested
    stop_requested = True


def signal_group(process, signum):
    try:
        os.killpg(process.pid, signum)
    except ProcessLookupError:
        pass


def main():
    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)

    service_key = os.environ.get("MATCHING_AI_KEY", "").strip() or secrets.token_urlsafe(32)
    ai_port = "8001" if int(os.environ.get("PORT", "4000")) == 8000 else "8000"
    backend_env = {
        **os.environ,
        "MATCHING_AI_KEY": service_key,
        "MATCHING_AI_URL": f"http://127.0.0.1:{ai_port}",
    }
    ai_env = {
        name: os.environ[name]
        for name in (
            "PATH",
            "AI_EMBEDDINGS_ENABLED",
            "AI_EMBEDDING_MODEL",
            "AI_MODEL_REVISION",
            "AI_MODEL_LOCAL_ONLY",
            "AI_MODEL_CACHE_DIR",
            "AI_PHOTO_MODEL_PATH",
            "PHOTO_MODERATION_MODE",
        )
        if name in os.environ
    }
    ai_env.update(
        HOME="/home/appuser",
        MATCHING_AI_KEY=service_key,
        PYTHONDONTWRITEBYTECODE="1",
    )

    backend_command = (
        "npm run dev -- --legacy-watch"
        if backend_env.get("NODE_ENV") == "development"
        else "node dist/server.js"
    )
    processes = {}
    try:
        processes["matching AI"] = subprocess.Popen(
            ["python", "-m", "uvicorn", "api.main:app", "--host", "127.0.0.1",
             "--port", ai_port, "--no-access-log"],
            cwd="/opt/mello-ai",
            env=ai_env,
            user="appuser",
            group="appuser",
            extra_groups=[],
            start_new_session=True,
        )
        processes["backend"] = subprocess.Popen(
            ["sh", "-c", f"npm run db:migrate && npm run db:seed && exec {backend_command}"],
            env=backend_env,
            start_new_session=True,
        )

        while not stop_requested:
            for name, process in processes.items():
                status = process.poll()
                if status is not None:
                    print(f"{name} exited with status {status}", flush=True)
                    return 1
            time.sleep(0.2)
        return 0
    finally:
        for process in processes.values():
            signal_group(process, signal.SIGTERM)
        deadline = time.monotonic() + 45
        for process in processes.values():
            try:
                process.wait(timeout=max(0, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                signal_group(process, signal.SIGKILL)
                process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
