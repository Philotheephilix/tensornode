// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// Hedera Token Service interface
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

    // 1️⃣ Create a fungible token
    function createToken(string memory name, string memory symbol) external {
        token = hts.createFungibleToken(name, symbol, address(this), 0, 0, false);
        emit TokenCreated(token);
    }

    // 2️⃣ Mint tokens to contract itself
    function mintTokens(int64 amount) external {
        require(token != address(0), "Token not created");
        int64 response = hts.mintToken(token, amount);
        require(response == 0, "Mint failed");
        emit TokensMinted(amount);
    }

    // 3️⃣ Batch transfer tokens to multiple recipients
    function batchTransfer(address[] calldata recipients, int64[] calldata amounts) external {
        require(token != address(0), "Token not created");
        require(recipients.length == amounts.length, "Recipients and amounts length mismatch");

        for (uint i = 0; i < recipients.length; i++) {
            int64 response = hts.transferToken(token, address(this), recipients[i], amounts[i]);
            require(response == 0, "Transfer failed");
            emit TokensTransferred(recipients[i], amounts[i]);
        }
    }
}
