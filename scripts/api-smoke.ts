// End-to-end API check against a running server: build, cache, failure preservation.
// Usage: npx tsx scripts/api-smoke.ts [baseUrl]
export {};
const B = (process.argv[2] ?? 'http://127.0.0.1:5174') + '/api';
const j = async (path: string, init?: RequestInit) => {
  const r = await fetch(B + path, { headers: { 'Content-Type': 'application/json' }, ...init });
  return { status: r.status, body: r.status === 204 ? null : await r.json() };
};
const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error('FAILED: ' + msg);
  console.log('ok  ', msg);
};

const cvs = (await j('/cvs')).body as { id: string; templateId: string }[];
assert(cvs.length >= 1, `at least one CV exists (${cvs.length})`);
const id = cvs[0].id;

const first = (await j(`/cvs/${id}/build`, { method: 'POST' })).body;
assert(first.status === 'success', `build succeeds (${first.durationMs} ms, ${first.pageCount} page)`);
const again = (await j(`/cvs/${id}/build`, { method: 'POST' })).body;
assert(again.cached && again.buildId === first.buildId, 'unchanged source reuses the same build');

const bad = await j(`/cvs/${id}`, { method: 'PUT', body: '[]' });
assert(bad.status === 400, 'non-object PUT is rejected');

const cv = (await j(`/cvs/${id}`)).body;
cv.advanced.extraPreamble = '% my tweak\n\\definecolor{brand}{HTML}{112233}\n\\notARealCommand\n';
await j(`/cvs/${id}`, { method: 'PUT', body: JSON.stringify(cv) });
const failed = (await j(`/cvs/${id}/build`, { method: 'POST' })).body;
assert(failed.status === 'error', `broken LaTeX fails: ${failed.failureReason}`);
const e = failed.errors[0];
console.log('     ->', e);
assert(e.file === 'custom_preamble.tex' && e.line > 0, 'error points at file and line');
const after = (await j(`/cvs/${id}`)).body;
assert(after.lastSuccessfulBuildId === first.buildId, 'previous successful PDF is preserved');
const log = await fetch(`${B}/builds/${failed.buildId}/log`);
assert(log.status === 200 && (await log.text()).includes('notARealCommand'), 'failed build log is available');

cv.advanced.extraPreamble = '';
await j(`/cvs/${id}`, { method: 'PUT', body: JSON.stringify(cv) });
const restored = (await j(`/cvs/${id}/build`, { method: 'POST' })).body;
assert(restored.cached && restored.buildId === first.buildId, 'reverting the change returns the original build');

const pdf = await fetch(`${B}/builds/${first.buildId}/pdf?download=1`);
assert(pdf.headers.get('content-disposition')?.startsWith('attachment'), 'PDF export downloads the previewed build');
console.log('\nAll API checks passed.');
