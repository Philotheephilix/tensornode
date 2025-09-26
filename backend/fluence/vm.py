import os
import requests
import json

HISTORY_FILE = "vm_deployments.json"

def deploy_vms(request_body):
    """
    Deploy VMs using Fluence API and store deployment details in a JSON history file.
    """
    api_key = os.getenv("FLUENCE_API_KEY")
    if not api_key:
        raise ValueError("FLUENCE_API_KEY environment variable not set")

    url = "https://api.fluence.dev/vms/v3"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    response = requests.post(url, headers=headers, data=json.dumps(request_body))

    if not (200 <= response.status_code < 300):
        raise Exception(f"API request failed with status {response.status_code}: {response.text}")

    deployment_data = response.json()
    save_to_history(deployment_data)
    return deployment_data

def save_to_history(deployment_data):
    """
    Append deployment data to a single JSON history file.
    """
    history = []
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r") as f:
            try:
                history = json.load(f)
            except json.JSONDecodeError:
                history = []

    history.append(deployment_data)

    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=4)

def get_active_vms():
    """
    Fetch all currently active VMs using the Fluence API.
    Returns the parsed JSON response (array of VM objects).
    """
    api_key = os.getenv("FLUENCE_API_KEY")
    if not api_key:
        raise ValueError("FLUENCE_API_KEY environment variable not set")

    url = "https://api.fluence.dev/vms/v3"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    response = requests.get(url, headers=headers)
    if not (200 <= response.status_code < 300):
        raise Exception(
            f"API request failed with status {response.status_code}: {response.text}"
        )

    return response.json()

def update_vms(updates: list[dict]) -> None:
    """
    Update VM properties (e.g., name, open ports) using the Fluence API.
    Expects a list of update objects. Returns None on success (204).
    """
    api_key = os.getenv("FLUENCE_API_KEY")
    if not api_key:
        raise ValueError("FLUENCE_API_KEY environment variable not set")

    url = "https://api.fluence.dev/vms/v3"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    body = {"updates": updates}
    response = requests.patch(url, headers=headers, data=json.dumps(body))

    # The API returns 204 No Content on success
    if response.status_code != 204:
        raise Exception(
            f"API request failed with status {response.status_code}: {response.text}"
        )


def delete_vms(vm_ids: list[str]) -> None:
    """
    Delete one or multiple VMs by IDs using the Fluence API.
    Returns None on success (204).
    """
    api_key = os.getenv("FLUENCE_API_KEY")
    if not api_key:
        raise ValueError("FLUENCE_API_KEY environment variable not set")

    url = "https://api.fluence.dev/vms/v3"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    body = {"vmIds": vm_ids}
    response = requests.delete(url, headers=headers, data=json.dumps(body))

    # The API returns 204 No Content on success
    if response.status_code != 204:
        raise Exception(
            f"API request failed with status {response.status_code}: {response.text}"
        )

def get_vm_by_id(vm_id: str) -> dict:
    """
    Fetch a single VM by id by listing all VMs and filtering locally.
    Raises ValueError if the VM cannot be found.
    """
    vms = get_active_vms()
    for vm in vms:
        # Fluence examples show key as "id"; keep a fallback for "vmId"
        if vm.get("id") == vm_id or vm.get("vmId") == vm_id:
            return vm
    raise ValueError(f"VM with id {vm_id} not found")


def execute_command_on_vm(vm_id: str, command: str, key_path: str = "keys/fluence", username: str = "ubuntu") -> int:
    """
    Execute a shell command on the VM via SSH using only OS commands.
    - Looks up VM public IP
    - Uses SSH private key with -i from the provided keys folder path
    - Returns the OS exit code from the ssh command
    """
    import shlex

    vm = get_vm_by_id(vm_id)
    public_ip = vm.get("publicIp")
    if not public_ip:
        raise ValueError("VM public IP not available")

    abs_key_path = os.path.abspath(key_path)
    if not os.path.exists(abs_key_path):
        raise FileNotFoundError(f"SSH key not found at {abs_key_path}")

    # Ensure private key permissions are acceptable for SSH
    os.system(f"chmod 600 {shlex.quote(abs_key_path)}")

    # Build SSH command using only OS commands; avoid host key prompts
    ssh_cmd = (
        f"ssh -i {shlex.quote(abs_key_path)} "
        f"-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "
        f"{shlex.quote(username)}@{shlex.quote(public_ip)} "
        f"{shlex.quote(command)}"
    )

    return os.system(ssh_cmd)

