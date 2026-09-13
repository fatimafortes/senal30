# DECISIONS

## 2026-09-13 — T8, T9, T10 cerrados (Security Floor) — y dos huecos de T10 corregidos

**T8 — validación, nada llega a la base ni al prompt.** Probado con
`scripts/test-validation.ts` contra el schema real (`caseIntakeSchema`),
simulando el mismo formato de mensaje que arma `POST /api/cases`:
- Texto de 10,000 caracteres → rechazado: `Revisa "raw_text": Máximo 2000
  caracteres.`
- Formulario completamente vacío → rechazado: `Revisa "patient_alias":
  Requerido.` (6 campos fallan a la vez, se muestra el primero).

Por construcción del route handler, `caseIntakeSchema.safeParse` corre
antes de cualquier llamada a `classifyBaselineSymptoms` o a Supabase —
ninguno de los dos casos llega a tocar la base ni el prompt.

**T9 — la key de Gemini nunca sale al cliente.** Se hizo un build de
producción con las variables reales (no placeholders) y se buscó tanto el
nombre `GEMINI_API_KEY` como el valor real de la key en `.next/static`
(lo único que se manda al navegador): cero resultados en ambos casos. Sí
aparece — a propósito — `NEXT_PUBLIC_SUPABASE_ANON_KEY`, que está
diseñada para ser pública (RLS es lo que protege los datos, no el
secreto de esa key). `GEMINI_API_KEY` solo aparece en `.next/server/`
(código que corre en el servidor, nunca llega al navegador).

**T10 — etiqueta de IA en toda pantalla con salida de modelo.** Al
revisar las 5 apariciones de `<AiDisclosure />` en el código se
encontraron dos huecos reales, corregidos en `CheckpointSection.tsx`:
1. La tarjeta de veredicto en borrador mostraba la etiqueta incluso
   cuando `verdict = 'not_scalable'` — ese texto es fijo del sistema
   (nunca se declaró señal, nunca llama a Gemini), no de IA. Ahora la
   etiqueta se excluye explícitamente para `not_scalable`.
2. Una vez confirmado el veredicto, la etiqueta **desaparecía por
   completo**, aunque el texto mostrado (`ai_rationale`) seguía siendo el
   mismo que redactó el modelo cuando no hubo corrección. La confirmación
   humana aprueba el borrador, no cambia quién lo escribió — la etiqueta
   ahora se mantiene después de confirmar, y solo desaparece cuando el
   texto mostrado es la razón de la propia usuaria (corrección) o un
   texto fijo del sistema (`not_scalable`, casos semilla).

Con esos dos fixes, las 5 ubicaciones actuales son consistentes: la
etiqueta aparece si y solo si el texto que se muestra lo escribió el
modelo, en cualquier estado de la pantalla.

## 2026-09-13 — T3/T4/T5: dejados como estaban, con evidencia adicional

Por instrucción de la usuaria, no se tocan. T3 ya cubierto por
`scripts/test-classification.ts` (texto ambiguo → sin candidatos). T4/T5
ya cubiertos por `scripts/test-checkpoint.ts` (mejora → confirmed, sin
cambio → failed) y ahora también verificados en producción con datos
reales: la usuaria corrió el checkpoint de día 30 del caso de Maria con
las tres respuestas mostrando que nada cambió, y el sistema produjo
`SEÑAL FALLÓ` correctamente.

## 2026-09-13 — T7 cerrado con evidencia empírica (dos cuentas reales)

Probado en producción por la usuaria con una segunda cuenta de Google
real, distinta al owner de los casos:

- Sin sesión, la URL directa de un caso (`/cases/[id]`) redirige a
  `/login` — el proxy protege la ruta antes de que llegue a la página.
- Con sesión de la segunda cuenta: `/cases` muestra 0 casos (RLS scoping
  la consulta por `owner_id = auth.uid()` funciona), y la URL directa de
  un caso de la primera cuenta devuelve 404 — RLS bloquea el `select`,
  `page.tsx` lo trata como "no existe" (comportamiento correcto: no debe
  filtrar ni siquiera que el caso existe, mucho menos su contenido).
- El aviso de datos ficticios se ve correctamente en `/cases`.

T7 del test plan (`docs/PACKET.md` sección 9) cerrado.

## 2026-09-13 — T6 con sesión real: fuera de alcance por tiempo, y por qué no hace falta

Se armó el procedimiento para probar T6 con una cookie de sesión real
(PATCH directo a la API REST de Supabase, sin pasar por nuestra ruta,
intentando poner `confirmed_by_owner_id` como otro usuario o modificar un
checkpoint ya confirmado). Se dejó fuera de alcance por tiempo — no se
llegó a correr.

