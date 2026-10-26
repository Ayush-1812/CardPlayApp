// Buttons, sized for thumbs.
//
// Every one of these is at least 48dp tall, gives a little haptic tap on
// press, and dips slightly while held so a touch is obviously registered
// even on a slow connection.

import * as Haptics from "expo-haptics";
import { ReactNode } from "react";
import {
  AccessibilityRole,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { colour, radius, space, TOUCH, type as text } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "primary" | "quiet" | "danger";
  // full makes the button take the width it is given, which is what a
  // single action at the bottom of a screen wants.
  full?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
  accessibilityHint?: string;
  role?: AccessibilityRole;
};

export function Button({
  label,
  onPress,
  disabled = false,
  tone = "quiet",
  full = true,
  icon,
  style,
  accessibilityHint,
  role = "button",
}: Props) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        tone === "primary" && styles.primary,
        tone === "danger" && styles.danger,
        full && styles.full,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[
          styles.label,
          tone === "primary" && styles.primaryLabel,
          tone === "danger" && styles.dangerLabel,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function PrimaryButton(props: Omit<Props, "tone">) {
  return <Button {...props} tone="primary" />;
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colour.line,
    backgroundColor: "rgba(0,0,0,0.3)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  full: { alignSelf: "stretch" },
  primary: { backgroundColor: colour.accent, borderColor: colour.accent },
  danger: { backgroundColor: colour.danger, borderColor: colour.danger },
  // A press is felt as well as seen: the surface dips a little.
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
  label: { ...text.label, fontSize: 15, color: colour.cream },
  primaryLabel: { color: colour.accentInk, fontWeight: "800" },
  dangerLabel: { color: "#fff", fontWeight: "700" },
  icon: { marginRight: space.xs },
});