class FluenceVMManager:
    """Simple manager wrapper around Fluence VM deployment helpers."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("FLUENCE_API_KEY")

    def connect(self) -> bool:
        """Prepare environment for API access. No network call is made here."""
        if self.api_key:
            # Ensure downstream helpers see the API key
            os.environ["FLUENCE_API_KEY"] = self.api_key
        return True

    def deploy_vm(self, request_body: dict | None = None) -> dict:
        """
        Deploy a VM (or VMs). If no request_body is provided, a minimal default is used.
        Returns the deployment data as returned by the Fluence API.
        """
        if request_body is None:
            request_body = {
                "constraints": {
                    "basicConfiguration": "cpu-4-ram-8gb-storage-25gb",
                    "additionalResources": {},
                    "hardware": None,
                    "datacenter": None,
                    "maxTotalPricePerEpochUsd": "1.5",
                },
                "instances": 1,
                "vmConfiguration": {
                    "name": "default-vm",
                    "openPorts": [
                        {"port": 80, "protocol": "tcp"},
                        {"port": 8080, "protocol": "tcp"},
                    ],
                    "hostname": None,
                    "osImage": "https://cloud-images.ubuntu.com/focal/current/focal-server-cloudimg-amd64.img",
                    "sshKeys": ["ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICxtJrECnv5YDzeC/LWLjnAwjZeJ0JfpzZ5lPfME5T8a philosanjay5@gmail.com"],
                },
            }

        return deploy_vms(request_body)

    def list_vms(self) -> list:
        """Return the list of active VMs for the current API key."""
        if self.api_key:
            os.environ["FLUENCE_API_KEY"] = self.api_key
        return get_active_vms()

    def update_vms(self, updates: list[dict]) -> None:
        """Update VM name and/or open ports for one or more VMs."""
        if self.api_key:
            os.environ["FLUENCE_API_KEY"] = self.api_key
        return update_vms(updates)

    def delete_vms(self, vm_ids: list[str]) -> None:
        """Delete one or more VMs by ID."""
        if self.api_key:
            os.environ["FLUENCE_API_KEY"] = self.api_key
        return delete_vms(vm_ids)

    def execute_on_vm(self, vm_id: str, command: str, key_path: str = "keys/id_ed25519", username: str = "ubuntu") -> int:
        """Execute a shell command on the specified VM via SSH using only OS commands."""
        if self.api_key:
            os.environ["FLUENCE_API_KEY"] = self.api_key
        return execute_command_on_vm(vm_id, command, key_path=key_path, username=username)

# Example usage
if __name__ == "__main__":
    request_body = {
        "constraints": {
            "basicConfiguration": "cpu-4-ram-8gb-storage-25gb",
            "additionalResources": {
                "storage": [
                    {"type": "NVMe", "supply": 20, "units": "GiB"}
                ]
            },
            "hardware": None,
            "datacenter": None,
            "maxTotalPricePerEpochUsd": "1.5"
        },
        "instances": 2,
        "vmConfiguration": {
            "name": "web-server",
            "openPorts": [
                {"port": 80, "protocol": "tcp"},
                {"port": 8080, "protocol": "tcp"}
            ],
            "hostname": "my-vm",
            "osImage": "https://cloud-images.ubuntu.com/focal/current/focal-server-cloudimg-amd64.img",
            "sshKeys": ["ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICxtJrECnv5YDzeC/LWLjnAwjZeJ0JfpzZ5lPfME5T8a philosanjay5@gmail.com"]
        }
    }

    result = deploy_vms(request_body)
    print("Deployment stored in history file:", HISTORY_FILE)
