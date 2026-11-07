// Made by scripts/make-sample.mjs: the tour's sample project, as the dashboard's API answered for it.
// Do not edit by hand; run the script again. Shown only while the tour runs (sample.ts).
import type { SampleSnapshot } from "./sample.js";

export const SAMPLE_SNAPSHOT: SampleSnapshot = {
 "takenAt": "2026-11-07T11:51:02.425Z",
 "answers": {
  "/api/projects": [
   {
    "id": "progressor-sample",
    "name": "Sample: Recipe box",
    "root": "Sample project"
   }
  ],
  "/api/workspaces": [],
  "/api/overview": [
   {
    "id": "progressor-sample",
    "name": "Sample: Recipe box",
    "root": "Sample project",
    "goals": [
     {
      "id": "sign-in-with-google",
      "title": "Sign in with Google",
      "status": "done",
      "done": 3,
      "total": 3,
      "waitingOnYou": false,
      "openQuestions": 0,
      "untriedTests": 0,
      "waitingSteps": 0,
      "updatedAt": 1794052262159.1482
     },
     {
      "id": "save-favourite-recipes",
      "title": "Save favourite recipes",
      "status": "done",
      "done": 3,
      "total": 3,
      "waitingOnYou": false,
      "openQuestions": 0,
      "untriedTests": 0,
      "waitingSteps": 0,
      "updatedAt": 1794052262200.8127
     },
     {
      "id": "search-by-ingredient",
      "title": "Search by ingredient",
      "status": "done",
      "done": 3,
      "total": 3,
      "waitingOnYou": false,
      "openQuestions": 0,
      "untriedTests": 0,
      "waitingSteps": 0,
      "updatedAt": 1794052262225.823
     },
     {
      "id": "dark-mode",
      "title": "Dark mode",
      "status": "paused",
      "done": 2,
      "total": 3,
      "waitingOnYou": true,
      "openQuestions": 0,
      "untriedTests": 1,
      "waitingSteps": 1,
      "updatedAt": 1794052262259.1467
     },
     {
      "id": "shopping-list-from-recipes",
      "title": "Shopping list from recipes",
      "status": "active",
      "done": 3,
      "total": 6,
      "waitingOnYou": false,
      "openQuestions": 0,
      "untriedTests": 0,
      "waitingSteps": 0,
      "updatedAt": 1794052262309.4163
     },
     {
      "id": "meal-planner",
      "title": "Meal planner",
      "status": "planned",
      "done": 0,
      "total": 2,
      "waitingOnYou": false,
      "openQuestions": 0,
      "untriedTests": 0,
      "waitingSteps": 0,
      "updatedAt": 1794052262333.291
     }
    ]
   }
  ],
  "/api/stats": {
   "goals": {
    "finished": 3,
    "open": 3,
    "cancelled": 0
   },
   "steps": {
    "done": 14,
    "open": 6,
    "cancelled": 0
   },
   "time": {
    "spent": 2709,
    "compared": {
     "steps": 14,
     "estimated": 580,
     "spent": 439,
     "withinEstimate": 13
    }
   },
   "drift": {
    "sideTrips": 2,
    "goalsWithSideTrips": 2,
    "goals": 6,
    "endings": {
     "merged back": 1,
     "returned": 1,
     "recalibrated": 0,
     "open": 0
    },
    "stepsAdded": 1,
    "stepsCancelled": 0
   },
   "perDay": [
    {
     "day": "2026-10-25",
     "count": 0
    },
    {
     "day": "2026-10-26",
     "count": 0
    },
    {
     "day": "2026-10-27",
     "count": 0
    },
    {
     "day": "2026-10-28",
     "count": 0
    },
    {
     "day": "2026-10-29",
     "count": 3
    },
    {
     "day": "2026-10-30",
     "count": 0
    },
    {
     "day": "2026-10-31",
     "count": 0
    },
    {
     "day": "2026-11-01",
     "count": 3
    },
    {
     "day": "2026-11-02",
     "count": 0
    },
    {
     "day": "2026-11-03",
     "count": 0
    },
    {
     "day": "2026-11-04",
     "count": 3
    },
    {
     "day": "2026-11-05",
     "count": 0
    },
    {
     "day": "2026-11-06",
     "count": 2
    },
    {
     "day": "2026-11-07",
     "count": 3
    }
   ],
   "longest": [
    {
     "goal": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes",
     "id": "t2",
     "title": "Store favourites on the device",
     "spent": 56,
     "estimate": 45,
     "project": "Sample: Recipe box",
     "projectId": "progressor-sample"
    },
    {
     "goal": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes",
     "id": "t3",
     "title": "Favourites page",
     "spent": 48,
     "estimate": 60,
     "project": "Sample: Recipe box",
     "projectId": "progressor-sample"
    },
    {
     "goal": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "id": "t3",
     "title": "Add up the same ingredients",
     "spent": 45,
     "estimate": 45,
     "project": "Sample: Recipe box",
     "projectId": "progressor-sample"
    },
    {
     "goal": "sign-in-with-google",
     "goalTitle": "Sign in with Google",
     "id": "t2",
     "title": "Keep people signed in",
     "spent": 42,
     "estimate": 60,
     "project": "Sample: Recipe box",
     "projectId": "progressor-sample"
    },
    {
     "goal": "search-by-ingredient",
     "goalTitle": "Search by ingredient",
     "id": "t3",
     "title": "Results page",
     "spent": 36,
     "estimate": 45,
     "project": "Sample: Recipe box",
     "projectId": "progressor-sample"
    }
   ],
   "perProject": [
    {
     "id": "progressor-sample",
     "name": "Sample: Recipe box",
     "done": 14,
     "open": 6,
     "goalsFinished": 3,
     "goalsOpen": 3,
     "spent": 2709,
     "sideTrips": 2,
     "lastTwoWeeks": 14
    }
   ]
  },
  "/api/projects/progressor-sample/roadmap": {
   "root": "Sample project",
   "file": ".progressor/roadmap.md",
   "goals": [
    {
     "id": "sign-in-with-google",
     "ref": "progressor://sign-in-with-google",
     "title": "Sign in with Google",
     "status": "done",
     "line": 11,
     "outcome": "People can sign in with their Google account and stay signed in on that device.",
     "added": {
      "at": "2026-10-29T04:00:00.000Z",
      "by": "AI"
     },
     "updated": {
      "at": "2026-10-29T06:11:00.000Z",
      "by": "AI"
     },
     "planFile": ".progressor/goals/sign-in-with-google.md",
     "done": 3,
     "total": 3,
     "counts": {
      "pending": 0,
      "in progress": 0,
      "with a helper": 0,
      "waiting on you": 0,
      "checked": 0,
      "done": 3,
      "released": 0,
      "dropped": 0
     },
     "waitingOnYou": false,
     "openQuestions": 0,
     "untriedTests": 0,
     "waitingSteps": 0,
     "updatedAt": 1794052262159.1482,
     "waiting": [],
     "blocked": false
    },
    {
     "id": "save-favourite-recipes",
     "ref": "progressor://save-favourite-recipes",
     "title": "Save favourite recipes",
     "status": "done",
     "line": 15,
     "outcome": "A heart on each recipe saves it, and Favourites lists them, also offline.",
     "added": {
      "at": "2026-11-01T04:40:00.000Z",
      "by": "AI"
     },
     "updated": {
      "at": "2026-11-01T07:12:00.000Z",
      "by": "AI"
     },
     "planFile": ".progressor/goals/save-favourite-recipes.md",
     "done": 3,
     "total": 3,
     "counts": {
      "pending": 0,
      "in progress": 0,
      "with a helper": 0,
      "waiting on you": 0,
      "checked": 0,
      "done": 3,
      "released": 0,
      "dropped": 0
     },
     "waitingOnYou": false,
     "openQuestions": 0,
     "untriedTests": 0,
     "waitingSteps": 0,
     "updatedAt": 1794052262200.8127,
     "waiting": [],
     "blocked": false
    },
    {
     "id": "search-by-ingredient",
     "ref": "progressor://search-by-ingredient",
     "title": "Search by ingredient",
     "status": "done",
     "line": 19,
     "outcome": "Typing an ingredient lists every recipe that uses it, fastest first.",
     "added": {
      "at": "2026-11-04T05:40:00.000Z",
      "by": "AI"
     },
     "updated": {
      "at": "2026-11-04T07:34:00.000Z",
      "by": "AI"
     },
     "planFile": ".progressor/goals/search-by-ingredient.md",
     "done": 3,
     "total": 3,
     "counts": {
      "pending": 0,
      "in progress": 0,
      "with a helper": 0,
      "waiting on you": 0,
      "checked": 0,
      "done": 3,
      "released": 0,
      "dropped": 0
     },
     "waitingOnYou": false,
     "openQuestions": 0,
     "untriedTests": 0,
     "waitingSteps": 0,
     "updatedAt": 1794052262225.823,
     "waiting": [],
     "blocked": false
    },
    {
     "id": "dark-mode",
     "ref": "progressor://dark-mode",
     "title": "Dark mode",
     "status": "paused",
     "line": 23,
     "outcome": "The app follows the phone's dark setting, and every screen reads well in it.",
     "added": {
      "at": "2026-11-06T03:10:00.000Z",
      "by": "AI"
     },
     "updated": {
      "at": "2026-11-06T03:10:00.000Z",
      "by": "AI"
     },
     "planFile": ".progressor/goals/dark-mode.md",
     "done": 2,
     "total": 3,
     "counts": {
      "pending": 0,
      "in progress": 0,
      "with a helper": 0,
      "waiting on you": 1,
      "checked": 0,
      "done": 2,
      "released": 0,
      "dropped": 0
     },
     "waitingOnYou": true,
     "openQuestions": 0,
     "untriedTests": 1,
     "waitingSteps": 1,
     "updatedAt": 1794052262259.1467,
     "waiting": [],
     "blocked": false
    },
    {
     "id": "shopping-list-from-recipes",
     "ref": "progressor://shopping-list-from-recipes",
     "title": "Shopping list from recipes",
     "status": "active",
     "line": 27,
     "claim": {
      "session": "s-sample",
      "pid": 27252,
      "since": "2026-11-07T03:45:00.000Z"
     },
     "outcome": "Pick recipes for the week and get one shopping list, with the same ingredients added up.",
     "added": {
      "at": "2026-11-07T03:45:00.000Z",
      "by": "AI"
     },
     "updated": {
      "at": "2026-11-07T03:45:00.000Z",
      "by": "AI"
     },
     "planFile": ".progressor/goals/shopping-list-from-recipes.md",
     "done": 3,
     "total": 6,
     "counts": {
      "pending": 2,
      "in progress": 1,
      "with a helper": 0,
      "waiting on you": 0,
      "checked": 0,
      "done": 3,
      "released": 0,
      "dropped": 0
     },
     "waitingOnYou": false,
     "openQuestions": 0,
     "untriedTests": 0,
     "waitingSteps": 0,
     "updatedAt": 1794052262309.4163,
     "waiting": [],
     "blocked": false
    },
    {
     "id": "meal-planner",
     "ref": "progressor://meal-planner",
     "title": "Meal planner",
     "status": "planned",
     "line": 32,
     "outcome": "Plan the week's meals on a calendar.",
     "added": {
      "at": "2026-11-07T05:49:00.000Z",
      "by": "AI"
     },
     "planFile": ".progressor/goals/meal-planner.md",
     "done": 0,
     "total": 2,
     "counts": {
      "pending": 2,
      "in progress": 0,
      "with a helper": 0,
      "waiting on you": 0,
      "checked": 0,
      "done": 0,
      "released": 0,
      "dropped": 0
     },
     "waitingOnYou": false,
     "openQuestions": 0,
     "untriedTests": 0,
     "waitingSteps": 0,
     "updatedAt": 1794052262333.291,
     "waiting": [],
     "blocked": false
    }
   ],
   "sessions": [
    {
     "session": "s-sample",
     "pid": 27252,
     "goal": "shopping-list-from-recipes",
     "running": true
    }
   ],
   "ideas": [],
   "standingInstructions": [
    {
     "id": "s1",
     "ref": "progressor://roadmap/s1",
     "text": "Ask me before adding a new dependency",
     "line": 5,
     "hard": true
    },
    {
     "id": "s2",
     "ref": "progressor://roadmap/s2",
     "text": "Write tests first for anything with logic",
     "line": 7,
     "hard": false
    }
   ],
   "context": "Recipe box is a small web app for saving recipes, planning meals and shopping for them. This is a sample, for the tour.\n\n- Built with React and a local database, so it works without a connection.\n- Runs on phones first; the desktop layout comes second.",
   "wishes": [],
   "schedule": {
    "capacity": 1,
    "helpers": 0,
    "running": [
     {
      "goal": "shopping-list-from-recipes",
      "id": "t4",
      "title": "Tick items off in the shop",
      "status": "in progress",
      "left": 0,
      "start": 0,
      "end": 0,
      "over": true
     }
    ],
    "next": [
     {
      "goal": "shopping-list-from-recipes",
      "id": "t5",
      "title": "Share the list by link",
      "status": "pending",
      "left": 42,
      "start": 0,
      "end": 42,
      "over": false
     }
    ],
    "goals": [
     {
      "id": "dark-mode",
      "title": "Dark mode",
      "finish": 0,
      "unknown": 0,
      "left": 0,
      "estimate": 10,
      "estimateSet": false,
      "adjusted": true
     },
     {
      "id": "shopping-list-from-recipes",
      "title": "Shopping list from recipes",
      "finish": 63,
      "unknown": 0,
      "left": 63,
      "estimate": 120,
      "estimateSet": false,
      "adjusted": true
     },
     {
      "id": "meal-planner",
      "title": "Meal planner",
      "finish": 136.5,
      "unknown": 0,
      "left": 73.5,
      "estimate": 105,
      "estimateSet": false,
      "adjusted": true
     }
    ],
    "finish": 136.5,
    "unknown": 0,
    "estimated": true,
    "factor": 0.7
   },
   "resources": [],
   "projectTalk": {
    "messages": [
     {
      "id": "m1",
      "ref": "progressor://_project/m1",
      "text": "Please keep the app working offline, whatever we add.",
      "line": 5,
      "state": "replied",
      "sentAt": "2026-11-07T05:47:00.000Z",
      "seenAt": "2026-11-07T05:49:00.000Z",
      "reply": "Will do. Everything is stored on the phone first and synced when there's a connection.",
      "repliedAt": "2026-11-07T05:49:00.000Z"
     }
    ]
   }
  },
  "/api/projects/progressor-sample/stats": {
   "goals": {
    "finished": 3,
    "open": 3,
    "cancelled": 0
   },
   "steps": {
    "done": 14,
    "open": 6,
    "cancelled": 0
   },
   "time": {
    "spent": 2709,
    "compared": {
     "steps": 14,
     "estimated": 580,
     "spent": 439,
     "withinEstimate": 13
    }
   },
   "drift": {
    "sideTrips": 2,
    "goalsWithSideTrips": 2,
    "goals": 6,
    "endings": {
     "merged back": 1,
     "returned": 1,
     "recalibrated": 0,
     "open": 0
    },
    "stepsAdded": 1,
    "stepsCancelled": 0
   },
   "perDay": [
    {
     "day": "2026-10-25",
     "count": 0
    },
    {
     "day": "2026-10-26",
     "count": 0
    },
    {
     "day": "2026-10-27",
     "count": 0
    },
    {
     "day": "2026-10-28",
     "count": 0
    },
    {
     "day": "2026-10-29",
     "count": 3
    },
    {
     "day": "2026-10-30",
     "count": 0
    },
    {
     "day": "2026-10-31",
     "count": 0
    },
    {
     "day": "2026-11-01",
     "count": 3
    },
    {
     "day": "2026-11-02",
     "count": 0
    },
    {
     "day": "2026-11-03",
     "count": 0
    },
    {
     "day": "2026-11-04",
     "count": 3
    },
    {
     "day": "2026-11-05",
     "count": 0
    },
    {
     "day": "2026-11-06",
     "count": 2
    },
    {
     "day": "2026-11-07",
     "count": 3
    }
   ],
   "longest": [
    {
     "goal": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes",
     "id": "t2",
     "title": "Store favourites on the device",
     "spent": 56,
     "estimate": 45
    },
    {
     "goal": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes",
     "id": "t3",
     "title": "Favourites page",
     "spent": 48,
     "estimate": 60
    },
    {
     "goal": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "id": "t3",
     "title": "Add up the same ingredients",
     "spent": 45,
     "estimate": 45
    },
    {
     "goal": "sign-in-with-google",
     "goalTitle": "Sign in with Google",
     "id": "t2",
     "title": "Keep people signed in",
     "spent": 42,
     "estimate": 60
    },
    {
     "goal": "search-by-ingredient",
     "goalTitle": "Search by ingredient",
     "id": "t3",
     "title": "Results page",
     "spent": 36,
     "estimate": 45
    }
   ],
   "perGoal": [
    {
     "id": "sign-in-with-google",
     "title": "Sign in with Google",
     "status": "done",
     "done": 3,
     "total": 3,
     "spent": 101,
     "estimate": 145,
     "sideTrips": 0
    },
    {
     "id": "save-favourite-recipes",
     "title": "Save favourite recipes",
     "status": "done",
     "done": 3,
     "total": 3,
     "spent": 122,
     "estimate": 135,
     "sideTrips": 1
    },
    {
     "id": "search-by-ingredient",
     "title": "Search by ingredient",
     "status": "done",
     "done": 3,
     "total": 3,
     "spent": 84,
     "estimate": 120,
     "sideTrips": 0
    },
    {
     "id": "dark-mode",
     "title": "Dark mode",
     "status": "paused",
     "done": 2,
     "total": 3,
     "spent": 1941,
     "estimate": 70,
     "sideTrips": 0
    },
    {
     "id": "shopping-list-from-recipes",
     "title": "Shopping list from recipes",
     "status": "active",
     "done": 3,
     "total": 6,
     "spent": 461,
     "estimate": 240,
     "sideTrips": 1
    },
    {
     "id": "meal-planner",
     "title": "Meal planner",
     "status": "planned",
     "done": 0,
     "total": 2,
     "spent": 0,
     "estimate": 105,
     "sideTrips": 0
    }
   ],
   "estimates": {
    "learn": true,
    "window": 20,
    "factor": 0.7,
    "samples": 14
   }
  },
  "/api/projects/progressor-sample/calendar": {
   "now": "2026-11-07T11:51:02.515Z",
   "events": [
    {
     "id": "added:sign-in-with-google",
     "kind": "goal-added",
     "title": "New goal: Sign in with Google",
     "start": "2026-10-29T04:00:00.000Z",
     "goal": "sign-in-with-google",
     "goalTitle": "Sign in with Google",
     "detail": "Added by your AI"
    },
    {
     "id": "step:sign-in-with-google:t1",
     "kind": "step",
     "title": "Google sign-in button",
     "start": "2026-10-29T04:00:00.000Z",
     "end": "2026-10-29T04:27:00.000Z",
     "goal": "sign-in-with-google",
     "goalTitle": "Sign in with Google",
     "detail": "Step finished"
    },
    {
     "id": "step:sign-in-with-google:t2",
     "kind": "step",
     "title": "Keep people signed in",
     "start": "2026-10-29T04:37:00.000Z",
     "end": "2026-10-29T05:19:00.000Z",
     "goal": "sign-in-with-google",
     "goalTitle": "Sign in with Google",
     "detail": "Step finished"
    },
    {
     "id": "step:sign-in-with-google:t3",
     "kind": "step",
     "title": "Tests for sign-in",
     "start": "2026-10-29T05:29:00.000Z",
     "end": "2026-10-29T06:01:00.000Z",
     "goal": "sign-in-with-google",
     "goalTitle": "Sign in with Google",
     "detail": "Step finished"
    },
    {
     "id": "done:sign-in-with-google",
     "kind": "goal-done",
     "title": "Finished: Sign in with Google",
     "start": "2026-10-29T06:01:00.000Z",
     "goal": "sign-in-with-google",
     "goalTitle": "Sign in with Google"
    },
    {
     "id": "added:save-favourite-recipes",
     "kind": "goal-added",
     "title": "New goal: Save favourite recipes",
     "start": "2026-11-01T04:40:00.000Z",
     "goal": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes",
     "detail": "Added by your AI"
    },
    {
     "id": "step:save-favourite-recipes:t1",
     "kind": "step",
     "title": "Heart button on a recipe",
     "start": "2026-11-01T04:40:00.000Z",
     "end": "2026-11-01T04:58:00.000Z",
     "goal": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes",
     "detail": "Step finished"
    },
    {
     "id": "step:save-favourite-recipes:t2",
     "kind": "step",
     "title": "Store favourites on the device",
     "start": "2026-11-01T05:08:00.000Z",
     "end": "2026-11-01T06:04:00.000Z",
     "goal": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes",
     "detail": "Step finished"
    },
    {
     "id": "step:save-favourite-recipes:t3",
     "kind": "step",
     "title": "Favourites page",
     "start": "2026-11-01T06:14:00.000Z",
     "end": "2026-11-01T07:02:00.000Z",
     "goal": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes",
     "detail": "Step finished"
    },
    {
     "id": "done:save-favourite-recipes",
     "kind": "goal-done",
     "title": "Finished: Save favourite recipes",
     "start": "2026-11-01T07:02:00.000Z",
     "goal": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes"
    },
    {
     "id": "added:search-by-ingredient",
     "kind": "goal-added",
     "title": "New goal: Search by ingredient",
     "start": "2026-11-04T05:40:00.000Z",
     "goal": "search-by-ingredient",
     "goalTitle": "Search by ingredient",
     "detail": "Added by your AI"
    },
    {
     "id": "step:search-by-ingredient:t1",
     "kind": "step",
     "title": "Index ingredients",
     "start": "2026-11-04T05:40:00.000Z",
     "end": "2026-11-04T06:07:00.000Z",
     "goal": "search-by-ingredient",
     "goalTitle": "Search by ingredient",
     "detail": "Step finished"
    },
    {
     "id": "step:search-by-ingredient:t2",
     "kind": "step",
     "title": "Search box",
     "start": "2026-11-04T06:17:00.000Z",
     "end": "2026-11-04T06:38:00.000Z",
     "goal": "search-by-ingredient",
     "goalTitle": "Search by ingredient",
     "detail": "Step finished"
    },
    {
     "id": "step:search-by-ingredient:t3",
     "kind": "step",
     "title": "Results page",
     "start": "2026-11-04T06:48:00.000Z",
     "end": "2026-11-04T07:24:00.000Z",
     "goal": "search-by-ingredient",
     "goalTitle": "Search by ingredient",
     "detail": "Step finished"
    },
    {
     "id": "done:search-by-ingredient",
     "kind": "goal-done",
     "title": "Finished: Search by ingredient",
     "start": "2026-11-04T07:24:00.000Z",
     "goal": "search-by-ingredient",
     "goalTitle": "Search by ingredient"
    },
    {
     "id": "added:dark-mode",
     "kind": "goal-added",
     "title": "New goal: Dark mode",
     "start": "2026-11-06T03:10:00.000Z",
     "goal": "dark-mode",
     "goalTitle": "Dark mode",
     "detail": "Added by your AI"
    },
    {
     "id": "step:dark-mode:t1",
     "kind": "step",
     "title": "Colours for dark mode",
     "start": "2026-11-06T03:10:00.000Z",
     "end": "2026-11-06T03:34:00.000Z",
     "goal": "dark-mode",
     "goalTitle": "Dark mode",
     "detail": "Step finished"
    },
    {
     "id": "step:dark-mode:t2",
     "kind": "step",
     "title": "Follow the phone's setting",
     "start": "2026-11-06T03:44:00.000Z",
     "end": "2026-11-06T03:58:00.000Z",
     "goal": "dark-mode",
     "goalTitle": "Dark mode",
     "detail": "Step finished"
    },
    {
     "id": "added:shopping-list-from-recipes",
     "kind": "goal-added",
     "title": "New goal: Shopping list from recipes",
     "start": "2026-11-07T03:45:00.000Z",
     "goal": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "detail": "Added by your AI"
    },
    {
     "id": "step:shopping-list-from-recipes:t1",
     "kind": "step",
     "title": "List items in the database",
     "start": "2026-11-07T03:45:00.000Z",
     "end": "2026-11-07T04:03:00.000Z",
     "goal": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "detail": "Step finished"
    },
    {
     "id": "step:shopping-list-from-recipes:t2",
     "kind": "step",
     "title": "Add a recipe's ingredients",
     "start": "2026-11-07T04:13:00.000Z",
     "end": "2026-11-07T04:44:00.000Z",
     "goal": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "detail": "Step finished"
    },
    {
     "id": "step:shopping-list-from-recipes:t3",
     "kind": "step",
     "title": "Add up the same ingredients",
     "start": "2026-11-07T04:54:00.000Z",
     "end": "2026-11-07T05:39:00.000Z",
     "goal": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "detail": "Step finished"
    },
    {
     "id": "added:meal-planner",
     "kind": "goal-added",
     "title": "New goal: Meal planner",
     "start": "2026-11-07T05:49:00.000Z",
     "goal": "meal-planner",
     "goalTitle": "Meal planner",
     "detail": "Added by your AI"
    },
    {
     "id": "planned:shopping-list-from-recipes:t5",
     "kind": "planned",
     "title": "Share the list by link",
     "start": "2026-11-07T11:51:02.527Z",
     "end": "2026-11-07T12:33:02.527Z",
     "goal": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "detail": "Planned next"
    },
    {
     "id": "due:shopping-list-from-recipes",
     "kind": "due",
     "title": "Should be done: Shopping list from recipes",
     "start": "2026-11-07T12:54:02.527Z",
     "goal": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "detail": "Expected finish, from the estimates"
    },
    {
     "id": "due:meal-planner",
     "kind": "due",
     "title": "Should be done: Meal planner",
     "start": "2026-11-07T14:07:32.527Z",
     "goal": "meal-planner",
     "goalTitle": "Meal planner",
     "detail": "Expected finish, from the estimates"
    }
   ]
  },
  "/api/projects/progressor-sample/handoffs": [],
  "/api/projects/progressor-sample/routines": {
   "routines": []
  },
  "/api/projects/progressor-sample/goals/sign-in-with-google": {
   "goal": {
    "id": "sign-in-with-google",
    "ref": "progressor://sign-in-with-google",
    "title": "Sign in with Google",
    "status": "done",
    "line": 11,
    "outcome": "People can sign in with their Google account and stay signed in on that device.",
    "added": {
     "at": "2026-10-29T04:00:00.000Z",
     "by": "AI"
    },
    "updated": {
     "at": "2026-10-29T06:11:00.000Z",
     "by": "AI"
    },
    "planFile": ".progressor/goals/sign-in-with-google.md",
    "done": 3,
    "total": 3,
    "counts": {
     "pending": 0,
     "in progress": 0,
     "with a helper": 0,
     "waiting on you": 0,
     "checked": 0,
     "done": 3,
     "released": 0,
     "dropped": 0
    },
    "waitingOnYou": false,
    "openQuestions": 0,
    "untriedTests": 0,
    "waitingSteps": 0,
    "updatedAt": 1794052262159.1482,
    "waiting": [],
    "blocked": false
   },
   "graph": {
    "nodes": [
     {
      "kind": "task",
      "id": "t1",
      "ref": "progressor://sign-in-with-google/t1",
      "title": "Google sign-in button",
      "status": "done",
      "line": 5,
      "code": [
       "src/auth/GoogleButton.tsx"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-10-29T04:00:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-10-29T04:27:00.000Z",
       "by": "AI"
      },
      "estimate": 45,
      "spent": 27,
      "startedAt": "2026-10-29T04:00:00.000Z",
      "finishedAt": "2026-10-29T04:27:00.000Z",
      "step": 0,
      "lane": 0
     },
     {
      "kind": "task",
      "id": "t2",
      "ref": "progressor://sign-in-with-google/t2",
      "title": "Keep people signed in",
      "status": "done",
      "line": 13,
      "code": [
       "src/auth/session.ts"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-10-29T04:00:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-10-29T05:19:00.000Z",
       "by": "AI"
      },
      "estimate": 60,
      "spent": 42,
      "startedAt": "2026-10-29T04:37:00.000Z",
      "finishedAt": "2026-10-29T05:19:00.000Z",
      "step": 1,
      "lane": 0
     },
     {
      "kind": "task",
      "id": "t3",
      "ref": "progressor://sign-in-with-google/t3",
      "title": "Tests for sign-in",
      "status": "done",
      "line": 21,
      "code": [
       "test/auth.test.ts"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-10-29T04:00:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-10-29T06:01:00.000Z",
       "by": "AI"
      },
      "estimate": 40,
      "spent": 32,
      "startedAt": "2026-10-29T05:29:00.000Z",
      "finishedAt": "2026-10-29T06:01:00.000Z",
      "step": 2,
      "lane": 0
     }
    ],
    "edges": [
     {
      "from": "t1",
      "to": "t2",
      "kind": "plan"
     },
     {
      "from": "t2",
      "to": "t3",
      "kind": "plan"
     }
    ]
   },
   "decisions": [],
   "notes": [],
   "handTests": [],
   "messages": [],
   "questions": [],
   "pictures": []
  },
  "/api/projects/progressor-sample/goals/save-favourite-recipes": {
   "goal": {
    "id": "save-favourite-recipes",
    "ref": "progressor://save-favourite-recipes",
    "title": "Save favourite recipes",
    "status": "done",
    "line": 15,
    "outcome": "A heart on each recipe saves it, and Favourites lists them, also offline.",
    "added": {
     "at": "2026-11-01T04:40:00.000Z",
     "by": "AI"
    },
    "updated": {
     "at": "2026-11-01T07:12:00.000Z",
     "by": "AI"
    },
    "planFile": ".progressor/goals/save-favourite-recipes.md",
    "done": 3,
    "total": 3,
    "counts": {
     "pending": 0,
     "in progress": 0,
     "with a helper": 0,
     "waiting on you": 0,
     "checked": 0,
     "done": 3,
     "released": 0,
     "dropped": 0
    },
    "waitingOnYou": false,
    "openQuestions": 0,
    "untriedTests": 0,
    "waitingSteps": 0,
    "updatedAt": 1794052262200.8127,
    "waiting": [],
    "blocked": false
   },
   "graph": {
    "nodes": [
     {
      "kind": "task",
      "id": "t1",
      "ref": "progressor://save-favourite-recipes/t1",
      "title": "Heart button on a recipe",
      "status": "done",
      "line": 5,
      "code": [
       "src/recipe/Heart.tsx"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-11-01T04:40:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-01T04:58:00.000Z",
       "by": "AI"
      },
      "estimate": 30,
      "spent": 18,
      "startedAt": "2026-11-01T04:40:00.000Z",
      "finishedAt": "2026-11-01T04:58:00.000Z",
      "step": 0,
      "lane": 0
     },
     {
      "kind": "task",
      "id": "t2",
      "ref": "progressor://save-favourite-recipes/t2",
      "title": "Store favourites on the device",
      "status": "done",
      "line": 13,
      "code": [
       "src/db/favourites.ts"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-11-01T04:40:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-01T06:04:00.000Z",
       "by": "AI"
      },
      "estimate": 45,
      "spent": 56,
      "startedAt": "2026-11-01T05:08:00.000Z",
      "finishedAt": "2026-11-01T06:04:00.000Z",
      "step": 1,
      "lane": 0
     },
     {
      "kind": "task",
      "id": "t3",
      "ref": "progressor://save-favourite-recipes/t3",
      "title": "Favourites page",
      "status": "done",
      "line": 21,
      "code": [
       "src/pages/Favourites.tsx"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-11-01T04:40:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-01T07:02:00.000Z",
       "by": "AI"
      },
      "estimate": 60,
      "spent": 48,
      "startedAt": "2026-11-01T06:14:00.000Z",
      "finishedAt": "2026-11-01T07:02:00.000Z",
      "step": 3,
      "lane": 0
     },
     {
      "kind": "detour",
      "id": "d1",
      "ref": "progressor://save-favourite-recipes/d1",
      "title": "Fix the database upgrade",
      "status": "merged back",
      "line": 30,
      "branchedFrom": "t2",
      "reason": "Old installs failed to open the database after the new table was added",
      "step": 2,
      "lane": 1
     }
    ],
    "edges": [
     {
      "from": "t1",
      "to": "t2",
      "kind": "plan"
     },
     {
      "from": "t2",
      "to": "t3",
      "kind": "plan"
     },
     {
      "from": "t2",
      "to": "d1",
      "kind": "detour"
     },
     {
      "from": "d1",
      "to": "t3",
      "kind": "merge"
     }
    ]
   },
   "decisions": [],
   "notes": [],
   "handTests": [],
   "messages": [],
   "questions": [],
   "pictures": []
  },
  "/api/projects/progressor-sample/goals/search-by-ingredient": {
   "goal": {
    "id": "search-by-ingredient",
    "ref": "progressor://search-by-ingredient",
    "title": "Search by ingredient",
    "status": "done",
    "line": 19,
    "outcome": "Typing an ingredient lists every recipe that uses it, fastest first.",
    "added": {
     "at": "2026-11-04T05:40:00.000Z",
     "by": "AI"
    },
    "updated": {
     "at": "2026-11-04T07:34:00.000Z",
     "by": "AI"
    },
    "planFile": ".progressor/goals/search-by-ingredient.md",
    "done": 3,
    "total": 3,
    "counts": {
     "pending": 0,
     "in progress": 0,
     "with a helper": 0,
     "waiting on you": 0,
     "checked": 0,
     "done": 3,
     "released": 0,
     "dropped": 0
    },
    "waitingOnYou": false,
    "openQuestions": 0,
    "untriedTests": 0,
    "waitingSteps": 0,
    "updatedAt": 1794052262225.823,
    "waiting": [],
    "blocked": false
   },
   "graph": {
    "nodes": [
     {
      "kind": "task",
      "id": "t1",
      "ref": "progressor://search-by-ingredient/t1",
      "title": "Index ingredients",
      "status": "done",
      "line": 5,
      "code": [
       "src/db/index.ts"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-11-04T05:40:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-04T06:07:00.000Z",
       "by": "AI"
      },
      "estimate": 45,
      "spent": 27,
      "startedAt": "2026-11-04T05:40:00.000Z",
      "finishedAt": "2026-11-04T06:07:00.000Z",
      "step": 0,
      "lane": 0
     },
     {
      "kind": "task",
      "id": "t2",
      "ref": "progressor://search-by-ingredient/t2",
      "title": "Search box",
      "status": "done",
      "line": 13,
      "code": [
       "src/search/SearchBox.tsx"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-11-04T05:40:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-04T06:38:00.000Z",
       "by": "AI"
      },
      "estimate": 30,
      "spent": 21,
      "startedAt": "2026-11-04T06:17:00.000Z",
      "finishedAt": "2026-11-04T06:38:00.000Z",
      "step": 1,
      "lane": 0
     },
     {
      "kind": "task",
      "id": "t3",
      "ref": "progressor://search-by-ingredient/t3",
      "title": "Results page",
      "status": "done",
      "line": 21,
      "code": [
       "src/pages/Results.tsx"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-11-04T05:40:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-04T07:24:00.000Z",
       "by": "AI"
      },
      "estimate": 45,
      "spent": 36,
      "startedAt": "2026-11-04T06:48:00.000Z",
      "finishedAt": "2026-11-04T07:24:00.000Z",
      "step": 2,
      "lane": 0
     }
    ],
    "edges": [
     {
      "from": "t1",
      "to": "t2",
      "kind": "plan"
     },
     {
      "from": "t2",
      "to": "t3",
      "kind": "plan"
     }
    ]
   },
   "decisions": [],
   "notes": [],
   "handTests": [],
   "messages": [],
   "questions": [],
   "pictures": []
  },
  "/api/projects/progressor-sample/goals/dark-mode": {
   "goal": {
    "id": "dark-mode",
    "ref": "progressor://dark-mode",
    "title": "Dark mode",
    "status": "paused",
    "line": 23,
    "outcome": "The app follows the phone's dark setting, and every screen reads well in it.",
    "added": {
     "at": "2026-11-06T03:10:00.000Z",
     "by": "AI"
    },
    "updated": {
     "at": "2026-11-06T03:10:00.000Z",
     "by": "AI"
    },
    "planFile": ".progressor/goals/dark-mode.md",
    "done": 2,
    "total": 3,
    "counts": {
     "pending": 0,
     "in progress": 0,
     "with a helper": 0,
     "waiting on you": 1,
     "checked": 0,
     "done": 2,
     "released": 0,
     "dropped": 0
    },
    "waitingOnYou": true,
    "openQuestions": 0,
    "untriedTests": 1,
    "waitingSteps": 1,
    "updatedAt": 1794052262259.1467,
    "waiting": [],
    "blocked": false
   },
   "graph": {
    "nodes": [
     {
      "kind": "task",
      "id": "t1",
      "ref": "progressor://dark-mode/t1",
      "title": "Colours for dark mode",
      "status": "done",
      "line": 5,
      "code": [
       "src/theme.css"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-11-06T03:10:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-06T03:34:00.000Z",
       "by": "AI"
      },
      "estimate": 40,
      "spent": 24,
      "startedAt": "2026-11-06T03:10:00.000Z",
      "finishedAt": "2026-11-06T03:34:00.000Z",
      "step": 0,
      "lane": 0
     },
     {
      "kind": "task",
      "id": "t2",
      "ref": "progressor://dark-mode/t2",
      "title": "Follow the phone's setting",
      "status": "done",
      "line": 13,
      "code": [
       "src/theme.ts"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-11-06T03:10:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-06T03:58:00.000Z",
       "by": "AI"
      },
      "estimate": 20,
      "spent": 14,
      "startedAt": "2026-11-06T03:44:00.000Z",
      "finishedAt": "2026-11-06T03:58:00.000Z",
      "step": 1,
      "lane": 0
     },
     {
      "kind": "task",
      "id": "t3",
      "ref": "progressor://dark-mode/t3",
      "title": "Try it on your phone",
      "status": "waiting on you",
      "line": 21,
      "code": [],
      "fromDetour": false,
      "added": {
       "at": "2026-11-06T03:10:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-06T04:08:00.000Z",
       "by": "AI"
      },
      "estimate": 10,
      "timingSince": "2026-11-06T04:08:00.000Z",
      "startedAt": "2026-11-06T04:08:00.000Z",
      "step": 2,
      "lane": 0
     }
    ],
    "edges": [
     {
      "from": "t1",
      "to": "t2",
      "kind": "plan"
     },
     {
      "from": "t2",
      "to": "t3",
      "kind": "plan"
     }
    ]
   },
   "decisions": [],
   "notes": [],
   "handTests": [
    {
     "id": "h1",
     "ref": "progressor://dark-mode/h1",
     "text": "Open the app on your phone with dark mode on. Every screen should be easy to read.",
     "line": 31,
     "result": "pending",
     "task": "t3",
     "seen": false,
     "added": {
      "at": "2026-11-06T04:08:00.000Z",
      "by": "AI"
     }
    }
   ],
   "messages": [],
   "questions": [],
   "pictures": []
  },
  "/api/projects/progressor-sample/goals/shopping-list-from-recipes": {
   "goal": {
    "id": "shopping-list-from-recipes",
    "ref": "progressor://shopping-list-from-recipes",
    "title": "Shopping list from recipes",
    "status": "active",
    "line": 27,
    "claim": {
     "session": "s-sample",
     "pid": 27252,
     "since": "2026-11-07T03:45:00.000Z"
    },
    "outcome": "Pick recipes for the week and get one shopping list, with the same ingredients added up.",
    "added": {
     "at": "2026-11-07T03:45:00.000Z",
     "by": "AI"
    },
    "updated": {
     "at": "2026-11-07T03:45:00.000Z",
     "by": "AI"
    },
    "planFile": ".progressor/goals/shopping-list-from-recipes.md",
    "done": 3,
    "total": 6,
    "counts": {
     "pending": 2,
     "in progress": 1,
     "with a helper": 0,
     "waiting on you": 0,
     "checked": 0,
     "done": 3,
     "released": 0,
     "dropped": 0
    },
    "waitingOnYou": false,
    "openQuestions": 0,
    "untriedTests": 0,
    "waitingSteps": 0,
    "updatedAt": 1794052262309.4163,
    "waiting": [],
    "blocked": false
   },
   "graph": {
    "nodes": [
     {
      "kind": "task",
      "id": "t1",
      "ref": "progressor://shopping-list-from-recipes/t1",
      "title": "List items in the database",
      "status": "done",
      "line": 5,
      "code": [
       "src/db/list.ts"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-11-07T03:45:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-07T04:03:00.000Z",
       "by": "AI"
      },
      "estimate": 30,
      "spent": 18,
      "startedAt": "2026-11-07T03:45:00.000Z",
      "finishedAt": "2026-11-07T04:03:00.000Z",
      "step": 0,
      "lane": 0
     },
     {
      "kind": "task",
      "id": "t2",
      "ref": "progressor://shopping-list-from-recipes/t2",
      "title": "Add a recipe's ingredients",
      "status": "done",
      "line": 13,
      "code": [
       "src/list/addRecipe.ts"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-11-07T03:45:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-07T04:44:00.000Z",
       "by": "AI"
      },
      "estimate": 45,
      "spent": 31,
      "startedAt": "2026-11-07T04:13:00.000Z",
      "finishedAt": "2026-11-07T04:44:00.000Z",
      "step": 1,
      "lane": 0
     },
     {
      "kind": "task",
      "id": "t3",
      "ref": "progressor://shopping-list-from-recipes/t3",
      "title": "Add up the same ingredients",
      "status": "done",
      "line": 21,
      "code": [
       "src/list/merge.ts"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-11-07T03:45:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-07T05:39:00.000Z",
       "by": "AI"
      },
      "estimate": 45,
      "spent": 45,
      "startedAt": "2026-11-07T04:54:00.000Z",
      "finishedAt": "2026-11-07T05:39:00.000Z",
      "step": 2,
      "lane": 0
     },
     {
      "kind": "task",
      "id": "t4",
      "ref": "progressor://shopping-list-from-recipes/t4",
      "title": "Tick items off in the shop",
      "status": "in progress",
      "line": 29,
      "code": [
       "src/pages/List.tsx"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-11-07T03:45:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-07T05:44:00.000Z",
       "by": "AI"
      },
      "estimate": 30,
      "timingSince": "2026-11-07T05:44:00.000Z",
      "startedAt": "2026-11-07T05:44:00.000Z",
      "step": 3,
      "lane": 0
     },
     {
      "kind": "task",
      "id": "t5",
      "ref": "progressor://shopping-list-from-recipes/t5",
      "title": "Share the list by link",
      "status": "pending",
      "line": 36,
      "code": [
       "src/list/share.ts"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-11-07T03:45:00.000Z",
       "by": "AI"
      },
      "estimate": 60,
      "step": 4,
      "lane": 0
     },
     {
      "kind": "task",
      "id": "t6",
      "ref": "progressor://shopping-list-from-recipes/t6",
      "title": "Convert cups and spoons to grams",
      "status": "pending",
      "line": 40,
      "code": [
       "src/list/units.ts"
      ],
      "addedBy": "d1",
      "fromDetour": true,
      "added": {
       "at": "2026-11-07T05:39:00.000Z",
       "by": "AI"
      },
      "estimate": 30,
      "step": 5,
      "lane": 0
     },
     {
      "kind": "detour",
      "id": "d1",
      "ref": "progressor://shopping-list-from-recipes/d1",
      "title": "Units that don't match",
      "status": "returned",
      "line": 51,
      "branchedFrom": "t3",
      "reason": "\"1 cup\" and \"200 g\" of the same flour could not be added up",
      "step": 3,
      "lane": 1
     }
    ],
    "edges": [
     {
      "from": "t1",
      "to": "t2",
      "kind": "plan"
     },
     {
      "from": "t2",
      "to": "t3",
      "kind": "plan"
     },
     {
      "from": "t3",
      "to": "t4",
      "kind": "plan"
     },
     {
      "from": "t4",
      "to": "t5",
      "kind": "plan"
     },
     {
      "from": "t5",
      "to": "t6",
      "kind": "plan"
     },
     {
      "from": "t3",
      "to": "d1",
      "kind": "detour"
     },
     {
      "from": "d1",
      "to": "t3",
      "kind": "return"
     }
    ]
   },
   "decisions": [
    {
     "id": "c1",
     "ref": "progressor://shopping-list-from-recipes/c1",
     "text": "Ingredients are added up by name and unit: 200 g flour + 100 g Flour = 300 g flour.",
     "line": 48,
     "added": {
      "at": "2026-11-07T05:39:00.000Z",
      "by": "AI"
     }
    }
   ],
   "notes": [],
   "handTests": [],
   "messages": [
    {
     "id": "m1",
     "ref": "progressor://shopping-list-from-recipes/m1",
     "text": "Can the list update live when my partner ticks something off?",
     "line": 5,
     "state": "replied",
     "sentAt": "2026-11-07T05:44:00.000Z",
     "seenAt": "2026-11-07T05:47:00.000Z",
     "reply": "Yes: the shared list syncs when either phone is online. I added it to \"Share the list by link\".",
     "repliedAt": "2026-11-07T05:47:00.000Z"
    }
   ],
   "questions": [],
   "pictures": []
  },
  "/api/projects/progressor-sample/goals/meal-planner": {
   "goal": {
    "id": "meal-planner",
    "ref": "progressor://meal-planner",
    "title": "Meal planner",
    "status": "planned",
    "line": 32,
    "outcome": "Plan the week's meals on a calendar.",
    "added": {
     "at": "2026-11-07T05:49:00.000Z",
     "by": "AI"
    },
    "planFile": ".progressor/goals/meal-planner.md",
    "done": 0,
    "total": 2,
    "counts": {
     "pending": 2,
     "in progress": 0,
     "with a helper": 0,
     "waiting on you": 0,
     "checked": 0,
     "done": 0,
     "released": 0,
     "dropped": 0
    },
    "waitingOnYou": false,
    "openQuestions": 0,
    "untriedTests": 0,
    "waitingSteps": 0,
    "updatedAt": 1794052262333.291,
    "waiting": [],
    "blocked": false
   },
   "graph": {
    "nodes": [
     {
      "kind": "task",
      "id": "t1",
      "ref": "progressor://meal-planner/t1",
      "title": "Week view",
      "status": "pending",
      "line": 5,
      "code": [],
      "fromDetour": false,
      "added": {
       "at": "2026-11-07T05:49:00.000Z",
       "by": "AI"
      },
      "estimate": 60,
      "step": 0,
      "lane": 0
     },
     {
      "kind": "task",
      "id": "t2",
      "ref": "progressor://meal-planner/t2",
      "title": "Drag a recipe onto a day",
      "status": "pending",
      "line": 8,
      "code": [],
      "fromDetour": false,
      "added": {
       "at": "2026-11-07T05:49:00.000Z",
       "by": "AI"
      },
      "estimate": 45,
      "step": 1,
      "lane": 0
     }
    ],
    "edges": [
     {
      "from": "t1",
      "to": "t2",
      "kind": "plan"
     }
    ]
   },
   "decisions": [],
   "notes": [],
   "handTests": [],
   "messages": [],
   "questions": [],
   "pictures": []
  }
 }
};
