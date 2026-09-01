import 'react-native-gesture-handler';

import { initOneSignal } from './src/services/notifications/oneSignal';
import { RootApp } from './src/app/RootApp';

// Runs before React renders, and long before NavigationContainer mounts (RootApp gates
// it on hydration + fonts + a 1.8s minimum splash). That ordering is what makes a
// cold-start notification tap reliable: OneSignal's click listener is already
// registered when the tap crosses the bridge, and the URL it produces is buffered
// until React Navigation asks for it.
//
// An explicit call, not an import side effect — see the note in oneSignal.ts.
initOneSignal();

export default RootApp;
