import axios from 'axios';
import fs from 'node:fs';

const r = await axios.get(
  'https://invmoment.my.id/wp-content/plugins/weddingsaas-pro/assets/js/wds-dashboard.js?v=2.9.2',
);
const b = String(r.data);
fs.writeFileSync('tmp-wds-dashboard.js', b);

const i = b.indexOf('function loadThemes');
console.log(b.slice(i, i + 800));
console.log('\n==== loadCategories ====');
const j = b.indexOf('function loadCategories');
console.log(b.slice(j, j + 500));
console.log('\n==== invitation_add context ====');
const k = b.indexOf('invitation_add');
console.log(b.slice(k - 100, k + 400));
