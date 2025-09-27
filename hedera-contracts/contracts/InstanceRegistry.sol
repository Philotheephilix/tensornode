// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract InstanceRegistry {
    struct Instance {
        uint256 subnetId;
        address minerAddress; // Hedera Account ID can be mapped to EVM address
        bool state;           // true = active, false = inactive
        string url;
    }

    // Mapping miner address => instance details
    mapping(address => Instance) public instances;

    // Track all registered miners for iteration
    address[] private minerList;

    /// @notice Register or update a miner instance
    function registerInstance(
        uint256 _subnetId,
        address _minerAddress,
        bool _state,
        string calldata _url
    ) external {
        // if first time registering, push to miner list
        if (instances[_minerAddress].minerAddress == address(0)) {
            minerList.push(_minerAddress);
        }

        instances[_minerAddress] = Instance({
            subnetId: _subnetId,
            minerAddress: _minerAddress,
            state: _state,
            url: _url
        });
    }

    /// @notice Fetch all miner instances
    function getAllInstances() external view returns (Instance[] memory) {
        Instance[] memory result = new Instance[](minerList.length);
        for (uint256 i = 0; i < minerList.length; i++) {
            result[i] = instances[minerList[i]];
        }
        return result;
    }

    /// @notice Fetch only active miner instances
    function getActiveInstances() external view returns (Instance[] memory) {
        // Count active first
        uint256 activeCount = 0;
        for (uint256 i = 0; i < minerList.length; i++) {
            if (instances[minerList[i]].state) {
                activeCount++;
            }
        }

        // Collect active instances
        Instance[] memory result = new Instance[](activeCount);
        uint256 j = 0;
        for (uint256 i = 0; i < minerList.length; i++) {
            if (instances[minerList[i]].state) {
                result[j] = instances[minerList[i]];
                j++;
            }
        }
        return result;
    }
}
