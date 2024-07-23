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
require("@nomicfoundation/hardhat-chai-matchers");

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
    const uwProvider = new JsonRpcProvider(hre.network.config.url);
    const Quiz = await hre.ethers.getContractFactory('Quiz', new hre.ethers.Wallet(accounts[0], uwProvider));
    const quiz = await Quiz.deploy();
    await quiz.waitForDeployment();

    console.log(`Quiz address: ${await quiz.getAddress()}`);
    return quiz;
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

    // Questions
    const questions = await quiz.getQuestions("");
    console.log(`Questions (counting from 0):`);
    for (let i=0; i<questions.length; i++) {
      console.log(`  ${i}. ${questions[i].question}`);
      for (let j=0; j<questions[i].choices.length; j++) {
        console.log(`     ${String.fromCharCode(97+j)}) ${questions[i].choices[j]}`);
      }
    }

    // Coupons
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

// Add a new question.
task('clearQuestions')
  .addPositionalParam('address', 'contract address')
  .setAction(async (args, hre) => {
    await hre.run('compile');

    let quiz = await hre.ethers.getContractAt('Quiz', args.address);
    const tx = await quiz.clearQuestions();
    const receipt = await tx.wait();
    console.log(`Success! Transaction hash: ${receipt!.hash}`);
  });

// Add a new question.
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

// Add a new question.
task('addQuestions')
  .addPositionalParam('address', 'contract address')
  .addPositionalParam('questionsFile', 'file containing questions in JSON format')
  .setAction(async (args, hre) => {
    await hre.run('compile');

    let quiz = await hre.ethers.getContractAt('Quiz', args.address);
    const questions = JSON.parse(await fs.readFile(args.questionsFile,'utf8'));
    for (var i=0; i<questions.length; i++) {
      const tx = await quiz.addQuestion(questions[i].question, questions[i].choices);
      const receipt = await tx.wait();
      console.log(`Added question ${questions[i].question}. Transaction hash: ${receipt!.hash}`);
    }
  });

// Add a new question.
task('addCoupons')
  .addPositionalParam('address', 'contract address')
  .addPositionalParam('couponsFile', 'file containing coupons, one per line')
  .setAction(async (args, hre) => {
    await hre.run('compile');

    let quiz = await hre.ethers.getContractAt('Quiz', args.address);
    const coupons = (await fs.readFile(args.couponsFile,'utf8')).split("\n");
    // Trim last empty line.
    if (coupons[coupons.length-1]=="") {
      coupons.pop();
    }
    for (var i=0; i<coupons.length; i+=20) {
      let cs = coupons.slice(i, i+20);
      const tx = await quiz.addCoupons(cs);
      const receipt = await tx.wait();
      console.log(`Added coupons: ${coupons.slice(i, i+20)}. Transaction hash: ${receipt!.hash}`);
    }
  });

// Add a new question.
task('setReward')
  .addPositionalParam('address', 'contract address')
  .addPositionalParam('reward', 'reward in ROSE')
  .setAction(async (args, hre) => {
    await hre.run('compile');

    let quiz = await hre.ethers.getContractAt('Quiz', args.address);
    const tx = await quiz.setReward(hre.ethers.parseEther(args.reward));
    const receipt = await tx.wait();
    console.log(`Successfully set reward to ${args.reward} ROSE. Transaction hash: ${receipt!.hash}`);
  });

// Add a new question.
task('fund')
  .addPositionalParam('address', 'contract address')
  .addPositionalParam('amount', 'reclaim funds to this address')
  .setAction(async (args, hre) => {
    await hre.run('compile');

    let quiz = await hre.ethers.getContractAt('Quiz', args.address);
    const tx = await (await hre.ethers.getSigners())[0].sendTransaction({
      from: (await hre.ethers.getSigners())[0].address,
      to: await quiz.getAddress(),
      value: hre.ethers.parseEther(args.amount),
    });
    const receipt = await tx.wait();
    console.log(`Successfully funded ${await quiz.getAddress()} with ${args.amount} ROSE. Transaction hash: ${receipt!.hash}`);
  });

// Add a new question.
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

// Add a new question.
task('setGaslessKeyPair')
  .addPositionalParam('address', 'contract address')
  .addPositionalParam('payerAddress', 'payer address')
  .addPositionalParam('payerSecret', 'payer secret key')
  .setAction(async (args, hre) => {
    await hre.run('compile');

    let quiz = await hre.ethers.getContractAt('Quiz', args.address);

    const nonce = await hre.ethers.provider.getTransactionCount(args.payerAddress);
    const tx = await quiz.setGaslessKeyPair(args.payerAddress, args.payerSecret, nonce);
    const receipt = await tx.wait();
    console.log(`Successfully set gasless keypair to ${args.payerAddress}, secret ${args.payerSecret} and nonce ${nonce}. Transaction hash: ${receipt!.hash}`);
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
