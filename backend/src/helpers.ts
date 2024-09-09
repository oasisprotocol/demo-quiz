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
import { ethers } from 'hardhat';

export async function loadYamlConfig(filePath: string): Promise<any> {
  try {
    const fileContents = await promises.readFile(filePath, 'utf8');
    return yaml.load(fileContents);
  } catch (error) {
    console.error("Error reading YAML file", error);
    return {};
  }
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
    console.log(`Added question: ${question.question}. Transaction hash: ${receipt!.hash}`);
  }
}

export async function addCoupons(quizContract: any, couponsFile: string) {
  const coupons = (await promises.readFile(couponsFile, 'utf8')).split('\n').filter(Boolean);
  for (let i = 0; i < coupons.length; i += 20) {
    const chunk = coupons.slice(i, i + 20);
    const tx = await quizContract.addCoupons(chunk);
    const receipt = await tx.wait();
    console.log(`Added coupons: ${chunk}. Transaction hash: ${receipt!.hash}`);
  }
}

export async function setNativeReward(hre: typeof import('hardhat'), quizContract: any, reward: string) {
  const { ethers } = hre;
  const tx = await quizContract.setPayoutReward(ethers.parseEther(reward));
  const receipt = await tx.wait();
  console.log(`Set reward to ${reward} ROSE. Transaction hash: ${receipt!.hash}`);
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

export async function fundContract(hre: typeof import('hardhat'), quizContract: any, amount: string) {
  const { ethers } = hre;
  const tx = await (await ethers.getSigners())[0].sendTransaction({
    to: await quizContract.getAddress(),
    value: ethers.parseEther(amount),
  });
  const receipt = await tx.wait();
  console.log(`Funded contract with ${amount} ROSE. Transaction hash: ${receipt!.hash}`);
}

export async function fundGaslessAccount(hre: typeof import('hardhat'), gaslessAddress: string, amount: string) {
  const { ethers } = hre;
  const tx = await (await ethers.getSigners())[0].sendTransaction({
    to: gaslessAddress,
    value: ethers.parseEther(amount),
  });
  const receipt = await tx.wait();
  console.log(`Funded gasless account with ${amount} ROSE. Transaction hash: ${receipt!.hash}`);
}

export async function setGaslessKeyPair(quizContract: any, payerAddress: string, payerSecret: string, nonce: number) {
  const tx = await quizContract.setGaslessKeyPair(payerAddress, payerSecret, nonce);
  const receipt = await tx.wait();
  console.log(`Set gasless keypair. Transaction hash: ${receipt!.hash}`);
}