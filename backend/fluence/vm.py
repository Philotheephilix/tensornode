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
                        {"port": 8080, "protocol": "tcp"}
                    ],
                    "hostname": None,
                    "osImage": "https://cloud-images.ubuntu.com/focal/current/focal-server-cloudimg-amd64.img",
                    "sshKeys": ["ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICxtJrECnv5YDzeC/LWLjnAwjZeJ0JfpzZ5lPfME5T8a philosanjay5@gmail.com"],
                },
            }

        return deploy_vms(request_body)

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
