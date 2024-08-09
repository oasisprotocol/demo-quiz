import type { ComputedRef } from "vue";
import { computed } from "vue";

import { type Quiz, Quiz__factory } from "@oasisprotocol/demo-quiz-backend";
export type { Quiz } from "@oasisprotocol/demo-quiz-backend";
import {
  type OasisReward,
  OasisReward__factory,
} from "@oasisprotocol/demo-quiz-backend";
export type { OasisReward } from "@oasisprotocol/demo-quiz-backend";

import { useEthereumStore } from "./stores/ethereum";

export const addr = import.meta.env.VITE_QUIZ_ADDR!;
export const addrNFT = import.meta.env.VITE_NFT_ADDR!;

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

export function useNFT(): ComputedRef<OasisReward | null> {
  const eth = useEthereumStore();

  return computed(() => {
    if (!eth) {
      console.error("[useQuiz] Ethereum Store not initialized");
      return null;
    }

    return OasisReward__factory.connect(addrNFT, eth.provider);
  });
}
