import { promises } from 'fs';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';
import axios from 'axios';
import * as yaml from "js-yaml";

import '@nomicfoundation/hardhat-ethers';
import '@oasisprotocol/sapphire-hardhat';
import '@typechain/hardhat';
import 'hardhat-watcher';
import 'solidity-coverage';
import { HardhatEthersSigner, SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

export async function loadYamlConfig(filePath: string): Promise<any> {
  const fileContents = await promises.readFile(filePath, 'utf8');
  return yaml.load(fileContents);
}

/**
 * Generates n unique coupons of length l.
 * @param n number of coupons
 * @param l length of each coupon
 * @returns List of unique coupon strings
 */
export async function genCoupons(n=50, l=6): Promise<string[]> {
  // List of allowed characters. Inspired by BASE-58 encoding.
  const allowedChars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTVWXYZ23456789";
  const coupons = new Set<string>();
  for (let i=0; i<n; i++) {
    let c: string;
    do {
      c="";
      for (let j = 0; j < l; j++) {
        c += allowedChars[Math.floor(Math.random() * allowedChars.length)];
      }
    } while (coupons.has(c));
    coupons.add(c);
  }
  return Array.from(coupons.values());
}

export async function printAccount(hre: typeof import('hardhat'), addr: string) {
  const balance = hre.ethers.formatEther(await hre.ethers.provider.getBalance(addr));
  console.log(`Using account ${addr}. Account balance ${balance}`);
}

export async function deployContract(hre: typeof import('hardhat'),
                                      accounts: HardhatEthersSigner[],
                                      contractName: string,
                                      ...deployArgs: any[]) {
    const { ethers } = hre;
    const contractFactory = await ethers.getContractFactory(contractName, accounts[0]);
    const contract = await contractFactory.deploy(...deployArgs);
    await contract.waitForDeployment();
    console.log(`${contractName} deployed at address: ${await contract.getAddress()}`);
    return contract;
  }

export async function addQuestions(quizContract: any, questionsFile: string) {
  const questions = JSON.parse(await promises.readFile(questionsFile, 'utf8'));
  for (const question of questions) {
    const tx = await quizContract.addQuestion(question.question, question.choices);
    const receipt = await tx.wait();
    console.log(`Adding question: ${question.question}\n  Transaction hash: ${receipt!.hash}`);
  }
}

export async function addCoupons(quizContract: any, couponsFile: string) {
  const coupons = (await promises.readFile(couponsFile, 'utf8')).split('\n').filter(Boolean);
  for (let i = 0; i < coupons.length; i += 20) {
    const chunk = coupons.slice(i, i + 20);
    const tx = await quizContract.addCoupons(chunk);
    const receipt = await tx.wait();
    console.log(`Adding coupons: ${chunk}\n  Transaction hash: ${receipt!.hash}`);
  }
}

export async function setNativeReward(hre: typeof import('hardhat'), quizContract: any, reward: string) {
  const { ethers } = hre;
  const tx = await quizContract.setPayoutReward(ethers.parseEther(reward));
  const receipt = await tx.wait();
  console.log(`Setting reward to ${reward} ROSE\n  Transaction hash: ${receipt!.hash}`);
}


export async function addAllowMint(hre: typeof import('hardhat'), contract: any, address: string) {
  const tx = await contract.addAllowMint(address);
  await tx.wait();
  console.log(`Address ${address} allowed to mint.`);
}

export async function removeAllowMint(hre: typeof import('hardhat'), contract: any, address: string) {
  const tx = await contract.removeAllowMint(address);
  await tx.wait();
  console.log(`Address ${address} allowed to mint.`);
}

export async function setNftAddress(hre: typeof import('hardhat'), contract: any, nftAddress: string) {
  const tx = await contract.setNftAddress(nftAddress);
  await tx.wait();
  console.log(`NFT address set to ${nftAddress}.`);
}

export async function storeNFT(hre: typeof import('hardhat'), quiz: any, jsonMetadata: string) {
  console.log(`Storing NFT with metadata: ${jsonMetadata}`);
  console.log(`NFT address: ${await quiz.nftAddress()}`);

  const nft = await hre.ethers.getContractAt('NftReward', await quiz.nftAddress());
  if ((await nft.tokenURIs(hre.ethers.keccak256(hre.ethers.toUtf8Bytes(jsonMetadata)))).length > 0) {
    console.log(`NFT already stored. Ignoring.`);
    return;
  }
  const tx = await quiz.storeNFT(jsonMetadata, { gasLimit: 15_000_000 });
  await tx.wait();
  console.log(`NFT stored.`);
}

export async function fundAccount(hre: typeof import('hardhat'), account: any, amount: string) {
  const { ethers } = hre;
  const tx = await (await ethers.getSigners())[0].sendTransaction({
    to: account,
    value: ethers.parseEther(amount),
  });
  const receipt = await tx.wait();
  console.log(`Funding account ${account} with ${amount} ROSE\n  Transaction hash: ${receipt!.hash}`);
}

export async function setGaslessKeyPair(hre: typeof import('hardhat'), quizContract: any, payerSecret: string, nonce: number) {
  const { ethers } = hre;
  const payerAddress = ethers.computeAddress(payerSecret);
  const tx = await quizContract.setGaslessKeyPair(payerAddress, payerSecret, nonce);
  const receipt = await tx.wait();
  console.log(`Setting gasless payer ${payerAddress}\n  Transaction hash: ${receipt!.hash}`);
}
