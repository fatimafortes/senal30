// Manual acceptance check for commit 2 (T1/T2/T3 from docs/IMPLEMENTATION_PROMPT.md).
// Run with: node --env-file=.env.local scripts/test-classification.ts
// Not part of the app — a throwaway runner, safe to delete after review.

import { classifyBaselineSymptoms } from "../src/lib/llm.ts";

const cases = [
  {
    id: "T1",
    text: "Me levanto 4 veces en la noche a orinar y tengo mucha sed todo el día.",
    expect: "has_credible_signal: true, symptom candidate: nicturia",
  },
  {
    id: "T2",
    text: "Me siento bien, me salió alta el azúcar en el estudio.",
    expect: "has_credible_signal: false",
  },
  {
    id: "T3",
    text: "Me duele la rodilla.",
    expect: "no candidates / has_credible_signal: false",
  },
];

for (const c of cases) {
  const result = await classifyBaselineSymptoms(c.text);
  console.log(`\n${c.id} — esperado: ${c.expect}`);
  console.log(`  texto: "${c.text}"`);
  console.log(`  resultado:`, JSON.stringify(result, null, 2));
}
