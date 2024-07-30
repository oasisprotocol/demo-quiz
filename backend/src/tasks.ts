import { promises } from 'fs';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';
import axios from 'axios';

import '@nomicfoundation/hardhat-ethers';
import '@oasisprotocol/sapphire-hardhat';
import '@typechain/hardhat';
import canonicalize from 'canonicalize';
import { JsonRpcProvider } from "ethers";
import 'hardhat-watcher';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import { HardhatUserConfig, task } from 'hardhat/config';
import 'solidity-coverage';

import {
    storeNFT, fundContract, fundGaslessAccount, setGaslessKeyPair,
    deployContract, addQuestions, setNativeReward, addCoupons,
    addAllowMint, setNftAddress, loadYamlConfig, removeAllowMint
} from './helpers';


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
        promises.mkdir(outDir, { recursive: true }),
    ]);

    await Promise.all(
        artifactNames.map(async (fqn) => {
            const { abi, contractName, sourceName } = await hre.artifacts.readArtifact(fqn);
            if (abi.length === 0 || !sourceName.startsWith(srcDir) || contractName.endsWith('Test'))
                return;
            await promises.writeFile(`${path.join(outDir, contractName)}.json`, `${canonicalize(abi)}\n`);
        }),
    );
});

// Deploy the Quiz.
task('deployQuiz')
    .setAction(async (_, hre) => {
        await hre.run('compile');

        const quiz = await deployContract(hre, await hre.ethers.getSigners(), 'Quiz');
        return (await quiz.getAddress());
    });

// Deploy the NftReward contract.
task('deployNftReward')
    .addParam("name", "Name of NFT")
    .addParam("symbol", "Symbol for NFT token")
    .setAction(async (args, hre) => {
        await hre.run('compile');

        const nftReward = await deployContract(hre, await hre.ethers.getSigners(), 'NftReward', args.name, args.symbol);
        return (await nftReward.getAddress());
    });

