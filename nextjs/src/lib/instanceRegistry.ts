/**
 * InstanceRegistry utilities for Next.js (server-side)
 *
 * Note: @hashgraph/sdk requires Node.js runtime. Use these functions
 * in Server Components, Route Handlers, or API routes only.
 */

import {
  AccountId,
  ContractId,
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import { ethers } from "ethers";

export type BigNumberish = ethers.BigNumberish;

export interface InstanceDto {
  subnetId: string;
  minerAddress: string;
  state: boolean;
  url: string;
}

export interface SubnetDto {
  id: string;
  name: string;
}

const DEFAULT_RPC_URL = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";

export function toEvmAddressHex(addressLike: string): string {
  if (!addressLike) throw new Error("addressLike is required");
  if (addressLike.startsWith("0x")) return addressLike;
  if (addressLike.includes(".")) {
    const hex = AccountId.fromString(addressLike).toSolidityAddress();
    return `0x${hex}`;
  }
  return addressLike.startsWith("0x") ? addressLike : `0x${addressLike}`;
}

export function contractIdToEvmHex(contractIdLike: string): string {
  const hex = ContractId.fromString(contractIdLike).toSolidityAddress();
  return `0x${hex}`;
}

function toSdkUint256(value: ethers.BigNumberish): number {
  // Hedera SDK addUint256 expects number | Long | BigNumber (SDK's type). We coerce to a safe number.
  // Assumes values are within JS safe integer range (e.g., small subnet IDs like 1, 2, ...).
  return ethers.BigNumber.from(value).toNumber();
}

function getInterface(): ethers.utils.Interface {
  return new ethers.utils.Interface([
    "function registerSubnet(uint256,string)",
    "function registerInstance(uint256,address,bool,string)",
    "function getActiveInstancesBySubnet(uint256) view returns (tuple(uint256,address,bool,string)[])",
    "function getAllSubnets() view returns (tuple(uint256,string)[])",
    // public getters
    "function subnets(uint256) view returns (tuple(uint256,string))",
    "function instances(address,uint256) view returns (tuple(uint256,address,bool,string))",
  ]);
}

function normalizeInstanceTuple(tuple: any): InstanceDto {
  return {
    subnetId: ethers.BigNumber.from(tuple[0]).toString(),
    minerAddress: tuple[1] as string,
    state: Boolean(tuple[2]),
    url: tuple[3] as string,
  };
}

function normalizeSubnetTuple(tuple: any): SubnetDto {
  return {
    id: ethers.BigNumber.from(tuple[0]).toString(),
    name: tuple[1] as string,
  };
}

export async function registerSubnet(options: {
  client: Client;
  contractId: string;
  subnetId: BigNumberish;
  name: string;
  gas?: number;
}): Promise<{ status: string; transactionId: string }> {
  const { client, contractId, subnetId, name, gas = 2_000_000 } = options;
  const cid = ContractId.fromString(contractId);
  const exec = new ContractExecuteTransaction()
    .setContractId(cid)
    .setGas(gas)
    .setFunction(
      "registerSubnet",
      new ContractFunctionParameters().addUint256(toSdkUint256(subnetId)).addString(String(name))
    );
  const resp = await exec.execute(client);
  const receipt = await resp.getReceipt(client);
  return { status: receipt.status.toString(), transactionId: resp.transactionId.toString() };
}

export async function registerInstance(options: {
  client: Client;
  contractId: string;
  subnetId: BigNumberish;
  minerAddress: string; // can be Hedera 0.0.x or EVM 0x...
  state: boolean;
  url: string;
  gas?: number;
}): Promise<{ status: string; transactionId: string }> {
  const { client, contractId, subnetId, minerAddress, state, url, gas = 2_000_000 } = options;
  const cid = ContractId.fromString(contractId);
  const minerEvm = toEvmAddressHex(minerAddress);

  const exec = new ContractExecuteTransaction()
    .setContractId(cid)
    .setGas(gas)
    .setFunction(
      "registerInstance",
      new ContractFunctionParameters()
        .addUint256(toSdkUint256(subnetId))
        .addAddress(minerEvm)
        .addBool(Boolean(state))
        .addString(String(url))
    );
  const resp = await exec.execute(client);
  const receipt = await resp.getReceipt(client);
  return { status: receipt.status.toString(), transactionId: resp.transactionId.toString() };
}

export async function getActiveInstancesBySubnet(options: {
  contractId: string;
  subnetId: BigNumberish;
  rpcUrl?: string;
}): Promise<InstanceDto[]> {
  const { contractId, subnetId, rpcUrl = DEFAULT_RPC_URL } = options;
  const evmAddress = contractIdToEvmHex(contractId);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const iface = getInterface();
  const data = iface.encodeFunctionData("getActiveInstancesBySubnet", [ethers.BigNumber.from(subnetId)]);
  const raw = await provider.call({ to: evmAddress, data });
  const [instances] = iface.decodeFunctionResult("getActiveInstancesBySubnet", raw) as [any[]];
  return instances.map(normalizeInstanceTuple);
}

export async function getAllSubnets(options: {
  contractId: string;
  rpcUrl?: string;
}): Promise<SubnetDto[]> {
  const { contractId, rpcUrl = DEFAULT_RPC_URL } = options;
  const evmAddress = contractIdToEvmHex(contractId);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const iface = getInterface();
  const data = iface.encodeFunctionData("getAllSubnets", []);
  const raw = await provider.call({ to: evmAddress, data });
  const [subnets] = iface.decodeFunctionResult("getAllSubnets", raw) as [any[]];
  return subnets.map(normalizeSubnetTuple);
}

export async function getInstance(options: {
  contractId: string;
  minerAddress: string;
  subnetId: BigNumberish;
  rpcUrl?: string;
}): Promise<InstanceDto> {
  const { contractId, minerAddress, subnetId, rpcUrl = DEFAULT_RPC_URL } = options;
  const evmAddress = contractIdToEvmHex(contractId);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const iface = getInterface();
  const minerEvm = toEvmAddressHex(minerAddress);
  const data = iface.encodeFunctionData("instances", [minerEvm, ethers.BigNumber.from(subnetId)]);
  const raw = await provider.call({ to: evmAddress, data });
  const [inst] = iface.decodeFunctionResult("instances", raw) as [any];
  return normalizeInstanceTuple(inst);
}

export async function getSubnet(options: {
  contractId: string;
  subnetId: BigNumberish;
  rpcUrl?: string;
}): Promise<SubnetDto> {
  const { contractId, subnetId, rpcUrl = DEFAULT_RPC_URL } = options;
  const evmAddress = contractIdToEvmHex(contractId);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const iface = getInterface();
  const data = iface.encodeFunctionData("subnets", [ethers.BigNumber.from(subnetId)]);
  const raw = await provider.call({ to: evmAddress, data });
  const [subnet] = iface.decodeFunctionResult("subnets", raw) as [any];
  return normalizeSubnetTuple(subnet);
}


