// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract InstanceRegistry {
    struct Instance {
        uint256 subnetId;
        address minerAddress;
        bool state;
        string url;
    }

    struct Subnet {
        uint256 id;
        string name;
    }

    mapping(uint256 => Subnet) public subnets;
    uint256[] private subnetList;

    mapping(uint256 => address[]) private subnetMiners;         // subnetId → miners
    mapping(address => uint256[]) private minerSubnets;         // miner → subnets
    mapping(address => mapping(uint256 => bool)) private isSubnetMember;

    mapping(address => mapping(uint256 => Instance)) public instances;

    function registerSubnet(uint256 _subnetId, string calldata _name) external {
        if (bytes(subnets[_subnetId].name).length == 0) {
            subnetList.push(_subnetId);
        }
        subnets[_subnetId] = Subnet({id: _subnetId, name: _name});
    }

    function registerInstance(
        uint256 _subnetId,
        address _minerAddress,
        bool _state,
        string calldata _url
    ) external {
        require(bytes(subnets[_subnetId].name).length > 0, "Subnet not registered");

        instances[_minerAddress][_subnetId] = Instance({
            subnetId: _subnetId,
            minerAddress: _minerAddress,
            state: _state,
            url: _url
        });

        if (!isSubnetMember[_minerAddress][_subnetId]) {
            subnetMiners[_subnetId].push(_minerAddress);
            minerSubnets[_minerAddress].push(_subnetId);
            isSubnetMember[_minerAddress][_subnetId] = true;
        }
    }

    function getActiveInstancesBySubnet(uint256 _subnetId) external view returns (Instance[] memory) {
        address[] memory miners = subnetMiners[_subnetId];
        uint256 activeCount = 0;

        for (uint256 i = 0; i < miners.length; i++) {
            if (instances[miners[i]][_subnetId].state) {
                activeCount++;
            }
        }

        Instance[] memory result = new Instance[](activeCount);
        uint256 j = 0;
        for (uint256 i = 0; i < miners.length; i++) {
            if (instances[miners[i]][_subnetId].state) {
                result[j] = instances[miners[i]][_subnetId];
                j++;
            }
        }
        return result;
    }

    function getAllSubnets() external view returns (Subnet[] memory) {
        Subnet[] memory result = new Subnet[](subnetList.length);
        for (uint256 i = 0; i < subnetList.length; i++) {
            result[i] = subnets[subnetList[i]];
        }
        return result;
    }
}
