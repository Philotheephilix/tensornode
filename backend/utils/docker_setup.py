import os
import shlex


def run_command(command: str) -> int:
    """
    Execute a shell command using only OS facilities.
    Returns the exit code from the shell.
    """
    return os.system(command)


def curl_url_to_file(url: str, output_path: str) -> int:
    """
    Curl a URL and save to a specific file path using only OS commands.
    """
    abs_output = os.path.abspath(output_path)
    output_dir = os.path.dirname(abs_output)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    cmd = f"curl -L -o {shlex.quote(abs_output)} {shlex.quote(url)}"
    return run_command(cmd)


def build_docker_setup_command(image_url: str, workdir: str = "ubuntu-docker") -> str:
    """
    Build a single shell command string that:
      - Installs Docker
      - Starts the Docker service if needed
      - Adds the current user to the docker group
      - Opens UFW port 3000 and shows status
      - Creates a working directory and downloads the Dockerfile via curl
      - Builds the Docker image
      - Runs the container in detached mode so SSH does not hang

    Uses only standard OS commands. We use `sg docker -c` to run commands under the docker group
    without spawning an interactive shell that would block.
    """
    safe_url = shlex.quote(image_url)
    safe_workdir = shlex.quote(workdir)

    # Commands that should run under docker group membership
    docker_group_cmds = "; ".join([
        # Fail fast on any error so SSH returns non‑zero
        "set -e",
        f"sudo ufw allow 3000/tcp",
        f"sudo ufw status",
        f"mkdir -p {safe_workdir}",
        f"cd {safe_workdir}",
        f"curl -L -o Dockerfile {safe_url}",
        # Basic validation: allow leading comments/blank lines; require first non-comment line to be FROM
        "awk '/^[[:space:]]*(#|$)/{next} {print; exit}' Dockerfile | grep -Ei '^[[:space:]]*FROM\\b' >/dev/null || { echo 'Downloaded file does not look like a Dockerfile'; head -n 10 Dockerfile; exit 1; }",
        # Clean up any prior container with the same name to avoid conflicts
        f"docker rm -f my-ubuntu-container >/dev/null 2>&1 || true",
        f"docker build -t my-ubuntu-image .",
        # Run detached to avoid hanging SSH; map port 3000
        f"docker run -d --name my-ubuntu-container -p 3000:3000 my-ubuntu-image",
        # Show running containers for confirmation
        f"docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'",
    ])

    # Before switching groups, ensure Docker is installed and the daemon is running
    pre_cmds = "; ".join([
        "sudo apt update",
        "sudo apt install -y docker.io",
        # Make sure the daemon is up (some images may not autostart it)
        "sudo systemctl start docker || sudo service docker start || true",
        # Add current user to docker group for future sessions
        "sudo usermod -aG docker \"$USER\"",
    ])

    # Use sg to run the sequence as part of the docker group without opening a blocking shell
    cmd = f"{pre_cmds} && sg docker -c {shlex.quote(docker_group_cmds)}"
    return cmd


def run_docker_setup(image_url: str, workdir: str = "ubuntu-docker") -> int:
    """
    Build the full setup command and execute it with os.system.
    Returns the exit code of the overall process.
    """
    command = build_docker_setup_command(image_url=image_url, workdir=workdir)
    return run_command(command)


def prompt_and_run_docker_setup() -> int:
    """
    Prompt the user for a Dockerfile URL and run the setup sequence.
    Returns the exit code from the shell execution.
    """
    url = input("Enter Dockerfile URL: ").strip()
    if not url:
        print("No URL provided.")
        return 1
    return run_docker_setup(url)


def build_docker_setup_from_local(remote_dockerfile_dir: str = "ubuntu-docker", exposed_port: int = 3000) -> str:
    """
    Build a shell command that assumes a Dockerfile already exists on the VM under
    `remote_dockerfile_dir` and builds/runs it. No curl/download involved.
    """
    safe_dir = shlex.quote(remote_dockerfile_dir)
    safe_port = str(int(exposed_port))

    docker_group_cmds = "; ".join([
        # Fail fast on any error
        "set -e",
        f"sudo ufw allow {safe_port}/tcp",
        f"sudo ufw status",
        f"mkdir -p {safe_dir}",
        f"cd {safe_dir}",
        # Basic validation: ensure Dockerfile exists and looks valid
        "test -f Dockerfile || { echo 'Dockerfile not found'; exit 1; }",
        "awk '/^[[:space:]]*(#|$)/{next} {print; exit}' Dockerfile | grep -Ei '^[[:space:]]*FROM\\b' >/dev/null || { echo 'File does not look like a Dockerfile'; head -n 10 Dockerfile; exit 1; }",
        f"docker rm -f my-ubuntu-container >/dev/null 2>&1 || true",
        f"docker build -t my-ubuntu-image .",
        f"docker run -d --name my-ubuntu-container -p {safe_port}:{safe_port} my-ubuntu-image",
        f"docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'",
    ])

    pre_cmds = "; ".join([
        "sudo apt update",
        "sudo apt install -y docker.io",
        "sudo systemctl start docker || sudo service docker start || true",
        "sudo usermod -aG docker \"$USER\"",
    ])

    cmd = f"{pre_cmds} && sg docker -c {shlex.quote(docker_group_cmds)}"
    return cmd 