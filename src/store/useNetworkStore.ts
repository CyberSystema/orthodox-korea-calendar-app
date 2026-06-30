import { create } from 'zustand';
import * as Network from 'expo-network';

type NetworkSnapshot = {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
};

// Optimistic: only treat the device as offline when a flag is explicitly `false`.
// expo-network leaves `isInternetReachable` undefined on some platforms / very early
// in launch, and we don't want a transient `undefined` to flash the offline banner.
function computeOnline(state: NetworkSnapshot): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

type NetworkState = {
  isOnline: boolean;
  setOnline: (value: boolean) => void;
};

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: true,
  setOnline: (isOnline) => set({ isOnline }),
}));

// Seed the current connectivity, then subscribe to changes. Returns an unsubscribe
// function. Call once from the app root and clean up on unmount.
export async function initNetworkMonitor(): Promise<() => void> {
  try {
    const state = await Network.getNetworkStateAsync();
    useNetworkStore.getState().setOnline(computeOnline(state));
  } catch {
    // Keep the optimistic default if the initial probe fails.
  }

  const subscription = Network.addNetworkStateListener((state) => {
    useNetworkStore.getState().setOnline(computeOnline(state));
  });

  return () => subscription.remove();
}
