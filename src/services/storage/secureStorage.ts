import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  async setItem(key: string, value: string) {
    await SecureStore.setItemAsync(key, value);
  },
  async getItem(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async deleteItem(key: string) {
    await SecureStore.deleteItemAsync(key);
  },
};
