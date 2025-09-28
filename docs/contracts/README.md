# Smart Contracts

TensorNode leverages Hedera's smart contract capabilities to provide decentralized governance, instance registry, and token distribution. The smart contracts are written in Solidity and deployed on the Hedera network, ensuring transparency, immutability, and decentralized operation.

## Contract Overview

The TensorNode smart contract ecosystem consists of two main contracts:

1. **Instance Registry Contract** - Manages miner registrations and subnet organization
2. **Token Distributor Contract** - Handles token creation, minting, and distribution

## Instance Registry Contract

The Instance Registry is the core contract that manages the network's decentralized infrastructure.

### Contract Structure

```solidity
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
    
    mapping(uint256 => address[]) private subnetMiners;
    mapping(address => uint256[]) private minerSubnets;
    mapping(address => mapping(uint256 => bool)) private isSubnetMember;
    mapping(address => mapping(uint256 => Instance)) public instances;
}
```

### Key Functions

#### Register Subnet
```solidity
function registerSubnet(uint256 _subnetId, string calldata _name) external {
    if (bytes(subnets[_subnetId].name).length == 0) {
        subnetList.push(_subnetId);
    }
    subnets[_subnetId] = Subnet({id: _subnetId, name: _name});
}
```

**Purpose**: Creates or updates a subnet definition
**Parameters**:
- `_subnetId`: Unique identifier for the subnet
- `_name`: Human-readable name for the subnet

**Usage Example**:
```javascript
// Register LLM subnet
await instanceRegistry.registerSubnet(1, "Large Language Models");

// Register Vision subnet
await instanceRegistry.registerSubnet(2, "Computer Vision");
```

#### Register Instance
```solidity
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
```

**Purpose**: Registers a miner instance in a specific subnet
**Parameters**:
- `_subnetId`: Target subnet ID
- `_minerAddress`: Miner's wallet address
- `_state`: Active/inactive status
- `_url`: API endpoint URL for the miner

**Usage Example**:
```javascript
// Register active LLM miner
await instanceRegistry.registerInstance(
    1,                          // LLM subnet
    "0x742d35Cc6634C0532925a3b8D4c9db96590e4CAF",
    true,                       // Active
    "http://192.168.1.100:3000" // API endpoint
);
```

#### Get Active Instances by Subnet
```solidity
function getActiveInstancesBySubnet(uint256 _subnetId) 
    external view returns (Instance[] memory) {
    address[] memory miners = subnetMiners[_subnetId];
    uint256 activeCount = 0;

    // Count active instances
    for (uint256 i = 0; i < miners.length; i++) {
        if (instances[miners[i]][_subnetId].state) {
            activeCount++;
        }
    }

    // Build result array
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
```

**Purpose**: Retrieves all active miner instances for a specific subnet
**Parameters**:
- `_subnetId`: Subnet to query

**Usage Example**:
```javascript
// Get all active LLM miners
const activeMiners = await instanceRegistry.getActiveInstancesBySubnet(1);
console.log(`Found ${activeMiners.length} active LLM miners`);
```

#### Get All Subnets
```solidity
function getAllSubnets() external view returns (Subnet[] memory) {
    Subnet[] memory result = new Subnet[](subnetList.length);
    for (uint256 i = 0; i < subnetList.length; i++) {
        result[i] = subnets[subnetList[i]];
    }
    return result;
}
```

**Purpose**: Returns all registered subnets
**Returns**: Array of all subnet definitions

## Token Distributor Contract

The Token Distributor manages the TensorNode native token lifecycle.

### Contract Structure

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IHederaTokenService {
    function createFungibleToken(
        string memory name,
        string memory symbol,
        address treasury,
        int64 initialSupply,
        uint32 decimals,
        bool freezeDefault
    ) external returns (address);

    function mintToken(address token, int64 amount) external returns (int64);

    function transferToken(
        address token,
        address sender,
        address receiver,
        int64 amount
    ) external returns (int64);
}

