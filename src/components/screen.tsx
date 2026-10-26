// The frame every screen shares: the felt, the safe areas, and a header
// whose back button does the same thing as the Android back gesture.

import { useRouter } from "expo-router";
import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colour, radius, space, TOUCH, type as text } from "../theme";

export function Screen({
  title,
  subtitle,
  back = true,
  action,
  children,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {(title || back) && (
        <View style={styles.header}>
          {back && router.canGoBack() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
              hitSlop={8}
            >
              <Text style={styles.backMark}>←</Text>
            </Pressable>
          ) : null}
          <View style={styles.titles}>
            {title ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {action}
        </View>
      )}
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colour.feltDark },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  back: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colour.panel,
    marginLeft: -space.sm,
  },
  pressed: { opacity: 0.7 },
  backMark: { color: colour.cream, fontSize: 22, lineHeight: 24 },
  titles: { flex: 1, gap: 2 },
  title: { ...text.heading, color: colour.cream },
  subtitle: { ...text.small, color: colour.creamSoft, lineHeight: 17 },
});
