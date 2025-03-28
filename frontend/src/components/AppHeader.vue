<script setup lang="ts">
import AppButton from "@/components/AppButton.vue";

function addSapphireToMetaMask() {
  if (!window.ethereum?.request) {
    return alert(
      "Have you installed MetaMask yet? If not, please do so.\n\nComputer: Once it is installed, you will be able to add the Sapphire ParaTime to your MetaMask.\n\nPhone: Open the website through your MetaMask Browser to add the Sapphire ParaTime."
    );
  }

  const startTime = Date.now();
  window.ethereum
    .request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0x5afe",
          chainName: "Oasis Sapphire",
          nativeCurrency: {
            name: "ROSE",
            symbol: "ROSE",
            decimals: 18,
          },
          rpcUrls: ["https://sapphire.oasis.io/", "wss://sapphire.oasis.io/ws"],
          blockExplorerUrls: ["https://explorer.oasis.io/mainnet/sapphire"],
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
  <header class="">
    <nav class="bg-primaryMedium border-gray-200 p-2 xl:py-4 xl:px-0">
      <div class="flex flex-wrap justify-between items-center mx-0 md:mx-10">
        <RouterLink to="/">
          <img src="@/assets/logo.svg" class="h-6 sm:h-9" alt="Oasis logo" />
        </RouterLink>
        <AppButton variant="metamask" @click="addSapphireToMetaMask"
          >Add Sapphire to Metamask
        </AppButton>
      </div>
    </nav>
    <p class="text-white text-right text-sm mt-3 mr-4 md:mr-12">
      Problems, questions, compliments?<br />
      Contact us on
      <a href="https://oasis.io/discord" target="_blank">Discord</a>! 🎉
    </p>
  </header>
</template>

<style lang="postcss" scoped></style>