// Set the NFT address in the Quiz contract.
task("setNftAddress", "Sets the NFT contract address in the Quiz contract")
    .addParam("address", "The address of the deployed Quiz contract")
    .addParam("nftAddress", "The address of the NFT contract to set")
    .setAction(async (args, hre) => {
        const quiz = await hre.ethers.getContractAt('Quiz', args.address);
        await setNftAddress(hre, quiz, args.nftAddress);
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
        for (let i = 0; i < coupons.length; i++) {
            if (couponStatus[i] == await quiz.COUPON_VALID()) {
                validCoupons.push(coupons[i]);
            } else if (couponStatus[i] == await quiz.COUPON_REMOVED()) {
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
        console.log(`Spent coupons (${spentCoupons.size}/${coupons.length}): ${spentCouponsStr.slice(0, spentCouponsStr.length - 1)}`);
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
        const questions = await quiz.getQuestions("testCoupon1");
        console.log(`Questions (counting from 0):`);
        for (let i = 0; i < questions.length; i++) {
            console.log(`  ${i}. ${questions[i].question}`);
            for (let j = 0; j < questions[i].choices.length; j++) {
                console.log(`     ${String.fromCharCode(97 + j)}) ${questions[i].choices[j]}`);
            }
        }

        // Coupons.
        try {
            const coupons = await quiz.countCoupons();
            console.log(`Coupons Available/All: ${coupons[0]}/${coupons[1]}`)
        } catch (_) {
        }

        console.log(`Reward (in native token): ${hre.ethers.formatEther(await quiz.payoutReward())} ROSE`)
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
        const questions = JSON.parse(await promises.readFile(args.questionsFile, 'utf8'));
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

// Fetch image from IPFS.
task('storeNft')
    .addPositionalParam('quiz', 'Quiz contract')
    .addPositionalParam('jsonFile', 'Path to JSON metadata file')
    .setAction(async (args, hre) => {
        const quiz = await hre.ethers.getContractAt('Quiz', args.quiz);
        const jsonMetadata = await promises.readFile(args.jsonFile, 'utf8');
        await storeNFT(hre, quiz, jsonMetadata);
    });

// Add minter address, usually only allowed for Quiz contract.
task('addAllowMint')
    .addPositionalParam('rewardContract', 'Reward contract to update')
    .addPositionalParam('minterAddress', 'Grant Mint access to this sender address')
    .setAction(async (args, hre) => {
        const nftReward = await hre.ethers.getContractAt('NftReward', args.rewardContract);
        await addAllowMint(hre, nftReward, args.minterAddress);
    });

// Add minter address, usually only allowed for Quiz contract.
task('removeAllowMint')
    .addPositionalParam('rewardContract', 'Reward contract to update')
    .addPositionalParam('minterAddress', 'Grant Mint access to this sender address')
    .setAction(async (args, hre) => {
        const nftReward = await hre.ethers.getContractAt('NftReward', args.rewardContract);
        await removeAllowMint(hre, nftReward, args.minterAddress);
    });

// Set reward amount in native token.
task('setNativeReward')
    .addPositionalParam('address', 'contract address')
    .addPositionalParam('reward', 'reward in ROSE')
    .setAction(async (args, hre) => {
        const quiz = await hre.ethers.getContractAt('Quiz', args.address);
        await setNativeReward(hre, quiz, args.reward);
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

// Fetch image from IPFS.
task('fetchImageFromIpfs')
    .addPositionalParam('ipfsHash', 'IPFS hash of the image')
    .addPositionalParam('outputPath', 'Path to save the fetched image')
    .setAction(async (args, hre) => {
        try {
            const response = await axios.get(`https://ipfs.io/ipfs/${args.ipfsHash}`, {
                responseType: 'arraybuffer'
            });

            fs.writeFileSync(args.outputPath, Buffer.from(response.data));
            console.log(`Image fetched from IPFS and saved to ${args.outputPath}`);
        } catch (error) {
            console.error('Error fetching image from IPFS:', error);
        }
    });

task('deployAndSetup')
    .addPositionalParam('configFile', 'Quiz configuration filename',  'test-config.yaml')
    .setAction(async (args, hre) => {
        await hre.run('compile');

        // Load default configuration from YAML file
        // const defaultConfig = await loadYamlConfig(path.resolve(__dirname, args.configFile));
        const cfg = await loadYamlConfig(args.configFile);

        console.log(`Questions File: ${cfg.questionsFile}`);
        console.log(`Coupons File: ${cfg.couponsFile}`);
        console.log(`Reward: ${cfg.nativeReward}`);
        console.log(`Fund Amount: ${cfg.fundAmount}`);
        console.log(`Metadata file path: ${cfg.nftReward.metadataFile}`);
        console.log(`Fund gasless amount: ${cfg.fundGaslessAmount}`);
        console.log(`Gasless Address: ${cfg.gaslessAddress}`);
        console.log(`Gasless Secret: ${cfg.gaslessSecret}`);


        const quiz = await hre.run("deployQuiz");
        await hre.run("addQuestions", { address: quiz, questionsFile: cfg.questionsFile })
        await hre.run("addCoupons", { address: quiz, couponsFile: cfg.couponsFile })
        
        if (cfg.fundAmount)
        {
            await hre.run("fund", { address: quiz, amount: cfg.fundAmount });
        }

        // Update the contract state if reward > 0
        if (cfg.nativeReward && hre.ethers.parseEther(cfg.nativeReward) > BigInt(0)) {
            await hre.run("setNativeReward", { address: quiz, reward: cfg.nativeReward });
        }
        // Set gasless key pair if provided
        if (cfg.gaslessAddress && cfg.gaslessSecret) {
            await hre.run("setGaslessKeyPair", { address: quiz, payerAddress: cfg.gaslessAddress, payerSecret: cfg.gaslessSecret });
            if (cfg.fundGaslessAmount)
            {
                await hre.run("fund", { address: cfg.gaslessAddress, amount: cfg.fundGaslessAmount });
            }
            
        }

        if (cfg.nftReward) {
            let nftReward;
            if (cfg.nftReward.address) {
                nftReward = await hre.ethers.getContractAt('NftReward', cfg.nftReward.address);
            }
            else{
                nftReward = await hre.run("deployNftReward", {name: cfg.nftReward.name, symbol: cfg.nftReward.symbol })
            }
            await hre.run("setNftAddress", { address: quiz, nftAddress: nftReward })
            await hre.run("addAllowMint", { rewardContract: nftReward, minterAddress: quiz })
            await hre.run("storeNft", {quiz: quiz, jsonFile: cfg.nftReward.metadataFile })

        }
    });