**Por qué el trigger la hace redundante, no solo "también válida"**: T6
pregunta si un caso puede llegar a un estado cerrado sin confirmación del
owner, **sin importar la vía**. La prueba a nivel de ruta (401 sin sesión)
solo cubre una vía: nuestro propio código en `/api/cases/[id]/checkpoint/confirm`.
El trigger de `0003_senal30_protect_checkpoint_confirmation.sql`
(`before insert or update` sobre `senal30_checkpoints`) actúa en la capa
de datos, por debajo de cualquier vía posible de escritura — nuestra ruta,
una llamada directa a la API REST de Supabase, o cualquier código futuro
que alguien agregue. Rechaza la escritura (`raise exception`) si
`confirmed_by_owner_id` no es `auth.uid()`, o si se intenta tocar un
checkpoint que ya tiene `confirmed_by_owner_id`. Esa garantía no depende
de qué ruta se use para escribir — es estructural, se cumple por
construcción. La prueba con cookie real habría confirmado empíricamente
lo mismo que el trigger ya garantiza por diseño; queda como pendiente
opcional si se quiere la evidencia empírica además de la garantía
estructural, pero no es necesaria para sostener la afirmación de T6.

## 2026-09-13 — Aviso permanente de datos ficticios (piso de seguridad #5)

