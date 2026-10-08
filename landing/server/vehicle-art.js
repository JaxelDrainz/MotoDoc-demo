// Side-profile line drawings, one per body type, in the MotoDoc dashboard's emerald-and-mint style.
// Served as SVG by the API so the landing app and the Next.js dashboard share one set.
const shapes = {
  hatchback: { body: [[22,132],[20,108],[40,96],[118,84],[160,52],[285,52],[340,88],[352,100],[350,132]], glass: [[128,84],[165,58],[272,57],[318,84]], pillar: 215 },
  saloon: { body: [[22,132],[20,108],[40,96],[122,86],[165,54],[262,54],[312,86],[366,90],[372,104],[370,132]], glass: [[132,86],[170,60],[256,60],[298,86]], pillar: 212 },
  estate: { body: [[22,132],[20,108],[40,96],[122,86],[165,54],[338,54],[366,88],[370,104],[368,132]], glass: [[132,86],[170,60],[330,60],[352,86]], pillar: 222 },
  suv: { body: [[22,132],[20,98],[40,84],[120,74],[158,38],[325,38],[358,74],[364,96],[362,132]], glass: [[130,74],[163,45],[318,45],[345,74]], pillar: 222 },
  coupe: { body: [[22,132],[20,110],[40,100],[135,90],[185,62],[245,60],[330,92],[366,96],[370,108],[368,132]], glass: [[146,90],[190,68],[242,66],[312,90]] },
  convertible: { body: [[22,132],[20,110],[40,100],[135,90],[168,60],[175,62],[158,90],[300,88],[366,94],[370,108],[368,132]] },
  mpv: { body: [[22,132],[20,104],[36,92],[95,78],[150,40],[335,40],[362,70],[366,100],[364,132]], glass: [[106,78],[155,47],[328,47],[350,78]], pillar: 215 },
  van: { body: [[22,132],[20,100],[34,88],[80,78],[112,36],[372,36],[374,132]], glass: [[92,78],[118,43],[170,43],[170,78]] },
  pickup: { body: [[22,132],[20,100],[40,86],[118,76],[152,40],[238,40],[246,84],[372,84],[374,132]], glass: [[128,76],[157,47],[230,47],[236,76]] },
};
shapes.car = shapes.hatchback;

function rounded(points, radius) {
  return points.map((point, index) => {
    const before = points[(index + points.length - 1) % points.length], after = points[(index + 1) % points.length];
    const cut = other => {
      const dx = other[0] - point[0], dy = other[1] - point[1], length = Math.hypot(dx, dy), by = Math.min(radius, length / 2);
      return `${(point[0] + dx / length * by).toFixed(1)} ${(point[1] + dy / length * by).toFixed(1)}`;
    };
    return `${index ? 'L' : 'M'}${cut(before)}Q${point[0]} ${point[1]} ${cut(after)}`;
  }).join('') + 'Z';
}

const wheel = x => `<circle cx="${x}" cy="128" r="29" fill="#fff"/><circle cx="${x}" cy="128" r="23" fill="#fff" stroke="#0b7b5b" stroke-width="3"/><circle cx="${x}" cy="128" r="9" fill="#eaf6f0" stroke="#0b7b5b" stroke-width="2.5"/>`;

export function vehicleArt(body) {
  const shape = shapes[body];
  if (!shape) return null;
  const top = shape.glass && Math.min(...shape.glass.map(point => point[1])), base = shape.glass && Math.max(...shape.glass.map(point => point[1]));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 170" role="img" aria-label="${body === 'car' ? 'Car' : body} outline"><path d="${rounded(shape.body, 10)}" fill="#eaf6f0" stroke="#0b7b5b" stroke-width="3" stroke-linejoin="round"/>${shape.glass ? `<path d="${rounded(shape.glass, 5)}" fill="#fff" stroke="#0b7b5b" stroke-width="2.5" stroke-linejoin="round"/>` : ''}${shape.pillar ? `<path d="M${shape.pillar} ${top}V${base}" stroke="#0b7b5b" stroke-width="2.5"/>` : ''}<ellipse cx="200" cy="154" rx="172" ry="5" fill="#dcece5"/>${wheel(100)}${wheel(300)}</svg>`;
}
