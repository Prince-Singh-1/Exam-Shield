# Exam Shield — Architecture

This document outlines the intended architecture. Implementation is in progress.

## High-level

```
┌──────────────┐        HTTPS / JWT        ┌──────────────────┐
│   client     │ ◄──────────────────────► │     server       │
│  React+Vite  │                          │ Express + Prisma │
│  Sakura UI   │                          │   PostgreSQL     │
└──────┬───────┘                          └────────┬─────────┘
       │                                           │
       │ in-browser AI (TF.js / MediaPipe)         │ PDF gen + scheduler
       ▼                                           ▼
  Proctoring engine                        Balanced-set generator
```

## Modules

### Auth & roles
- JWT auth, role middleware: `admin`, `examiner`, `proctor`, `student`.
- Student auth is gated to **online** exams only.

### Question bank
- CRUD for questions tagged by difficulty (EASY/MEDIUM/HARD) and type (MCQ/SUBJECTIVE).
- MCQ stores options + correct option.

### Offline workflow
1. Examiner uploads bank + configures sets (count, per-set question counts, per-difficulty counts).
2. Examiner sets exam date + lead-time (hours before).
3. Scheduler generates papers at `examDateTime - leadTimeHours`.
4. **Balanced-set algorithm** ensures equal total difficulty across sets, randomized selection.
5. Audit record stamped (examDate, generatedAt, generatedBy).
6. PDF per set produced with instructions + audit stamp.

### Online workflow
1. Examiner configures bank + sets (same inputs).
2. On student start, a paper is assembled on-the-fly (kept secret until then).
3. Exam runner enforces lockdown + AI proctoring.
4. Violations (with snapshots) streamed/stored and surfaced on proctor dashboard.

## Balanced-set algorithm (intended)
- Bucket questions by difficulty.
- For each set, draw the required count per difficulty at random (no replacement across a generation run where bank size allows).
- Assign difficulty weights (e.g. EASY=1, MEDIUM=2, HARD=3); verify each set's total weight is equal/near-equal, rebalancing draws if needed.

## Anti-cheat (online)
- Client: disable copy/cut/paste, contextmenu, devtools keys, selection, print; force fullscreen; detect visibilitychange/blur/fullscreenchange.
- AI: gaze direction, phone/object detection, face count, audio level — debounced into violation events with timestamped captures.
