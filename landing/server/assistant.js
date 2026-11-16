// Ask MotoDoc: a small local language model that runs inside the server, with no outside
// AI service. A TF-IDF bag-of-words model over example questions (English and Finnish)
// picks the closest topic; the answer is written for that topic and filled in with the
// person's own data. When nothing is close enough it says so instead of guessing.
import { z } from 'zod';
import { recommendationsFor } from './extras.js';

const DAY = 86400000;
const STOP = new Set(
  'a an the is are am do does did i my me you your to of for in on at it this that and or be can how what when where why which should will with ja on ei se mitä miten milloin missä voi voin onko minun mun sinun kun jos tai että'.split(
    ' ',
  ),
);

export const tokens = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFC')
    .replace(/['’`]/g, '')
    .split(/[^a-z0-9äöå]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .flatMap((w) => (w.length > 5 ? [w, w.slice(0, 5)] : [w]));

// Topics: [id, roles ('driver' | 'garage' | 'all'), example questions]
const TOPICS = [
  ['greet', 'all', ['hi', 'hello', 'hey there', 'good morning', 'hei', 'moi', 'terve', 'huomenta']],
  [
    'thanks',
    'all',
    ['thanks', 'thank you', 'great thanks', 'kiitos', 'kiitti', 'thank you so much'],
  ],
  [
    'needs',
    'driver',
    [
      'what does my car need',
      'is anything due on my car',
      'when is my next service',
      'does my car need service',
      'what maintenance is due',
      'mitä autoni tarvitsee',
      'milloin seuraava huolto',
      'tarvitseeko autoni huoltoa',
    ],
  ],
  [
    'inspection',
    'driver',
    [
      'when is my inspection',
      'when do i need katsastus',
      'mot test date',
      'inspection due',
      'how often is inspection',
      'milloin katsastus',
      'katsastus erääntyy',
      'katsastuksen päivä',
    ],
  ],
  [
    'insurance',
    'driver',
    [
      'when is my insurance due',
      'car insurance renewal',
      'insurance date',
      'liikennevakuutus',
      'vakuutus erääntyy',
    ],
  ],
  [
    'tax',
    'driver',
    [
      'vehicle tax due',
      'when do i pay car tax',
      'road tax',
      'ajoneuvovero',
      'milloin ajoneuvovero',
    ],
  ],
  [
    'book',
    'driver',
    [
      'how do i book a service',
      'book an appointment',
      'make a booking',
      'i want to book oil change',
      'schedule a repair',
      'varaa huolto',
      'miten varaan ajan',
      'haluan varata ajan',
    ],
  ],
  [
    'next_booking',
    'driver',
    [
      'when is my appointment',
      'my next booking',
      'upcoming booking',
      'what time is my service',
      'milloin varaukseni on',
      'seuraava varaus',
    ],
  ],
  [
    'change_booking',
    'all',
    [
      'cancel my booking',
      'cancel appointment',
      'i can’t make it to my appointment',
      'change my appointment time',
      'reschedule booking',
      'move my appointment',
      'peru varaus',
      'siirrä aikaa',
      'muuta varausta',
    ],
  ],
  [
    'invoices',
    'all',
    [
      'how do i pay my invoice',
      'unpaid invoices',
      'how much do i owe',
      'pay the bill',
      'overdue invoices',
      'create an invoice',
      'maksa lasku',
      'avoimet laskut',
      'luo lasku',
    ],
  ],
  [
    'paylater',
    'driver',
    [
      'klarna',
      'pay later',
      'split the payment',
      'pay in instalments',
      'osamaksu',
      'maksa myöhemmin',
    ],
  ],
  [
    'engine_light',
    'driver',
    [
      'check engine light is on',
      'engine warning light',
      'yellow engine light',
      'engine light flashing',
      'moottorin vikavalo palaa',
      'moottorivalo',
    ],
  ],
  [
    'oil_light',
    'driver',
    [
      'oil light is on',
      'oil pressure warning',
      'red oil can light',
      'öljyvalo palaa',
      'öljynpaine',
    ],
  ],
  [
    'battery',
    'driver',
    [
      'car won’t start',
      'car will not start',
      'car wont start in the morning',
      'engine does not turn over',
      'battery light',
      'dead battery',
      'battery is flat in cold',
      'auto ei käynnisty',
      'akku tyhjä',
      'akkuvalo',
    ],
  ],
  [
    'brakes',
    'driver',
    [
      'brakes are squeaking',
      'grinding noise when braking',
      'brake warning light',
      'brake pedal feels soft',
      'jarrut vinkuu',
      'jarrut kirskuu',
      'jarruvalo palaa',
    ],
  ],
  [
    'tyre_pressure',
    'driver',
    [
      'tyre pressure light',
      'flat tyre',
      'tire pressure warning',
      'puncture',
      'rengaspaine',
      'rengas tyhjä',
      'rengasrikko',
    ],
  ],
  [
    'winter_tyres',
    'driver',
    [
      'when should i change to winter tyres',
      'studded tyres allowed',
      'when are winter tires required',
      'summer tyres back on',
      'talvirenkaat',
      'nastarenkaat milloin',
      'renkaanvaihto',
      'vaihda kesärenkaat alle',
      'vaihda talvirenkaat',
      'swap to summer tyres',
    ],
  ],
  [
    'tread',
    'driver',
    [
      'tread depth',
      'how worn can tyres be',
      'minimum tyre tread',
      'are my tyres too worn',
      'urasyvyys',
      'renkaat kuluneet',
    ],
  ],
  [
    'oil_interval',
    'driver',
    [
      'how often should i change oil',
      'oil change interval',
      'when change oil',
      'öljynvaihto',
      'kuinka usein öljynvaihto',
    ],
  ],
  [
    'membership',
    'all',
    [
      'membership benefits',
      'what do i get with membership',
      'garage plan',
      'join a membership',
      'jäsenyys',
      'jäsenedut',
    ],
  ],
  [
    'contact_garage',
    'driver',
    [
      'contact my garage',
      'garage phone number',
      'message my mechanic',
      'talk to the mechanic',
      'ota yhteyttä korjaamoon',
      'korjaamon puhelinnumero',
    ],
  ],
  [
    'find_garage',
    'driver',
    [
      'find a garage near me',
      'best garage nearby',
      'garages open now',
      'korjaamo lähellä',
      'etsi korjaamo',
    ],
  ],
  [
    'add_car',
    'driver',
    ['add a car', 'add another vehicle', 'register my car', 'lisää auto', 'uusi auto'],
  ],
  [
    'reminders',
    'all',
    ['set a reminder', 'remind me', 'reminder for tyres', 'muistutus', 'muistuta minua'],
  ],
  [
    'password',
    'all',
    [
      'forgot my password',
      'change password',
      'reset password',
      'unohdin salasanan',
      'vaihda salasana',
    ],
  ],
  [
    'fuel_day',
    'driver',
    ['fuel day', 'free fuel', 'free petrol', 'polttoainepäivä', 'ilmainen polttoaine'],
  ],
  [
    'human',
    'all',
    [
      'talk to a person',
      'customer support',
      'contact motodoc',
      'i need help from a human',
      'asiakaspalvelu',
      'yhteys motodociin',
    ],
  ],
  [
    'requests',
    'garage',
    [
      'booking requests',
      'pending requests',
      'new bookings to approve',
      'approve booking',
      'varauspyynnöt',
      'hyväksy varaus',
    ],
  ],
  [
    'block_day',
    'garage',
    [
      'close a day',
      'holiday closed',
      'block a day',
      'change opening hours',
      'sulje päivä',
      'aukioloajat',
      'loma',
    ],
  ],
  [
    'team',
    'garage',
    [
      'add a mechanic',
      'invite staff',
      'give access to employee',
      'team member',
      'kutsu mekaanikko',
      'tiimi',
    ],
  ],
  [
    'reviews',
    'garage',
    ['reply to a review', 'bad review', 'my rating', 'arvostelu', 'vastaa arvioon'],
  ],
];

// The model: one TF-IDF vector per example question; a question is matched to the topic of
// its most similar example (cosine similarity).
const examples = TOPICS.flatMap(([id, role, list]) =>
  list.map((q) => ({ id, role, words: tokens(q) })),
);
const df = new Map();
for (const e of examples) for (const w of new Set(e.words)) df.set(w, (df.get(w) || 0) + 1);
const idf = (w) => Math.log((examples.length + 1) / ((df.get(w) || 0) + 1)) + 1;
const vector = (words) => {
  const tf = new Map();
  for (const w of words) tf.set(w, (tf.get(w) || 0) + 1);
  const v = new Map([...tf].map(([w, n]) => [w, n * idf(w)]));
  const norm = Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0)) || 1;
  for (const [w, x] of v) v.set(w, x / norm);
  return v;
};
for (const e of examples) e.vec = vector(e.words);

export function classify(question, role) {
  const q = vector(tokens(question));
  const best = new Map();
  for (const e of examples) {
    if (e.role !== 'all' && e.role !== role) continue;
    let score = 0;
    for (const [w, x] of q) score += x * (e.vec.get(w) || 0);
    if (score > (best.get(e.id) || 0)) best.set(e.id, score);
  }
  const ranked = [...best].sort((a, b) => b[1] - a[1]);
  return { topic: ranked[0]?.[0] || null, confidence: ranked[0]?.[1] || 0, ranked };
}

const SUGGEST = {
  driver: [
    'What does my car need?',
    'When is my inspection?',
    'How do I pay an invoice?',
    'Check engine light is on',
  ],
  garage: ['Booking requests', 'Overdue invoices', 'How do I close a day?', 'Add a mechanic'],
};

export function registerAssistant(app, ctx) {
  const { one, all, parse, clock, rateLimit } = ctx;

  const dateText = (date, fi) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(fi ? 'fi-FI' : 'en-FI', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  const daysTo = (date) => Math.round((Date.parse(`${date}T12:00:00Z`) - clock()) / DAY);

  const answer = async (topic, user, fi) => {
    const L = (en, finnish) => (fi ? finnish : en);
    const driver = user.role === 'driver';
    const cars = driver
      ? await all(
          `SELECT v.*,c.mot_due,c.oil_life,c.brake_wear FROM vehicles v LEFT JOIN vehicle_condition c ON c.vehicle_id=v.id
           WHERE v.owner_id=? AND v.archived_at IS NULL ORDER BY v.make,v.model`,
          user.id,
        )
      : [];
    const carName = (v) => `${v.make} ${v.model} (${v.registration})`;
    const deadline = (field, label, labelFi) => {
      const rows = cars.filter((v) => v[field]);
      if (!cars.length)
        return {
          text: L(
            'Add your car first and I can keep track of its dates.',
            'Lisää ensin autosi, niin seuraan sen päivämääriä.',
          ),
          actions: [['Add a car', '#vehicles']],
        };
      if (!rows.length)
        return {
          text: L(
            `You haven’t added a ${label} date yet. Add it to your car and MotoDoc reminds you two weeks before.`,
            `Et ole vielä lisännyt ${labelFi}päivää. Lisää se autollesi, niin MotoDoc muistuttaa kaksi viikkoa ennen.`,
          ),
          actions: [['My vehicles', '#vehicles']],
        };
      return {
        text: rows
          .map((v) => {
            const d = daysTo(v[field]);
            return L(
              `${carName(v)}: ${label} ${d < 0 ? `was due ${dateText(v[field])}, ${-d} days ago` : `is due ${dateText(v[field])}, in ${d} days`}.`,
              `${carName(v)}: ${labelFi} ${d < 0 ? `erääntyi ${dateText(v[field], true)}, ${-d} päivää sitten` : `erääntyy ${dateText(v[field], true)}, ${d} päivän päästä`}.`,
            );
          })
          .join('\n'),
        actions: [['My vehicles', '#vehicles']],
      };
    };

    switch (topic) {
      case 'greet':
        return {
          text: L(
            `Hi ${user.name.split(' ')[0]}! Ask me about your car, bookings, invoices or warning lights.`,
            `Hei ${user.name.split(' ')[0]}! Kysy autostasi, varauksista, laskuista tai merkkivaloista.`,
          ),
        };
      case 'thanks':
        return { text: L('You’re welcome. Drive safely!', 'Ole hyvä. Turvallista matkaa!') };
      case 'needs': {
        if (!cars.length)
          return {
            text: L(
              'Add your car and I’ll tell you what it needs next.',
              'Lisää autosi, niin kerron mitä se tarvitsee seuraavaksi.',
            ),
            actions: [['Add a car', '#vehicles']],
          };
        const lines = [];
        for (const v of cars) {
          const records = await all(
            'SELECT r.summary,r.mileage,r.performed_at,b.service FROM service_records r JOIN bookings b ON b.id=r.booking_id WHERE r.vehicle_id=?',
            v.id,
          );
          const due = recommendationsFor(v, records, v, clock()).filter((i) =>
            ['overdue', 'due_soon'].includes(i.priority),
          );
          lines.push(
            due.length
              ? L(
                  `${carName(v)}: ${due.map((i) => `${i.title}${i.priority === 'overdue' ? ' (overdue)' : ' (soon)'}`).join(', ')}.`,
                  `${carName(v)}: ${due.map((i) => `${i.title}${i.priority === 'overdue' ? ' (myöhässä)' : ' (pian)'}`).join(', ')}.`,
                )
              : L(
                  `${carName(v)}: nothing is due right now.`,
                  `${carName(v)}: mitään ei ole juuri nyt erääntymässä.`,
                ),
          );
        }
        return {
          text: lines.join('\n'),
          actions: [
            ['Recommendations', '#recommendations'],
            ['Book a service', 'book'],
          ],
        };
      }
      case 'inspection': {
        const own = deadline('mot_due', 'inspection', 'katsastus');
        return {
          ...own,
          text: `${own.text}\n${L(
            'In Finland most cars are first inspected 4 years after registration, then at 6 and 8 years, and every year after that.',
            'Suomessa useimmat autot katsastetaan ensimmäisen kerran 4 vuoden kuluttua käyttöönotosta, sitten 6 ja 8 vuoden iässä ja sen jälkeen vuosittain.',
          )}`,
          actions: [
            ['Inspections', '#inspections'],
            ['Book inspection prep', 'book'],
          ],
        };
      }
      case 'insurance':
        return deadline('insurance_due', 'insurance', 'vakuutus');
      case 'tax':
        return deadline('tax_due', 'vehicle tax', 'ajoneuvovero');
      case 'book':
        return {
          text: L(
            'Tap Book a service: pick a garage, the service, your car and a free time. The garage confirms it, and you can chat with them in Messages.',
            'Napauta Varaa huolto: valitse korjaamo, palvelu, autosi ja vapaa aika. Korjaamo vahvistaa varauksen, ja voit keskustella heidän kanssaan Viesteissä.',
          ),
          actions: [['Book a service', 'book']],
        };
      case 'next_booking': {
        const b = driver
          ? await one(
              `SELECT b.*,g.name garage_name FROM bookings b JOIN garages g ON g.id=b.garage_id
               WHERE b.driver_id=? AND b.status IN ('pending','confirmed') AND b.starts_at>? ORDER BY b.starts_at LIMIT 1`,
              user.id,
              new Date(clock()).toISOString(),
            )
          : null;
        if (!b)
          return {
            text: L('You have no upcoming bookings.', 'Sinulla ei ole tulevia varauksia.'),
            actions: [['Book a service', 'book']],
          };
        const when = new Date(b.starts_at).toLocaleString(fi ? 'fi-FI' : 'en-FI', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Helsinki',
        });
        return {
          text: L(
            `${b.service} at ${b.garage_name}, ${when}.${b.status === 'pending' ? ' The garage hasn’t confirmed it yet.' : ''}`,
            `${b.service}, ${b.garage_name}, ${when}.${b.status === 'pending' ? ' Korjaamo ei ole vielä vahvistanut sitä.' : ''}`,
          ),
          actions: [['Bookings', '#bookings']],
        };
      }
      case 'change_booking':
        return {
          text: driver
            ? L(
                'Open Bookings, choose the booking and tap Reschedule or Cancel. Please cancel at least 24 hours ahead so the garage can give the time to someone else.',
                'Avaa Varaukset, valitse varaus ja napauta Siirrä tai Peru. Peru vähintään 24 tuntia etukäteen, jotta korjaamo voi antaa ajan jollekulle toiselle.',
              )
            : L(
                'Open Bookings, choose the booking and propose a new time, or decline it with a reason. The driver is told straight away.',
                'Avaa Varaukset, valitse varaus ja ehdota uutta aikaa tai hylkää se perustellen. Asiakas saa tiedon heti.',
              ),
          actions: [['Bookings', '#bookings']],
        };
      case 'invoices': {
        if (!driver) {
          const overdue = user.garage_id
            ? await one(
                "SELECT COUNT(*) n FROM invoices WHERE garage_id=? AND status='unpaid' AND due_date<?",
                user.garage_id,
                new Date(clock()).toISOString().slice(0, 10),
              )
            : { n: 0 };
          return {
            text: L(
              `You have ${overdue.n} overdue ${overdue.n === 1 ? 'invoice' : 'invoices'}. To bill a finished job, open Invoices and tap New invoice, or create it when you complete the job. You can send payment reminders from each invoice.`,
              `Sinulla on ${overdue.n} erääntynyttä laskua. Laskuta valmis työ avaamalla Laskut ja napauttamalla Uusi lasku, tai luo se työn valmistuessa. Maksumuistutukset lähetät laskun sivulta.`,
            ),
            actions: [['Invoices', '#invoices']],
          };
        }
        const open = await one(
          "SELECT COUNT(*) n, MIN(due_date) due FROM invoices WHERE driver_id=? AND status='unpaid'",
          user.id,
        );
        return {
          text: open.n
            ? L(
                `You have ${open.n} unpaid ${open.n === 1 ? 'invoice' : 'invoices'}${open.due ? `, the first due ${dateText(open.due)}` : ''}. Open one and tap Pay now, or pay by bank transfer with its reference number.`,
                `Sinulla on ${open.n} maksamatonta laskua${open.due ? `, ensimmäinen erääntyy ${dateText(open.due, true)}` : ''}. Avaa lasku ja napauta Maksa nyt, tai maksa tilisiirrolla viitenumerolla.`,
              )
            : L(
                'You’re all paid up. No unpaid invoices.',
                'Kaikki on maksettu. Ei avoimia laskuja.',
              ),
          actions: [['Invoices', '#invoices']],
        };
      }
      case 'paylater':
        return {
          text: L(
            'Open an unpaid invoice, tap Pay now and choose Klarna at checkout to pay in 30 days or split the bill. Klarna checks eligibility.',
            'Avaa maksamaton lasku, napauta Maksa nyt ja valitse kassalla Klarna maksaaksesi 30 päivän päästä tai erissä. Klarna tarkistaa maksukelpoisuuden.',
          ),
          actions: [['Invoices', '#invoices']],
        };
      case 'engine_light':
        return {
          text: L(
            'A steady yellow engine light means the engine computer found a fault. It’s usually safe to drive gently to a garage soon for a diagnostic scan. If it’s flashing, or the car shakes or loses power, slow down and stop when it’s safe: driving on can damage the catalytic converter.',
            'Tasaisesti palava keltainen moottorin vikavalo tarkoittaa, että moottorinohjaus havaitsi vian. Yleensä voit ajaa rauhallisesti korjaamolle vikadiagnoosiin pian. Jos valo vilkkuu tai auto nykii tai menettää tehoa, hidasta ja pysähdy turvalliseen paikkaan: ajaminen voi vaurioittaa katalysaattoria.',
          ),
          actions: [['Book diagnostics', 'book']],
        };
      case 'oil_light':
        return {
          text: L(
            'A red oil light means low oil pressure. Stop as soon as it’s safe and turn the engine off: driving on can wreck the engine within minutes. Check the oil level when the engine has cooled. If the level is fine or the light stays on, don’t drive; have it towed or ask your garage.',
            'Punainen öljyvalo tarkoittaa matalaa öljynpainetta. Pysähdy heti kun se on turvallista ja sammuta moottori: ajaminen voi rikkoa moottorin minuuteissa. Tarkista öljymäärä moottorin jäähdyttyä. Jos määrä on kunnossa tai valo palaa edelleen, älä aja; tilaa hinaus tai kysy korjaamolta.',
          ),
          actions: [['Message my garage', '#messages']],
        };
      case 'battery':
        return {
          text: L(
            'If the car won’t start and clicks or the lights are dim, the battery is probably flat; cold weather makes this common in Finland. A jump start or a charger usually helps. If the battery light comes on while driving, the alternator may not be charging: drive straight to a garage. Batteries usually last 4–6 years.',
            'Jos auto ei käynnisty ja naksuttaa tai valot ovat himmeät, akku on luultavasti tyhjä; pakkanen tekee tästä yleistä. Apukäynnistys tai laturi yleensä auttaa. Jos akkuvalo syttyy ajaessa, laturi ei ehkä lataa: aja suoraan korjaamolle. Akku kestää yleensä 4–6 vuotta.',
          ),
          actions: [['Book a battery check', 'book']],
        };
      case 'brakes':
        return {
          text: L(
            'Squeaking often means the pads are getting thin; grinding means metal on metal, so book a brake check right away. A red brake light, a soft pedal or the car pulling to one side are safety issues: drive carefully and get it checked today.',
            'Vinkuminen tarkoittaa usein, että jarrupalat ovat ohentuneet; kirskuminen tarkoittaa metallia metallia vasten, joten varaa jarrujen tarkastus heti. Punainen jarruvalo, pehmeä poljin tai auton vetäminen sivulle ovat turvallisuusasioita: aja varovasti ja tarkastuta jarrut tänään.',
          ),
          actions: [['Book a brake check', 'book']],
        };
      case 'tyre_pressure':
        return {
          text: L(
            'The tyre pressure light means at least one tyre is low. Check all four at a petrol station when the tyres are cold; the right pressures are on a sticker in the driver’s door frame or fuel flap. If one keeps losing air, it may be punctured: a garage can usually repair it.',
            'Rengaspainevalo tarkoittaa, että ainakin yhdessä renkaassa on liian vähän ilmaa. Tarkista kaikki neljä huoltoasemalla renkaiden ollessa kylmiä; oikeat paineet löytyvät kuljettajan oven karmista tai tankin luukusta. Jos rengas tyhjenee jatkuvasti, siinä voi olla reikä: korjaamo voi yleensä paikata sen.',
          ),
          actions: [['Book a tyre check', 'book']],
        };
      case 'winter_tyres':
        return {
          text: L(
            'In Finland winter tyres are required from 1 December to the end of February, and whenever conditions call for them. Studded tyres are allowed from 1 November until the Monday after Easter (earlier or later if the weather needs it). Book your tyre change early: garages fill up at the first frost.',
            'Suomessa talvirenkaat ovat pakolliset 1.12.–helmikuun loppuun ja aina kun olosuhteet sitä vaativat. Nastarenkaita saa käyttää 1.11. alkaen pääsiäistä seuraavaan maanantaihin (sään vaatiessa myös aiemmin tai myöhemmin). Varaa renkaanvaihto ajoissa: korjaamot täyttyvät ensimmäisillä pakkasilla.',
          ),
          actions: [['Book a tyre change', 'book']],
        };
      case 'tread':
        return {
          text: L(
            'The legal minimum tread is 1.6 mm, and 3 mm for winter tyres in the winter tyre period. For safe grip, change summer tyres at about 3 mm and winter tyres at about 4–5 mm.',
            'Lain vaatima vähimmäisurasyvyys on 1,6 mm ja talvirenkailla talvirengaskaudella 3 mm. Turvallisen pidon vuoksi vaihda kesärenkaat noin 3 mm:ssä ja talvirenkaat noin 4–5 mm:ssä.',
          ),
          actions: [['Book a tyre check', 'book']],
        };
      case 'oil_interval':
        return {
          text: L(
            'Most cars need an oil change every 15 000 km or once a year, whichever comes first; check your car’s service book. Short trips in the cold wear oil faster. MotoDoc works out when yours is due from your service history.',
            'Useimmat autot tarvitsevat öljynvaihdon 15 000 km:n tai vuoden välein, kumpi tulee ensin; tarkista huoltokirjasta. Lyhyet ajot pakkasella kuluttavat öljyä nopeammin. MotoDoc laskee huoltohistoriasta, milloin vaihto on edessä.',
          ),
          actions: [['Recommendations', '#recommendations']],
        };
      case 'membership':
        return {
          text: driver
            ? L(
                'A garage membership gives you a lower hourly rate and the garage’s own perks for the cars you choose. Open Memberships to see plans from garages you use.',
                'Korjaamojäsenyys antaa alemman tuntihinnan ja korjaamon omat edut valitsemillesi autoille. Avaa Jäsenyydet nähdäksesi käyttämiesi korjaamojen paketit.',
              )
            : L(
                'Offer a yearly membership with a member hourly rate and your own perks. Open Memberships to set the price and see your members.',
                'Tarjoa vuosijäsenyyttä jäsentuntihinnalla ja omilla eduillasi. Avaa Jäsenyydet asettaaksesi hinnan ja nähdäksesi jäsenesi.',
              ),
          actions: [['Memberships', '#memberships']],
        };
      case 'contact_garage':
        return {
          text: L(
            'My mechanic has your garage’s phone, address and opening hours. To write to them about a booking, use Messages.',
            'Mekaanikkosi-sivulla on korjaamosi puhelinnumero, osoite ja aukioloajat. Kirjoita varaukseen liittyen Viesteissä.',
          ),
          actions: [
            ['My mechanic', '#mechanic'],
            ['Messages', '#messages'],
          ],
        };
      case 'find_garage':
        return {
          text: L(
            'Open Find a garage. Filter by what’s open now or by specialisation, or tap Near me to sort by distance. Ratings come from verified bookings.',
            'Avaa Etsi korjaamo. Suodata auki olevat tai erikoisala, tai napauta Lähelläni lajitellaksesi etäisyyden mukaan. Arviot tulevat varmennetuista varauksista.',
          ),
          actions: [['Find a garage', '#garages']],
        };
      case 'add_car':
        return {
          text: L(
            'Open My vehicles and tap Add vehicle. Add the inspection, insurance and tax dates too, and MotoDoc reminds you before each one.',
            'Avaa Autoni ja napauta Lisää ajoneuvo. Lisää myös katsastus-, vakuutus- ja veropäivät, niin MotoDoc muistuttaa ennen jokaista.',
          ),
          actions: [['My vehicles', '#vehicles']],
        };
      case 'reminders':
        return {
          text: L(
            'Open Reminders and tap Add reminder with a date. You’ll see it in the app, and by email if you’ve turned on email updates in Account.',
            'Avaa Muistutukset ja napauta Lisää muistutus päivämäärineen. Näet sen sovelluksessa ja sähköpostissa, jos olet ottanut sähköposti-ilmoitukset käyttöön Tilissä.',
          ),
          actions: [['Reminders', '#reminders']],
        };
      case 'password':
        return {
          text: L(
            'To change it, open Account and choose Change password. If you’re signed out and forgot it, use Forgot password on the sign-in page and we’ll email you a link.',
            'Vaihda salasana avaamalla Tili ja valitsemalla Vaihda salasana. Jos olet kirjautunut ulos ja unohdit sen, käytä kirjautumissivun Unohtuiko salasana -linkkiä, niin lähetämme linkin sähköpostiisi.',
          ),
          actions: [['Account', '#account']],
        };
      case 'fuel_day':
        return {
          text: L(
            'On Fuel Day MotoDoc pays for some of your fuel at a partner station, one day only, while places last. Open Fuel Day to see if one is coming up and claim your pass.',
            'Polttoainepäivänä MotoDoc maksaa osan polttoaineestasi kumppaniasemalla, vain yhtenä päivänä ja niin kauan kuin paikkoja riittää. Avaa Polttoainepäivä nähdäksesi tulevat päivät ja lunastaaksesi passin.',
          ),
          actions: [['Fuel Day', '#fuel-day']],
        };
      case 'human':
        return {
          text: L(
            'For a booking, write to the garage in Messages. For anything about MotoDoc itself, send us feedback from Account and a person will read it.',
            'Varaukseen liittyen kirjoita korjaamolle Viesteissä. MotoDociin liittyvissä asioissa lähetä palautetta Tilin kautta, niin ihminen lukee sen.',
          ),
          actions: [
            ['Messages', '#messages'],
            ['Account', '#account'],
          ],
        };
      case 'requests': {
        const n = user.garage_id
          ? (
              await one(
                "SELECT COUNT(*) n FROM bookings b LEFT JOIN booking_jobs j ON j.booking_id=b.id WHERE b.garage_id=? AND b.status='pending' AND COALESCE(j.requested_by,'driver')<>'garage'",
                user.garage_id,
              )
            ).n
          : 0;
        return {
          text: L(
            `You have ${n} booking ${n === 1 ? 'request' : 'requests'} waiting. Open Bookings to approve with a time and mechanic, propose another time, or decline with a reason.`,
            `Sinulla on ${n} odottavaa varauspyyntöä. Avaa Varaukset hyväksyäksesi ajan ja mekaanikon, ehdottaaksesi toista aikaa tai hylätäksesi perustellen.`,
          ),
          actions: [['Bookings', '#bookings']],
        };
      }
      case 'block_day':
        return {
          text: L(
            'On Overview, use Blocked days to close a date (drivers can’t book it) and Opening hours to change your weekly hours. Your online switch hides you from new bookings right away.',
            'Yleiskatsauksessa voit sulkea päivän kohdasta Suljetut päivät (asiakkaat eivät voi varata sitä) ja muuttaa viikon aukioloaikoja. Paikalla-kytkin piilottaa sinut uusilta varauksilta heti.',
          ),
          actions: [['Overview', '#overview']],
        };
      case 'team':
        return {
          text: L(
            'Open Team and tap Invite. Choose a role (manager, mechanic or receptionist) and fine-tune which areas they can see. They get a link to set their own password.',
            'Avaa Tiimi ja napauta Kutsu. Valitse rooli (esihenkilö, mekaanikko tai asiakaspalvelija) ja säädä, mitä alueita hän näkee. Hän saa linkin oman salasanan asettamiseen.',
          ),
          actions: [['Team', '#team']],
        };
      case 'reviews':
        return {
          text: L(
            'Open Reviews to see your rating breakdown and reply publicly to each review once. A calm, specific reply to a bad review helps future customers trust you.',
            'Avaa Arviot nähdäksesi arvosanojesi jakauman ja vastataksesi julkisesti kuhunkin arvioon kerran. Rauhallinen ja konkreettinen vastaus huonoon arvioon lisää tulevien asiakkaiden luottamusta.',
          ),
          actions: [['Reviews', '#reviews']],
        };
      default:
        return null;
    }
  };

  app.post('/api/assistant', async (req, res) => {
    const { message, lang } = parse(
      z.object({
        message: z.string().trim().min(1).max(500),
        lang: z.enum(['en', 'fi']).default('en'),
      }),
      req,
    );
    await rateLimit(req, 'assistant', 60, req.user.id);
    const role = req.user.role === 'garage' ? 'garage' : 'driver';
    const fi = lang === 'fi';
    const { topic, confidence } = classify(message, role);
    const reply = confidence >= 0.3 ? await answer(topic, req.user, fi) : null;
    if (!reply)
      return res.json({
        topic: null,
        confidence,
        text: fi
          ? 'En ole varma, mitä tarkoitat. Kokeile jotakin näistä tai kysy korjaamoltasi.'
          : 'I’m not sure about that one. Try one of these, or ask your garage.',
        actions: [],
        suggestions: SUGGEST[role],
      });
    res.json({
      topic,
      confidence: Math.round(confidence * 100) / 100,
      text: reply.text,
      actions: (reply.actions || []).map(([label, href]) => ({ label, href })),
      suggestions: [],
    });
  });
}
