<script setup lang="ts">
import { ethers } from "ethers";
import { onMounted, ref } from "vue";

import { useQuiz, useNFT, addrNFT } from "../contracts";
import { useEthereumStore } from "../stores/ethereum";
import AppButton from "@/components/AppButton.vue";
import SuccessInfo from "@/components/SuccessInfo.vue";
import CheckedIcon from "@/components/CheckedIcon.vue";
import UncheckedIcon from "@/components/UncheckedIcon.vue";
import QuizDetailsLoader from "@/components/QuizDetailsLoader.vue";
// import { token } from "@oasisprotocol/demo-quiz-backend/lib/cjs/typechain-types/@openzeppelin/contracts";

const props = defineProps<{ coupon: string }>();

const quiz = useQuiz();
const nft = useNFT();
const eth = useEthereumStore();

const errors = ref<string[]>([]);
const isLoading = ref(false);
const isCheckingAnswers = ref<Boolean>(false);
const isClaimingReward = ref<Boolean>(false);
const questions = ref<Question[]>([]);
const selectedChoices = ref<bigint[]>([]);
const allQuestionsAnswered = ref<Boolean>(false);
const correctVector = ref<boolean[]>([]);
const address = ref("");
const isSpinning = ref(false);

const couponValid = ref<Boolean>(false);
const answersChecked = ref<Boolean>(false);
const answersCorrect = ref<Boolean>(false);
const isReward = ref<Boolean>(false);
const rewardClaimed = ref<Boolean>(false);
const userImages = ref<string[]>([]);
const tokenId = ref<string>("");

interface Questions {
  questions: Question[];
}

interface Question {
  question: string;
  choices: string[];
}

function handleError(error: Error, errorMessage: string) {
  errors.value = Array();
  errors.value.push(`${errorMessage}`);
  console.error(error);
}

async function onChoiceClick(qId: number, choiceId: number): Promise<void> {
  selectedChoices.value[qId] = BigInt(choiceId);

  let allAns = true;
  for (let i = 0; i < selectedChoices.value.length; i++) {
    if (selectedChoices.value[i] === undefined) {
      allAns = false;
      break;
    }
  }
  allQuestionsAnswered.value = allAns;
}

async function doCheckAnswers(): Promise<void> {
  const [cv, gaslessTx] = await quiz.value!.checkAnswers(
    props.coupon,
    selectedChoices.value,
    ethers.ZeroAddress
  );
  let allCorrect = true;
  for (let i = 0; i < cv.length; i++) {
    if (!cv[i]) {
      allCorrect = false;
      break;
    }
  }
  answersChecked.value = true;
  answersCorrect.value = allCorrect;
  correctVector.value = cv;
}

async function fetchQuestions(): Promise<void> {
  try {
    isLoading.value = true;
    questions.value = await quiz.value!.getQuestions(props.coupon);
    isReward.value = await quiz.value!.isReward();
    selectedChoices.value = Array(questions.value.length); // prepare an array of undefined values until the answer is selected.
    couponValid.value = true;
  } catch (e) {
    handleError(e as Error, "Coupon not valid");
  } finally {
    isLoading.value = false;
  }
}

async function fetchImages(): Promise<void> {
  try {
    console.log(address.value);
    isLoading.value = true;
    console.log("Debug: Fetching images");
    const tokens = await nft.value!.getOwnedTokens(address.value);
    console.log(tokens);
    for (let i = 0; i < tokens.length; i++) {
      console.log(tokens[i]);
      userImages.value.push(await nft.value!.tokenURI(tokens[i]));
    }
  } catch (e) {
    handleError(e as Error, "Image not valid");
  } finally {
    isLoading.value = false;
  }
}

