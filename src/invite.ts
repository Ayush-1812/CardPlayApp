// Getting people to the table.
//
// An invitation is a link. It opens the app if it is installed and the
// website if it is not, so whoever you send it to can play either way.
// WhatsApp is the way most groups actually pass it around, so it gets a
// button of its own, with the ordinary share sheet behind it for everyone
// else.

import * as Linking from "expo-linking";

// Where the website lives, so an invite reaches someone without the app.
export const WEB_URL = (
  process.env.EXPO_PUBLIC_WEB_URL ?? "https://card-play01.vercel.app"
).replace(/\/$/, "");

// inviteLink is what gets sent. The website reads the token out of the
// fragment, and the app registers the same shape as a deep link, so one
// link serves both.
export function inviteLink(token: string): string {
  return `${WEB_URL}/#invite=${token}`;
}

// roomCode is the short thing people read out loud when the link is too
// much trouble. It is the front of the invitation token, which is random,
// in the alphabet that survives being read aloud: no O or 0, no I or 1.
export function roomCode(token: string): string {
  const clean = token.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const safe = clean.replace(/[O0I1L]/g, "");
  return safe.slice(0, 6).padEnd(6, "X");
}

// inviteMessage is what lands in the chat. It says the game, because a
// link on its own tells nobody what they are being asked to join.
export function inviteMessage(opts: {
  game: string;
  host: string;
  link: string;
}): string {
  return `${opts.host} wants a game of ${opts.game} on CardPlay. Tap to take a seat: ${opts.link}`;
}

// whatsappURL opens WhatsApp with the message ready to send. It is a deep
// link, so it only works where WhatsApp is installed -- the caller falls
// back to the share sheet.
export function whatsappURL(message: string): string {
  return `whatsapp://send?text=${encodeURIComponent(message)}`;
}

export async function canOpenWhatsApp(): Promise<boolean> {
  try {
    return await Linking.canOpenURL("whatsapp://send?text=hello");
  } catch {
    return false;
  }
}

// inviteTokenFrom pulls the token out of a link somebody opened the app
// with, whichever of the two shapes it took.
export function inviteTokenFrom(url: string): string | null {
  const fragment = url.match(/[#?&]invite=([A-Za-z0-9_-]+)/);
  if (fragment) return fragment[1];
  const path = url.match(/\/join\/([A-Za-z0-9_-]+)/);
  return path ? path[1] : null;
}
