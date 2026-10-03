import fs from 'node:fs';

const h = fs.readFileSync('tmp-invmoment-edit-32851.html', 'utf8');
function formChunk(id) {
  const re = new RegExp(`<form[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/form>`, 'i');
  return h.match(re)?.[1] || '';
}
for (const id of ['form--settings', 'form--event', 'form--gift', 'form--bride']) {
  console.log(`\n======== ${id} ========`);
  console.log(formChunk(id).slice(0, 3200));
}
