import { parseLoveStories } from '../parser/love-story.js';

const sample = `2013 — Awal Sebuah Cerita (JUDUL)
Sebuah cerita yang tak pernah kami sangka akan sampai sejauh ini, bermula di bangku SMP pada tahun 2013.

Saat itu, kami hanya dua orang yang saling mengenal dan menjadi dekat tapi tidak pernah terpikir bahwa kedekatan sederhana di masa sekolah itu kelak akan menjadi bagian penting dari perjalanan hidup kami.

2024 — Dipertemukan Kembali (JUDUL)
Setelah lima tahun tanpa komunikasi, semesta kembali mempertemukan kami.

Kali ini, bukan lagi sekadar mengenang masa lalu, tetapi mulai mengenal satu sama lain dengan cara yang lebih dewasa.

Percakapan demi percakapan membawa kami pada keyakinan bahwa mungkin, setelah sekian lama, inilah waktu yang tepat untuk melanjutkan cerita yang dahulu sempat tertunda.

Lamaran — Sebuah Janji (JUDUL)
Setelah melewati perjalanan panjang yang penuh cerita, akhirnya tibalah kami pada satu langkah yang lebih berarti.

Dengan penuh rasa syukur dan doa, kami mempertemukan keluarga dan menyampaikan niat untuk melanjutkan hubungan ini menuju pernikahan.

Pernikahan — Awal Selamanya (JUDUL)
Dari kedekatan sederhana di SMP dan banyak cerita telah dilewati, akhirnya kami sampai pada satu tujuan: pernikahan.

Kami percaya, jika dua hati memang ditakdirkan untuk bersama, sejauh apa pun jalan yang ditempuh, pada akhirnya akan selalu ada cara untuk kembali menemukan satu sama lain.

Kini, bukan lagi tentang kapan pertama kali bertemu atau berapa lama pernah terpisah, melainkan tentang memilih untuk tetap bersama—hari ini, esok, dan selamanya.`;

const stories = parseLoveStories(sample);
console.log(JSON.stringify(stories.map((s) => ({ title: s.title, bodyLen: s.description.length })), null, 2));

if (stories.length !== 4) throw new Error(`expected 4, got ${stories.length}`);
if (stories[0].title !== '2013 — Awal Sebuah Cerita') throw new Error(stories[0].title);
if (stories[1].title !== '2024 — Dipertemukan Kembali') throw new Error(stories[1].title);
if (stories[2].title !== 'Lamaran — Sebuah Janji') throw new Error(stories[2].title);
if (stories[3].title !== 'Pernikahan — Awal Selamanya') throw new Error(stories[3].title);
if (/JUDUL/i.test(stories.map((s) => s.title).join(' '))) {
  throw new Error('(JUDUL) must be stripped from title');
}
if (!/bangku SMP/.test(stories[0].description)) throw new Error('body 1');
if (!/selamanya/.test(stories[3].description)) throw new Error('body 4');

// Without (JUDUL) marker -> empty
const noMarker = parseLoveStories(`Awal Bertemu\nParagraf tanpa marker.`);
if (noMarker.length !== 0) throw new Error('should require (JUDUL)');

console.log('Love story (JUDUL) parser OK');
