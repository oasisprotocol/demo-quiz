import { expect } from "chai";
import { ethers } from "hardhat";
import { Quiz, Quiz__factory } from "../typechain-types";
import {
  deployQuiz,
  addQuestions,
  addOneQuestion,
  addCoupons,
  setGaslessKeypair,
  setReward,
} from "./Quiz";
import { decodeBytes32String, encodeBytes32String } from "ethers";
import { randomBytes } from "crypto";
require("@nomicfoundation/hardhat-chai-matchers");

async function deployNFT() {
  const Reward_factory = await ethers.getContractFactory("NftReward");
  const nftReward = await Reward_factory.deploy("NFT Reward", "OASIS", {
    gasLimit: 10_000_000, // https://github.com/oasisprotocol/sapphire-paratime/issues/319
  });
  await nftReward.waitForDeployment();
  return { nftReward };
}

export { deployNFT };

describe("NftReward", function () {
  let owner;
  let addr1;

  it("Should mint NFT successfully", async function () {
    [owner, addr1] = await ethers.getSigners();
    const { nftReward } = await deployNFT();

    await nftReward.addAllowMint(owner.address);

    await nftReward.mint(addr1.address, ethers.encodeBytes32String("JSON"));
    expect(await nftReward.totalSupply()).to.equal(BigInt(1));
  });

  it("Should mint from whitelisted quiz", async function () {
    if ((await ethers.provider.getNetwork()).chainId != BigInt(0x5afd)) {
      // Requires Sapphire precompiles.
      this.skip();
    }
    [owner, addr1] = await ethers.getSigners();
    const { nftReward } = await deployNFT();
    const { quiz } = await deployQuiz();
    await nftReward.addAllowMint(quiz.getAddress());

    await addOneQuestion(quiz);
    await addCoupons(quiz);
    await setReward(quiz);
    console.log("Balance: ", await nftReward.balanceOf(addr1.address));

    // Get encoded certificate
    const [_correctVector, encPc] = await quiz.checkAnswers(
      "testCoupon1",
      [0],
      addr1.address
    );
    await quiz.setNftAddress(nftReward.getAddress());
    // Claim reward
    const tx = await quiz.claimReward(encPc);
    console.log("Balance: ", await nftReward.balanceOf(addr1.address));

    // Check if an NFT was minted to the addr1
    await expect(
      (
        await nftReward.getOwnedTokens(addr1.address)
      ).length
    ).to.equal(1);
  });

  it("Should mint from whitelisted quiz using gasless tx", async function () {
    if ((await ethers.provider.getNetwork()).chainId != BigInt(0x5afd)) {
      // Requires Sapphire precompiles.
      this.skip();
    }
    [owner, addr1] = await ethers.getSigners();
    const { nftReward } = await deployNFT();
    const { quiz } = await deployQuiz();
    await expect(nftReward.mint(addr1.address, 
      ethers.encodeBytes32String("JSON"))).to.be.reverted; 

    await nftReward.addAllowMint(owner.address);
    await nftReward.mint(addr1.address, ethers.encodeBytes32String("JSON"));
    await nftReward.removeAllowMint(owner.address);

    await expect(await nftReward.mint(addr1.address, 
      ethers.encodeBytes32String("JSON"))).to.be
      .reverted; //revertedWith("Address not allowed");

    await nftReward.addAllowMint(await quiz.getAddress());
    await nftReward.addAllowMint(owner.address);
    await nftReward.addAllowMint(
      "0xDce075E1C39b1ae0b75D554558b6451A226ffe00"
    );
    await addOneQuestion(quiz);
    await addCoupons(quiz);
    await setReward(quiz);
    // Hardhat account addr1 private key not available so transfer to hardcoded keypair
    await addr1.sendTransaction({
      to: "0xDce075E1C39b1ae0b75D554558b6451A226ffe00",
      value: ethers.parseEther("10.0"),
    });
    await addr1.sendTransaction({
      to: quiz.getAddress(),
      value: ethers.parseEther("20.0"),
    });

    await setGaslessKeypair(quiz);

    await quiz.setNftAddress(await nftReward.getAddress());
    const [_correctVector, tx] = await quiz.checkAnswers(
      "testCoupon1",
      [0],
      "0xDce075E1C39b1ae0b75D554558b6451A226ffe00"
    );

    const receipt = await (
      await ethers.provider.broadcastTransaction(tx)
    ).wait();
    expect(receipt).to.not.equal(null);
    expect(receipt!.status).to.be.equal(1);

    console.log(
      "Balance: ",
      await nftReward.balanceOf("0xDce075E1C39b1ae0b75D554558b6451A226ffe00")
    );
    await expect(
      (
        await nftReward.getOwnedTokens(
          "0xDce075E1C39b1ae0b75D554558b6451A226ffe00"
        )
      ).length
    ).to.equal(1);
    // const [_correctVector, encPc] = await quiz.checkAnswers("testCoupon1", [0], addr1.address);
  }).timeout(100000);
});
