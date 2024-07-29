import { promises as fs } from 'fs';
import path from 'path';

import '@nomicfoundation/hardhat-ethers';
import '@oasisprotocol/sapphire-hardhat';
import '@typechain/hardhat';
import canonicalize from 'canonicalize';
import {JsonRpcProvider} from "ethers";
import 'hardhat-watcher';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import { HardhatUserConfig, task } from 'hardhat/config';
import 'solidity-coverage';


async function deployContract(hre: typeof import('hardhat'), contractName: string, url: string) {
  const { ethers } = hre;
  const uwProvider = new JsonRpcProvider(url);
  const contractFactory = await ethers.getContractFactory(contractName, new hre.ethers.Wallet(accounts[0], uwProvider));
  const contract = await contractFactory.deploy();
  await contract.waitForDeployment();
  console.log(`${contractName} deployed at address: ${await contract.getAddress()}`);
  return contract;
}

async function addQuestions(quizContract: any, questionsFile: string) {
  const questions = JSON.parse(await fs.readFile(questionsFile, 'utf8'));
  for (const question of questions) {
    const tx = await quizContract.addQuestion(question.question, question.choices);
    const receipt = await tx.wait();
    console.log(`Added question: ${question.question}. Transaction hash: ${receipt!.hash}`);
  }
}

async function addCoupons(quizContract: any, couponsFile: string) {
  const coupons = (await fs.readFile(couponsFile, 'utf8')).split('\n').filter(Boolean);
  for (let i = 0; i < coupons.length; i += 20) {
    const chunk = coupons.slice(i, i + 20);
    const tx = await quizContract.addCoupons(chunk);
    const receipt = await tx.wait();
    console.log(`Added coupons: ${chunk}. Transaction hash: ${receipt!.hash}`);
  }
}

async function setReward(hre: typeof import('hardhat'), quizContract: any, reward: string) {
  const { ethers } = hre;
  const tx = await quizContract.setReward(ethers.parseEther(reward));
  const receipt = await tx.wait();
  console.log(`Set reward to ${reward} ROSE. Transaction hash: ${receipt!.hash}`);
}

async function fundContract(hre: typeof import('hardhat'), quizContract: any, amount: string) {
  const { ethers } = hre;
  const tx = await (await ethers.getSigners())[0].sendTransaction({
    to: await quizContract.getAddress(),
    value: ethers.parseEther(amount),
  });
  const receipt = await tx.wait();
  console.log(`Funded contract with ${amount} ROSE. Transaction hash: ${receipt!.hash}`);
}

async function fundGaslessAccount(hre: typeof import('hardhat'), gaslessAddress: string, amount: string) {
  const { ethers } = hre;
  const tx = await (await ethers.getSigners())[0].sendTransaction({
    to: gaslessAddress,
    value: ethers.parseEther(amount),
  });
  const receipt = await tx.wait();
  console.log(`Funded gasless account with ${amount} ROSE. Transaction hash: ${receipt!.hash}`);
}

async function setGaslessKeyPair(quizContract: any, payerAddress: string, payerSecret: string, nonce: number) {
  const tx = await quizContract.setGaslessKeyPair(payerAddress, payerSecret, nonce);
  const receipt = await tx.wait();
  console.log(`Set gasless keypair. Transaction hash: ${receipt!.hash}`);
}

const TASK_EXPORT_ABIS = 'export-abis';

task(TASK_COMPILE, async (_args, hre, runSuper) => {
  await runSuper();
  await hre.run(TASK_EXPORT_ABIS);
});

task(TASK_EXPORT_ABIS, async (_args, hre) => {
  const srcDir = path.basename(hre.config.paths.sources);
  const outDir = path.join(hre.config.paths.root, 'abis');

  const [artifactNames] = await Promise.all([
    hre.artifacts.getAllFullyQualifiedNames(),
    fs.mkdir(outDir, { recursive: true }),
  ]);

  await Promise.all(
    artifactNames.map(async (fqn) => {
      const { abi, contractName, sourceName } = await hre.artifacts.readArtifact(fqn);
      if (abi.length === 0 || !sourceName.startsWith(srcDir) || contractName.endsWith('Test'))
        return;
      await fs.writeFile(`${path.join(outDir, contractName)}.json`, `${canonicalize(abi)}\n`);
    }),
  );
});

