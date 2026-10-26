// The shell every screen sits in: the session, the felt background, and a
// stack whose back behaviour is Android's own. Expo Router wires the
// hardware back button to this stack, so pressing back leaves a table the
// same way the on-screen back does.

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colour } from "../src/theme";
import { SessionProvider } from "../src/session";

// Deep links into a room should still have somewhere to go back to, so
// the games list is the anchor of the stack.
export const unstable_settings = { anchor: "index" };

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colour.feltDark },
            animation: "slide_from_right",
          }}
        />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
