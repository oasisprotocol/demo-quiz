<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useQuiz } from "../contracts";
import { useEthereumStore } from "../stores/ethereum";
import AppButton from "@/components/AppButton.vue";

const { t } = useI18n();
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
      class="text-white text-center font-['Roboto_Mono'] text-2xl md:text-3xl mb-5 leading-snug max-w-md m-auto tracking-wider"
    >
      {{ $t("greeting") }}
    </h1>
    <p class="text-white text-center mb-7" v-html="t('quiz_intro')"></p>
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
        {{ $t("enter_coupon") }}
        <span class="text-red-500">*</span>
      </label>
    </div>

    <RouterLink
      :to="{ name: 'quiz', params: { coupon: quizCoupon } }"
      class="flex no-underline"
    >
      <AppButton
        variant="primary"
        class="m-auto hover:text-white hover:bg-primaryRoyal hover:border-white"
        >{{ $t("confirm") }}</AppButton
      >
    </RouterLink>

    <p
      class="text-white mt-5 mb-20"
      v-if="isReward"
      v-html="t('reward_note')"
    ></p>
  </section>
</template>

<style scoped lang="postcss"></style>