async function claimReward(e: Event): Promise<void> {
  if (e.target instanceof HTMLFormElement) {
    e.target.checkValidity();
    if (!e.target.reportValidity()) return;
  }
  console.log("Debug: Claiming reward");
  e.preventDefault();

  const TIMEOUT_LIMIT = 100;
  let timeout = 0;
  while (!rewardClaimed.value && timeout < TIMEOUT_LIMIT) {
    try {
      isClaimingReward.value = true;
      console.log(address.value);
      let receipt;
      const gaslessKeyPair = await quiz.value!.getGaslessKeyPair();
      const [cv, gaslessTx] = await quiz.value!.checkAnswers(
        props.coupon,
        selectedChoices.value,
        ethers.getAddress(address.value)
      );
      console.log(gaslessTx);
      // If gasless KeyPair is set, checkAnswers will return gaslessTx
      if (gaslessKeyPair[0] !== ethers.ZeroAddress) {
        console.log(cv);
        console.log(gaslessTx);
        receipt = await (
          await eth.provider.broadcastTransaction(gaslessTx)
        ).wait(); // gasless version
        console.log("Transaction confirmed");
        rewardClaimed.value = true;
        tokenId.value = (
          (await nft.value!.totalSupply()) - BigInt(1)
        ).toString();
      } else {
        console.log("Requesting account access");
        // Check the network chain ID
        const chainId = await window.ethereum.request({
          method: "eth_chainId",
        });
        const expectedChainId = import.meta.env.VITE_NETWORK!;
        const rpcUrl = import.meta.env.VITE_WEB3_GATEWAY!;

        if (chainId !== expectedChainId) {
          // Request network change
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: expectedChainId,
                rpcUrls: [rpcUrl],
                chainName: "Oasis Sapphire",
                nativeCurrency: {
                  name: "ROSE",
                  symbol: "ROSE",
                  decimals: 18,
                },
              },
            ],
          });
        }
        // Request MetaMask account access
        await window.ethereum.request({ method: "eth_requestAccounts" });
        console.log("MetaMask is connected and on the correct network");
        // Create a provider and signer
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        const quizWithSigner = quiz.value!.connect(signer);

        try {
          // Send the transaction
          const tx_hash = await quizWithSigner.claimReward(gaslessTx);
          console.log("Transaction sent:", tx_hash);
          await tx_hash.wait();
          console.log("Transaction confirmed");
          rewardClaimed.value = true;
          tokenId.value = (
            (await nft.value!.totalSupply()) - BigInt(1)
          ).toString();
        } catch (error) {
          console.error(
            "User denied transaction signature or error occurred:",
            error
          );
          return;
        }
      }
    } catch (e: any) {
      if (++timeout == TIMEOUT_LIMIT) {
        handleError(e, "Error while claiming the reward");
      }
    }
  }
  await fetchImages();
  isClaimingReward.value = false;
}

async function checkAnswers(e: Event): Promise<void> {
  e.preventDefault();
  try {
    isCheckingAnswers.value = true;
    await doCheckAnswers();
  } catch (e: any) {
    handleError(e.reason, e.message);
  } finally {
    isCheckingAnswers.value = false;
  }
}

const addNFTToMetaMask = async () => {
  try {
    isClaimingReward.value = true;

    if (typeof window.ethereum !== "undefined") {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const imageUrl = userImages.value[userImages.value.length - 1];

      await window.ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC721",
          options: {
            address: addrNFT,
            tokenId: tokenId.value,
            image: imageUrl,
          },
        },
      });

      console.log("NFT added to MetaMask successfully");
    } else {
      console.error("MetaMask is not installed");
    }
  } catch (error) {
    console.error("Error adding NFT to MetaMask:", error);
  } finally {
    isClaimingReward.value = false;
  }
};

