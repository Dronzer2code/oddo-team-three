// Moves the pulled reference assets into packages/ui under readable names and
// self-hosts the latin Inter subsets so nothing depends on a third-party CDN.
import fs from 'node:fs/promises';
import path from 'node:path';

const REPO = path.resolve('..', '..');
const UI = path.join(REPO, 'packages', 'ui');
const FONT_DIR = path.join(UI, 'assets', 'fonts');
const IMG_DIR = path.join(UI, 'assets', 'img');
await fs.mkdir(FONT_DIR, { recursive: true });
await fs.mkdir(IMG_DIR, { recursive: true });

const FONTS = [
  ['inter-300.woff2', 'https://framerusercontent.com/assets/aqiiD4LUKkKzXdjGL5UzHq8bo5w.woff2'],
  ['inter-400.woff2', 'https://framerusercontent.com/assets/GrgcKwrN6d3Uz8EwcLHZxwEfC4.woff2'],
  ['inter-500.woff2', 'https://framerusercontent.com/assets/UjlFhCnUjxhNfep4oYBPqnEssyo.woff2'],
  ['inter-700.woff2', 'https://framerusercontent.com/assets/syRNPWzAMIrcJ3wIlPIP43KjQs.woff2'],
];

for (const [name, url] of FONTS) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  await fs.writeFile(path.join(FONT_DIR, name), Buffer.from(await res.arrayBuffer()));
  console.log('font', name);
}

// source file in out/assets/images  ->  name inside packages/ui/assets/img
const IMAGES = {
  // isometric vehicle renders (transparent PNG)
  'L1609GPPmv386CJ9Fk4v03Vmw.png': 'car-sedan.png',
  'u2NBVQDvo9VEI2Rp8xQuKKeLKw.png': 'car-suv.png',
  'n29hj9GG3eNGlrdys29z2zooI.png': 'car-van.png',
  'knWAWdU24NjiHb7rikIGzr8Ym7U.png': 'car-minivan.png',
  'lOEJyirFcRcmpXOQqisihG3eXc.png': 'car-pair.png',
  'McqHJQ30EVGG5zjtxjnm43714vs.png': 'car-topdown.png',
  // outline vehicle marks
  'GeXJI6z47fJ6MLYzwVwoumGPFTU.svg': 'outline-hatchback.svg',
  'RjoapNQi7ddfCeMP4HTdCpUZNA.svg': 'outline-sedan.svg',
  'Y9eleeBUbPLPy0yNmtCblpdRFM.svg': 'outline-suv.svg',
  'xbYTlYa6jhcwwg6xBSn8kBpugY.svg': 'outline-van.svg',
  // ui marks
  'bTOROwAiEgAXOzoDblKJnU5eTM.svg': 'connector-branch.svg',
  'fkPibiMedC2cBMJADn9YDm09NI.svg': 'connector-arrow.svg',
  'JX6R4dXxwA7l4btductCUgdlJw.svg': 'mark-rocket.svg',
  'Fy3Zsb7NKst0Ih9SEy1RTRmRPn0.svg': 'mark-tracking.svg',
  'rfvte13A1oJB4YlOGKG8lpIVob0.svg': 'mark-chart.svg',
  'r2sIUZDQSeViL06iXlFhQOGugl4.svg': 'mark-shield.svg',
  'ES3aI04FGHcMorvZpURq8PVJc.svg': 'mark-card.svg',
  '8lnUnrtoRQTRz0jDU3AMkdPF5Ec.svg': 'mark-stopwatch.svg',
  'YGSuotS3VsY3SPGAgPDNR8Bg9Q.svg': 'mark-pin.svg',
  'XZk7YLzUwe1AXfES9YVIVixzzuM.svg': 'mark-taxi.svg',
  '8W4poMSOPIrD1QByExb8OHSCvk.svg': 'mark-van.svg',
  'TKqUHVJrUzMiYf8kuMvKRGEEJ9w.svg': 'mark-car.svg',
  'DdnxU5NNr37sM9Qka8fqBeFcg.svg': 'mark-smile.svg',
  // photography
  'NuAZV5m0u4A9JTsPCcDTd7BowX0.png': 'photo-interchange.png',
  'SEQXNura3SOZm4vTqnWr2wAvwE.jpg': 'photo-highway-aerial.jpg',
  'XzOv6zXaZOUSgRKboyDvHi0zvNo.jpg': 'photo-open-road.jpg',
  'fbZxhdlAF6v05fOj0ha19BXQBAw.jpg': 'photo-motion.jpg',
  'W2ArVfYpmnFtsp4Rj7Y8qOLK7E.png': 'photo-city-street.png',
  'UcUg8DPIhFthjGkbXLdMNecueJ0.png': 'photo-light-trails.png',
  'ytbyMC54rwXQ978Agk1pJZaY.jpg': 'photo-night.jpg',
  'swzuuqBBzJ45YYUWgqtndjnJwU.jpg': 'photo-parked-suv.jpg',
  'aQ8xMTwZfJShaOH4clSUi0ipKw.jpg': 'photo-car-park.jpg',
  'HLm3W3XUDxjGDmxmxfqVuSqdHz4.png': 'photo-driver-wheel.png',
  'IbOIOkzfXWO7AcMnyeh0Jda2l8.jpg': 'photo-passenger.jpg',
  'j7NyLF5w0ZDl1TZboyL4jTY8E.png': 'photo-boarding.png',
  'ifiMpHITo0gz3E11A0IJ3XP3uY.jpg': 'photo-door-open.jpg',
  'ZkBGemos1AxTERbF3OxoehzOcSg.jpg': 'photo-lot.jpg',
  'ws2rMIaDKVC37hmFZTnE2ZnOKQ.png': 'phone-map.png',
  // portraits for testimonial / driver cards
  'JjWWJ468LEdG3RbvDyGaM0ijg.webp': 'person-1.webp',
  '7waeSbtJpIfuwzQqwqmSkzCYQk.webp': 'person-2.webp',
  'kUA6fJsMOrZyjImaWzxmcpr6kk.webp': 'person-3.webp',
  'vfwl7TV6iiGpgqnem6L7Y5Rbgv0.png': 'person-4.png',
  'jxxuoWDpdEC8669tzqdXOAeTPw.png': 'person-5.png',
  'wH9PYRaOG9E4pHjl1FwXxUHs.png': 'person-6.png',
  '4cikZ8DMrRJxFr3be7YrNNOCMI.png': 'person-7.png',
  'KHGXmsoB5fa3ArKU84Ukhyj3Cjg.png': 'person-8.png',
  'w2UHM3JhKZBAI1zFkm57b84g4.jpg': 'person-9.jpg',
  '6FRP8rHDtkZ0ys6rLIYWglGLIEo.jpg': 'person-10.jpg',
  'rlzVjq4hIe7R86rShZ3s7qPplK4.png': 'person-11.png',
  'Dyc8sXeiMNMUODC3RTlqoOfGgzM.png': 'person-12.png',
};

const SRC = path.resolve('out', 'assets', 'images');
let copied = 0;
const missing = [];
for (const [from, to] of Object.entries(IMAGES)) {
  try {
    await fs.copyFile(path.join(SRC, from), path.join(IMG_DIR, to));
    copied++;
  } catch {
    missing.push(from);
  }
}
console.log(`images copied: ${copied}`);
if (missing.length) console.log('missing:', missing.join(', '));
