type AccountAddress = { address?: string | null; city?: string | null; province?: string | null; country?: string | null };

/** Keep freeform text intact and append only missing legacy address components. */
export function consolidateAccountAddress(fields: AccountAddress): string | null | undefined {
  let result = fields.address;
  const normalize = (value: string) => value.toLowerCase().replace(/[\s,;]+/g, ' ').trim();
  const components = [fields.city, fields.province, fields.country];
  for (let index = 0; index < components.length; index++) {
    const component = components[index]?.trim();
    if (!component) continue;
    // A freeform Full Address is authoritative; do not infer a country from the default.
    if (index === 2 && normalize(component) === 'philippines'
      && (!result?.trim() || !(fields.city?.trim() || fields.province?.trim()))) continue;
    if (` ${normalize(result ?? '')} `.includes(` ${normalize(component)} `)) continue;
    result = result?.trim() ? `${result.replace(/[\s,;]+$/g, '')}, ${component}` : component;
  }
  return result;
}
