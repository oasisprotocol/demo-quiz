import { expect } from "chai";
import { ethers } from "hardhat";
import { Quiz, Quiz__factory } from "../typechain-types";
import {deployQuiz, addQuestions, addOneQuestion, addCoupons, setGaslessKeypair, setReward} from "./Quiz";

async function deployNFT() {
    const Reward_factory = await ethers.getContractFactory("OasisReward");
    const oasisReward = await Reward_factory.deploy("Oasis Reward", "OASIS",
        {
            gasLimit: 10_000_000, // https://github.com/oasisprotocol/sapphire-paratime/issues/319
        }
    );
    await oasisReward.waitForDeployment();
    return { oasisReward };
}

export {deployNFT};


describe("OasisRewards", function () {
    let owner;
    let addr1;

    it("Should generate base64 NFT successfully", async function () {
        const { oasisReward } = await deployNFT();
        [owner, addr1] = await ethers.getSigners();
        await oasisReward.addAllowMint(owner.address);

        // Compare the generated SVG base64 images
        const svg = '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="50" fill="red" /></svg>';
        const base64EncodedSVG_test = Buffer.from(svg).toString('base64');

        const base64EncodedSVG = await oasisReward.generateComplexSVG(1);
        expect(base64EncodedSVG.replace("data:image/svg+xml;base64,", "")).to.equal(base64EncodedSVG_test.replace("data:image/svg+xml;base64,", ""));
    });

    it("Should mint NFT successfully", async function () {
        [owner, addr1] = await ethers.getSigners();
        const { oasisReward } = await deployNFT();
        
        await oasisReward.addAllowMint(owner.address);
        const base64EncodedSVG = await oasisReward.generateComplexSVG(1);

        await oasisReward.mint(addr1.address, base64EncodedSVG);
        expect(await oasisReward.totalSupply()).to.equal(BigInt(1));
    });

    it("Should mint from whitelisted quiz", async function () {
        if ((await ethers.provider.getNetwork()).chainId != BigInt(0x5afd)) { // Requires Sapphire precompiles.
            this.skip();
          }
        [owner, addr1] = await ethers.getSigners();
        const { oasisReward } = await deployNFT();
        const { quiz } = await deployQuiz();
        await oasisReward.addAllowMint(quiz.getAddress());

        await addOneQuestion(quiz);
        await addCoupons(quiz);
        await setReward(quiz);
        console.log("Balance: ", await oasisReward.balanceOf(addr1.address));
        
        // Get encoded certificate
        const [_correctVector, encPc] = await quiz.checkAnswers("testCoupon1", [0], addr1.address);
        await quiz.setNft(oasisReward.getAddress());
        // Claim reward
        const tx = await quiz.claimReward(encPc);
        console.log("Balance: ", await oasisReward.balanceOf(addr1.address));

        // Check if an NFT was minted to the addr1
        console.log(await oasisReward.getOwnedTokens(addr1.address));
        await expect((await oasisReward.getOwnedTokens(addr1.address)).length).to.equal(1);
    });


    it("Should mint from whitelisted quiz using gasless tx", async function () {
        if ((await ethers.provider.getNetwork()).chainId != BigInt(0x5afd)) { // Requires Sapphire precompiles.
            this.skip();
        }
        [owner, addr1] = await ethers.getSigners();
        const { oasisReward } = await deployNFT();
        const { quiz } = await deployQuiz();
        await oasisReward.mint(addr1.address, "");
        await expect(oasisReward.mint(addr1.address, "")).to.be.reverted; //revertedWith("Token URI not set");
        
        await oasisReward.addAllowMint(owner.address);
        const svg = await oasisReward.generateComplexSVG(1);
        await oasisReward.removeAllowMint(owner.address);

        await expect(oasisReward.mint(addr1.address, svg))
            .to.be.reverted; //revertedWith("Address not allowed");
        
        await oasisReward.addAllowMint(quiz.getAddress());
        await oasisReward.addAllowMint(owner.address);
        await oasisReward.addAllowMint("0xDce075E1C39b1ae0b75D554558b6451A226ffe00");
        await addOneQuestion(quiz);
        await addCoupons(quiz);
        await setReward(quiz);
        // Hardhat account addr1 private key not available so transfer to hardcoded keypair
        await addr1.sendTransaction({to: "0xDce075E1C39b1ae0b75D554558b6451A226ffe00", value: ethers.parseEther("10.0")});
        await addr1.sendTransaction({to: quiz.getAddress(), value: ethers.parseEther("20.0")});

        await setGaslessKeypair(quiz);
        
        await quiz.setNft(oasisReward.getAddress());
        const [_correctVector, tx] = await quiz.checkAnswers("testCoupon1", [0], "0xDce075E1C39b1ae0b75D554558b6451A226ffe00");

        const receipt = await (await ethers.provider.broadcastTransaction(tx)).wait();
        expect(receipt).to.not.equal(null);
        expect(receipt!.status).to.be.equal(1);

        console.log("Balance: ", await oasisReward.balanceOf("0xDce075E1C39b1ae0b75D554558b6451A226ffe00"));
        await expect((await oasisReward.getOwnedTokens("0xDce075E1C39b1ae0b75D554558b6451A226ffe00")).length).to.equal(1);
        // const [_correctVector, encPc] = await quiz.checkAnswers("testCoupon1", [0], addr1.address);


    }).timeout(200000);
});