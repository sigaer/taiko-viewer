<template>
  <NuxtLayout>
    <NuxtPage :keepalive="{ exclude: ['PersonalGrowthLayout', 'PracticePlayerPage'] }" />
  </NuxtLayout>
  <AnnualMobileNotice />
</template>
