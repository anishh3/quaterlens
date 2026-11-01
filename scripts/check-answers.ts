import { answerQuestion } from "../lib/answer";
import { RECENT_QUESTIONS, SUGGESTIONS } from "../lib/questions";

const hero = answerQuestion("What was Infosys revenue in Q1 FY2026?");
if (!hero.found) throw new Error("Hero question was not answered");
if (!hero.headline.includes("US$ 4,941 million")) {
  throw new Error(`Unexpected hero headline: ${hero.headline}`);
}
if (!hero.headline.includes("Rs 42,279 crore")) {
  throw new Error("Hero headline is missing the rupee revenue");
}
if (hero.evidence.length < 2) throw new Error("Hero evidence missing");
if (hero.evidence[0]?.page !== "4" || hero.evidence[1]?.page !== "3") {
  throw new Error("Hero evidence pages do not match the report layout");
}

for (const item of [...RECENT_QUESTIONS, ...SUGGESTIONS.map((text) => ({ text }))]) {
  const answer = answerQuestion(item.text);
  if (!answer.headline) throw new Error(`Empty headline for: ${item.text}`);
  console.log(`\nQ: ${item.text}\nfound=${answer.found}\n${answer.headline}`);
}

console.log("\nAnswer checks passed.");
