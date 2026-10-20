export default defineNuxtPlugin(() => {
  const {theme,setTheme}=useViewerTheme();
  const cookie=useCookie<string>('taiko_theme');
  // Existing localStorage preference is migrated before the first paint. All
  // subsequent SSR requests carry the same explicit theme cookie.
  useHead(() => ({
    htmlAttrs:{'data-theme':theme.value},
    bodyAttrs:{class:theme.value==='dark'?'theme-dark':''},
    script:[{key:'viewer-theme-bootstrap',tagPosition:'head',innerHTML:`(function(){try{var m=document.cookie.match(/(?:^|; )taiko_theme=(dark|light)(?:;|$)/),t=m?m[1]:localStorage.getItem('taiko_theme');if(t!=='dark')t='light';document.documentElement.dataset.theme=t;if(!m)document.cookie='taiko_theme='+t+'; Path=/; Max-Age=31536000; SameSite=Lax';}catch(e){}})();`}]
  }));
  if(import.meta.client){
    if(cookie.value==='dark'||cookie.value==='light')setTheme(cookie.value);
    watch(theme,value=>setTheme(value));
    window.addEventListener('storage',event=>{if(event.key==='taiko_theme')setTheme(event.newValue||'light');});
  }
});
