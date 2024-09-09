import type { ComputedRef } from "vue";
import { computed } from "vue";

import { type Quiz, Quiz__factory } from "@oasisprotocol/demo-quiz-backend";
export type { Quiz } from "@oasisprotocol/demo-quiz-backend";
import {
  type NftReward,
  NftReward__factory,
} from "@oasisprotocol/demo-quiz-backend";
export type { NftReward } from "@oasisprotocol/demo-quiz-backend";

import { useEthereumStore } from "./stores/ethereum";

export const addr = import.meta.env.VITE_QUIZ_ADDR!;

// export const nftAddress = computed(() => import.meta.env.VITE_NFT_ADDR);

export function useQuiz(): ComputedRef<Quiz | null> {
  const eth = useEthereumStore();

  return computed(() => {
    if (!eth) {
      console.error("[useQuiz] Ethereum Store not initialized");
      return null;
    }

    return Quiz__factory.connect(addr, eth.provider);
  });
}

export function useNFT(addrNFT: string): ComputedRef<NftReward | null> {
  const eth = useEthereumStore();

  return computed(() => {
    if (!eth) {
      console.error("[useQuiz] Ethereum Store not initialized");
      return null;
    }

    const quiz = useQuiz();
    return NftReward__factory.connect(addrNFT, eth.provider);
  });
}