**Encontrado**: los casos creados a mano durante las pruebas (p. ej.
"Roberto", "Maria") no llevan ninguna etiqueta de datos inventados —
solo los casos cargados por "Cargar casos de demostración"
(`is_seed = true`) la tienen. El piso de seguridad de
`docs/IMPLEMENTATION_PROMPT.md` (#5) dice "All seed data invented and
visibly labeled as fictional. No real personal data anywhere" — el
principio de fondo (nunca datos reales) aplica a cualquier caso en el
sistema, no solo a los precargados.

**Por qué no se etiquetó cada caso individualmente como `is_seed`**:
`is_seed` significa específicamente "caso de demostración precargado con
clasificación ya escrita a mano, sin pasar por Gemini" — mezclar ese
significado con "caso real de prueba que sí pasó por la clasificación
real" sería confuso y falso en ambos sentidos. En vez de eso, se agregó
un aviso permanente, visible en cada pantalla donde se ve o se captura un
caso:
- `/cases`: banner fijo arriba de la lista — "Todos los datos en este
  sistema son ficticios. Este es un proyecto escolar; nunca ingreses
  información real de una paciente."
- `/cases/new`: el mismo aviso, justo donde se escribe el texto de
  síntomas — es el punto real donde alguien podría escribir un dato real
  por accidente.

Esto cubre el caso general (cualquier dato en el sistema es inventado)
sin inventar una etiqueta por caso que no se puede verificar
automáticamente — solo la usuaria sabe si lo que escribió es ficticio.

## 2026-09-13 — Commit 5: confirmación humana y auditoría

**Hallazgo antes de escribir código — no es un override, es un hueco que se
cerró**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` es pública por diseño (protegida
por RLS), lo que significa que cualquier usuario técnico podría llamar
directo a la API REST de Supabase con su propia sesión, sin pasar por
nuestras rutas de Next.js. La policy RLS de `senal30_checkpoints`
(migración 0001) verifica que el checkpoint pertenezca a un caso del
usuario, pero no restringe qué columnas puede escribir ni con qué valores
— en teoría alguien podría escribir `confirmed_by_owner_id` con cualquier
valor y saltarse la razón obligatoria de una corrección, sin tocar
nuestro código en absoluto.

**Fix — `0003_senal30_protect_checkpoint_confirmation.sql`** (aditivo,
solo agrega una función y un trigger sobre `senal30_checkpoints`, nada
destructivo, no toca ninguna otra tabla): un trigger `before insert or
update` que (1) hace inmutable un checkpoint ya confirmado — ni el
veredicto, ni la razón, ni quién lo confirmó pueden cambiar después por
ninguna vía — y (2) exige que `confirmed_by_owner_id` sea siempre
`auth.uid()`, nunca otro usuario. Esto no cambia ningún comportamiento
legítimo de la app; solo hace imposible el atajo que encontré, sin
importar por dónde se intente.

**`POST /api/cases/[id]/checkpoint/confirm`** — la única forma de que un
veredicto de día 30 sea final:
- Body: `{ verdict, override_reason? }`. `confirmed_by_owner_id` y
  `confirmed_at` los pone el servidor a partir de la sesión — nunca se
  aceptan del cliente.
- Si el veredicto elegido es igual al borrador que ya existía, es un
  "Confirmar" simple, sin razón.
- Si es distinto al borrador (o no había borrador porque el proveedor
  falló al comparar), es una corrección: la razón es obligatoria (mínimo
  10 caracteres) y se guarda en `senal30_audit_log`
  (`checkpoint_overridden`, con `original_verdict` y `reason`).
- Un checkpoint ya confirmado devuelve 409 — no se puede reconfirmar ni
  recorregir.
- `not_scalable` también requiere confirmación, igual que `confirmed` y
  `failed` — la Condición 2 ("la IA nunca cierra un caso") no hace
  excepción para ese veredicto, aunque el diagrama del packet lo muestre
  yendo directo a la bitácora.

**Bitácora completa**: se revisó cada transición de estado del caso contra
`senal30_audit_log` — `case_created`, `baseline_classified`,
`case_enrolled`, `signal_manufactured`, `marked_unresolved`,
`day_30_reached`, `checkpoint_compared`, y ahora `checkpoint_confirmed` /
`checkpoint_overridden`. Todas ya se escriben y la bitácora en
`/cases/[id]` ya las muestra todas (no hubo que agregar nada ahí, solo
verificar que ningún camino nuevo se hubiera quedado sin loguear).

**`/cases` — escalaciones al principio**: un caso con checkpoint
`verdict = 'failed'` y `confirmed_by_owner_id` nulo ahora sube al mismo
nivel de prioridad que los casos sin señal (antes de sin resolver,
manufacturada y disponible). También extendí el contador "requiere
decisión" para incluir estas escalaciones — no me lo pediste
explícitamente para el contador, solo para el orden, pero una señal que
falló y sigue sin confirmar es exactamente el tipo de cosa que ese
contador existe para contar; dime si prefieres que el contador se quede
sin tocar.

**T6 — probado por API, no solo por UI**: `POST` sin sesión a
`/api/cases/[id]/checkpoint/confirm` en producción devuelve 401 (abajo).
La garantía completa de que "no hay cierre sin confirmación" descansa en
dos capas independientes: la ruta (deriva `confirmed_by_owner_id` de la
sesión, exige razón para corregir, rechaza re-confirmar) y el trigger de
base de datos (inmutabilidad + no se puede confirmar como otro usuario).
No pude probar con una sesión autenticada real posteando payloads
maliciosos (necesitaría tu cookie de sesión) — si quieres esa prueba más
fuerte, dime y armamos un curl con tu sesión, o lo verificas tú mismo
desde las devtools del navegador.

**Sin overrides ni atajos agregados** — todo lo de arriba restringe, nunca
abre una puerta nueva.

## 2026-09-13 — Commit 4: el loop de 30 días

**Alcance**: limitado a día 30 (preguntas + comparación + veredicto), tal
como lo especifica `docs/IMPLEMENTATION_PROMPT.md` para este commit. El
"pulso" de día 7 que aparece en el diagrama de `docs/PACKET.md` no está en
los criterios de aceptación de este commit (solo T4/T5, ambos de día 30) —
queda fuera, no es un olvido. La confirmación/override del veredicto
(Condición 2) es explícitamente el commit 5: aquí el veredicto queda como
**borrador**, `confirmed_by_owner_id` nunca se toca, y el caso nunca se
cierra. Por lo mismo, la parte de T5 que dice "surfaces an escalation on
the caseload list" tampoco está completa todavía — el veredicto `failed`
se guarda y se muestra en el detalle del caso, pero `/cases` no lo
prioriza aún; eso es trabajo de comisión 5 ("sorts escalations to the
top").

**Qué se agregó**:
- `src/lib/llm.ts` se refactorizó: la lógica de llamar a Gemini y parsear
  JSON estricto (antes duplicada) ahora vive en un solo `callGemini<T>`
  interno; `classifyBaselineSymptoms` no cambió de comportamiento, solo de
  implementación. Dos funciones nuevas, mismas reglas que la clasificación
  (solo texto de síntomas/señal, nunca alias ni identificadores; JSON
  estricto; nunca lanza):
  - `generateCheckpointQuestions(declaredSignal)`: redacta 3 preguntas de
    día 30 en español llano para la señal declarada. Si el proveedor
    falla, cae en una plantilla fija genérica (`provider_unavailable:
    true`) en vez de bloquear el checkpoint — no hay nada que "rechazar"
    aquí, lo que importa es que el caso siga su curso.
  - `compareCheckpointToBaseline(baselineText, declaredSignal, answers)`:
    compara línea base contra las 3 respuestas y decide `confirmed` |
    `failed`. Si el proveedor falla, `verdict` queda en `null` (nunca
    inventa un veredicto) — pendiente de revisión humana en commit 5.
- `POST /api/cases/[id]/advance-day`: la herramienta de desarrollo
  etiquetada en pantalla ("⏩ Avanzar 30 días (simulado)"). Bloqueada si el
  caso sigue en `no_credible_signal` sin decisión, o si ya llegó a 30. Si
  el caso tiene una señal declarada (orgánica o manufacturada) agenda un
  checkpoint con 3 preguntas generadas; si no (caso `unresolved`, nunca se
  declaró señal), escribe directo `verdict = 'not_scalable'` con una
  razón fija del sistema — no la genera ningún modelo, así que no lleva
  la etiqueta de IA.
- `POST /api/cases/[id]/checkpoint/answer`: captura las 3 respuestas
  simuladas y produce el veredicto vía `compareCheckpointToBaseline`.
- `CheckpointSection.tsx`: en `/cases/[id]`, debajo de las acciones del
  caso. Muestra el botón de avanzar tiempo, luego la "vista simulada de la
  paciente" (preguntas + respuestas, etiquetada explícitamente como
  simulada — WhatsApp real es plumbing fuera de alcance, igual que en el
  scope cut del packet) y por último la tarjeta de veredicto
  (CONFIRMADA/FALLÓ/NO ESCALABLE), marcada como borrador.

**Pruebas de aceptación (T4/T5)**, corridas con `scripts/test-checkpoint.ts`
contra la API real (mismo patrón que T1/T2/T3):
- T4 (respuestas muestran mejora en nicturia): `verdict: "confirmed"` ✓
- T5 (respuestas muestran que sigue igual): `verdict: "failed"` ✓

Las preguntas generadas también se revisaron a mano: lenguaje llano, sin
jerga clínica ni de sistema, consistente con el tono ya establecido en la
clasificación de línea base.

## 2026-09-13 — Orden de la lista y contador de "requiere decisión"

Dos desvíos del packet en `/cases`, señalados por la usuaria tras cargar
los casos de demostración:

1. **Orden**: la lista ordenaba por `created_at`, así que el caso sin
   señal (M.R.) quedaba hasta abajo. `docs/PACKET.md` pantalla 1 es
   explícito: "los casos sin señal de retorno suben al principio de la
   lista" — no es cosmético, es el producto negándose a enterrar sus
   propias fallas. Orden nuevo (`src/app/cases/page.tsx`): sin señal →
   sin resolver → manufacturada → disponible, con `created_at` desc como
   desempate dentro de cada grupo. El orden se calcula en la app, no en la
   consulta SQL (el enum de Postgres no está declarado en este orden).

2. **Contador**: "1 requieren decisión" solo contaba `no_credible_signal`,
   dejando fuera los casos con señal manufacturada — que siguen siendo una
   excepción manual bajo escrutinio, no una señal orgánica resuelta. Ahora
   cuenta `no_credible_signal` + `manufactured`. `unresolved` no cuenta:
   ya es un cierre, no una decisión pendiente.

## 2026-09-13 — Bug: "No se pudo crear el caso" + rediseño al mockup

**Bug encontrado**: al crear un caso real en producción, la usuaria recibió
solo "No se pudo crear el caso." en rojo, sin más contexto.

**Causa confirmada** (2026-09-13, tras intentar correr `0002_senal30_add_seed_flag.sql`
y recibir `relation "senal30_cases" does not exist"`): **`0001_senal30_init.sql`
nunca se había corrido.** Quedó pendiente desde el commit 1, cuando la
sesión se desvió a resolver el cambio de proveedor a Gemini, y nadie volvió
a confirmar que se hubiera ejecutado antes de dar por cerrado ese commit.
Ninguna tabla `senal30_*` existía — ni siquiera `senal30_cases` — así que
cualquier `insert` fallaba desde el principio. **No era la cuota de
Gemini**: la sospecha original era razonable (justo veníamos de encontrar
el límite de 20/día) pero incorrecta.

Esto también explica algo que pasó desapercibido antes: cuando se probó el
login por primera vez y `/cases` mostró "Todavía no hay casos", esa lectura
tampoco revisaba si la consulta a Supabase regresaba un error — con la
tabla inexistente, un error real se veía idéntico a una lista vacía. Se
corrigió de una vez (ver commit de este mismo día): `/cases` y
`/cases/[id]` ahora revisan el `error` de cada consulta y muestran un
aviso explícito en vez de una lista vacía silenciosa cuando la lectura
falla.

**Fix del proceso**: antes de dar por cerrado un commit que depende de una
migración, confirmar explícitamente que se corrió — no asumirlo porque
otra parte de la app (como el login) funcionó.

**Redeploy / verificación final**: `0001_senal30_init.sql` y
`0002_senal30_add_seed_flag.sql` corridas sin errores en el proyecto
"semestre". Causa confirmada por la propia usuaria al ejecutar 0001: era
la tabla faltante, no la cuota de Gemini. El código ya estaba desplegado
(commits del mismo día con el logging/mensajes mejorados); con las tablas
ahora existiendo, la creación de casos queda lista para probarse de nuevo
en producción. Bug cerrado.

**Fix de código**: `/cases` y `/cases/[id]` ahora revisan el `error` de
cada lectura a Supabase. `/cases` muestra un aviso rojo explícito en vez de
"Todavía no hay casos." cuando la consulta falla. `/cases/[id]` distingue
`PGRST116` (no existe esa fila — 404 real) de cualquier otro error (tabla
inexistente, RLS, etc.), que ahora muestra un aviso de "no se pudo cargar"
en vez de disfrazarse de 404. Ambos casos quedan logueados server-side.

**Fix — instrumentación permanente** (`src/app/api/cases/route.ts`):
- Todo el handler quedó envuelto en `try/catch`; cualquier excepción no
  prevista ya no tumba la respuesta sin explicación.
- Los errores de Postgres/PostgREST se loguean completos con
  `console.error` (visibles en el dashboard de Vercel → Logs) y se traducen
  a mensajes específicos por código (`23502` campo faltante, `42501` RLS,
  `42703` columna inexistente → probable migración pendiente, etc.) en vez
  de un texto genérico.
- Los errores de validación ahora dicen qué campo falló
  (`Revisa "raw_text": ...`) en lugar de "Datos inválidos."
- El formulario (`/cases/new`) nunca borra lo que la usuaria escribió al
  fallar — es un formulario no controlado, el navegador conserva los
  valores; se agregó además manejo explícito de fallas de red sin perder el
  texto.

**Fix — el comportamiento de fondo que se pidió, independientemente de la
causa**: se agregó `provider_unavailable: boolean` al resultado de
`classifyBaselineSymptoms` (`src/lib/llm.ts`) para distinguir "el modelo
revisó el texto y no encontró señal" de "el modelo no pudo responder". El
caso **siempre se guarda** con `signal_status = no_credible_signal` en
ambos casos (fail toward refusal, nunca hacia perder el caso), pero:
- si el proveedor no respondió, la pantalla de rechazo dice explícitamente
  "El servicio de clasificación no está disponible en este momento..." en
  vez de inventar una razón clínica que nadie generó;
- `baselines.ai_labeled` se guarda en `false` en ese caso, y la etiqueta de
  IA no se muestra — no reclama contenido generado por un modelo que nunca
  respondió;
- el formulario de alta muestra el mismo aviso y un enlace directo al caso
  recién creado en vez de redirigir de inmediato, para que la usuaria lo
  vea antes de seguir.

**Redeploy**: incluido en el mismo commit que el rediseño (ver abajo).

## 2026-09-13 — Rediseño: alineado al mockup (`docs/SENAL30_mockup.png`)

La UI anterior era un tema oscuro genérico — no correspondía al mockup
aprobado, que es parte del argumento del producto (Nota de diseño del
packet: "una tarjeta de inspección de control de calidad, no una app de
salud... el único elemento visualmente fuerte de cada pantalla es el
veredicto"). Rediseño en `/login`, `/cases`, `/cases/new`, `/cases/[id]`,
`CaseActions`, `AiDisclosure`:
- Fondo claro (`bg-stone-100`) con tarjetas blancas de borde delgado
  (`border-neutral-300`), no dark mode.
- Eyebrow uppercase "SEÑAL 30 · ..." en cada pantalla, como en el mockup.
- Lista de casos: barra de color a la izquierda de cada fila según
  `signal_status` (ámbar para sin señal / manufacturada, gris para el
  resto) en vez de badges de colores planos; contador "N casos · M
  requieren decisión" igual que la pantalla 1 del mockup.
- La tarjeta de rechazo sigue siendo el único elemento visualmente fuerte:
  borde grueso ámbar, título grande en negritas, todo lo demás en texto
  normal.

## 2026-09-13 — Robustez de cuota: modelo lite + modo de demostración

**Contexto**: el hallazgo del commit 3 (20 solicitudes/día en
`gemini-3.6-flash`) es un riesgo real para la entrega — el rubro más pesado
("funciona en la URL") no puede depender de que quede cuota el día de la
demo.

**Investigación de rate limits**:
- `ai.google.dev/gemini-api/docs/rate-limits` y `.../docs/pricing` ya **no
  publican una tabla estática** de límites del free tier por modelo — dicen
  explícitamente "view your active rate limits in AI Studio" (son
  específicos por proyecto). Tampoco documentan RPD para `generateContent`
  en el tier gratuito; solo mencionan límites de grounding (Search/Maps).
- Varios blogs de terceros (aifreeapi.com, tinkerllm.com, tokenmix.ai, etc.)
  coinciden en que los modelos **flash-lite** tienen cuota gratuita mucho
  mayor que flash normal (cifras entre 1,000 y 1,500 RPD según la fuente,
  con fechas distintas de 2026 — no hay una cifra oficial única, pero todas
  apuntan en la misma dirección).
- Confirmado empíricamente contra la API real (fuente más confiable que
  cualquier blog): `gemini-3.6-flash` truena a los 20/día
  (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, quotaValue 20). Un
  request de prueba a `gemini-3.5-flash-lite` con el mismo tipo de texto
  respondió bien, sin fricción, y con menos overhead de "thinking" tokens
  que el modelo 3.6 (más rápido y más barato si algún día se paga).

**Decisión — cambio de modelo**: `GEMINI_MODEL` en `src/lib/llm.ts` pasó de
`gemini-3.6-flash` a `gemini-3.5-flash-lite` — un cambio de una línea,
exactamente como predijo la usuaria, gracias a que el proveedor ya estaba
aislado ahí. T1/T2/T3 vueltos a correr contra el modelo nuevo: los tres
pasan, con el mismo tono en lenguaje de la paciente.

**Decisión — modo de demostración, no caché genérico**: se evaluó una capa
de caché de respuestas del LLM y se descartó — el texto de síntomas de cada
paciente real es único, cachear no habría ayudado en nada al escenario que
realmente le preocupa a la usuaria (que la demo funcione aunque la cuota se
agote). En su lugar:
- `supabase/migrations/0002_senal30_add_seed_flag.sql`: agrega
  `is_seed boolean not null default false` a `senal30_cases` (aditivo, no
  destructivo, solo toca esa tabla `senal30_`).
- `src/lib/seed-data.ts`: 4 casos 100% inventados con su clasificación ya
  escrita a mano — cubren los cuatro `signal_status` posibles, incluyendo
  **la pantalla de rechazo sin resolver todavía** (la más importante).
  Ninguno llama a Gemini.
- `POST /api/seed`: botón "Cargar casos de demostración" en `/cases`,
  idempotente por owner (no duplica si ya sembró). Solo los casos que la
  usuaria cree a mano en vivo tocan la API real.
- Honestidad: los casos sembrados guardan `baselines.ai_labeled = false` y
  usan `actor: "seed_data"` en el audit log (nunca `"ai_classifier"), y la
  etiqueta "Contenido generado por IA" **no se muestra** en sus tarjetas —
  porque esa clasificación no la generó ningún modelo, y decir lo contrario
  sería falso. Además llevan una insignia visible "Datos inventados — caso
  de demostración" en la lista y en el detalle (piso de seguridad #5).

**No se agregó ningún override del flujo real** — el modo de demostración
vive completamente al margen de `classifyBaselineSymptoms` y de las rutas
de intake/enroll/manufacture/unresolved; no cambia ninguna verificación
existente.

Sources:
- [ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API Free Tier Rate Limits 2026 (tinkerllm.com)](https://tinkerllm.com/blog/gemini-api-free-tier-limits-rate-quotas/)
- [Gemini API Free Tier Rate Limits: Complete Guide for 2026 (aifreeapi.com)](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits)

## 2026-09-13 — Commit 3: la negativa

**Qué cambió**
- `/cases/[id]`: pantalla de detalle. Cuando `signal_status ===
  'no_credible_signal'`, la tarjeta "SIN SEÑAL DE RETORNO CREÍBLE — no se
  puede inscribir" es el elemento visualmente dominante (borde grueso, texto
  grande, arriba de todo lo demás) — no un mensaje de error entre otros
  elementos. Debajo, en su propio cuadro, la razón en lenguaje llano y la
  cita textual de la paciente; el conteo de síntomas reversibles; y la
  etiqueta de IA obligatoria.
- El botón "Inscribir caso" existe siempre, pero solo tiene `disabled={false}`
  cuando `signal_status === 'available'`. Para cualquier otro estado queda
  deshabilitado con una nota explicando por qué.
- Dos caminos, y solo dos, cuando no hay señal creíble: "Declarar una señal"
  (con justificación de texto obligatoria, mínimo 10 caracteres) o
  "Registrar como no resuelto". Ambos escriben a `senal30_audit_log`
  (`signal_manufactured`, `marked_unresolved`) y ninguno de los dos puede
  dejar el caso en `signal_status = 'available'` — ni por construcción: las
  rutas solo saben poner `'manufactured'` o `'unresolved'`, respectivamente.
- Tres rutas nuevas, las tres re-verifican todo server-side sin confiar en
  el cliente: `POST /api/cases/[id]/enroll` (rechaza con 403 si
  `signal_status !== 'available'`, sin excepción), `POST
  /api/cases/[id]/manufacture-signal` y `POST
  /api/cases/[id]/mark-unresolved` (ambas rechazan con 409 si el caso no
  está en `'no_credible_signal'`, para no poder re-resolver un caso dos
  veces ni tocar uno que ya tenía señal).
- **No se agregó ningún flag, override o parámetro para saltarse la
  verificación.** No existe ninguna ruta que pueda poner
  `signal_status = 'available'` después de la creación del caso — esa
  decisión la toma únicamente la clasificación de IA en el commit 2, con su
  propia red de seguridad (`enforceConsistency` en `lib/llm.ts`).
- Ajuste al prompt de Gemini (`lib/llm.ts`): el campo `rationale` ahora pide
  explícitamente tono llano y cálido, hablando de lo que la paciente
  sentiría o no sentiría, sin jerga clínica ni de sistema — siguiendo el
  tono de `docs/SENAL30_mockup.png` pantalla 2. Verificado: T1 ahora dice
  "...debería notar que se levanta mucho menos al baño por las noches..." y
  T2 dice "...no hay ningún cambio físico directo que vaya a notar que
  mejora en 30 días...", ninguno usa palabras como "candidato" o
  "clasificación".

**Aceptación (T2, el caso duro)**: con `signal_status = 'no_credible_signal'`,
el botón de inscribir está deshabilitado en la UI, y `POST
/api/cases/[id]/enroll` devuelve 403 sin escribir nada, sin importar quién
llame a la ruta — no hay forma, ni por UI ni por API, de que este caso
termine `'available'`.

**Hallazgo operativo importante — cuota gratuita de Gemini**: el modelo
`gemini-3.6-flash` en el tier gratuito tiene un límite de **20 solicitudes
por día por proyecto** (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`).
Se agotó hoy mismo durante las pruebas de este commit — T3 cayó en 429 y el
sistema respondió correctamente con `has_credible_signal: false` (el
fallback funcionó exactamente como debía), pero 20/día es muy poco margen
para demos en vivo o para cuando haya más de un puñado de casos reales.
Vale la pena que la usuaria decida si acepta el límite, prueba un modelo
Gemini más barato/con más cuota gratuita, o activa facturación en ese
proyecto de Google AI Studio antes de la entrega.

## 2026-09-13 — `scripts/` se queda en el repo (decisión deliberada)

`scripts/test-classification.ts` no estaba en el plan de commits del
implementation prompt, pero se agregó a propósito para poder correr T1/T2/T3
contra la API real de Gemini sin pasar por toda la UI — es evidencia
reproducible del test plan (`docs/PACKET.md` sección 9), no un descuido.
Confirmado con la usuaria que se queda en el repo público como referencia de
regresión: no importa nada del código de producción, está excluido del
`tsconfig.json` de la app, y no contiene ningún secreto (solo tres textos de
ejemplo en español).

## 2026-09-13 — Commit 1 cerrado: deploy a Vercel + login probado

`vercel link` creó el proyecto `senal30` en la cuenta de Vercel de la
usuaria y conectó el repo de GitHub (auto-deploy en cada push a `main`).
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (tipo Config,
público a propósito — está protegido por RLS) y `GEMINI_API_KEY` (tipo
Secret) se configuraron en Production/Preview/Development. Deploy en
https://senal30.vercel.app.

Verificado:
- `curl` a `/cases` sin sesión → 307 a `/login` (criterio de aceptación).
- Login real con Google probado por la usuaria en producción: `/login` →
  Google → `/auth/callback` → `/cases` mostrando su correo.

**Pendiente, no bloqueante**: T7 (owner B no puede leer casos de owner A
por RLS) se prueba después del commit 3, cuando ya haya casos reales que
intentar leer cruzado — ahorita la tabla está vacía.

## 2026-09-13 — Incidente: secreto pegado en el chat + rotación pendiente

Se pegó una `GEMINI_API_KEY` directamente en el chat con Claude Code antes de
establecer la regla de no pasar secretos por ahí. Esa key resultó ser
compartida con dos entregas anteriores de la clase que todavía no se
califican, así que **no se revoca todavía** para no romperlas.

**Qué se hizo**: se creó una `GEMINI_API_KEY` nueva, exclusiva de SEÑAL 30,
y esa es la que vive en `.env.local` de este proyecto. Se estableció la
regla, hacia adelante, de no pasar secretos por el chat — valores como keys
o tokens se ponen directo en `.env.local` o en el dashboard correspondiente.

**Pendiente**: rotar (revocar) la key compartida en cuanto esas dos entregas
anteriores se hayan calificado.

## 2026-09-13 — Commit 2: intake + clasificación de línea base (Gemini)

**Qué cambió**
- `/cases/new`: formulario de alta (alias, tipo/valor de detección, fecha,
  estatus de asequibilidad, texto libre de síntomas), Zod en cliente y
  servidor (`src/lib/validation.ts`), tope de 2000 caracteres en el texto.
- `POST /api/cases`: valida, inserta en `senal30_cases`, llama al
  clasificador con **solo** el texto de síntomas (nunca el alias ni otro
  identificador), inserta en `senal30_baselines`, y escribe dos eventos en
  `senal30_audit_log` (`case_created`, `baseline_classified`).
- `src/lib/llm.ts`: único punto de contacto con el proveedor de LLM —
  expone `classifyBaselineSymptoms(text)` y nada más sale de este archivo.
  Temperatura 0.1, `responseMimeType: application/json`, defensa contra
  fences de markdown, y **cualquier fallo (red, parseo, forma inesperada,
  schema inválido) cae en `has_credible_signal: false` marcado para
  revisión humana** — nunca hacia inscripción automática. Además hay una
  red de seguridad adicional al prompt: si no hay síntomas concretos o no
  hay señal primaria declarada, `has_credible_signal` se fuerza a `false`
  sin importar lo que haya dicho el modelo (de esto depende T2, el caso más
  duro del packet).
- `/cases` ahora lista los casos reales del owner con su `signal_status`.

**Nota de modelo**: `gemini-2.5-flash` ya no está disponible para cuentas
nuevas (404 de la API); se usa `gemini-3.6-flash`, que es lo que la propia
API de Google recomienda en el mensaje de error. Un cambio de modelo futuro
solo toca la constante `GEMINI_MODEL` en `src/lib/llm.ts`.

**Pruebas de aceptación (T1/T2/T3) — corridas con `scripts/test-classification.ts`
contra la API real**:
- T1 ("me levanto 4 veces en la noche... mucha sed"): `has_credible_signal: true`,
  `symptoms: ["nicturia", "sed excesiva"]`, `suggested_primary_signal: "nicturia"` ✓
- T2 ("me siento bien, me salió alta el azúcar"): `has_credible_signal: false`,
  `symptoms: []` ✓
- T3 ("me duele la rodilla"): `has_credible_signal: false`, `symptoms: []` ✓

Las tres pasaron. En una corrida intermedia T1 cayó una vez en el fallback
genérico por una sobrecarga temporal (503) del modelo — se agregó logging
de errores en `lib/llm.ts` (`console.error("[llm] ...")`) para poder
diagnosticar esto en producción sin romper el comportamiento de "fallar
hacia el rechazo".

**Qué NO cambia**: todo lo del packet — la señal primaria solo se declara
si `has_credible_signal` es verdadero; el caso se crea con
`signal_status: 'available'` o `'no_credible_signal'` según el resultado,
pero la pantalla de rechazo (tarjeta de advertencia, botón de inscribir
deshabilitado) es trabajo del commit 3, todavía no existe.

## 2026-09-13 — Cambio de proveedor LLM: Anthropic → Google Gemini

**Qué cambió**: `docs/PACKET.md` (tabla de arquitectura, fila LLM) y
`.env.local.example` ahora dicen Google Gemini API / `GEMINI_API_KEY` en vez
de Anthropic API / `ANTHROPIC_API_KEY`. Nada más del packet se tocó.

**Por qué**: la usuaria tiene tier gratuito en Google Gemini y prefiere
usarlo en vez de pagar por la API de Anthropic para este proyecto escolar.

**Qué NO cambia** (se mantiene igual que en `docs/IMPLEMENTATION_PROMPT.md`,
sección "LLM prompt rules"):
- La llamada al modelo sigue siendo exclusivamente desde un route handler de
  servidor — la key nunca llega al cliente.
- Respuesta exigida en JSON estricto, sin prosa ni fences de markdown; se
  despoja cualquier fence de forma defensiva antes de parsear.
- Si el parseo falla, el resultado cae a `has_credible_signal: false` y se
  marca para revisión humana — falla siempre hacia el rechazo, nunca hacia
  la inscripción automática.
- Nunca se envía el alias del paciente ni ningún identificador al modelo,
  solo el texto de síntomas, con un tope de longitud antes de la llamada.
- La etiqueta en pantalla sigue siendo "Contenido generado por IA — revisar
  antes de actuar", sin nombrar el proveedor.

El código del commit 2 aísla el proveedor detrás de una sola función
(`src/lib/llm.ts`) para que un futuro cambio de proveedor no toque el resto
de la app.

## 2026-09-12 — Commit 1: skeleton + security floor

**What changed**
- Scaffolded Next.js (App Router, TypeScript, Tailwind) via `create-next-app`.
- Added Supabase SSR auth (`@supabase/ssr`): browser client, server client, and
  a middleware (`src/middleware.ts`) that refreshes the session on every
  request and redirects signed-out users away from `/cases` to `/login`.
- Google sign-in wired through Supabase Auth (`/login` triggers
  `signInWithOAuth`, `/auth/callback` exchanges the code, `/auth/signout`
  clears the session).
- `/cases` is a protected placeholder — no case data yet, just proves the
  auth gate works end to end.
- SQL migration `supabase/migrations/0001_senal30_init.sql` creates the four
  tables from the packet (`senal30_cases`, `senal30_baselines`,
  `senal30_checkpoints`, `senal30_audit_log`) plus RLS policies scoping every
  row to `owner_id = auth.uid()` (child tables scoped via a join to
  `senal30_cases`). All objects are `senal30_`-prefixed because the Supabase
  project ("semestre") is shared with other class assignments — see
  `supabase/migrations/0000_check_existing_tables.sql`, a read-only check to
  run first.

**Why the `senal30_` prefix and the read-only check first**: the Supabase
project is shared across the user's coursework, not exclusive to this app.
No destructive statements anywhere in the migration; it only touches
`senal30_*` objects and is safe to re-run.

**What broke / open items**
- Nothing broken yet — pending first real deploy + first login test once
  Supabase credentials and the Google OAuth redirect URL are in place.
- Google OAuth provider already exists in this Supabase project for other
  assignments (shared Client ID/Secret) — we only add a redirect URL to its
  existing allow-list, never touch the provider's credentials.

**Tomorrow's first move**
- Once `.env.local` has real Supabase values and the migration has run:
  test sign-in locally, confirm `/cases` redirects when signed out, then
  deploy to Vercel and confirm the same on the live URL (commit 1
  acceptance test). Then start commit 2 (intake form + baseline
  classification via Claude).
