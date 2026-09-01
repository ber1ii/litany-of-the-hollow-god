type SoundCategory = 'sfx' | 'bgm' | 'ambient' | 'ui';

interface SoundOptions {
  volume?: number;
  pitch?: number;
  loop?: boolean;
  position?: [number, number, number];
  category?: SoundCategory;
}

class AudioManagerClass {
  private ctx: AudioContext | null = null;
  private soundBufferCache: Map<string, AudioBuffer> = new Map();
  private bgmAudio: HTMLAudioElement | null = null;
  private ambientAudio: HTMLAudioElement | null = null;

  // Category Volumes
  public masterVolume = 1.0;
  public categoryVolumes: Record<SoundCategory, number> = {
    sfx: 0.9,
    bgm: 0.15,
    ambient: 0.25,
    ui: 0.8,
  };

  // Sound Mappings for Random Variations
  private variations: Record<string, string[]> = {
    footsteps_walk: [
      '/sfx/player-footsteps-1-first.ogg',
      '/sfx/player-footsteps-1-second.ogg',
      '/sfx/player-footsteps-1-third.ogg',
      '/sfx/player-footsteps-1-fourth.ogg',
      '/sfx/player-footsteps-1-fifth.ogg',
    ],
    footsteps_chase: [
      '/sfx/player-foorsteps-chase-first.ogg',
      '/sfx/player-footsteps-chase-second.ogg',
      '/sfx/player-footsteps-chase-third.ogg',
      '/sfx/player-footsteps-chase-fourth.ogg',
    ],
    flesh_hit_floor: [
      '/sfx/flesh-hit-floor1.ogg',
      '/sfx/flesh-hits-floor2.ogg',
      '/sfx/flesh-hits-floor3.ogg',
    ],
    low_hp_cough: ['/sfx/low-hp-cough-1.ogg', '/sfx/low-hp-cough-2.ogg', '/sfx/low-hp-cough-3.ogg'],
    orc_walk: [
      '/sfx/orc-walk-1.ogg',
      '/sfx/orc-walk-2.ogg',
      '/sfx/orc-walk-3.ogg',
      '/sfx/orc-walk-4.ogg',
    ],
    skeleton_walk: [
      '/sfx/skeleton-walk-1.ogg',
      '/sfx/skeleton-walk-2.ogg',
      '/sfx/skeleton-walk-3.ogg',
    ],
    vampire_walk: ['/sfx/vampire-walk-1.ogg', '/sfx/vampire-walk-2.ogg', '/sfx/vampire-walk-3.ogg'],
    eerie_creak: [
      '/sfx/ambiance-eerie-creeks1.ogg',
      '/sfx/ambiance-eerie-creeks2.ogg',
      '/sfx/ambiance-eerie-creeks3.ogg',
      '/sfx/ambiance-eerie-creeks4.ogg',
    ],
    eerie_highpitch: ['/sfx/ambiance-eerie-highpitch1.ogg', '/sfx/ambiance-eerie-highpitch2.ogg'],
    eerie_whoosh: ['/sfx/ambiance-eerie-whoosh1.ogg', '/sfx/ambiance-eerie-whoosh2.ogg'],
  };

