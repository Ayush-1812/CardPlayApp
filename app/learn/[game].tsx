// Learning a game in the two minutes before it starts.
//
// One idea per screen, a tap to move on, and a couple of questions
// answered on real cards. It can be left at any point -- the room is one
// back gesture away -- and picked up again from the top, because nobody
// is going to resume a tutorial from step four.

import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Button, PrimaryButton } from "../../src/components/button";
import { Card } from "../../src/components/card";
import { Screen } from "../../src/components/screen";
import { guideFor, type Choice, type Question } from "../../src/guides";
import { colour, radius, space, type as text } from "../../src/theme";

type Step =
  | { kind: "lesson"; index: number }
  | { kind: "question"; index: number }
  | { kind: "reference" };

export default function Learn() {
  const { game } = useLocalSearchParams<{ game: string }>();
  const router = useRouter();
  const guide = guideFor(game);
  const { width } = useWindowDimensions();
  const [step, setStep] = useState(0);
  // What has been tapped, keyed by question index and label, so a note
  // stays on screen while the rest of the answers are explored.
  const [tapped, setTapped] = useState<Record<string, true>>({});

  const steps = useMemo<Step[]>(() => {
    if (!guide) return [];
    return [
      ...guide.lessons.map((_, index) => ({ kind: "lesson" as const, index })),
      ...guide.questions.map((_, index) => ({ kind: "question" as const, index })),
      { kind: "reference" as const },
    ];
  }, [guide]);

  if (!guide)
    return (
      <Screen title="How to play">
        <View style={styles.middle}>
          <Text style={styles.body}>
            There is no guide for that game yet.
          </Text>
        </View>
      </Screen>
    );

  const current = steps[step];
  const last = step === steps.length - 1;
  const cardWidth = Math.min(72, Math.floor((width - space.lg * 2) / 5.4));

  function tap(question: number, choice: Choice) {
    setTapped((was) => ({ ...was, [`${question}:${choice.label}`]: true }));
  }

  function answered(index: number, question: Question): boolean {
    const choices = question.kind === "cards" ? question.hand : question.options;
    return choices.some((c) => c.ok && tapped[`${index}:${c.label}`]);
  }

  return (
    <Screen
      title={`How to play ${guide.name}`}
      subtitle={`${guide.players} · ${guide.length}`}
    >
      {/* Where you are, and how much is left. Four dots is a promise that
          this is short. */}
      <View style={styles.dots} accessibilityLabel={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === step && styles.dotNow,
              i < step && styles.dotDone,
            ]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.body_}
        showsVerticalScrollIndicator={false}
      >
        {step === 0 ? (
          <View style={styles.goal}>
            <Text style={styles.goalLabel}>What you are trying to do</Text>
            <Text style={styles.goalText}>{guide.goal}</Text>
          </View>
        ) : null}

        {current?.kind === "lesson"
          ? (() => {
              const lesson = guide.lessons[current.index];
              return (
                <View style={styles.panel}>
                  <Text style={styles.heading}>{lesson.title}</Text>
                  <Text style={styles.body}>{lesson.body}</Text>
                  {lesson.demo ? (
                    <View style={styles.demo}>
                      {lesson.demo.table ? (
                        <View style={styles.row}>
                          {lesson.demo.table.map((code, i) => (
                            <Card
                              key={`t${i}`}
                              code={code === "??" ? undefined : code}
                              down={code === "??"}
                              width={cardWidth}
                            />
                          ))}
                        </View>
                      ) : null}
                      {lesson.demo.hand ? (
                        <View style={styles.row}>
                          {lesson.demo.hand.map((code, i) => (
                            <Card
                              key={`h${i}`}
                              code={code === "??" ? undefined : code}
                              down={code === "??"}
                              width={cardWidth}
                            />
                          ))}
                        </View>
                      ) : null}
                      {lesson.demo.caption ? (
                        <Text style={styles.caption}>{lesson.demo.caption}</Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })()
          : null}

        {current?.kind === "question"
          ? (() => {
              const question = guide.questions[current.index];
              const choices =
                question.kind === "cards" ? question.hand : question.options;
              return (
                <View style={styles.panel}>
                  <Text style={styles.askLabel}>Your turn</Text>
                  <Text style={styles.heading}>{question.ask}</Text>

                  {question.kind === "cards" && question.lead ? (
                    <View style={styles.lead}>
                      <Text style={styles.caption}>Led</Text>
                      <Card code={question.lead} width={cardWidth} />
                    </View>
                  ) : null}

                  {question.kind === "cards" ? (
                    <View style={styles.row}>
                      {question.hand.map((choice) => (
                        <Card
                          key={choice.label}
                          code={choice.label}
                          width={cardWidth}
                          onPress={() => tap(current.index, choice)}
                          highlight={
                            choice.ok && !!tapped[`${current.index}:${choice.label}`]
                          }
                          style={
                            !choice.ok && tapped[`${current.index}:${choice.label}`]
                              ? styles.wrongCard
                              : undefined
                          }
                        />
                      ))}
                    </View>
                  ) : (
                    <View style={styles.options}>
                      {question.options.map((choice) => (
                        <Button
                          key={choice.label}
                          label={choice.label}
                          tone={
                            tapped[`${current.index}:${choice.label}`] && choice.ok
                              ? "primary"
                              : "quiet"
                          }
                          onPress={() => tap(current.index, choice)}
                        />
                      ))}
                    </View>
                  )}

                  {/* Every answer that has been tried explains itself, so
                      the wrong ones teach as much as the right one. */}
                  {choices
                    .filter((c) => tapped[`${current.index}:${c.label}`])
                    .map((c) => (
                      <View
                        key={c.label}
                        style={[styles.note, c.ok ? styles.noteOk : styles.noteNo]}
                      >
                        <Text style={styles.noteMark}>{c.ok ? "✓" : "✕"}</Text>
                        <Text style={styles.noteText}>
                          <Text style={styles.noteWhat}>{c.label}  </Text>
                          {c.note}
                        </Text>
                      </View>
                    ))}

                  {!answered(current.index, question) ? (
                    <Text style={styles.caption}>
                      Tap one to find out. Nothing here can go wrong.
                    </Text>
                  ) : null}
                </View>
              );
            })()
          : null}

        {current?.kind === "reference"
          ? (
              <>
                <View style={styles.panel}>
                  <Text style={styles.heading}>What is on the screen</Text>
                  {guide.screen.map((item) => (
                    <View key={item.label} style={styles.item}>
                      <Text style={styles.itemLabel}>{item.label}</Text>
                      <Text style={styles.body}>{item.what}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.panel}>
                  <Text style={styles.heading}>Worth knowing</Text>
                  {guide.tips.map((tip) => (
                    <View key={tip} style={styles.bullet}>
                      <Text style={styles.bulletMark}>•</Text>
                      <Text style={styles.body}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </>
            )
          : null}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 ? (
          <Button
            label="Back"
            onPress={() => setStep((s) => Math.max(0, s - 1))}
            full={false}
            style={styles.backButton}
          />
        ) : null}
        {last ? (
          <PrimaryButton
            label="Got it"
            onPress={() => router.back()}
            style={styles.grow}
          />
        ) : (
          <PrimaryButton
            label="Next"
            onPress={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            style={styles.grow}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  middle: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  dots: {
    flexDirection: "row",
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  dot: {
    flex: 1,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  dotNow: { backgroundColor: colour.accent },
  dotDone: { backgroundColor: "rgba(239,192,73,0.45)" },
  body_: { padding: space.lg, paddingBottom: space.xl, gap: space.md },
  goal: {
    borderLeftWidth: 3,
    borderLeftColor: colour.accent,
    paddingLeft: space.md,
    gap: 2,
  },
  goalLabel: {
    ...text.small,
    color: colour.creamSoft,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  goalText: { ...text.body, color: colour.cream, fontWeight: "700", lineHeight: 21 },
  panel: {
    backgroundColor: colour.panelSolid,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colour.line,
    padding: space.lg,
    gap: space.md,
  },
  heading: { ...text.heading, color: colour.cream, lineHeight: 26 },
  body: { ...text.body, color: colour.creamSoft, lineHeight: 22 },
  caption: { ...text.small, color: colour.creamSoft, lineHeight: 17 },
  askLabel: {
    ...text.small,
    color: colour.accent,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  demo: { gap: space.sm, alignItems: "flex-start" },
  row: { flexDirection: "row", gap: space.xs, flexWrap: "wrap" },
  lead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  options: { gap: space.sm },
  wrongCard: { borderColor: colour.danger, borderWidth: 2, opacity: 0.75 },
  note: {
    flexDirection: "row",
    gap: space.sm,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
  },
  noteOk: { borderColor: colour.good, backgroundColor: "rgba(79,157,105,0.12)" },
  noteNo: { borderColor: colour.danger, backgroundColor: "rgba(194,85,63,0.12)" },
  noteMark: { ...text.label, color: colour.cream, fontWeight: "800" },
  noteText: { ...text.small, color: colour.cream, flex: 1, lineHeight: 18 },
  noteWhat: { fontWeight: "800" },
  item: { gap: 2 },
  itemLabel: { ...text.label, color: colour.cream },
  bullet: { flexDirection: "row", gap: space.sm },
  bulletMark: { color: colour.accent, ...text.body },
  footer: {
    flexDirection: "row",
    gap: space.sm,
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: colour.line,
    backgroundColor: colour.feltDeep,
  },
  backButton: { minWidth: 96 },
  grow: { flex: 1 },
});
