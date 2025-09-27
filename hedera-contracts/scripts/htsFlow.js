/*-
 *
 * Hedera Hardhat Example Project
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const { ethers } = require("hardhat");

// Runs a full flow against HederaTokenDistributor:
// 1) createToken(name, symbol)
// 2) mintTokens(mintAmount)
// 3) batchTransfer(recipients[], amounts[])
//
// Params:
// - contractAddress: Deployed HederaTokenDistributor address
// - name: Token name
// - symbol: Token symbol
// - mint: Amount to mint (int64)
// - recipientsCsv: Comma-separated EVM addresses
// - amountsCsv: Comma-separated amounts matching recipients
module.exports = async (contractAddress, name, symbol, mint, recipientsCsv, amountsCsv) => {
  const wallet = (await ethers.getSigners())[0];

  if (!contractAddress) throw new Error("contractAddress is required");
  if (!name) throw new Error("name is required");
  if (!symbol) throw new Error("symbol is required");
  if (mint === undefined || mint === null) throw new Error("mint is required");
  if (!recipientsCsv) throw new Error("recipients is required (comma-separated)");
  if (!amountsCsv) throw new Error("amounts is required (comma-separated)");

  const recipients = recipientsCsv.split(",").map((s) => s.trim()).filter(Boolean);
  const amounts = amountsCsv.split(",").map((s) => s.trim()).filter(Boolean);
  if (recipients.length !== amounts.length) {
    throw new Error("Recipients and amounts length mismatch");
  }

  const distributor = await ethers.getContractAt("HederaTokenDistributor", contractAddress, wallet);

  // Hashio often fails gas estimation for precompile calls; provide explicit gas limits
  const gasOverrides = { gasLimit: ethers.BigNumber.from(3_000_000) };

  console.log(`Using distributor at: ${contractAddress}`);
  console.log(`Creating token: ${name} (${symbol})...`);
  try {
    const txCreate = await distributor.createToken(name, symbol, gasOverrides);
    await txCreate.wait();
    console.log(`Token created.`);
  } catch (e) {
    console.error("Create failed:", e);
    throw e;
  }

  console.log(`Minting: ${mint} ...`);
  try {
    const txMint = await distributor.mintTokens(mint.toString(), gasOverrides);
    await txMint.wait();
    console.log(`Minted.`);
  } catch (e) {
    console.error("Mint failed:", e);
    throw e;
  }

  const parsedAmounts = amounts.map((a) => a.toString());
  console.log(`Transferring to ${recipients.length} recipient(s)...`);
  try {
    const txTransfer = await distributor.batchTransfer(recipients, parsedAmounts, gasOverrides);
    await txTransfer.wait();
    console.log(`Transfers completed.`);
    return txTransfer;
  } catch (e) {
    console.error("Transfer failed:", e);
    throw e;
  }
}; 