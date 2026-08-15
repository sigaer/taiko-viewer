export const ANNUAL_BGM_SRC = "/audio/annual/natsumatsuri-303-old.ogg";

type PlayingListener = (playing: boolean) => void;

const PRIMED_OWNER = Symbol("annual-bgm-primed-owner");
let activeOwner: symbol | null = null;
let activeListener: PlayingListener | null = null;
let audio: HTMLAudioElement | null = null;
let pendingPlay: Promise<boolean> | null = null;
let generation = 0;
let playIntent = false;

const notify = (playing: boolean) => activeListener?.(playing);

const ensureAudio = () => {
  if (!audio) {
    audio = new Audio(ANNUAL_BGM_SRC);
    audio.preload = "auto";
    audio.loop = true;
    audio.volume = 0.36;
  }
  return audio;
};

const stopGlobalAudio = (reset: boolean, release: boolean) => {
  generation += 1;
  playIntent = false;
  pendingPlay = null;
  audio?.pause();
  notify(false);
  if (reset && audio) audio.currentTime = 0;
  if (release && audio) {
    audio.removeAttribute("src");
    audio.load();
    audio = null;
  }
};

const playGlobalAudio = async () => {
  if (document.hidden) return false;
  const currentAudio = ensureAudio();
  if (!currentAudio.paused) {
    notify(true);
    return true;
  }
  if (pendingPlay) return pendingPlay;

  const playGeneration = generation;
  playIntent = true;
  let request: Promise<boolean>;
  try {
    request = Promise.resolve(currentAudio.play()).then(() => {
      if (playGeneration !== generation) {
        if (!playIntent || audio !== currentAudio) currentAudio.pause();
        return false;
      }
      notify(true);
      return true;
    }, () => {
      if (playGeneration === generation) {
        playIntent = false;
        notify(false);
      }
      return false;
    });
  } catch {
    playIntent = false;
    notify(false);
    return false;
  }

  pendingPlay = request;
  request.finally(() => {
    if (pendingPlay === request) pendingPlay = null;
  });
  return request;
};

export const primeAnnualBgm = () => {
  if (activeOwner && activeOwner !== PRIMED_OWNER) return Promise.resolve(Boolean(audio && !audio.paused));
  activeOwner = PRIMED_OWNER;
  return playGlobalAudio();
};

export const releasePrimedAnnualBgm = () => {
  if (activeOwner !== PRIMED_OWNER) return;
  stopGlobalAudio(true, true);
  activeOwner = null;
  activeListener = null;
};

export const createAnnualBgmSession = (listener: PlayingListener) => {
  const owner = Symbol("annual-bgm-owner");
  activeOwner = owner;
  activeListener = listener;
  if (audio && !audio.paused) notify(true);

  const ownsAudio = () => activeOwner === owner;

  return {
    async play() {
      if (!ownsAudio() || document.hidden) return false;
      return playGlobalAudio();
    },
    pause(reset = false) {
      if (!ownsAudio()) return;
      stopGlobalAudio(reset, false);
    },
    release() {
      if (!ownsAudio()) return;
      stopGlobalAudio(true, true);
      activeOwner = null;
      activeListener = null;
    }
  };
};

export type AnnualBgmSession = ReturnType<typeof createAnnualBgmSession>;