// Deploy the OasisReward contract.
task('deployOasisReward')
  .addParam("name", "Name of NFT")
  .addParam("symbol", "Symbol for NFT token")
  .setAction(async (args, hre) => {
    await hre.run('compile');

    // For deployment unwrap the provider to enable contract verification.
    const uwProvider = new JsonRpcProvider(hre.network.config.url);
    const OasisReward = await hre.ethers.getContractFactory('OasisReward', new hre.ethers.Wallet(accounts[0], uwProvider));
    const oasisReward = await OasisReward.deploy(args.name, args.symbol);
    await oasisReward.waitForDeployment();

    console.log(`OasisReward address: ${await oasisReward.getAddress()}`);
    return oasisReward;
});

// Unencrypted contract deployment.
task('deploy')
  .setAction(async (args, hre) => {
    await hre.run('compile');

    // For deployment unwrap the provider to enable contract verification.
    const quiz = await deployContract(hre, 'Quiz', hre.network.config.url);
    });

// Set the NFT address in the Quiz contract.
task("setNftAddress", "Sets the NFT contract address in the Quiz contract")
  .addParam("address", "The address of the deployed Quiz contract")
  .addParam("nftaddress", "The address of the NFT contract to set")
  .setAction(async (taskArgs, hre) => {

    const quiz = await hre.ethers.getContractAt('Quiz', taskArgs.address);
    // Call the setNft function with the provided NFT address
    const tx = await quiz.setNft(taskArgs.nftaddress);

    // Wait for the transaction to be mined
    await tx.wait();

    console.log(`NFT address set to ${taskArgs.nftaddress} in Quiz contract`);
  });



// Get list of valid coupons and spent coupons with the block number.
task('getCoupons')
  .addPositionalParam('address', 'contract address')
  .setAction(async (args, hre) => {
    await hre.run('compile');

    console.log(`Coupons for quiz contract ${args.address}`);
    const quiz = await hre.ethers.getContractAt('Quiz', args.address);

    const [coupons, couponStatus] = await quiz.getCoupons();
    let validCoupons: string[] = [];
    let removedCoupons: string[] = [];
    let spentCoupons = new Map<string, bigint>();
    for (let i=0; i<coupons.length; i++) {
      if (couponStatus[i]==await quiz.COUPON_VALID()) {
        validCoupons.push(coupons[i]);
      } else if (couponStatus[i]==await quiz.COUPON_REMOVED()) {
        removedCoupons.push(coupons[i]);
      } else {
        spentCoupons.set(coupons[i], couponStatus[i]);
      }
    }
    let spentCouponsStr = ""
    spentCoupons.forEach((value: bigint, key: string) => {
        spentCouponsStr += `${key}:${value},`;
      }
    );
    console.log(`Spent coupons (${spentCoupons.size}/${coupons.length}): ${spentCouponsStr.slice(0, spentCouponsStr.length-1)}`);
    console.log(`Valid coupons (${validCoupons.length}/${coupons.length}): ${validCoupons}`);
    console.log(`Removed coupons (${removedCoupons.length}/${coupons.length}): ${removedCoupons}`);
  });

// Print out the Quiz status. Useful as a checklist.
task('status')
  .addPositionalParam('address', 'contract address')
  .setAction(async (args, hre) => {
    await hre.run('compile');

    console.log(`Status of quiz contract ${args.address}`);
    const quiz = await hre.ethers.getContractAt('Quiz', args.address);

    // Questions.
    const questions = await quiz.getQuestions("");
    console.log(`Questions (counting from 0):`);
    for (let i=0; i<questions.length; i++) {
      console.log(`  ${i}. ${questions[i].question}`);
      for (let j=0; j<questions[i].choices.length; j++) {
        console.log(`     ${String.fromCharCode(97+j)}) ${questions[i].choices[j]}`);
      }
    }

    // Coupons.
    try {
        const coupons = await quiz.countCoupons();
        console.log(`Coupons Available/All: ${coupons[0]}/${coupons[1]}`)
    } catch (_) {
    }

    console.log(`Reward: ${hre.ethers.formatEther(await quiz.getReward())} ROSE`)
    console.log(`Payout Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(await quiz.getAddress()))} ROSE`)

    const gaslessKeyPair = await quiz.getGaslessKeyPair();
    console.log("Gasless signer:");
    console.log(` Address: ${gaslessKeyPair[0]}`)
    console.log(` Secret: ${gaslessKeyPair[1]}`)
    console.log(` Nonce: ${gaslessKeyPair[2]}`)
    console.log(` Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(gaslessKeyPair[0]))} ROSE`)
    console.log(` Actual nonce: ${await hre.ethers.provider.getTransactionCount(gaslessKeyPair[0])}`)
  });

