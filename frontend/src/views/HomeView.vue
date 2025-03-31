<script setup lang="ts">
import { onMounted, ref } from "vue";

import { useQuiz } from "../contracts";
import { useEthereumStore } from "../stores/ethereum";
import AppButton from "@/components/AppButton.vue";

const eth = useEthereumStore();
const quiz = useQuiz();

const errors = ref<string[]>([]);
const quizCoupon = ref<string>("");
const isReward = ref<Boolean>(false);
const author = ref("");
const isLoading = ref(true);

function handleError(error: Error, errorMessage: string) {
  errors.value.push(
    `${errorMessage}: ${error.message ?? JSON.stringify(error)}`
  );
  console.error(error);
}

onMounted(async () => {
  isReward.value = Boolean((await quiz.value!.payoutReward()) > 0);
});
</script>

<template>
  <section>
    <h1
      class="text-white text-center font-['Azeret_Mono'] text-2xl md:text-3xl mb-5 leading-snug max-w-md m-auto"
    >
      Welcome to the Oasis blockchain quiz!🌹
    </h1>
    <p class="text-white text-center mb-7">
      You probably know everything about the bitcoin and the Ethereum
      blockchains, but there are also other chains out there such as the
      <a href="https://oasisprotocol.org" target="_blank">Oasis Network</a>! ⛓
      This quiz runs on Oasis Sapphire inside a
      <b>confidential smart contract</b>, and verifies your answers completely
      on-chain. 🔒
    </p>
    <div class="form-group">
      <input
        type="text"
        id="couponText"
        class="peer"
        placeholder=" "
        v-model="quizCoupon"
        required
      />

      <label
        for="couponText"
        class="peer-focus:text-primaryDark peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-8 peer-focus:text-white"
      >
        Enter your coupon:
        <span class="text-red-500">*</span>
      </label>
    </div>

    <RouterLink
      :to="{ name: 'quiz', params: { coupon: quizCoupon } }"
      class="flex no-underline"
    >
      <AppButton variant="primary" class="m-auto hover:text-white hover:bg-primaryRoyal hover:border-white">Confirm</AppButton>
    </RouterLink>

    <p class="text-white mt-5 mb-20" v-if="isReward">
      When you solve the quiz, you will receive a <b>1 ROSE</b> reward! You can
      use the tokens to
      <a href="https://docs.oasis.io/dapp/sapphire/quickstart" target="_blank"
        >develop a dApp</a
      >
      🔨 and deploy it on the sapphire-testnet. If you don't have an idea for
      your dApp, perhaps you will find an inspiration by checking out our
      <a href="https://playground.oasis.io/" target="_blank">playground</a
      >.💡<br /><br />
      Of course, you can also exchange it for other tokens on a
      <a href="https://illuminex.xyz" target="_blank">DEX</a>. Maybe get you and
      your friends a <s>beer</s> hot chocolate in the nearby
      <a href="https://map.bitcoin.com/" target="_blank">crypto pub</a>? ☕ Or
      you can just hodl your tokens and maybe their value will surge. 🤑<br /><br />

      In either case, join us on
      <a href="https://oasis.io/discord" target="_blank">Discord</a>. You will
      find a lot of interesting answers there. Good luck!😉
    </p>
  </section>
</template>

<style scoped lang="postcss"></style>
