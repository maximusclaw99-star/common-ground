export * from "./types";
export * from "./tiers";
export { canonical, normalizeText, sharedPhrase, tokenSetSimilarity, nearMiss } from "./normalize";
export { specificity, isSpecific, SPECIFIC_ENOUGH } from "./specificity";
export { deriveSeniority, prepareStudent } from "./predicates";
export { scoreAffinity, rankPeople, coverage, type RankedPeople } from "./score";
