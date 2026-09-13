// Requisito del piso de seguridad (docs/IMPLEMENTATION_PROMPT.md #6): toda
// región de pantalla que muestre salida del modelo debe llevar esta etiqueta,
// sin nombrar al proveedor.
export function AiDisclosure() {
  return (
    <p className="rounded-md border border-dashed border-neutral-700 px-3 py-2 text-xs text-neutral-400">
      Contenido generado por IA — revisar antes de actuar.
    </p>
  );
}