// Add a new question.
task('addQuestion')
  .addPositionalParam('address', 'contract address')
  .addPositionalParam('question', 'the question')
  .addVariadicPositionalParam('choices', 'possible choices')
  .setAction(async (args, hre) => {
    await hre.run('compile');

    let quiz = await hre.ethers.getContractAt('Quiz', args.address);
    const tx = await quiz.addQuestion(args.question, args.choices);
    const receipt = await tx.wait();
    console.log(`Success! Transaction hash: ${receipt!.hash}`);
  });

// Clear (delete) questions.
task('clearQuestions')
  .addPositionalParam('address', 'contract address')
  .setAction(async (args, hre) => {
    await hre.run('compile');

    let quiz = await hre.ethers.getContractAt('Quiz', args.address);
    const tx = await quiz.clearQuestions();
    const receipt = await tx.wait();
    console.log(`Success! Transaction hash: ${receipt!.hash}`);
  });

// Update existing question.
task('setQuestion')
  .addPositionalParam('address', 'contract address')
  .addPositionalParam('number', 'question number (starting from 0)')
  .addPositionalParam('questionsFile', 'file containing questions in JSON format')
  .setAction(async (args, hre) => {
    await hre.run('compile');

    let quiz = await hre.ethers.getContractAt('Quiz', args.address);
    const questions = JSON.parse(await fs.readFile(args.questionsFile,'utf8'));
    const tx = await quiz.setQuestion(args.number, questions[parseInt(args.number)].question, questions[parseInt(args.number)].choices);
    const receipt = await tx.wait();
    console.log(`Updated question ${questions[parseInt(args.number)].question}. Transaction hash: ${receipt!.hash}`);
  });

// Add questions from json file.
task('addQuestions')
.addPositionalParam('address', 'contract address')
.addPositionalParam('questionsFile', 'file containing questions in JSON format')
.setAction(async (args, hre) => {
  const quiz = await hre.ethers.getContractAt('Quiz', args.address);
  await addQuestions(quiz, args.questionsFile);
});

// Add coupons.
task('addCoupons')
.addPositionalParam('address', 'contract address')
.addPositionalParam('couponsFile', 'file containing coupons, one per line')
.setAction(async (args, hre) => {
  const quiz = await hre.ethers.getContractAt('Quiz', args.address);
  await addCoupons(quiz, args.couponsFile);
});

// Set reward amount in native token.
task('setReward')
  .addPositionalParam('address', 'contract address')
  .addPositionalParam('reward', 'reward in ROSE')
  .setAction(async (args, hre) => {
    const quiz = await hre.ethers.getContractAt('Quiz', args.address);
    await setReward(hre, quiz, args.reward);
  });

// Send funds from signers account to quiz contract.
task('fund')
  .addPositionalParam('address', 'contract address')
  .addPositionalParam('amount', 'amount in ROSE')
  .setAction(async (args, hre) => {
    const quiz = await hre.ethers.getContractAt('Quiz', args.address);
    await fundContract(hre,
      quiz,
       args.amount
      );
  });

// Send funds from quiz contract to specified address.
task('reclaimFunds')
  .addPositionalParam('address', 'contract address')
  .addPositionalParam('payoutAddress', 'reclaim funds to this address')
  .setAction(async (args, hre) => {
    await hre.run('compile');

    let quiz = await hre.ethers.getContractAt('Quiz', args.address);
    const tx = await quiz.reclaimFunds(args.payoutAddress);
    const receipt = await tx.wait();
    console.log(`Successfully reclaimed funds to ${args.payoutAddress}. Transaction hash: ${receipt!.hash}`);
  });

