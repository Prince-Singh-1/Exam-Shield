# 🛡️ Exam Shield

A secure, fair, and intelligent examination platform.

> Reimagine the future of examinations with secure, fair, and intelligent solutions.

## Overview

Exam Shield supports two examination modes:

- **🟢 Online Exam** — AI-proctored, anti-cheat locked-down browser exam where each student's paper is assembled *just before* they start, so questions stay secret.
- **📄 Offline Exam** — Balanced, randomized question-paper generation from a large question bank, auto-generated a *configurable number of hours* before the exam, exported as printable PDFs with an anti-leak audit trail. (No student login — students sit physically.)

## Roles

| Role | Online | Offline |
|------|:------:|:-------:|
| Admin | ✅ | ✅ |
| Examiner / Paper-setter | ✅ | ✅ |
| Invigilator / Proctor | ✅ | ✅ |
| Student | ✅ | ❌ (physical) |

## Key features

### Online exam — anti-cheat & AI proctoring
- Disable copy / cut / paste, right-click, F12 & DevTools shortcuts, text selection, printing
- Forced fullscreen; tab-switch / window-blur / fullscreen-exit detection
- Webcam **eye/gaze** detection, **mobile phone & object** detection, **multi-face** detection
- **Voice/audio** detection via microphone
- **Automatic timestamped snapshot capture** on cheating events
- Proctor dashboard to review captured violations

### Offline exam — secure paper generation
- Large question bank with difficulty ratings (Easy / Medium / Hard)
- Configurable: number of sets, questions per set, hard/medium/easy count per set
- **Configurable lead time** (hours before exam) for auto-generation
- Randomized selection — paper setter does **not** know which questions are chosen
- **Balanced sets** — equal total difficulty across all sets
- Anti-leak audit stamp: exam date, generation timestamp, generated-by
- Printable **PDF** export per set with an instructions section

## Tech stack

- **Frontend:** React + Vite + TypeScript, TailwindCSS + shadcn/ui, Framer Motion — Japanese *sakura* (falling cherry-blossom) theme
- **Backend:** Node.js + Express + TypeScript + Prisma + PostgreSQL
- **Auth:** JWT, role-based authorization
- **Proctoring:** TensorFlow.js + MediaPipe FaceMesh (eye/gaze), COCO-SSD (phone/object), multi-face detection, Web Audio API (voice)
- **PDF:** server-side generation

## Repository layout

```
/client   → React + Vite frontend (sakura UI, dashboards, exam runner, proctoring)
/server   → Express + Prisma API (auth, question bank, set generation, PDF, violations)
```

## Status

🚧 Under active development by the Yatharth Team.
