<script setup lang="ts">
import AppButton from "@/components/AppButton.vue";
import { useI18n } from "vue-i18n";
const { t } = useI18n();

function addSapphireToMetaMask() {
  if (!window.ethereum?.request) {
    return alert(
      "Have you installed MetaMask yet? If not, please do so.\n\nComputer: Once it is installed, you will be able to add the Sapphire network to your MetaMask.\n\nPhone: Open the website through your MetaMask Browser to add the Sapphire network."
    );
  }

  const expectedChainId = import.meta.env.VITE_NETWORK!;
  const rpcUrl = import.meta.env.VITE_WEB3_GATEWAY!;
  const chainName = import.meta.env.VITE_CHAIN_NAME!;

  const startTime = Date.now();
  window.ethereum
    .request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: expectedChainId,
          chainName: chainName,
          nativeCurrency: {
            name: "ROSE",
            symbol: "ROSE",
            decimals: 18,
          },
          rpcUrls: [rpcUrl],
          blockExplorerUrls: [],
        },
      ],
    })
    .then((response) => {
      const isAutomatedResponse = Date.now() - startTime < 100;
      if (response === null && isAutomatedResponse) {
        alert("The Oasis Sapphire Testnet RPC is already added.");
      }
    });
}
</script>

<template>
  <header>
    <nav class="bg-primaryMedium border p-2 xl:py-4 xl:px-0">
      <div class="flex flex-wrap justify-between items-center mx-0 md:mx-10">
        <RouterLink to="/">
          <img src="@/assets/logo.svg" class="h-6 sm:h-9" alt="Oasis logo" />
        </RouterLink>
        <AppButton variant="metamask" @click="addSapphireToMetaMask"
          >{{ t("add_sapphire") }}
        </AppButton>
      </div>
    </nav>
    <p
      class="text-white text-right text-sm mt-3 mr-4 md:mr-12"
      v-html="t('discord_contact')"
    ></p>
  </header>
</template>

<style lang="postcss" scoped></style>
