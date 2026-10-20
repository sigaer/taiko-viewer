type ViewerContentLayout = "standard" | "wide" | "reading" | "immersive";
declare module "#app" {
  interface PageMeta { contentLayout?: ViewerContentLayout; }
}
declare module "vue-router" {
  interface RouteMeta { contentLayout?: ViewerContentLayout; }
}
export {};