onMounted(async () => {
  await fetchQuestions();
});
</script>
<template>
  <div v-if="errors.length > 0" class="text-red-500 px-3 mt-5 rounded-xl-sm">
    <span class="font-bold">Error:</span>
    <div v-for="error in errors" :key="error">{{ error }}</div>
  </div>
  <section v-if="couponValid && !answersCorrect">
    <div v-if="questions">
      <form @submit="checkAnswers">
        <fieldset
          class="mb-5"
          v-for="[qId, question] in Object.entries(questions)"
          :key="qId"
        >
          <p style="cursor: default" class="text-white text-base mb-5">
            {{ parseInt(qId) + 1 }}. {{ question.question }}
            <span v-if="answersChecked">
              <span v-if="correctVector[parseInt(qId)]">✅</span>
              <span v-if="!correctVector[parseInt(qId)]">❌</span>
            </span>
          </p>
          <AppButton
            v-for="(choice, choiceId) in question.choices"
            :key="choiceId"
            :class="{
              selected: selectedChoices[parseInt(qId)] === BigInt(choiceId),
              'pointer-events-none': isLoading,
            }"
            class="choice-btn mb-2 w-full"
            variant="choice"
            @click="onChoiceClick(parseInt(qId), choiceId)"
          >
            <span class="flex gap-2">
              <div class="align-middle">
                <CheckedIcon
                  v-if="selectedChoices[parseInt(qId)] === BigInt(choiceId)"
                />
                <UncheckedIcon v-else />
              </div>
              <span class="leading-6 normal-case text-left">{{ choice }}</span>
            </span>
          </AppButton>
        </fieldset>

        <div
          v-if="errors.length > 0"
          class="text-red-500 px-3 mt-5 rounded-xl-sm"
        >
          <span class="font-bold">Error:</span>
          <div v-for="error in errors" :key="error">{{ error }}</div>
        </div>
        <div class="flex justify-between items-start mt-6 mb-20">
          <AppButton
            type="submit"
            variant="primary"
            :disabled="isLoading || !allQuestionsAnswered"
            @click="checkAnswers"
          >
            <span v-if="isCheckingAnswers">Checking answers…</span>
            <span v-else>Check my answers</span>
          </AppButton>
        </div>
      </form>
    </div>

    <QuizDetailsLoader v-else />
  </section>
  <section class="pt-5" v-if="answersCorrect && !rewardClaimed">
    <SuccessInfo>
      <h2 class="text-2xl text-white text-base mb-5 mt-10">
        You Solved the Quiz!
      </h2>
    </SuccessInfo>

    <section v-if="isReward">
      <p class="text-white text-base mb-5 mt-10">
        To claim the reward, enter your account address below. You will receive
        ROSE on the
        <a
          href="https://docs.oasis.io/dapp/sapphire/#chain-information"
          target="_blank"
          >Oasis Sapphire Mainnet</a
        >
        chain.
      </p>
      <form @submit="claimReward">
        <div class="form-group">
          <input
            type="text"
            id="addressText"
            class="peer"
            placeholder=" "
            v-model="address"
            pattern="^(0x)?[0-9a-fA-F]{40}$"
            required
          />
          <label
            for="addressText"
            class="peer-focus:text-primaryDark peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-5"
          >
            Your address (0x...):
            <span class="text-red-500">*</span>
          </label>
        </div>
        <AppButton
          class="mb-20 no-capitalize"
          type="submit"
          variant="primary"
          :disabled="isClaimingReward"
        >
          <span class="normal-case" v-if="isClaimingReward"
            >Generating transaction and sending reward…</span
          >
          <span class="normal-case" v-else>Claim your reward</span>
        </AppButton>
      </form>
    </section>
  </section>
  <section v-if="rewardClaimed">
    <SuccessInfo class="mb-20">
      <h2 class="text-white text-3xl mb-10">
        Congratulations, you won an NFT!:
      </h2>
      <div class="featured-container">
        <img
          v-if="userImages.length > 0"
          :src="userImages[userImages.length - 1]"
          :key="userImages[userImages.length - 1]"
          alt="Featured Reward Image"
          class="featured-image"
        />
      </div>
      <!-- <div class="grid-container"> 
          <img
            v-for="(image, index) in userImages.slice(0, -1)"
            :src="image"
            :key="image"
            alt="Reward Image"
            class="grid-image"
          />
      </div> -->
      <h3 class="text-white text-3xl mb-10">Reward claimed!</h3>
      <p class="text-white">
        Token ID: <strong>{{ tokenId }}</strong>
      </p>
      <p class="text-white mb-10">
        NFT Contract Address: <strong>{{ addrNFT }}</strong>
      </p>
      <AppButton
        class="mb-20 no-capitalize"
        type="submit"
        variant="primary"
        :disabled="isClaimingReward"
        @click="addNFTToMetaMask"
      >
        <span class="normal-case" v-if="isClaimingReward"
          >Adding NFT to MetaMask...</span
        >
        <span class="normal-case" v-else>Add reward to wallet</span>
      </AppButton>
      <p class="text-white">
        Check out our
        <a href="https://docs.oasis.io/dapp/sapphire/quickstart" target="_blank"
          >Oasis Sapphire quickstart</a
        >
        and start building!
      </p>
      <p class="text-white">
        If you need help, contact us on the Oasis
        <a href="https://oasis.io/discord" target="_blank"
          >#dev-central Discord channel</a
        >.
      </p>
    </SuccessInfo>
  </section>
</template>

<style lang="postcss" scoped>
.error {
  @apply text-red-500;
}
</style>
