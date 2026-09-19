import assert from "node:assert/strict";
import { test } from "vitest";
import { DEFAULT_WEIGHTS, DynamicHomophilyScorer, NO_FACTORS, formatRanking, rankConnections, titleCase } from "./scorer";

// The reference script, verbatim. If this ever disagrees with the Python
// output, the port is wrong, not the test.
const myProfile = {
  hometown: "Chicago, IL",
  universities: ["University of Michigan", "Stanford University"],
  clubs: ["Debate Team", "IEEE"],
  academicFocus: ["Computer Science", "Machine Learning"],
  pastCompanies: ["Google", "Startup Inc"],
};
const myWeights = {
  shared_company: 30, shared_club: 20, shared_academic_focus: 15, shared_hometown: 10, shared_university: 5,
};
const connections = [
  {
    candidateName: "Contact A (The Former Coworker)",
    hometown: "Detroit, MI",
    universities: ["University of Michigan"],
    clubs: ["IEEE"],
    academicFocus: ["Computer Science"],
    pastCompanies: ["Google"],
  },
  {
    candidateName: "Contact B (The Hometown Peer)",
    hometown: "Chicago, IL",
    universities: ["Stanford University"],
    clubs: ["Outdoors Club"],
    academicFocus: ["Economics"],
    pastCompanies: ["Deloitte"],
  },
];

test("the reference example scores 70 and 15, with the reference's reasons", () => {
  const scorer = new DynamicHomophilyScorer(myProfile, myWeights);
  const results = rankConnections(scorer, connections);

  assert.deepEqual(results, [
    {
      name: "Contact A (The Former Coworker)",
      totalScore: 70,
      matchDrivers: [
        "Shared University: University Of Michigan (+5)",
        "Shared Organization: Ieee (+20)",
        "Shared Academic Focus: Computer Science (+15)",
        "Shared Past Employer: Google (+30)",
      ],
    },
    {
      name: "Contact B (The Hometown Peer)",
      totalScore: 15,
      matchDrivers: [
        "Shared Hometown (+10)",
        "Shared University: Stanford University (+5)",
      ],
    },
  ]);

  assert.equal(formatRanking(results).split("\n")[0], "Rank 1: Contact A (The Former Coworker) - Score: 70");
});

test("the defaults are the reference weights, and a missing weight counts zero", () => {
  assert.deepEqual({ ...DEFAULT_WEIGHTS }, myWeights);
  // As in the reference, a factor that matches is still NAMED at +0 — the
  // weight decides the points, not whether the match is reported.
  const scorer = new DynamicHomophilyScorer(myProfile, { shared_company: 30 });
  const r = scorer.scoreConnection("Only company counts", connections[0]);
  assert.equal(r.totalScore, 30);
  assert.deepEqual(r.matchDrivers, [
    "Shared University: University Of Michigan (+0)",
    "Shared Organization: Ieee (+0)",
    "Shared Academic Focus: Computer Science (+0)",
    "Shared Past Employer: Google (+30)",
  ]);
});

test("nothing shared is a named outcome, not an empty list", () => {
  const scorer = new DynamicHomophilyScorer(myProfile, myWeights);
  const r = scorer.scoreConnection("Stranger", { hometown: "Boise, ID" });
  assert.equal(r.totalScore, 0);
  assert.deepEqual(r.matchDrivers, [NO_FACTORS]);
  assert.equal(scorer.scoreConnection("Nobody").totalScore, 0);
});

test("matching is case-insensitive and each shared value counts once", () => {
  const scorer = new DynamicHomophilyScorer(myProfile, myWeights);
  const r = scorer.scoreConnection("Shouty", {
    hometown: "CHICAGO, IL",
    clubs: ["ieee", "IEEE", "debate team"],
    universities: ["stanford university", "STANFORD UNIVERSITY"],
  });
  // hometown 10 + two clubs 40 + one university 5
  assert.equal(r.totalScore, 55);
});

test("titleCase behaves like Python's str.title()", () => {
  assert.equal(titleCase("university of michigan"), "University Of Michigan");
  assert.equal(titleCase("booz allen hamilton"), "Booz Allen Hamilton");
  assert.equal(titleCase("ieee"), "Ieee");
});
