export type MainTabsParamList = {
  Today: undefined;
  Month: { year?: number; month?: number } | undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  EventDetail: { eventId: string; dateISO?: string };
  Settings: undefined;
  SecretMenu: undefined;
};
