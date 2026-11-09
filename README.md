# CODE MAN — Eat Code. Escape Bugs. Master Programming.
Web 2D arcade educational game (Phaser 3, JavaScript, JSON, LocalStorage). No backend.

## Run
Browsers block JSON loading from file://, so use a tiny server:

    cd code-man && python3 -m http.server 8000    # open http://localhost:8000

Phaser is bundled in lib/ (works offline; only the retro font needs internet, with a fallback).

## Deploy
Push the folder to a GitHub repo -> Settings -> Pages -> deploy from the main branch.

## Controls
Arrows/WASD, swipe or on-screen d-pad (touch). P/Esc = pause.

## Structure
- data/questions.json — question bank (add questions here, no code changes; validated on load)
- data/levels.json — maze (# wall, . bit, B bonus, Q quiz node, U/S/D power-ups, P player, G ghosts, X boss, E exit), topic, ghost speed, difficulty mix
- src/ — config, systems (Save/Question/Quiz/Audio), entities (Mover), scenes, main

## Status vs SRS
All SRS sections are implemented: menu (play / continue / how to play / leaderboard / achievements / settings), grid movement,
7 levels with their own mazes, world names, topic-matched questions and the SRS difficulty distribution, 4 ghost AIs with
Chase/Scatter/Frightened(freeze)/Return states, Core Virus boss (3 hard questions) in level 7, 3 power-ups, quiz engine
(MCQ / output / bug / logic / conceptual, timer, explanations, no repeats), score/lives/pause, 10 achievements,
local personal best + stats, touch controls, sound toggle and enemy-speed setting. The question bank has 200+ questions
across Python, C++, Java, JavaScript, Data Structures, Algorithms, CS fundamentals and problem solving.
