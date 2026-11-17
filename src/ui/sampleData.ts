// Made by scripts/make-sample.mjs: the tour's sample project, as the dashboard's API answered for it.
// Do not edit by hand; run the script again. Shown only while the tour runs (sample.ts).
import type { SampleSnapshot } from "./sample.js";

export const SAMPLE_SNAPSHOT: SampleSnapshot = {
 "takenAt": "2026-11-17T05:30:23.666Z",
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
      "updatedAt": 1794893423442.4482
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
      "updatedAt": 1794893423473.7126
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
      "updatedAt": 1794893423500.5073
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
      "oldestUntried": "2026-11-16T04:08:00.000Z",
      "waitingSteps": 1,
      "updatedAt": 1794893423524.0825
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
      "updatedAt": 1794893423568.8335
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
      "updatedAt": 1794893423589.1343
     }
    ],
    "seriousRisks": [
     {
      "id": "r2",
      "title": "Recipes lost when a phone is reset"
     }
    ],
    "failedChecks": [],
    "waitingOnOthers": [
     {
      "goal": "shopping-list-from-recipes",
      "goalTitle": "Shopping list from recipes",
      "step": "t5",
      "title": "Share the list by link",
      "waitingFor": "Sam",
      "need": "Open the share link on their phone and tick an item off"
     }
    ],
    "people": [
     {
      "id": "p1",
      "name": "Sam",
      "role": "your partner, trying the shared list"
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
    "spent": 1961,
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
     "day": "2026-11-04",
     "count": 0
    },
    {
     "day": "2026-11-05",
     "count": 0
    },
    {
     "day": "2026-11-06",
     "count": 0
    },
    {
     "day": "2026-11-07",
     "count": 0
    },
    {
     "day": "2026-11-08",
     "count": 3
    },
    {
     "day": "2026-11-09",
     "count": 0
    },
    {
     "day": "2026-11-10",
     "count": 0
    },
    {
     "day": "2026-11-11",
     "count": 3
    },
    {
     "day": "2026-11-12",
     "count": 0
    },
    {
     "day": "2026-11-13",
     "count": 0
    },
    {
     "day": "2026-11-14",
     "count": 3
    },
    {
     "day": "2026-11-15",
     "count": 0
    },
    {
     "day": "2026-11-16",
     "count": 2
    },
    {
     "day": "2026-11-17",
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
     "spent": 1961,
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
      "at": "2026-11-08T04:00:00.000Z",
      "by": "AI"
     },
     "updated": {
      "at": "2026-11-08T06:11:00.000Z",
      "by": "AI"
     },
     "planFile": ".progressor/goals/sign-in-with-google.md",
     "done": 3,
     "total": 3,
     "counts": {
      "pending": 0,
      "in progress": 0,
      "waiting on someone": 0,
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
     "updatedAt": 1794893423442.4482,
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
      "at": "2026-11-11T04:40:00.000Z",
      "by": "AI"
     },
     "updated": {
      "at": "2026-11-11T07:12:00.000Z",
      "by": "AI"
     },
     "planFile": ".progressor/goals/save-favourite-recipes.md",
     "done": 3,
     "total": 3,
     "counts": {
      "pending": 0,
      "in progress": 0,
      "waiting on someone": 0,
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
     "updatedAt": 1794893423473.7126,
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
      "at": "2026-11-14T05:40:00.000Z",
      "by": "AI"
     },
     "updated": {
      "at": "2026-11-14T07:34:00.000Z",
      "by": "AI"
     },
     "planFile": ".progressor/goals/search-by-ingredient.md",
     "done": 3,
     "total": 3,
     "counts": {
      "pending": 0,
      "in progress": 0,
      "waiting on someone": 0,
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
     "updatedAt": 1794893423500.5073,
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
     "forLaunch": true,
     "added": {
      "at": "2026-11-16T03:10:00.000Z",
      "by": "AI"
     },
     "updated": {
      "at": "2026-11-17T05:49:00.000Z",
      "by": "AI"
     },
     "planFile": ".progressor/goals/dark-mode.md",
     "done": 2,
     "total": 3,
     "counts": {
      "pending": 0,
      "in progress": 0,
      "waiting on someone": 0,
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
     "oldestUntried": "2026-11-16T04:08:00.000Z",
     "waitingSteps": 1,
     "updatedAt": 1794893423524.0825,
     "waiting": [],
     "blocked": false
    },
    {
     "id": "shopping-list-from-recipes",
     "ref": "progressor://shopping-list-from-recipes",
     "title": "Shopping list from recipes",
     "status": "active",
     "line": 28,
     "claim": {
      "session": "s-sample",
      "pid": 29396,
      "since": "2026-11-17T03:45:00.000Z"
     },
     "outcome": "Pick recipes for the week and get one shopping list, with the same ingredients added up.",
     "forLaunch": true,
     "added": {
      "at": "2026-11-17T03:45:00.000Z",
      "by": "AI"
     },
     "updated": {
      "at": "2026-11-17T05:49:00.000Z",
      "by": "AI"
     },
     "planFile": ".progressor/goals/shopping-list-from-recipes.md",
     "done": 3,
     "total": 6,
     "counts": {
      "pending": 1,
      "in progress": 1,
      "waiting on someone": 1,
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
     "updatedAt": 1794893423568.8335,
     "waiting": [],
     "blocked": false
    },
    {
     "id": "meal-planner",
     "ref": "progressor://meal-planner",
     "title": "Meal planner",
     "status": "planned",
     "line": 34,
     "outcome": "Plan the week's meals on a calendar.",
     "added": {
      "at": "2026-11-17T05:49:00.000Z",
      "by": "AI"
     },
     "planFile": ".progressor/goals/meal-planner.md",
     "done": 0,
     "total": 2,
     "counts": {
      "pending": 2,
      "in progress": 0,
      "waiting on someone": 0,
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
     "updatedAt": 1794893423589.1343,
     "waiting": [],
     "blocked": false
    }
   ],
   "sessions": [
    {
     "session": "s-sample",
     "pid": 29396,
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
   "seriousRisks": [
    {
     "id": "r2",
     "title": "Recipes lost when a phone is reset"
    }
   ],
   "waitingOnOthers": [
    {
     "goal": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "step": "t5",
     "title": "Share the list by link",
     "waitingFor": "Sam",
     "need": "Open the share link on their phone and tick an item off"
    }
   ],
   "people": [
    {
     "id": "p1",
     "name": "Sam",
     "role": "your partner, trying the shared list"
    }
   ],
   "schedule": {
    "capacity": 1,
    "helpers": 0,
    "running": [
     {
      "goal": "shopping-list-from-recipes",
      "id": "t4",
      "title": "Tick items off in the shop",
      "status": "in progress",
      "left": 21,
      "start": 0,
      "end": 21,
      "over": false
     }
    ],
    "next": [
     {
      "goal": "shopping-list-from-recipes",
      "id": "t5",
      "title": "Share the list by link",
      "status": "waiting on someone",
      "left": 42,
      "start": 21,
      "end": 63,
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
      "finish": 84,
      "unknown": 0,
      "left": 84,
      "estimate": 120,
      "estimateSet": false,
      "adjusted": true
     },
     {
      "id": "meal-planner",
      "title": "Meal planner",
      "finish": 157.5,
      "unknown": 0,
      "left": 73.5,
      "estimate": 105,
      "estimateSet": false,
      "adjusted": true
     }
    ],
    "finish": 157.5,
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
      "sentAt": "2026-11-17T05:47:00.000Z",
      "seenAt": "2026-11-17T05:49:00.000Z",
      "reply": "Will do. Everything is stored on the phone first and synced when there's a connection.",
      "repliedAt": "2026-11-17T05:49:00.000Z"
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
    "spent": 1961,
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
     "day": "2026-11-04",
     "count": 0
    },
    {
     "day": "2026-11-05",
     "count": 0
    },
    {
     "day": "2026-11-06",
     "count": 0
    },
    {
     "day": "2026-11-07",
     "count": 0
    },
    {
     "day": "2026-11-08",
     "count": 3
    },
    {
     "day": "2026-11-09",
     "count": 0
    },
    {
     "day": "2026-11-10",
     "count": 0
    },
    {
     "day": "2026-11-11",
     "count": 3
    },
    {
     "day": "2026-11-12",
     "count": 0
    },
    {
     "day": "2026-11-13",
     "count": 0
    },
    {
     "day": "2026-11-14",
     "count": 3
    },
    {
     "day": "2026-11-15",
     "count": 0
    },
    {
     "day": "2026-11-16",
     "count": 2
    },
    {
     "day": "2026-11-17",
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
     "spent": 1560,
     "estimate": 70,
     "sideTrips": 0
    },
    {
     "id": "shopping-list-from-recipes",
     "title": "Shopping list from recipes",
     "status": "active",
     "done": 3,
     "total": 6,
     "spent": 94,
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
   "now": "2026-11-17T05:30:23.714Z",
   "events": [
    {
     "id": "added:sign-in-with-google",
     "kind": "goal-added",
     "title": "New goal: Sign in with Google",
     "start": "2026-11-08T04:00:00.000Z",
     "goal": "sign-in-with-google",
     "goalTitle": "Sign in with Google",
     "detail": "Added by your AI"
    },
    {
     "id": "step:sign-in-with-google:t1",
     "kind": "step",
     "title": "Google sign-in button",
     "start": "2026-11-08T04:00:00.000Z",
     "end": "2026-11-08T04:27:00.000Z",
     "goal": "sign-in-with-google",
     "goalTitle": "Sign in with Google",
     "detail": "Step finished"
    },
    {
     "id": "step:sign-in-with-google:t2",
     "kind": "step",
     "title": "Keep people signed in",
     "start": "2026-11-08T04:37:00.000Z",
     "end": "2026-11-08T05:19:00.000Z",
     "goal": "sign-in-with-google",
     "goalTitle": "Sign in with Google",
     "detail": "Step finished"
    },
    {
     "id": "step:sign-in-with-google:t3",
     "kind": "step",
     "title": "Tests for sign-in",
     "start": "2026-11-08T05:29:00.000Z",
     "end": "2026-11-08T06:01:00.000Z",
     "goal": "sign-in-with-google",
     "goalTitle": "Sign in with Google",
     "detail": "Step finished"
    },
    {
     "id": "done:sign-in-with-google",
     "kind": "goal-done",
     "title": "Finished: Sign in with Google",
     "start": "2026-11-08T06:01:00.000Z",
     "goal": "sign-in-with-google",
     "goalTitle": "Sign in with Google"
    },
    {
     "id": "added:save-favourite-recipes",
     "kind": "goal-added",
     "title": "New goal: Save favourite recipes",
     "start": "2026-11-11T04:40:00.000Z",
     "goal": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes",
     "detail": "Added by your AI"
    },
    {
     "id": "step:save-favourite-recipes:t1",
     "kind": "step",
     "title": "Heart button on a recipe",
     "start": "2026-11-11T04:40:00.000Z",
     "end": "2026-11-11T04:58:00.000Z",
     "goal": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes",
     "detail": "Step finished"
    },
    {
     "id": "step:save-favourite-recipes:t2",
     "kind": "step",
     "title": "Store favourites on the device",
     "start": "2026-11-11T05:08:00.000Z",
     "end": "2026-11-11T06:04:00.000Z",
     "goal": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes",
     "detail": "Step finished"
    },
    {
     "id": "step:save-favourite-recipes:t3",
     "kind": "step",
     "title": "Favourites page",
     "start": "2026-11-11T06:14:00.000Z",
     "end": "2026-11-11T07:02:00.000Z",
     "goal": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes",
     "detail": "Step finished"
    },
    {
     "id": "done:save-favourite-recipes",
     "kind": "goal-done",
     "title": "Finished: Save favourite recipes",
     "start": "2026-11-11T07:02:00.000Z",
     "goal": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes"
    },
    {
     "id": "added:search-by-ingredient",
     "kind": "goal-added",
     "title": "New goal: Search by ingredient",
     "start": "2026-11-14T05:40:00.000Z",
     "goal": "search-by-ingredient",
     "goalTitle": "Search by ingredient",
     "detail": "Added by your AI"
    },
    {
     "id": "step:search-by-ingredient:t1",
     "kind": "step",
     "title": "Index ingredients",
     "start": "2026-11-14T05:40:00.000Z",
     "end": "2026-11-14T06:07:00.000Z",
     "goal": "search-by-ingredient",
     "goalTitle": "Search by ingredient",
     "detail": "Step finished"
    },
    {
     "id": "step:search-by-ingredient:t2",
     "kind": "step",
     "title": "Search box",
     "start": "2026-11-14T06:17:00.000Z",
     "end": "2026-11-14T06:38:00.000Z",
     "goal": "search-by-ingredient",
     "goalTitle": "Search by ingredient",
     "detail": "Step finished"
    },
    {
     "id": "step:search-by-ingredient:t3",
     "kind": "step",
     "title": "Results page",
     "start": "2026-11-14T06:48:00.000Z",
     "end": "2026-11-14T07:24:00.000Z",
     "goal": "search-by-ingredient",
     "goalTitle": "Search by ingredient",
     "detail": "Step finished"
    },
    {
     "id": "done:search-by-ingredient",
     "kind": "goal-done",
     "title": "Finished: Search by ingredient",
     "start": "2026-11-14T07:24:00.000Z",
     "goal": "search-by-ingredient",
     "goalTitle": "Search by ingredient"
    },
    {
     "id": "added:dark-mode",
     "kind": "goal-added",
     "title": "New goal: Dark mode",
     "start": "2026-11-16T03:10:00.000Z",
     "goal": "dark-mode",
     "goalTitle": "Dark mode",
     "detail": "Added by your AI"
    },
    {
     "id": "step:dark-mode:t1",
     "kind": "step",
     "title": "Colours for dark mode",
     "start": "2026-11-16T03:10:00.000Z",
     "end": "2026-11-16T03:34:00.000Z",
     "goal": "dark-mode",
     "goalTitle": "Dark mode",
     "detail": "Step finished"
    },
    {
     "id": "step:dark-mode:t2",
     "kind": "step",
     "title": "Follow the phone's setting",
     "start": "2026-11-16T03:44:00.000Z",
     "end": "2026-11-16T03:58:00.000Z",
     "goal": "dark-mode",
     "goalTitle": "Dark mode",
     "detail": "Step finished"
    },
    {
     "id": "added:shopping-list-from-recipes",
     "kind": "goal-added",
     "title": "New goal: Shopping list from recipes",
     "start": "2026-11-17T03:45:00.000Z",
     "goal": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "detail": "Added by your AI"
    },
    {
     "id": "step:shopping-list-from-recipes:t1",
     "kind": "step",
     "title": "List items in the database",
     "start": "2026-11-17T03:45:00.000Z",
     "end": "2026-11-17T04:03:00.000Z",
     "goal": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "detail": "Step finished"
    },
    {
     "id": "step:shopping-list-from-recipes:t2",
     "kind": "step",
     "title": "Add a recipe's ingredients",
     "start": "2026-11-17T04:13:00.000Z",
     "end": "2026-11-17T04:44:00.000Z",
     "goal": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "detail": "Step finished"
    },
    {
     "id": "step:shopping-list-from-recipes:t3",
     "kind": "step",
     "title": "Add up the same ingredients",
     "start": "2026-11-17T04:54:00.000Z",
     "end": "2026-11-17T05:39:00.000Z",
     "goal": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "detail": "Step finished"
    },
    {
     "id": "planned:shopping-list-from-recipes:t4",
     "kind": "planned",
     "title": "Tick items off in the shop",
     "start": "2026-11-17T05:30:23.717Z",
     "end": "2026-11-17T05:51:23.717Z",
     "goal": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "detail": "Being worked on"
    },
    {
     "id": "added:meal-planner",
     "kind": "goal-added",
     "title": "New goal: Meal planner",
     "start": "2026-11-17T05:49:00.000Z",
     "goal": "meal-planner",
     "goalTitle": "Meal planner",
     "detail": "Added by your AI"
    },
    {
     "id": "planned:shopping-list-from-recipes:t5",
     "kind": "planned",
     "title": "Share the list by link",
     "start": "2026-11-17T05:51:23.717Z",
     "end": "2026-11-17T06:33:23.717Z",
     "goal": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "detail": "Being worked on"
    },
    {
     "id": "due:shopping-list-from-recipes",
     "kind": "due",
     "title": "Should be done: Shopping list from recipes",
     "start": "2026-11-17T06:54:23.717Z",
     "goal": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "detail": "Expected finish, from the estimates"
    },
    {
     "id": "due:meal-planner",
     "kind": "due",
     "title": "Should be done: Meal planner",
     "start": "2026-11-17T08:07:53.717Z",
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
  "/api/projects/progressor-sample/readiness": {
   "readiness": {
    "scope": {
     "kind": "marked",
     "goals": [
      {
       "id": "dark-mode",
       "title": "Dark mode",
       "status": "paused"
      },
      {
       "id": "shopping-list-from-recipes",
       "title": "Shopping list from recipes",
       "status": "active"
      }
     ]
    },
    "ready": false,
    "left": 6,
    "verdict": "Not ready yet: 2 steps for the AI, 2 things for you, 1 thing waiting on others, 1 serious risk.",
    "ai": [
     {
      "kind": "step",
      "goal": "shopping-list-from-recipes",
      "goalTitle": "Shopping list from recipes",
      "id": "t4",
      "title": "Tick items off in the shop"
     },
     {
      "kind": "step",
      "goal": "shopping-list-from-recipes",
      "goalTitle": "Shopping list from recipes",
      "id": "t6",
      "title": "Convert cups and spoons to grams"
     }
    ],
    "you": [
     {
      "kind": "step",
      "goal": "dark-mode",
      "goalTitle": "Dark mode",
      "id": "t3",
      "title": "Try it on your phone"
     },
     {
      "kind": "hand test",
      "goal": "dark-mode",
      "goalTitle": "Dark mode",
      "id": "h1",
      "title": "Open the app on your phone with dark mode on. Every screen should be easy to read."
     }
    ],
    "others": [
     {
      "person": "Sam",
      "items": [
       {
        "kind": "step",
        "goal": "shopping-list-from-recipes",
        "goalTitle": "Shopping list from recipes",
        "id": "t5",
        "title": "Share the list by link",
        "need": "Open the share link on their phone and tick an item off"
       }
      ]
     }
    ],
    "risks": [
     {
      "id": "r2",
      "title": "Recipes lost when a phone is reset",
      "score": 6
     }
    ]
   }
  },
  "/api/projects/progressor-sample/risks": {
   "risks": [
    {
     "id": "r1",
     "title": "A shared list link reaches a stranger",
     "likelihood": "medium",
     "impact": "high",
     "mitigation": "Links expire after a week and can be switched off",
     "goals": [
      {
       "id": "shopping-list-from-recipes",
       "title": "Shopping list from recipes",
       "status": "active"
      }
     ],
     "status": "open",
     "score": 6,
     "serious": false
    },
    {
     "id": "r2",
     "title": "Recipes lost when a phone is reset",
     "likelihood": "medium",
     "impact": "high",
     "mitigation": "Back recipes up to the account",
     "goals": [],
     "status": "open",
     "score": 6,
     "serious": true
    },
    {
     "id": "r3",
     "title": "Slow search with thousands of recipes",
     "likelihood": "low",
     "impact": "medium",
     "goals": [
      {
       "id": "search-by-ingredient",
       "title": "Search by ingredient",
       "status": "done"
      }
     ],
     "status": "open",
     "score": 2,
     "serious": false
    }
   ]
  },
  "/api/projects/progressor-sample/feed": {
   "items": [
    {
     "goalId": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "kind": "decision",
     "key": "decision/shopping-list-from-recipes/c1",
     "at": "2026-11-17T05:39:00.000Z",
     "by": "AI",
     "text": "added a decision"
    },
    {
     "goalId": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "kind": "step",
     "key": "step/shopping-list-from-recipes/t3",
     "at": "2026-11-17T05:39:00.000Z",
     "by": "AI",
     "text": "finished step t3 Add up the same ingredients"
    },
    {
     "goalId": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "kind": "step",
     "key": "step/shopping-list-from-recipes/t2",
     "at": "2026-11-17T04:44:00.000Z",
     "by": "AI",
     "text": "finished step t2 Add a recipe's ingredients"
    },
    {
     "goalId": "shopping-list-from-recipes",
     "goalTitle": "Shopping list from recipes",
     "kind": "step",
     "key": "step/shopping-list-from-recipes/t1",
     "at": "2026-11-17T04:03:00.000Z",
     "by": "AI",
     "text": "finished step t1 List items in the database"
    },
    {
     "goalId": "dark-mode",
     "goalTitle": "Dark mode",
     "kind": "handTest",
     "key": "handTest/dark-mode/h1",
     "at": "2026-11-16T04:08:00.000Z",
     "by": "AI",
     "text": "added something to try",
     "open": true
    },
    {
     "goalId": "dark-mode",
     "goalTitle": "Dark mode",
     "kind": "step",
     "key": "step/dark-mode/t2",
     "at": "2026-11-16T03:58:00.000Z",
     "by": "AI",
     "text": "finished step t2 Follow the phone's setting"
    },
    {
     "goalId": "dark-mode",
     "goalTitle": "Dark mode",
     "kind": "step",
     "key": "step/dark-mode/t1",
     "at": "2026-11-16T03:34:00.000Z",
     "by": "AI",
     "text": "finished step t1 Colours for dark mode"
    },
    {
     "goalId": "search-by-ingredient",
     "goalTitle": "Search by ingredient",
     "kind": "goal",
     "key": "goal/search-by-ingredient/done",
     "at": "2026-11-14T07:34:00.000Z",
     "by": "AI",
     "text": "finished goal Search by ingredient"
    },
    {
     "goalId": "search-by-ingredient",
     "goalTitle": "Search by ingredient",
     "kind": "step",
     "key": "step/search-by-ingredient/t3",
     "at": "2026-11-14T07:24:00.000Z",
     "by": "AI",
     "text": "finished step t3 Results page"
    },
    {
     "goalId": "search-by-ingredient",
     "goalTitle": "Search by ingredient",
     "kind": "step",
     "key": "step/search-by-ingredient/t2",
     "at": "2026-11-14T06:38:00.000Z",
     "by": "AI",
     "text": "finished step t2 Search box"
    },
    {
     "goalId": "search-by-ingredient",
     "goalTitle": "Search by ingredient",
     "kind": "step",
     "key": "step/search-by-ingredient/t1",
     "at": "2026-11-14T06:07:00.000Z",
     "by": "AI",
     "text": "finished step t1 Index ingredients"
    },
    {
     "goalId": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes",
     "kind": "goal",
     "key": "goal/save-favourite-recipes/done",
     "at": "2026-11-11T07:12:00.000Z",
     "by": "AI",
     "text": "finished goal Save favourite recipes"
    },
    {
     "goalId": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes",
     "kind": "step",
     "key": "step/save-favourite-recipes/t3",
     "at": "2026-11-11T07:02:00.000Z",
     "by": "AI",
     "text": "finished step t3 Favourites page"
    },
    {
     "goalId": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes",
     "kind": "step",
     "key": "step/save-favourite-recipes/t2",
     "at": "2026-11-11T06:04:00.000Z",
     "by": "AI",
     "text": "finished step t2 Store favourites on the device"
    },
    {
     "goalId": "save-favourite-recipes",
     "goalTitle": "Save favourite recipes",
     "kind": "step",
     "key": "step/save-favourite-recipes/t1",
     "at": "2026-11-11T04:58:00.000Z",
     "by": "AI",
     "text": "finished step t1 Heart button on a recipe"
    },
    {
     "goalId": "sign-in-with-google",
     "goalTitle": "Sign in with Google",
     "kind": "goal",
     "key": "goal/sign-in-with-google/done",
     "at": "2026-11-08T06:11:00.000Z",
     "by": "AI",
     "text": "finished goal Sign in with Google"
    },
    {
     "goalId": "sign-in-with-google",
     "goalTitle": "Sign in with Google",
     "kind": "step",
     "key": "step/sign-in-with-google/t3",
     "at": "2026-11-08T06:01:00.000Z",
     "by": "AI",
     "text": "finished step t3 Tests for sign-in"
    },
    {
     "goalId": "sign-in-with-google",
     "goalTitle": "Sign in with Google",
     "kind": "step",
     "key": "step/sign-in-with-google/t2",
     "at": "2026-11-08T05:19:00.000Z",
     "by": "AI",
     "text": "finished step t2 Keep people signed in"
    },
    {
     "goalId": "sign-in-with-google",
     "goalTitle": "Sign in with Google",
     "kind": "step",
     "key": "step/sign-in-with-google/t1",
     "at": "2026-11-08T04:27:00.000Z",
     "by": "AI",
     "text": "finished step t1 Google sign-in button"
    }
   ]
  },
  "/api/projects/progressor-sample/cost": {
   "priced": false,
   "goals": {
    "sign-in-with-google": {
     "tokens": 1609260,
     "steps": {
      "t1": {
       "tokens": 536420
      },
      "t2": {
       "tokens": 536420
      },
      "t3": {
       "tokens": 536420
      }
     }
    },
    "save-favourite-recipes": {
     "tokens": 2680260,
     "steps": {
      "t1": {
       "tokens": 893420
      },
      "t2": {
       "tokens": 893420
      },
      "t3": {
       "tokens": 893420
      }
     }
    },
    "search-by-ingredient": {
     "tokens": 1223700,
     "steps": {
      "t1": {
       "tokens": 407900
      },
      "t2": {
       "tokens": 407900
      },
      "t3": {
       "tokens": 407900
      }
     }
    },
    "shopping-list-from-recipes": {
     "tokens": 1996960,
     "steps": {
      "t1": {
       "tokens": 673100
      },
      "t2": {
       "tokens": 673100
      },
      "t3": {
       "tokens": 650760
      }
     }
    }
   },
   "other": {
    "tokens": 22340
   }
  },
  "/api/projects/progressor-sample/sessions": {
   "sessions": [],
   "helpers": {
    "busy": 0
   }
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
     "at": "2026-11-08T04:00:00.000Z",
     "by": "AI"
    },
    "updated": {
     "at": "2026-11-08T06:11:00.000Z",
     "by": "AI"
    },
    "planFile": ".progressor/goals/sign-in-with-google.md",
    "done": 3,
    "total": 3,
    "counts": {
     "pending": 0,
     "in progress": 0,
     "waiting on someone": 0,
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
    "updatedAt": 1794893423442.4482,
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
       "at": "2026-11-08T04:00:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-08T04:27:00.000Z",
       "by": "AI"
      },
      "estimate": 45,
      "spent": 27,
      "startedAt": "2026-11-08T04:00:00.000Z",
      "finishedAt": "2026-11-08T04:27:00.000Z",
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
       "at": "2026-11-08T04:00:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-08T05:19:00.000Z",
       "by": "AI"
      },
      "estimate": 60,
      "spent": 42,
      "startedAt": "2026-11-08T04:37:00.000Z",
      "finishedAt": "2026-11-08T05:19:00.000Z",
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
       "at": "2026-11-08T04:00:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-08T06:01:00.000Z",
       "by": "AI"
      },
      "estimate": 40,
      "spent": 32,
      "startedAt": "2026-11-08T05:29:00.000Z",
      "finishedAt": "2026-11-08T06:01:00.000Z",
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
     "at": "2026-11-11T04:40:00.000Z",
     "by": "AI"
    },
    "updated": {
     "at": "2026-11-11T07:12:00.000Z",
     "by": "AI"
    },
    "planFile": ".progressor/goals/save-favourite-recipes.md",
    "done": 3,
    "total": 3,
    "counts": {
     "pending": 0,
     "in progress": 0,
     "waiting on someone": 0,
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
    "updatedAt": 1794893423473.7126,
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
       "at": "2026-11-11T04:40:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-11T04:58:00.000Z",
       "by": "AI"
      },
      "estimate": 30,
      "spent": 18,
      "startedAt": "2026-11-11T04:40:00.000Z",
      "finishedAt": "2026-11-11T04:58:00.000Z",
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
       "at": "2026-11-11T04:40:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-11T06:04:00.000Z",
       "by": "AI"
      },
      "estimate": 45,
      "spent": 56,
      "startedAt": "2026-11-11T05:08:00.000Z",
      "finishedAt": "2026-11-11T06:04:00.000Z",
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
       "at": "2026-11-11T04:40:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-11T07:02:00.000Z",
       "by": "AI"
      },
      "estimate": 60,
      "spent": 48,
      "startedAt": "2026-11-11T06:14:00.000Z",
      "finishedAt": "2026-11-11T07:02:00.000Z",
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
     "at": "2026-11-14T05:40:00.000Z",
     "by": "AI"
    },
    "updated": {
     "at": "2026-11-14T07:34:00.000Z",
     "by": "AI"
    },
    "planFile": ".progressor/goals/search-by-ingredient.md",
    "done": 3,
    "total": 3,
    "counts": {
     "pending": 0,
     "in progress": 0,
     "waiting on someone": 0,
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
    "updatedAt": 1794893423500.5073,
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
       "at": "2026-11-14T05:40:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-14T06:07:00.000Z",
       "by": "AI"
      },
      "estimate": 45,
      "spent": 27,
      "startedAt": "2026-11-14T05:40:00.000Z",
      "finishedAt": "2026-11-14T06:07:00.000Z",
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
       "at": "2026-11-14T05:40:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-14T06:38:00.000Z",
       "by": "AI"
      },
      "estimate": 30,
      "spent": 21,
      "startedAt": "2026-11-14T06:17:00.000Z",
      "finishedAt": "2026-11-14T06:38:00.000Z",
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
       "at": "2026-11-14T05:40:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-14T07:24:00.000Z",
       "by": "AI"
      },
      "estimate": 45,
      "spent": 36,
      "startedAt": "2026-11-14T06:48:00.000Z",
      "finishedAt": "2026-11-14T07:24:00.000Z",
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
    "forLaunch": true,
    "added": {
     "at": "2026-11-16T03:10:00.000Z",
     "by": "AI"
    },
    "updated": {
     "at": "2026-11-17T05:49:00.000Z",
     "by": "AI"
    },
    "planFile": ".progressor/goals/dark-mode.md",
    "done": 2,
    "total": 3,
    "counts": {
     "pending": 0,
     "in progress": 0,
     "waiting on someone": 0,
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
    "oldestUntried": "2026-11-16T04:08:00.000Z",
    "waitingSteps": 1,
    "updatedAt": 1794893423524.0825,
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
       "at": "2026-11-16T03:10:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-16T03:34:00.000Z",
       "by": "AI"
      },
      "estimate": 40,
      "spent": 24,
      "startedAt": "2026-11-16T03:10:00.000Z",
      "finishedAt": "2026-11-16T03:34:00.000Z",
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
       "at": "2026-11-16T03:10:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-16T03:58:00.000Z",
       "by": "AI"
      },
      "estimate": 20,
      "spent": 14,
      "startedAt": "2026-11-16T03:44:00.000Z",
      "finishedAt": "2026-11-16T03:58:00.000Z",
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
       "at": "2026-11-16T03:10:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-16T04:08:00.000Z",
       "by": "AI"
      },
      "estimate": 10,
      "timingSince": "2026-11-16T04:08:00.000Z",
      "startedAt": "2026-11-16T04:08:00.000Z",
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
      "at": "2026-11-16T04:08:00.000Z",
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
    "line": 28,
    "claim": {
     "session": "s-sample",
     "pid": 29396,
     "since": "2026-11-17T03:45:00.000Z"
    },
    "outcome": "Pick recipes for the week and get one shopping list, with the same ingredients added up.",
    "forLaunch": true,
    "added": {
     "at": "2026-11-17T03:45:00.000Z",
     "by": "AI"
    },
    "updated": {
     "at": "2026-11-17T05:49:00.000Z",
     "by": "AI"
    },
    "planFile": ".progressor/goals/shopping-list-from-recipes.md",
    "done": 3,
    "total": 6,
    "counts": {
     "pending": 1,
     "in progress": 1,
     "waiting on someone": 1,
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
    "updatedAt": 1794893423568.8335,
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
       "at": "2026-11-17T03:45:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-17T04:03:00.000Z",
       "by": "AI"
      },
      "estimate": 30,
      "spent": 18,
      "startedAt": "2026-11-17T03:45:00.000Z",
      "finishedAt": "2026-11-17T04:03:00.000Z",
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
       "at": "2026-11-17T03:45:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-17T04:44:00.000Z",
       "by": "AI"
      },
      "estimate": 45,
      "spent": 31,
      "startedAt": "2026-11-17T04:13:00.000Z",
      "finishedAt": "2026-11-17T04:44:00.000Z",
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
       "at": "2026-11-17T03:45:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-17T05:39:00.000Z",
       "by": "AI"
      },
      "estimate": 45,
      "spent": 45,
      "startedAt": "2026-11-17T04:54:00.000Z",
      "finishedAt": "2026-11-17T05:39:00.000Z",
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
       "at": "2026-11-17T03:45:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-17T05:44:00.000Z",
       "by": "AI"
      },
      "estimate": 30,
      "timingSince": "2026-11-17T05:44:00.000Z",
      "startedAt": "2026-11-17T05:44:00.000Z",
      "step": 3,
      "lane": 0
     },
     {
      "kind": "task",
      "id": "t5",
      "ref": "progressor://shopping-list-from-recipes/t5",
      "title": "Share the list by link",
      "status": "waiting on someone",
      "line": 36,
      "code": [
       "src/list/share.ts"
      ],
      "fromDetour": false,
      "added": {
       "at": "2026-11-17T03:45:00.000Z",
       "by": "AI"
      },
      "updated": {
       "at": "2026-11-17T05:49:00.000Z",
       "by": "AI"
      },
      "estimate": 60,
      "timingSince": "2026-11-17T05:49:00.000Z",
      "waitingFor": "Sam",
      "need": "Open the share link on their phone and tick an item off",
      "startedAt": "2026-11-17T05:49:00.000Z",
      "step": 4,
      "lane": 0
     },
     {
      "kind": "task",
      "id": "t6",
      "ref": "progressor://shopping-list-from-recipes/t6",
      "title": "Convert cups and spoons to grams",
      "status": "pending",
      "line": 46,
      "code": [
       "src/list/units.ts"
      ],
      "addedBy": "d1",
      "fromDetour": true,
      "added": {
       "at": "2026-11-17T05:39:00.000Z",
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
      "line": 57,
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
     "line": 54,
     "added": {
      "at": "2026-11-17T05:39:00.000Z",
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
     "sentAt": "2026-11-17T05:44:00.000Z",
     "seenAt": "2026-11-17T05:47:00.000Z",
     "reply": "Yes: the shared list syncs when either phone is online. I added it to \"Share the list by link\".",
     "repliedAt": "2026-11-17T05:47:00.000Z"
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
    "line": 34,
    "outcome": "Plan the week's meals on a calendar.",
    "added": {
     "at": "2026-11-17T05:49:00.000Z",
     "by": "AI"
    },
    "planFile": ".progressor/goals/meal-planner.md",
    "done": 0,
    "total": 2,
    "counts": {
     "pending": 2,
     "in progress": 0,
     "waiting on someone": 0,
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
    "updatedAt": 1794893423589.1343,
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
       "at": "2026-11-17T05:49:00.000Z",
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
       "at": "2026-11-17T05:49:00.000Z",
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
