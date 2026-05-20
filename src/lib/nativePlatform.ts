import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/** One-time native shell tweaks (iOS safe area handled in CSS). */
export async function initNativePlatform(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: Style.Light });
  } catch {
    /* ignore on simulators without status bar plugin */
  }
}