  constructor() {
    // Web Audio API initialized on first user interaction
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public async preloadSounds(urls: string[]) {
    this.initContext();
    if (!this.ctx) return;

    await Promise.all(
      urls.map(async (url) => {
        if (this.soundBufferCache.has(url)) return;
        try {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
          this.soundBufferCache.set(url, audioBuffer);
        } catch (e) {
          console.warn(`Failed to load sound file: ${url}`, e);
        }
      })
    );
  }

  public play(soundName: string, opts: SoundOptions = {}) {
    this.initContext();
    if (!this.ctx) return;

    // Resolve variations or direct filename
    let fileUrl = soundName;
    if (this.variations[soundName]) {
      const choices = this.variations[soundName];
      fileUrl = choices[Math.floor(Math.random() * choices.length)];
    } else if (!fileUrl.startsWith('/sfx/')) {
      fileUrl = `/sfx/${fileUrl}.ogg`;
    }

    const buffer = this.soundBufferCache.get(fileUrl);
    if (!buffer) {
      // Lazy load fallback
      this.preloadSounds([fileUrl]).then(() => this.play(soundName, opts));
      return;
    }

    const category = opts.category || 'sfx';
    const volume = (opts.volume ?? 1.0) * this.categoryVolumes[category] * this.masterVolume;
    if (volume <= 0) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Pitch Modulation
    if (opts.pitch) {
      source.playbackRate.value = opts.pitch;
    }

    // Gain Control
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = volume;

    // 3D Spatial Audio Node (Panner)
    if (opts.position) {
      const panner = this.ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 3;
      panner.maxDistance = 25;
      panner.rolloffFactor = 0.6;
      panner.setPosition(opts.position[0], opts.position[1], opts.position[2]);

      source.connect(gainNode);
      gainNode.connect(panner);
      panner.connect(this.ctx.destination);
    } else {
      source.connect(gainNode);
      gainNode.connect(this.ctx.destination);
    }

    source.loop = !!opts.loop;
    source.start(0);
    return source;
  }

  // Updates listener position for 3D positional audio calculation.

  public updateListenerPosition(pos: [number, number, number], forward: [number, number, number]) {
    if (!this.ctx) return;
    const listener = this.ctx.listener;
    if (listener.positionX) {
      listener.positionX.setValueAtTime(pos[0], this.ctx.currentTime);
      listener.positionY.setValueAtTime(pos[1], this.ctx.currentTime);
      listener.positionZ.setValueAtTime(pos[2], this.ctx.currentTime);
    } else {
      listener.setPosition(pos[0], pos[1], pos[2]);
    }

    if (listener.forwardX) {
      listener.forwardX.setValueAtTime(forward[0], this.ctx.currentTime);
      listener.forwardY.setValueAtTime(forward[1], this.ctx.currentTime);
      listener.forwardZ.setValueAtTime(forward[2], this.ctx.currentTime);
    } else {
      listener.setOrientation(forward[0], forward[1], forward[2], 0, 1, 0);
    }
  }

  public playAmbient(file: string, fadeDuration = 1.0) {
    const fullPath = file.startsWith('/sfx/') ? file : `/sfx/${file}.ogg`;

    if (this.ambientAudio && this.ambientAudio.src.endsWith(fullPath)) return;

    if (this.ambientAudio) {
      const oldAudio = this.ambientAudio;
      let vol = oldAudio.volume;
      const fadeInterval = setInterval(
        () => {
          vol -= 0.05;
          if (vol <= 0) {
            clearInterval(fadeInterval);
            oldAudio.pause();
          } else {
            oldAudio.volume = vol;
          }
        },
        (fadeDuration * 1000) / 20
      );
    }

    const audio = new Audio(fullPath);
    audio.loop = true;
    audio.volume = this.categoryVolumes.ambient * this.masterVolume;
    audio.play().catch(() => {});
    this.ambientAudio = audio;
  }

  public stopAmbient() {
    if (this.ambientAudio) {
      this.ambientAudio.pause();
      this.ambientAudio = null;
    }
  }

  public playBGM(file: string, fadeDuration = 1.0) {
    const fullPath = file.startsWith('/sfx/') ? file : `/sfx/${file}.ogg`;

    if (this.bgmAudio && this.bgmAudio.src.endsWith(fullPath)) return;

    if (this.bgmAudio) {
      const oldAudio = this.bgmAudio;
      // Fade out current track
      let vol = oldAudio.volume;
      const fadeInterval = setInterval(
        () => {
          vol -= 0.05;
          if (vol <= 0) {
            clearInterval(fadeInterval);
            oldAudio.pause();
          } else {
            oldAudio.volume = vol;
          }
        },
        (fadeDuration * 1000) / 20
      );
    }

    const audio = new Audio(fullPath);
    audio.loop = true;
    audio.volume = this.categoryVolumes.bgm * this.masterVolume;
    audio.play().catch(() => {
      /* Autoplay prevented until click */
    });
    this.bgmAudio = audio;
  }

  public stopBGM() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio = null;
    }
  }
}

export const AudioManager = new AudioManagerClass();
