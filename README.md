# Travel The Damn Universe v3.1 - OST & Goblin Polish

A cursed browser survival game about an increasingly illegal cube experiment, zombies, toilets, trucks, and one very determined boulder.

## Controls
- WASD / Arrow keys: move freely
- Mouse / touch: aim and shoot
- Space / Dash button: dash
- Mobile: floating joystick + Shoot + Dash

## Add your OST
1. Put audio files in `Music/`.
2. Add their exact filenames to `Music/playlist.json` in playback order.
3. Supported file extensions: MP3, M4A, OGG, WAV, AAC, and FLAC where the browser supports them.
4. The playlist loops. Players can change volume, shuffle, skip tracks, or choose a local folder from the Music menu.

See `Music/README.txt` for an example playlist.

## Leaderboard
The game now reuses one saved leaderboard identity per browser/device and updates that name's best score instead of intentionally adding duplicates. Run `SUPABASE-LEADERBOARD-SETUP.sql` once in Supabase to clean old duplicates and enforce unique names at the database level.

## Hosting
The ZIP is ready for itch.io HTML5 hosting or GitHub Pages. `index.html` is at the ZIP root as required.