contract HederaTokenDistributor {
    IHederaTokenService constant hts = IHederaTokenService(address(0x167));
    address public token;

    event TokenCreated(address tokenAddress);
    event TokensMinted(int64 amount);
    event TokensTransferred(address recipient, int64 amount);
}
```

### Key Functions

#### Create Token
```solidity
function createToken(string memory name, string memory symbol) external {
    token = hts.createFungibleToken(name, symbol, address(this), 0, 0, false);
    emit TokenCreated(token);
}
```

**Purpose**: Creates the TensorNode native token
**Parameters**:
- `name`: Token name (e.g., "TensorNode Token")
- `symbol`: Token symbol (e.g., "TNODE")

**Usage Example**:
```javascript
await tokenDistributor.createToken("TensorNode Token", "TNODE");
```

#### Mint Tokens
```solidity
function mintTokens(int64 amount) external {
    require(token != address(0), "Token not created");
    int64 response = hts.mintToken(token, amount);
    require(response == 0, "Mint failed");
    emit TokensMinted(amount);
}
```

**Purpose**: Mints new tokens to the contract
**Parameters**:
- `amount`: Number of tokens to mint

#### Batch Transfer
```solidity
function batchTransfer(address[] calldata recipients, int64[] calldata amounts) external {
    require(token != address(0), "Token not created");
    require(recipients.length == amounts.length, "Array length mismatch");

    for (uint i = 0; i < recipients.length; i++) {
        int64 response = hts.transferToken(token, address(this), recipients[i], amounts[i]);
        require(response == 0, "Transfer failed");
        emit TokensTransferred(recipients[i], amounts[i]);
    }
}
```

**Purpose**: Distributes tokens to multiple recipients
**Parameters**:
- `recipients`: Array of recipient addresses
- `amounts`: Array of token amounts (must match recipients length)

**Usage Example**:
```javascript
// Distribute rewards to miners
const miners = ["0x742d35Cc...", "0x8ba1f109..."];
const rewards = [100, 150];
await tokenDistributor.batchTransfer(miners, rewards);
```

## Deployment Guide

### Prerequisites

1. **Hardhat Development Environment**:
```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
```

2. **Hedera Account Setup**:
- Create testnet account at [portal.hedera.com](https://portal.hedera.com)
- Fund with testnet HBAR
- Generate ECDSA private key

3. **Environment Configuration**:
```env
TESTNET_OPERATOR_PRIVATE_KEY=your_private_key_hex
MAINNET_OPERATOR_PRIVATE_KEY=your_mainnet_private_key
```

### Hardhat Configuration

```javascript
// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    testnet: {
      url: "https://testnet.hashio.io/api",
      accounts: [process.env.TESTNET_OPERATOR_PRIVATE_KEY],
      chainId: 296,
      gas: 2100000,
      gasPrice: 8000000000
    },
    mainnet: {
      url: "https://mainnet.hashio.io/api", 
      accounts: [process.env.MAINNET_OPERATOR_PRIVATE_KEY],
      chainId: 295,
      gas: 2100000,
      gasPrice: 8000000000
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
```

### Deployment Scripts

#### Deploy Instance Registry
```javascript
// scripts/deploy-instance-registry.js
const hre = require("hardhat");

async function main() {
  console.log("Deploying InstanceRegistry...");
  
  const InstanceRegistry = await hre.ethers.getContractFactory("InstanceRegistry");
  const instanceRegistry = await InstanceRegistry.deploy();
  
  await instanceRegistry.deployed();
  
  console.log("InstanceRegistry deployed to:", instanceRegistry.address);
  
  // Register initial subnets
  console.log("Registering initial subnets...");
  
  await instanceRegistry.registerSubnet(1, "Large Language Models");
  await instanceRegistry.registerSubnet(2, "Computer Vision");
  await instanceRegistry.registerSubnet(3, "Speech-to-Text");
  await instanceRegistry.registerSubnet(4, "Text-to-Speech");
  await instanceRegistry.registerSubnet(5, "Translation");
  
  console.log("Initial subnets registered");
  
  return instanceRegistry.address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

#### Deploy Token Distributor
```javascript
// scripts/deploy-token-distributor.js
const hre = require("hardhat");

async function main() {
  console.log("Deploying HederaTokenDistributor...");
  
  const TokenDistributor = await hre.ethers.getContractFactory("HederaTokenDistributor");
  const tokenDistributor = await TokenDistributor.deploy();
  
  await tokenDistributor.deployed();
  
  console.log("HederaTokenDistributor deployed to:", tokenDistributor.address);
  
  // Create the TensorNode token
  console.log("Creating TensorNode token...");
  
  const createTx = await tokenDistributor.createToken("TensorNode Token", "TNODE");
  await createTx.wait();
  
  const tokenAddress = await tokenDistributor.token();
  console.log("TensorNode token created at:", tokenAddress);
  
  return tokenDistributor.address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### Deployment Commands

```bash
# Compile contracts
npx hardhat compile

# Deploy to testnet
npx hardhat run scripts/deploy-instance-registry.js --network testnet
npx hardhat run scripts/deploy-token-distributor.js --network testnet

# Deploy to mainnet
npx hardhat run scripts/deploy-instance-registry.js --network mainnet
npx hardhat run scripts/deploy-token-distributor.js --network mainnet

# Verify contracts (optional)
npx hardhat verify --network testnet <contract_address>
```

## Integration Examples

### Frontend Integration

```typescript
// lib/instanceRegistry.ts
import { ethers } from 'ethers';

const INSTANCE_REGISTRY_ABI = [
  "function registerInstance(uint256 _subnetId, address _minerAddress, bool _state, string _url)",
  "function getActiveInstancesBySubnet(uint256 _subnetId) view returns (tuple(uint256 subnetId, address minerAddress, bool state, string url)[])",
  "function getAllSubnets() view returns (tuple(uint256 id, string name)[])"
];

export class InstanceRegistryClient {
  private contract: ethers.Contract;
  
  constructor(contractAddress: string, provider: ethers.Provider) {
    this.contract = new ethers.Contract(contractAddress, INSTANCE_REGISTRY_ABI, provider);
  }
  
  async registerInstance(subnetId: number, minerAddress: string, state: boolean, url: string) {
    const tx = await this.contract.registerInstance(subnetId, minerAddress, state, url);
    return await tx.wait();
  }
  
  async getActiveMiners(subnetId: number) {
    return await this.contract.getActiveInstancesBySubnet(subnetId);
  }
  
  async getAllSubnets() {
    return await this.contract.getAllSubnets();
  }
}
```

### Backend Integration

```python
# backend/contracts/instance_registry.py
from web3 import Web3
import json

class InstanceRegistryClient:
    def __init__(self, contract_address: str, private_key: str, rpc_url: str):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.account = self.w3.eth.account.from_key(private_key)
        
        with open('artifacts/contracts/InstanceRegistry.sol/InstanceRegistry.json') as f:
            contract_data = json.load(f)
        
        self.contract = self.w3.eth.contract(
            address=contract_address,
            abi=contract_data['abi']
        )
    
    def register_instance(self, subnet_id: int, miner_address: str, state: bool, url: str):
        """Register miner instance on-chain"""
        tx = self.contract.functions.registerInstance(
            subnet_id, miner_address, state, url
        ).build_transaction({
            'from': self.account.address,
            'gas': 200000,
            'gasPrice': self.w3.to_wei('20', 'gwei'),
            'nonce': self.w3.eth.get_transaction_count(self.account.address)
        })
        
        signed_tx = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)
    
    def get_active_miners(self, subnet_id: int):
        """Get all active miners for a subnet"""
        return self.contract.functions.getActiveInstancesBySubnet(subnet_id).call()
```

## Testing

### Unit Tests

```javascript
// test/InstanceRegistry.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InstanceRegistry", function () {
  let instanceRegistry;
  let owner, miner1, miner2;

  beforeEach(async function () {
    [owner, miner1, miner2] = await ethers.getSigners();
    
    const InstanceRegistry = await ethers.getContractFactory("InstanceRegistry");
    instanceRegistry = await InstanceRegistry.deploy();
    await instanceRegistry.deployed();
  });

  describe("Subnet Management", function () {
    it("Should register a new subnet", async function () {
      await instanceRegistry.registerSubnet(1, "Test Subnet");
      
      const subnet = await instanceRegistry.subnets(1);
      expect(subnet.id).to.equal(1);
      expect(subnet.name).to.equal("Test Subnet");
    });

    it("Should return all subnets", async function () {
      await instanceRegistry.registerSubnet(1, "LLM");
      await instanceRegistry.registerSubnet(2, "Vision");
      
      const subnets = await instanceRegistry.getAllSubnets();
      expect(subnets.length).to.equal(2);
      expect(subnets[0].name).to.equal("LLM");
      expect(subnets[1].name).to.equal("Vision");
    });
  });

  describe("Instance Management", function () {
    beforeEach(async function () {
      await instanceRegistry.registerSubnet(1, "Test Subnet");
    });

    it("Should register a miner instance", async function () {
      await instanceRegistry.registerInstance(
        1,
        miner1.address,
        true,
        "http://example.com:3000"
      );
      
      const instance = await instanceRegistry.instances(miner1.address, 1);
      expect(instance.minerAddress).to.equal(miner1.address);
      expect(instance.state).to.be.true;
      expect(instance.url).to.equal("http://example.com:3000");
    });

    it("Should return active instances for subnet", async function () {
      await instanceRegistry.registerInstance(1, miner1.address, true, "http://miner1.com");
      await instanceRegistry.registerInstance(1, miner2.address, false, "http://miner2.com");
      
      const activeInstances = await instanceRegistry.getActiveInstancesBySubnet(1);
      expect(activeInstances.length).to.equal(1);
      expect(activeInstances[0].minerAddress).to.equal(miner1.address);
    });

    it("Should fail to register instance for non-existent subnet", async function () {
      await expect(
        instanceRegistry.registerInstance(999, miner1.address, true, "http://example.com")
      ).to.be.revertedWith("Subnet not registered");
    });
  });
});
```

### Integration Tests

```javascript
// test/integration/TokenDistribution.test.js
describe("Token Distribution Integration", function () {
  let instanceRegistry, tokenDistributor;
  let owner, miner1, miner2;

  beforeEach(async function () {
    [owner, miner1, miner2] = await ethers.getSigners();
    
    // Deploy contracts
    const InstanceRegistry = await ethers.getContractFactory("InstanceRegistry");
    instanceRegistry = await InstanceRegistry.deploy();
    
    const TokenDistributor = await ethers.getContractFactory("HederaTokenDistributor");
    tokenDistributor = await TokenDistributor.deploy();
    
    // Setup
    await instanceRegistry.registerSubnet(1, "LLM");
    await tokenDistributor.createToken("Test Token", "TEST");
    await tokenDistributor.mintTokens(1000);
  });

  it("Should distribute rewards to active miners", async function () {
    // Register miners
    await instanceRegistry.registerInstance(1, miner1.address, true, "http://miner1.com");
    await instanceRegistry.registerInstance(1, miner2.address, true, "http://miner2.com");
    
    // Get active miners
    const activeMiners = await instanceRegistry.getActiveInstancesBySubnet(1);
    expect(activeMiners.length).to.equal(2);
    
    // Distribute rewards
    const recipients = activeMiners.map(m => m.minerAddress);
    const amounts = [100, 150];
    
    await tokenDistributor.batchTransfer(recipients, amounts);
    
    // Verify distribution events
    const events = await tokenDistributor.queryFilter("TokensTransferred");
    expect(events.length).to.equal(2);
  });
});
```

### Running Tests

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/InstanceRegistry.test.js

# Run tests with gas reporting
REPORT_GAS=true npx hardhat test

# Run tests on specific network
npx hardhat test --network testnet
```

