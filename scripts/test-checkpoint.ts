// Manual acceptance check for commit 4 (T4/T5 from docs/IMPLEMENTATION_PROMPT.md).
// Run with: node --env-file=.env.local scripts/test-checkpoint.ts

import {
  generateCheckpointQuestions,
  compareCheckpointToBaseline,
} from "../src/lib/llm.ts";

const declaredSignal = "nicturia";
const baselineText =
  "Me levanto 4 veces en la noche a orinar y tengo mucha sed todo el día.";

console.log("Preguntas generadas para la señal declarada:");
const questions = await generateCheckpointQuestions(declaredSignal);
console.log(JSON.stringify(questions, null, 2));

const cases: { id: string; expect: string; answers: [string, string, string] }[] = [
  {
    id: "T4",
    expect: "confirmed",
    answers: [
      "Ya casi no me levanto en la noche, tal vez una vez.",
      "La sed ya no es tan fuerte como antes.",
      "Me siento con más energía en general.",
    ],
  },
  {
    id: "T5",
    expect: "failed",
    answers: [
      "Sigo levantándome igual, como 4 veces cada noche.",
      "La sed sigue igual de fuerte que antes.",
      "No he notado ningún cambio.",
    ],
  },
];

for (const c of cases) {
  const result = await compareCheckpointToBaseline(
    baselineText,
    declaredSignal,
    c.answers
  );
  console.log(`\n${c.id} — esperado: ${c.expect}`);
  console.log(`  resultado:`, JSON.stringify(result, null, 2));
}
