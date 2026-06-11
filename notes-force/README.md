# Notes Force

A standalone iPhone Notes-style magic app designed for GitHub Pages.

## Page URL

`https://magicaleb.github.io/Magic/notes-force/`

## Home-screen input

The app opens on a fake iPhone Home Screen. Ten ordinary-looking apps secretly represent digits:

- `1` Calendar, `2` Photos, `3` Camera, `4` Maps, `5` Weather
- `6` Clock, `7` Reminders, `8` App Store, `9` Settings, `0` Music

Tap the apps for the spectator's number, then tap **Notes**. Notes opens with the force item already moved to that numbered position. Tap **Files** to silently clear an unfinished entry.

## Setup

Press and hold the status-bar time on the fake Home Screen. The setup sheet allows you to:

- upload and resize a custom wallpaper
- set the force note title and force item
- replace the numbered list
- show secret mapping badges for rehearsal

Press and hold **Folders** in Notes to return to the Home Screen.

## Backup input

Inside the numbered note, press and hold the bottom-right compose button. An invisible phone keypad covers the note. Enter the number and pause.

Settings stay in the browser using local storage. The service worker keeps the app available offline after the first successful load.
