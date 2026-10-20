export type ViewerTheme = 'light' | 'dark';
export const useViewerTheme = () => {
  const cookie = useCookie<ViewerTheme>('taiko_theme', {sameSite:'lax',path:'/',maxAge:31536000});
  const theme = useState<ViewerTheme>('viewer-theme', () => cookie.value === 'dark' ? 'dark' : 'light');
  const setTheme = (value:string) => {
    theme.value = value === 'dark' ? 'dark' : 'light';
    cookie.value = theme.value;
    if(import.meta.client)try{localStorage.setItem('taiko_theme',theme.value);}catch{}
  };
  return {theme,setTheme};
};
