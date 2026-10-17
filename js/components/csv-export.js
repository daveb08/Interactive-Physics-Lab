/** CSV text from sample objects. `columns` = [{ key, label, unit }]. Pure, so it is unit-tested. */
export function buildCsv(samples, columns, extra = []) {
  const header = [...columns, ...extra.map(e => e.column)].map(c => c.unit ? `${c.label} (${c.unit})` : c.label);
  const lines = [header.join(',')];
  samples.forEach((s, i) => {
    const row = columns.map(c => fmt(s[c.key]));
    for (const e of extra) row.push(fmt(e.values[i]));
    lines.push(row.join(','));
  });
  return lines.join('\n') + '\n';
}
const fmt = v => v === undefined || v === null || Number.isNaN(v) ? '' : Number(v).toPrecision(10).replace(/\.?0+(e|$)/, '$1');

/** Browser-only: offer the CSV as a download. */
export function downloadCsv(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