## Gas Optimization

### Optimization Strategies

1. **Batch Operations**: Use batch functions to reduce transaction costs
2. **Storage Optimization**: Pack struct fields efficiently
3. **Event Logging**: Use events instead of storage for historical data
4. **View Functions**: Use view functions for read-only operations

### Gas Usage Analysis

```javascript
// Gas usage for common operations
const gasUsage = {
  registerSubnet: 50000,      // One-time per subnet
  registerInstance: 80000,    // Per miner registration
  getActiveInstances: 0,      // View function (no gas)
  createToken: 200000,        // One-time token creation
  mintTokens: 60000,          // Per mint operation
  batchTransfer: 40000        // Base + 20000 per recipient
};
```

## Security Considerations

### Access Control

```solidity
// Add access control to sensitive functions
import "@openzeppelin/contracts/access/Ownable.sol";

contract InstanceRegistry is Ownable {
    modifier onlyAuthorized() {
        require(authorized[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
    mapping(address => bool) public authorized;
    
    function setAuthorized(address account, bool status) external onlyOwner {
        authorized[account] = status;
    }
    
    function registerSubnet(uint256 _subnetId, string calldata _name) 
        external onlyAuthorized {
        // Implementation
    }
}
```

### Input Validation

```solidity
function registerInstance(
    uint256 _subnetId,
    address _minerAddress,
    bool _state,
    string calldata _url
) external {
    require(_minerAddress != address(0), "Invalid miner address");
    require(bytes(_url).length > 0, "URL cannot be empty");
    require(bytes(_url).length <= 200, "URL too long");
    require(bytes(subnets[_subnetId].name).length > 0, "Subnet not registered");
    
    // Implementation
}
```

