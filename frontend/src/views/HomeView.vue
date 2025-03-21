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
  isReward.value = Boolean(await quiz.value!.payoutReward() > 0);
});
</script>

<template>
  <section>
    <p class="text-white">
      Dobrodošli na Oasisovem blockchain kvizu!🌹<br/><br/>
      Kviz je namenjen tekmovalcem ACM UPM, da spoznajo čudovito tehnologijo
      veriženja blokov (<i>blockchain</i>). ⛓ Verjetno ste že slišali za bitcoin in
      Ethereum, obstajajo pa tudi druge verige. Ena takih je
      <a href="https://oasisprotocol.org/sapphire" target="_blank">Oasis Sapphire</a>, ki omogoča
      <b>tajno izvajanje programov in šifrirano hrambo podatkov</b>. 🔒 Tudi ta kviz ima
      shranjena vsa vprašanja in odgovore izključno na blockchainu!<br/><br/>
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
        class="peer-focus:text-primaryDark peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-5"
      >
        Vnesite vaš kupon:
        <span class="text-red-500">*</span>
      </label>
    </div>

    <RouterLink :to="{ name: 'quiz', params: { coupon: quizCoupon } }">
      <AppButton variant="primary">Potrdi</AppButton>
    </RouterLink>

    <p class="text-white mt-5">
      Po uspešno opravljenem kvizu si lahko <a href="https://metamask.io/download/" target="_blank">ustvariš novo kriptodenarnico</a>,
      na katero boš prejel nagrado v znesku <b>100 ROSE</b> na omrežju
      <a href="https://docs.oasis.io/build/sapphire/network#rpc-endpoints" target="_blank">Oasis Sapphire</a>.<br/><br/>
      Svoj programerski talent nato lahko preizkusiš v
      <a href="https://docs.oasis.io/build/sapphire/quickstart" target="_blank">
      programiranju blockchain aplikacij (<i>dApps</i>)</a>, z dobljenimi
      žetončki pa aplikacijo tudi objaviš! 🔨 Morda najdeš
      navdih na našem igrišču <a href="https://playground.oasis.io/" target="_blank">Oasis Playground</a>.💡 <br/><br/>
      Lahko pa kovančke le "držiš" in upaš, da v prihodnosti zrastejo. 🤑 Morda
      jih zamenjaš za <a href="https://illuminex.xyz" target="_blank">druge kriptokovance</a>?
      Ali pa svoje prijatelje pogostiš s kakavom v bižnjem
      <a href="https://map.bitcoin.com/" target="_blank">kriptolokalu</a> ☕. Morda odideš
      <a href="https://www.tus.si/" target="_blank">po nakupih</a>? 🛒<br/><br/>
      Preden odhitiš reševat kviz, te vabimo, da se pridružiš skupnosti
      slovenskih Oasis razvijalcev na
      <a href="https://oasis.io/discord" target="_blank">Discord kanalu #slovenia 🇸🇮 </a>.
      Z veseljem ti bomo priskočili na pomoč. 🆘<br/><br/>
      Veliko sreče pri reševanju!
    </p>
  </section>
</template>

<style scoped lang="postcss"></style>
