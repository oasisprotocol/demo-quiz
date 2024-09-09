# Oasis Demo Quiz dApp

A confidential quiz dApp exposing the RNG to generate a random order of
questions per coupon with the reward payout for the ones who solve it.
Runs on Oasis Sapphire.

- `backend` contains the solidity contract, deployment and testing utils.
- `frontend` contains a Vue-based web application communicating with the
  backend smart contract.

This monorepo is set up for `pnpm`. Install dependencies by running:

```sh
pnpm install
```

## Backend

Move to the `backend` folder and build smart contracts:

```sh
pnpm build
```

Next, deploy the contract.

### Basic Local Hardhat Deployment

Start the hardhat node:

```sh
npx hardhat node
```

Deploy smart contracts to that local network:

```sh
npx hardhat deploy --network localhost
```

The deployed Quiz and NftReward addresses will be reported. Store them
inside the `frontend` folder's `.env.development`, for example:

```
VITE_QUIZ_ADDR=0x385cAE1F3afFC50097Ca33f639184f00856928Ff
```

### Deploying to Sapphire Localnet, Testnet and Mainnet

Prepare your hex-encoded private key and store it as an environment variable:

```shell
export PRIVATE_KEY=0x...
```

To deploy the Quiz and Reward contracts to the [Sapphire Localnet], Testnet or Mainnet, use the
following commands respectively:

```shell
npx hardhat deployQuiz --network sapphire-localnet
npx hardhat deployQuiz --network sapphire-testnet
npx hardhat deployQuiz --network sapphire
```

```shell
npx hardhat deployNftReward --network sapphire-localnet
npx hardhat deployNftReward --network sapphire-testnet
npx hardhat deployNftReward --network sapphire
```

[Sapphire Localnet]: https://github.com/oasisprotocol/oasis-web3-gateway/pkgs/container/sapphire-dev

### Once deployed

Checklist after deploying a production-ready quiz:

1. Push questions. Example:

   ```shell
   npx hardhat addQuestions 0x385cAE1F3afFC50097Ca33f639184f00856928Ff test-questions.json --network sapphire-testnet
   ```

2. Add coupons. Example:

   ```shell
    hardhat addCoupons 0x385cAE1F3afFC50097Ca33f639184f00856928Ff test-coupons.txt  --network sapphire-testnet
   ```

3. Set ROSE payout reward amount. Example:

   ```shell
   npx hardhat setReward 0x385cAE1F3afFC50097Ca33f639184f00856928Ff 2.0  --network sapphire-testnet
   ```

4. Set gasless kaypair. The current account nonce will be fetched and stored to
   the contract. Because of that, the provided account **must be used solely for
   gasless transactions by the deployed quiz contract**. Example:

   ```shell
   npx hardhat setGaslessKeyPair 0x385cAE1F3afFC50097Ca33f639184f00856928Ff 0xd8cA6E05FC1a466992D98f5f4FFC621ca95b7229 0xbf63c1e7982a80f424b5e8c355b7f11a0968bf44b1407c473aadb364b8c291d3  --network sapphire-testnet
   ```

5. Fund the contract and the gasless account. Example:

   ```shell
   npx hardhat fund 0x385cAE1F3afFC50097Ca33f639184f00856928Ff 100  --network sapphire-testnet # contract
   npx hardhat fund 0xd8cA6E05FC1a466992D98f5f4FFC621ca95b7229 10  --network sapphire-testnet # gasless account
   ```

6. Set NFT reward contract address and enable Mint from Quiz contract.

   ```shell
   npx hardhat setNftAddress 0x385cAE1F3afFC50097Ca33f639184f00856928Ff  0xB22C255250d74B0ADD1bfB936676D2a299BF48Bd --network sapphire-testnet
   npx hardhat storeNFT 0xd8cA6E05FC1a466992D98f5f4FFC621ca95b7229 'test/assets/images/metadata_inline.json'   --network sapphire-testnet
   ```

7. Check the quiz contract status, to make sure if everything is set. Example:

   ```shell
   npx hardhat status 0x385cAE1F3afFC50097Ca33f639184f00856928Ff --network sapphire-testnet
   ```

   You can also obtain details on spent coupons as follows (may take a while):

   ```shell
   npx hardhat getCoupons 0x385cAE1F3afFC50097Ca33f639184f00856928Ff --network sapphire-testnet
   ```

### Deploy and setup quiz with a single task

You can also setup and run the entire quiz in a single task.
`deployAndSetup` deploys and sets up the quiz and NFT reward.

```shell
npx hardhat deployAndSetup test-config.yaml --network sapphire-testnet

```

Check out other hardhat tasks that will help you manage the quiz:

```shell
npx hardhat help
```

### A note on tests:

When running tests on sapphire-localnet

```shell
npx hardhat test --network sapphire-localnet
```

avoid setting $PRIVATE_KEY environment variable, 
unless the address associated with this key is already funded on the network. 

### Additional tasks
1. Add single question.

```shell
npx hardhat addQuestion "My question?" 0x385cAE1F3afFC50097Ca33f639184f00856928Ff --network sapphire-testnet
```

2. Clear questions.

```shell
npx hardhat clearQuestions 0x385cAE1F3afFC50097Ca33f639184f00856928Ff --network sapphire-testnet
```

3. Reclaim funds from Quiz contract.

```shell
npx hardhat reclaimFunds 0x385cAE1F3afFC50097Ca33f639184f00856928Ff 0xC66AB83418C20A65C3f8e83B3d11c8C3a6097b6F --network sapphire-testnet
```

4. Fetch from Ipfs.

```shell
npx hardhat fetchImageFromIpfs Qmbr87zRx1uGM9fGYgHXRyq4EwSZ4jSaiXwQZC7ACpNcfW output.png
```

## Frontend

After you compiled the backend, updated `.env.development` with the
corresponding address and a chain ID, move to the `frontend` folder, compile
and Hot-Reload frontend for Development:

```sh
pnpm dev
```

Navigate to http://localhost:5173 with your browser to view your dApp. Some
browsers (e.g. Brave) may require https connection and a CA-signed certificate
to access the wallet. In this case, read the section below on how to properly
deploy your dApp.

You can use one of the deployed test accounts and associated private key with
MetaMask. If you use the same MetaMask accounts on fresh local networks such as
Hardhat Node, Foundry Anvil or sapphire-dev docker image, don't forget to
**clear your account's activity** each time or manually specify the correct
account nonce.

### Frontend Deployment

You can build assets for deployment by running:

```sh
pnpm build
```

`dist` folder will contain the generated HTML files that can be hosted.

#### Different Website Base

If you are running dApp on a non-root base dir, add

```
BASE_DIR=/my/public/path
```

to `.env.production` and bundle the app with

```
pnpm build-only --base=/my/public/path/
```

Then copy the `dist` folder to a place of your `/my/public/path` location.