### Upgrade Patterns

```solidity
// Use proxy pattern for upgradeable contracts
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract InstanceRegistryV2 is Initializable, OwnableUpgradeable {
    function initialize() public initializer {
        __Ownable_init();
    }
    
    // Contract implementation
}
```

## Monitoring and Analytics

### Event Monitoring

```javascript
// Monitor contract events
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

// Listen for new instance registrations
contract.on("InstanceRegistered", (subnetId, minerAddress, url) => {
    console.log(`New miner registered: ${minerAddress} in subnet ${subnetId}`);
    // Update database, send notifications, etc.
});

// Listen for token transfers
tokenContract.on("TokensTransferred", (recipient, amount) => {
    console.log(`Tokens transferred: ${amount} to ${recipient}`);
    // Update reward tracking
});
```

### Analytics Queries

```javascript
// Get network statistics
async function getNetworkStats() {
    const subnets = await instanceRegistry.getAllSubnets();
    const stats = {};
    
    for (const subnet of subnets) {
        const activeMiners = await instanceRegistry.getActiveInstancesBySubnet(subnet.id);
        stats[subnet.name] = {
            id: subnet.id,
            activeMiners: activeMiners.length,
            miners: activeMiners.map(m => ({
                address: m.minerAddress,
                url: m.url
            }))
        };
    }
    
    return stats;
}
```

---

The TensorNode smart contracts provide a robust, decentralized foundation for network governance and token economics. Their modular design, comprehensive testing, and security features ensure reliable operation of the decentralized AI network.