// Set gasless key-pair.
task('setGaslessKeyPair')
  .addPositionalParam('address', 'contract address')
  .addPositionalParam('payerAddress', 'payer address')
  .addPositionalParam('payerSecret', 'payer secret key')
  .setAction(async (args, hre) => {
    const quiz = await hre.ethers.getContractAt('Quiz', args.address);
    const nonce = await hre.ethers.provider.getTransactionCount(args.payerAddress);
    await setGaslessKeyPair(quiz, args.payerAddress, args.payerSecret, nonce);
  });


// Deploy and setup Quiz contract.
task('deployAndSetupQuiz')
  .addOptionalParam('questionsFile', 'File containing questions in JSON format', 'test-questions.json')
  .addOptionalParam('couponsFile', 'File containing coupons, one per line', 'test-coupons.txt')
  .addOptionalParam('reward', 'Reward in ROSE', '2.0')
  .addOptionalParam('gaslessAddress', 'Payer address for gasless transactions')
  .addOptionalParam('gaslessSecret', 'Payer secret key for gasless transactions')
  .addOptionalParam('fundAmount', 'Amount in ROSE to fund the contract', '100')
  .addOptionalParam('fundGaslessAmount', 'Amount in ROSE to fund the gasless account', '10')
  .addOptionalParam('contractAddress', 'Contract address for status check')
  .setAction(async (args, hre) => {
    await hre.run('compile');
    const quiz = await deployContract(hre, 'Quiz', hre.network.config.url);
    await addQuestions(quiz, args.questionsFile);
    await addCoupons(quiz, args.couponsFile);
    await setReward(hre, quiz, args.reward);
    await fundContract(hre, quiz, args.fundAmount);
    const nonce = await hre.ethers.provider.getTransactionCount(args.gaslessAddress);
    if (!args.gaslessAddress || !args.gaslessSecret) {
      console.log('Provide --gasless-address and --gasless-secret to set gasless keypair.');
      return
    }
    await setGaslessKeyPair(quiz, args.gaslessAddress, args.gaslessSecret, nonce);
    await fundGaslessAccount(hre, args.gaslessAddress, args.fundGaslessAmount);
    if (args.contractAddress) {
      await hre.run('status', { address: args.contractAddress });
    } else {
      await hre.run('status', { address: await quiz.getAddress() });
    }
  });

// Hardhat Node and sapphire-dev test mnemonic.
const TEST_HDWALLET = {
  mnemonic: "test test test test test test test test test test test junk",
  path: "m/44'/60'/0'/0",
  initialIndex: 0,
  count: 20,
  passphrase: "",
};

const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : TEST_HDWALLET;

const config: HardhatUserConfig = {
  networks: {
    hardhat: { // https://hardhat.org/metamask-issue.html
      chainId: 1337,
    },
    'sapphire': {
      url: 'https://sapphire.oasis.io',
      chainId: 0x5afe,
      accounts,
    },
    'sapphire-testnet': {
      url: 'https://testnet.sapphire.oasis.dev',
      chainId: 0x5aff,
      accounts,
    },
    'sapphire-localnet': { // docker run -it -p8545:8545 -p8546:8546 ghcr.io/oasisprotocol/sapphire-localnet -test-mnemonic
      url: 'http://localhost:8545',
      chainId: 0x5afd,
      accounts,
    },
    'emerald-testnet': {
      url: 'https://testnet.emerald.oasis.io',
      chainId: 0xa515,
      accounts,
    },
  },
  solidity: {
    version: '0.8.16',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  watcher: {
    compile: {
      tasks: ['compile'],
      files: ['./contracts/'],
    },
    test: {
      tasks: ['test'],
      files: ['./contracts/', './test'],
    },
    coverage: {
      tasks: ['coverage'],
      files: ['./contracts/', './test'],
    },
  },
  mocha: {
    require: ['ts-node/register/files'],
    timeout: 50_000,
  },
};

export default config;
