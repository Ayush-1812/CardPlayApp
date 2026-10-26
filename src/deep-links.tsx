// Links that arrive from outside the app.
//
// The invite that gets passed around a group is a website link with the
// token in its fragment, because that is the one link that works for
// everybody -- app or no app. A fragment never reaches a router, so it is
// read here and turned into a route.

import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { inviteTokenFrom } from "./invite";

export function InviteLinks() {
  const router = useRouter();
  const url = Linking.useURL();
  // The same link arriving twice -- which happens when the app is brought
  // back to the foreground -- must not push a second join screen.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!url || handled.current === url) return;
    const token = inviteTokenFrom(url);
    if (!token) return;
    handled.current = url;
    router.replace({ pathname: "/join", params: { token } });
  }, [url, router]);

  return null;
}
