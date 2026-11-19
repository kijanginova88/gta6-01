# Neon Bay — Streets of Solmar

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kijanginova88/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kijanginova88/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the sun-soaked fictional city of Neon Bay: steal cars, outrun the police, run missions for the crew, and become the King of Neon Bay. Everything in it — the city, characters, vehicles, story, art, sound and music — is original, drawn and synthesised in code. No Rockstar material, no network, no library: plain HTML5 Canvas and JavaScript, playable in a desktop browser from static files.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 — or open `game/index.html` directly from any static server.

## Controls

- **WASD / arrow keys** — walk and drive
- **E** — steal a car / get out of a car
- **F** — punch
- **Space** — shoot (aim with the mouse)
- **P** — pause · **M** — mute · **R** — restart after being wasted or busted

## What is in the city

- A 3200×2400 driveable city with roads, sidewalks, buildings, a park, a beach and the sea, plus traffic cars and pedestrians living their own lives
- A 5-star wanted system: steal cars, hit pedestrians or shoot and the Neon Bay police come for you — on foot and in pursuit cars — until you lose them or get busted
- 6 story missions for the crew (steal-and-deliver, fetch, lose-the-heat, collect, timed, survive), with cash payouts, a persistent save (localStorage) and a best-run record
- Combat on foot and from the car, car health and damage, cash pickups, health packs and ammo
- HUD with health, ammo, cash, wanted stars, mission tracker and a live minimap; title, pause, wasted, busted and victory screens
- Synthesised WebAudio sound effects and music — no audio files

## Screenshots

The four frames in `screenshots/` are real renders of the game running in headless Chrome (`?shot=start|drive|chase|mission&seed=1`), and `shots.json` lists them in that order.

## Build the entry

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `game/` and `screenshots/` into the output directory and writes `dossier.json` for the judge.

---

<sub>Entered on [make.fun](https://make.fun/?ref=thr15azb&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
