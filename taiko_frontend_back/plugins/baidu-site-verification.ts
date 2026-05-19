export default defineNuxtPlugin(() => {
  const verificationCode = String(useRuntimeConfig().public.baiduSiteVerification || "").trim();
  if (!verificationCode) return;

  useHead({
    meta: [{ name: "baidu-site-verification", content: verificationCode }]
  });
});
