export type BilibiliDynamicItem = {
  id_str: string;
  type: string;
  modules: {
    module_author: {
      mid: number;
      name: string;
      face: string;
      pub_time: string;
      pub_action: string;
    };
    module_tag?: {
      text: string;
    };
    module_dynamic: {
      desc?: {
        text: string;
      };
      major?: {
        type: string;
        draw?: {
          items: Array<{
            src: string;
            width: number;
            height: number;
          }>;
        };
        archive?: {
          aid: string;
          bvid: string;
          cover: string;
          title: string;
          desc: string;
          duration_text: string;
          jump_url: string;
          stat: {
            play: string;
            danmaku: string;
          };
        };
        opus?: {
          jump_url: string;
          pics: Array<{
            url: string;
            width: number;
            height: number;
          }>;
          summary: {
            text: string;
          };
          title: string;
        };
      };
    };
    module_stat: {
      comment: {
        count: number;
        forbidden: boolean;
      };
      forward: {
        count: number;
        forbidden: boolean;
      };
      like: {
        count: number;
        forbidden: boolean;
        status: boolean;
      };
    };
  };
  basic: {
    jump_url: string;
  };
};

export type BilibiliDynamicResponse = {
  code: number;
  message: string;
  data?: {
    items?: BilibiliDynamicItem[];
  };
};
