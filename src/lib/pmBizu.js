import content from '../data/pmBizu.json';
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const entries = new Map(Object.entries(content).map(([name,text])=>[normalize(name),text]));
// Exact normalized names only; never attach a generic summary to an unknown topic.
export function getPmBizu(name) { return entries.get(normalize(name)) || ''; }
