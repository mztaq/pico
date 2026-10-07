/// <reference types="vite/client" />

declare const __PICO_DISCORD_CONFIG__: Readonly<{ channelId: string; botToken: string }>;
interface ImportMetaEnv { readonly VITE_PICO_ANTI_INSPECTION?: string; }
