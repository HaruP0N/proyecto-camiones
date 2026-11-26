/** Bind named values without touching quoted text, identifiers, or SQL comments. */
export function bindParameters(statement: string, parameters: ReadonlyMap<string, unknown>) {
  const values: unknown[] = [];
  const positions = new Map<string, number>();
  const tokens = /'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\/|\$([a-zA-Z_][\w]*)?\$[\s\S]*?\$\1\$|@([a-zA-Z_][\w]*)/g;
  const text = statement.replace(tokens, (token, _tag, name: string | undefined) => {
    if (!name) return token;
    if (!parameters.has(name)) throw new Error(`Falta el parámetro SQL: ${name}`);
    if (!positions.has(name)) {
      values.push(parameters.get(name));
      positions.set(name, values.length);
    }
    return `$${positions.get(name)}`;
  });
  return { text, values };
}
