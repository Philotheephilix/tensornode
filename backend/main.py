from fluence.vm import FluenceVMManager
import os
import time

def main():
    # Ensure API key is available via environment; FluenceVMManager.connect propagates it
    api_key = os.getenv("FLUENCE_API_KEY")
    vm = FluenceVMManager(api_key=api_key)

    vm.connect()

    # Path to SSH private key in the keys folder next to this file (backend/keys/...)
    keys_dir = os.path.join(os.path.dirname(__file__), "keys")
    key_path = os.path.join(keys_dir, "fluence")

    # 1) Deploy a VM (uses default body which includes your public key)
    # print("Deploying VM...")
    # deploy_result = vm.deploy_vm()
    # print("Deploy result:", deploy_result)

    # deployed_vm_ids = _extract_vm_ids(deploy_result)

    # 2) List VMs
    print("Listing active VMs...")
    vms = vm.list_vms()
    print(f"Active VMs: {len(vms)}")

    # Choose a VM to operate on from fetched details
    target_vm_id = (vms[0].get("id") or vms[0].get("vmId")) if vms else None
    if not target_vm_id:
        print("No VM available to operate on.")
        return

    # 3) Execute a simple command over SSH to verify connectivity
    print(f"Executing command on VM {target_vm_id} via SSH...")
    exit_code = vm.execute_on_vm(target_vm_id, "uname -a", key_path=key_path, username="ubuntu")
    print("SSH command exit code:", exit_code)

    # 4) Update VM name and open ports (must include all intended ports)
    #    We'll preserve current ports from the VM details and rename it.
    print(f"Updating VM {target_vm_id} name and ports...")
    # fetch fresh details from the list we already have
    current_vm = next((item for item in vms if (item.get("id") == target_vm_id or item.get("vmId") == target_vm_id)), None)
    current_ports = current_vm.get("ports") if current_vm else []
    # Map 'ports' from GET to 'openPorts' expected by PATCH
    open_ports = []
    for p in current_ports or []:
        port_num = p.get("port")
        protocol = p.get("protocol") or p.get("proto") or "tcp"
        if port_num:
            open_ports.append({"port": port_num, "protocol": protocol})

    # Example: ensure 80 is open as well
    if not any(p.get("port") == 80 for p in open_ports):
        open_ports.append({"port": 80, "protocol": "tcp"})

    new_name = f"tnode-{int(time.time())}"
    vm.update_vms([
        {
            "id": target_vm_id,
            "vmName": new_name,
            "openPorts": open_ports,
        }
    ])
    print(f"Updated VM {target_vm_id} to name {new_name} with ports {open_ports}")

    # 5) Optional: Delete the VM(s). Set DO_DELETE=True to enable.
    DO_DELETE = False
    if DO_DELETE:
        print(f"Deleting VM(s): {[target_vm_id]}")
        vm.delete_vms([target_vm_id])
        print("Delete requested.")


if __name__ == "__main__":
    main()
