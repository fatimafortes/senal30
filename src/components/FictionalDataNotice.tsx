// Piso de seguridad (docs/IMPLEMENTATION_PROMPT.md #5): ningún dato real de
// paciente en ningún lado. Visible en toda pantalla donde se ve o se
// captura un caso, no solo en los casos de demostración precargados.
export function FictionalDataNotice() {
  return (
    <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      Todos los datos en este sistema son ficticios — proyecto escolar.
      Nunca ingreses información real de una paciente.
    </p>
  );
}
