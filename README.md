# CardPlay for phones

The CardPlay app: card games with your own group, on the phone that is
already in your hand. It talks to the same server as
[the website](https://card-play01.vercel.app), so a game can have app
players and browser players at the same table.

## What it does

- **Make a room and fill it.** A WhatsApp button, a share sheet, a
  copyable link and a room code, because a group will use all four. Anyone
  who taps the link gets a guest account on the spot -- no sign-up, one
  field, their name.
- **Learn a game in two minutes.** Short lessons with the cards drawn
  underneath them, then questions answered by tapping real cards. Every
  wrong answer says why, which is how the legal moves get taught.
- **Play.** Trump and Bluff have tables in the app. Monopoly Deal runs on
  the server and is on the website for now; Cambio is still to come.
- **Talk while you play.** Voice is a mesh between the players; the server
  only passes on the introductions. The control sits in the top bar beside
  the trump card, never over the cards.
- **Change game without breaking up the room.** The same people, the same
  seats, the same call -- only the cards change.

## Running it

```sh
npm install
npx expo start            # the games, the rooms, the tables, the chat
```

Voice chat uses `react-native-webrtc`, which is real native code, so it
does not run in Expo Go. For voice you need a development build:

```sh
npx expo run:android      # or: npx expo run:ios
```

Point the app at a different server with a `.env` file:

```
EXPO_PUBLIC_API_URL=http://192.168.1.10:8080
EXPO_PUBLIC_WEB_URL=http://192.168.1.10:3000
```

Without those it uses the live server and the live website. The API
defaults to a free instance that sleeps when nobody is playing, so the
first request after a quiet spell takes a few seconds -- the client
retries by itself while it wakes.

## Checks

```sh
npx tsc --noEmit                      # types
npx expo export --platform android    # the bundle actually builds
```

## How it is put together

```
app/                  the screens, as routes
  index.tsx           your name, and a seat
  games.tsx           pick a game, or join with a link
  learn/[game].tsx    the tutorial
  room/[id].tsx       the lobby: invites, seats, readiness, settings
  table/[id].tsx      the table frame; the game inside it is the server's business
  join.tsx            arriving on somebody else's invitation
src/
  api.ts              every call to the server, with retry while it wakes
  realtime.ts         one socket, reconnecting, re-subscribing
  live.tsx            that socket held above every screen
  session.tsx         a guest account that survives a restart
  voice/              the mesh, and the control in the top bar
  tables/             Trump and Bluff, drawn for a phone
  guides.ts           the rules, in plain words
  components/         cards, buttons, chat, room settings
```

Two decisions explain most of the rest.

**The connection lives above the screens.** The socket and the voice
channel are held at the root, so walking from the lobby into a game and
back out moves a subscription instead of rebuilding a connection. That is
what makes "play another game without leaving the call" true rather than
aspirational.

**The server decides the rules; this draws them.** Nothing here works out
whether a move is legal. When a card cannot be played, the table says why
in the player's own words -- "you must follow hearts while you still hold
one" -- and lets the server have the final word.
