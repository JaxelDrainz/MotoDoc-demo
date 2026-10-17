const EMAIL = '[info@motodoc.app](mailto:info@motodoc.app)';

export const fiContent = {
  hero: {
    title: 'Sinun autosi.\nSinun mekaanikkosi.',
    tagline: 'Kaikki yhdessä paikassa.',
    description:
      'Varaa luotettava korjaamo, pidä huoltohistoria tallessa ja nauti mekaanikkosi eduista.',
    cta: 'Aloita',
    secondary: 'Korjaamoille',
  },
  drivers: {
    eyebrow: 'AUTOILIJOILLE',
    title: 'Autosi huolto,\nselkeästi järjestyksessä.',
    text: 'Kaikki mitä autosi tarvitsee, yhdessä paikassa. Seuraavasta huollosta viimeisimpään korjaukseen – pidä yhteyttä niihin, jotka pitävät sinut liikkeessä.',
    features: [
      {
        title: 'Löydä luotettava korjaamo',
        text: 'Löydä luotettavat korjaamot läheltäsi ja pidä yhteyttä mekaanikkoosi.',
      },
      { title: 'Varaa aika', text: 'Varaa suoraan luotettavilta korjaamoilta – ei puheluita.' },
      { title: 'Huoltohistoria', text: 'Seuraa jokaista korjausta ja huoltoa yhdessä paikassa.' },
      { title: 'Jäsenedut', text: 'Avaa mekaanikkosi alennukset ja edut.' },
      { title: 'Laskut ja maksut', text: 'Pidä huoltolaskut ja maksutiedot yhdessä.' },
      { title: 'Älykkäät muistutukset', text: 'Pidä katsastus- ja huoltopäivät näkyvillä.' },
    ],
  },
  garages: {
    eyebrow: 'KORJAAMOILLE',
    title: 'Sinun korjaamosi.\nTäysin verkossa.',
    text: 'Hallitse varauksia, jäsenyyksiä, huoltokirjauksia ja viestintää yhdessä paikassa – nykyaikaiseen autonhuoltoon.',
    cta: 'Rekisteröi korjaamosi',
    caption: 'Enemmän aikaa siihen, missä olet paras.',
    features: [
      { title: 'Korjaamoprofiili', text: 'Näytä autoilijoille palvelusi ja sijaintisi.' },
      {
        title: 'Asiakashallinta',
        text: 'Pidä asiakashistoria, omat muistiinpanot ja tunnisteet yhdessä.',
      },
      { title: 'Jäsenohjelmat', text: 'Luo omilla hinnoilla ja eduilla varustettuja jäsenyyksiä.' },
      { title: 'Varausten hallinta', text: 'Käy pyynnöt läpi ja vahvista jokainen aika.' },
      {
        title: 'Korjaamon yleiskuva',
        text: 'Näe tulevat työt, valmiit huollot ja laskujen summat.',
      },
      {
        title: 'Laskutus ja kirjaukset',
        text: 'Luo huoltolaskuja ja kirjaa vastaanotetut maksut.',
      },
    ],
  },
  product: {
    eyebrow: 'TUOTE',
    title: 'Autosi yhdellä näytöllä.',
    text: 'Autoilijan näkymä näyttää autosi lukemat, seuraavan huollon ja autostasi huolehtivan korjaamon. Tämä on oikea sovellus esimerkkitiedoilla.',
  },
  closing: {
    eyebrow: 'AUTONHUOLTO HELPOKSI',
    title: 'Sinun mekaanikkosi.\nSinun huoltosi. Sinun MotoDocisi.',
    text: 'Löydä korjaamo, johon voit luottaa. Varaa huollot, seuraa kunnossapitoa ja hyödynnä jäsenedut – kaikki yhdessä sovelluksessa.',
    cta: 'Pääse mukaan',
    secondary: 'Rekisteröi korjaamosi',
  },
  faq: [
    {
      question: 'Miten varaan huollon?',
      answer:
        'Lisää autosi, valitse listattu korjaamo ja poimi vapaa tunti sen kalenterista. Pyyntösi menee korjaamolle, joka vahvistaa sen. Voit siirtää tai perua tulevan varauksen näkymästäsi.',
    },
    {
      question: 'Ottaako MotoDoc vastaan maksuja?',
      answer:
        'Ei. Korjaamot voivat kirjata laskut ja vastaanottamansa maksut, jotta molemmat näkevät saman tiedon, mutta itse maksu sovitaan suoraan sinun ja korjaamon välillä.',
    },
    {
      question: 'Mistä öljyn, jarrujen ja katsastuksen lukemat tulevat?',
      answer:
        'Syötät ne itse autosi mittaristosta tai viimeisimmästä katsastus- tai huoltoraportista. Ne eivät ole reaaliaikaista anturidataa, ja MotoDoc näyttää ”Ei kirjattu”, kunnes lisäät ne.',
    },
    {
      question: 'Voinko viestiä korjaamoni kanssa MotoDocissa?',
      answer:
        'Kyllä. Jokaisella varauksella on oma viestiketjunsa, ja kellokuvake näyttää uudet viestit, vahvistukset ja erääntyvät muistutukset.',
    },
    {
      question: 'Miten korjaamo liittyy mukaan?',
      answer:
        'Luo korjaamotili, täydennä profiiliin palvelut, yhteystiedot ja aukioloajat ja julkaise se. Autoilijat voivat sen jälkeen löytää ja varata sinut.',
    },
    {
      question: 'Mitä tiedoilleni tapahtuu?',
      answer:
        'Tilisi, ajoneuvosi, varauksesi ja viestisi tallennetaan, jotta palvelu toimii, ja niitä jaetaan vain korjaamoille, joilta varaat. Lisätiedot löytyvät [tietosuojaselosteesta](/privacy).',
    },
  ],
  legal: {
    privacy: {
      title: 'Tietosuojaseloste',
      intro:
        'Tämä seloste kertoo, mitä MotoDoc tallentaa sinusta, miksi, kuka tiedot näkee ja mitä voit pyytää meitä tekemään niillä.',
      updated: '13. lokakuuta 2026',
      body: `## Rekisterinpitäjä
MotoDocia ylläpitää MotoDoc-tiimi. Lähetä tietosuojaa koskevat kysymykset ja pyynnöt osoitteeseen ${EMAIL}.

## Mitä tallennamme
- **Tilisi:** nimi, sähköpostiosoite ja rooli (autoilija tai korjaamo). Salasanasi tallennetaan vain suolattuna scrypt-tiivisteenä, ei koskaan luettavassa muodossa. Jos käytät Google-kirjautumista, tallennamme Google-tilisi tunnisteen.
- **Autoilijat:** ajoneuvosi (merkki, malli, vuosimalli, rekisterinumero, ajokilometrit), syöttämäsi lukemat, varaukset, huoltokirjaukset, arviot, muistutukset ja jäsenyyspyynnöt.
- **Korjaamot:** julkinen profiili, palvelut, yhteystiedot, aukioloajat, jäsenyydet, kirjaamasi laskut sekä asiakkaistasi tekemäsi yksityiset muistiinpanot.
- **Molemmat:** varauksiin liittyvät viestit sekä profiilikuva tai logo, jos lataat sellaisen.

## Miksi käytämme tietoja
Pyytämäsi palvelun tuottamiseen: kirjautumiseen, autojesi ja varaustesi näyttämiseen, varauspyyntöjen ja viestien välittämiseen autoilijoiden ja korjaamoiden välillä sekä erääntyvistä päivistä muistuttamiseen. Emme myy tietojasi emmekä käytä niitä mainontaan.

## Kuka näkee tiedot
- Korjaamo, jolta varaat, näkee nimesi, kuvasi, varatun ajoneuvon ja palvelun, viestisi sekä arviosi huollosta.
- Autoilija näkee korjaamon julkisen profiilin, yhteystiedot, keskiarvosanan ja viestit.
- Palveluntarjoajamme (Vercel ja Turso) käsittelevät tietoja puolestamme, jotta palvelu toimii.

## Evästeet ja selaimen tallennustila
MotoDoc asettaa yhden evästeen, \`motodoc_session\`, joka pitää sinut kirjautuneena enintään seitsemän päivää. Se on välttämätön, eikä skripteillä voi lukea sitä. Vaalean tai tumman tilan valinta, kielivalinta ja sivuston näyttöasetukset tallennetaan selaimesi paikalliseen tallennustilaan. Emme käytä mainos- tai analytiikkaevästeitä.

## Muut palvelut, joita käytämme
- **Google-kirjautuminen**, vain jos valitset kirjautumisen Googlella.
- **Wikipedia ja Wikimedia Commons** automallin kuvan hakemiseen. Lähetämme vain merkin ja mallin. Itse kuva latautuu Wikimedian palvelimilta, jotka näkevät siksi IP-osoitteesi.
- **NHTSA:n ajoneuvotietokanta** sellaisen merkin tai mallin hakemiseen, jota ei ole omassa luettelossamme. Lähetämme vain merkki- tai mallikenttään kirjoittamasi tekstin.

## Kuinka kauan säilytämme tiedot
Säilytämme tietojasi niin kauan kuin tilisi on olemassa. Jos haluat sulkea tilisi ja poistaa tietosi, kirjoita osoitteeseen ${EMAIL}. Korjaamon kirjaamia huoltokirjauksia ja laskuja voidaan säilyttää, jos korjaamon on lain mukaan säilytettävä ne.

## Oikeutesi
Voit pyytää kopion tiedoistasi, niiden korjaamista tai poistamista, vastustaa tai rajoittaa niiden käyttöä sekä saada ne siirrettävässä muodossa. Kirjoita osoitteeseen ${EMAIL}, niin vastaamme kuukauden kuluessa. Jos olet EU:ssa tai ETA-alueella, voit tehdä valituksen myös kansalliselle tietosuojaviranomaiselle.`,
    },
    terms: {
      title: 'Käyttöehdot',
      intro: 'Nämä ehdot ovat voimassa, kun luot MotoDoc-tilin tai käytät palvelua.',
      updated: '13. lokakuuta 2026',
      body: `## Mikä MotoDoc on
MotoDoc yhdistää autoilijat ja itsenäiset korjaamot. Autoilijat pitävät ajoneuvotietonsa tallessa, varaavat huoltoja ja viestivät korjaamoiden kanssa; korjaamot hallitsevat varauksia, asiakkaita, jäsenyyksiä ja laskukirjauksia. MotoDoc ei ole korjaamo eikä tee itse korjauksia tai huoltoja.

## Tilisi
Anna oikeat tiedot, pidä salasanasi omana tietonasi ja ilmoita osoitteeseen ${EMAIL}, jos epäilet jonkun muun käyttäneen tiliäsi. Olet vastuussa siitä, mitä tilisi kautta tehdään.

## Varaukset
Varaus on pyyntö, kunnes korjaamo vahvistaa sen. Kumpi tahansa osapuoli voi perua tulevan varauksen sovelluksessa. Työstä, sen laadusta, hinnasta ja mahdollisesta takuusta sovitaan autoilijan ja korjaamon välillä.

## Maksut ja laskut
MotoDoc ei ota vastaan eikä käsittele maksuja. Sovelluksen laskut ja ”maksettu”-merkinnät ovat korjaamon kirjauksia. Jäsenyydet ovat korjaamoiden tarjouksia, ja niiden hinnoittelusta ja laskutuksesta sovitaan suoraan korjaamon kanssa.

## Ajoneuvotiedot
Lukemat, kuten öljyn kesto, jarrujen kuluminen ja katsastuspäivät, syötät itse, ja ne näytetään sellaisina kuin syötit ne. Autojen kuvat ovat Wikimedia Commonsin yleiskuvia mallista, eivät kuvia omasta ajoneuvostasi. Älä luota MotoDociin autosi omien varoitusten, valmistajan huolto-ohjelman tai mekaanikon neuvojen sijaan.

## Arviot ja viestit
Voit arvioida huollon vasta, kun se on valmis. Pidä arviot ja viestit rehellisinä ja lainmukaisina. Voimme poistaa sisältöä tai sulkea tilejä, jotka ovat loukkaavia, vilpillisiä tai käyttävät palvelua väärin.

## Saatavuus ja vastuu
Pyrimme pitämään MotoDocin saatavilla ja ajan tasalla, mutta tarjoamme sen sellaisenaan ilman takuuta keskeytyksettömästä toiminnasta. Lain sallimissa rajoissa MotoDoc ei vastaa korjaamoiden työstä, väliin jääneistä varauksista tai välillisistä vahingoista. Mikään näissä ehdoissa ei rajoita kuluttajansuojalain mukaisia oikeuksiasi, joita ei voi sopimuksella rajata.

## Muutokset
Jos muutamme näitä ehtoja merkittävästi, kerromme siitä sovelluksessa tai sähköpostitse ennen muutoksen voimaantuloa. Voit lopettaa MotoDocin käytön ja pyytää tilisi sulkemista milloin tahansa.`,
    },
    contact: {
      title: 'Yhteystiedot',
      intro: 'Kysyttävää MotoDocista, tilistäsi tai korjaamosi listaamisesta? Autamme mielellämme.',
      updated: '',
      body: `## Sähköposti
Kirjoita osoitteeseen ${EMAIL}. Kerro, oletko autoilija vai korjaamo, ja tiliin liittyvissä kysymyksissä sähköpostiosoite, jolla rekisteröidyit.

## Ongelma varauksen tai huollon kanssa
Lähetä viesti ensin korjaamolle tilisi varauksesta; korjaamo näkee tiedot ja vastaa nopeimmin. Jos asia ei ratkea, kirjoita meille.

## Tietosi
Jos haluat kopion tiedoistasi tai tilisi poistettavaksi, katso [tietosuojaseloste](/privacy) ja kirjoita osoitteeseen ${EMAIL}.`,
    },
  },
};

export const fiStrings = {
  'Plan service': 'Suunnittele huolto',
  '{x} days': '{x} päivää',
  '{x} day': '{x} päivä',
  'Photo: {x}': 'Kuva: {x}',
  'Photo:': 'Kuva:',
  'Rate {x}': 'Arvioi: {x}',
  'Notifications, {x} new': 'Ilmoitukset, {x} uutta',
  'Switch to dark mode': 'Vaihda tummaan tilaan',
  'Switch to light mode': 'Vaihda vaaleaan tilaan',
  'MotoDoc driver dashboard showing a Volvo XC60 with oil life, brake wear and inspection countdown, an upcoming confirmed oil service, and the connected workshop with its rating and contact buttons.':
    'MotoDocin autoilijanäkymä: Volvo XC60, öljyn kesto, jarrujen kuluminen ja katsastukseen jäljellä oleva aika, tuleva vahvistettu öljynvaihto sekä oma korjaamo arvosanoineen ja yhteyspainikkeineen.',
  'Times use your device’s timezone. Your garage confirms the appointment.':
    'Ajat ovat laitteesi aikavyöhykkeellä. Korjaamosi vahvistaa ajan.',
  'Hello,': 'Hei,',
  'Messages with': 'Viestit:',
  'Notes for': 'Muistiinpanot:',
  'Selected:': 'Valittu:',
  'A LITTLE HELP, EVERY STEP': 'PIENTÄ APUA JOKA VAIHEESSA',
  'A LITTLE MORE, FROM YOUR MECHANIC': 'VÄHÄN ENEMMÄN MEKAANIKOLTASI',
  'A clear view of your garage, and the people who trust it.':
    'Selkeä näkymä korjaamoosi ja ihmisiin, jotka luottavat siihen.',
  'A driver and mechanic reviewing a service note together beside a car in a garage.':
    'Autoilija ja mekaanikko käyvät huoltomuistiinpanoa läpi auton vieressä korjaamossa.',
  'A familiar face for every service.': 'Tuttu kasvo jokaisessa huollossa.',
  'A helping hand.': 'Auttava käsi.',
  'A little extra convenience for your next visit.':
    'Vähän lisää vaivattomuutta seuraavalle käynnille.',
  'A little help remembering what’s next.': 'Pientä apua muistamaan, mitä on tulossa.',
  'A little less admin. A lot more peace of mind.':
    'Vähemmän paperityötä. Paljon enemmän mielenrauhaa.',
  'A mechanic caring for a car, illustrated in green.':
    'Vihreä piirros mekaanikosta huoltamassa autoa.',
  'A mechanic inspecting a car engine in a bright workshop.':
    'Mekaanikko tarkastaa auton moottoria valoisassa korjaamossa.',
  'A trusted garage.': 'Luotettava korjaamo.',
  About: 'Tietoa',
  'About MotoDoc': 'Tietoa MotoDocista',
  'About your garage': 'Tietoa korjaamostasi',
  Account: 'Tili',
  'Account created. Welcome to MotoDoc.': 'Tili luotu. Tervetuloa MotoDociin.',
  'Account navigation': 'Tilin navigointi',
  'Add a phone number, opening hours, and the mechanic drivers will meet.':
    'Lisää puhelinnumero, aukioloajat ja mekaanikko, jonka autoilijat tapaavat.',
  'Add a reminder': 'Lisää muistutus',
  'Add a vehicle to book': 'Lisää ajoneuvo varataksesi',
  'Add inspection dates, insurance renewals, or your next tyre change.':
    'Lisää katsastuspäivät, vakuutusten uusimiset tai seuraava renkaanvaihto.',
  'Add plan': 'Lisää jäsenyys',
  'Add reminder': 'Lisää muistutus',
  'Add to Calendar': 'Lisää kalenteriin',
  'Add vehicle': 'Lisää ajoneuvo',
  'Add your address': 'Lisää osoitteesi',
  'Add your car': 'Lisää autosi',
  'Add your city': 'Lisää kaupunkisi',
  'Add your first car to keep its details and service records together.':
    'Lisää ensimmäinen autosi, niin sen tiedot ja huoltokirjaukset pysyvät yhdessä.',
  'Add your first vehicle': 'Lisää ensimmäinen ajoneuvosi',
  'Add your vehicle': 'Lisää ajoneuvosi',
  'Add your vehicle, find a garage, and book your next service.':
    'Lisää ajoneuvosi, löydä korjaamo ja varaa seuraava huolto.',
  Address: 'Osoite',
  'All appointments': 'Kaikki ajat',
  'Already have an account?': 'Onko sinulla jo tili?',
  'Already requested': 'Jo pyydetty',
  'Amount (EUR)': 'Summa (EUR)',
  'Amounts are recorded in EUR. This creates an invoice record; it does not charge a customer.':
    'Summat kirjataan euroina. Tämä luo laskukirjauksen; se ei veloita asiakasta.',
  Analytics: 'Analytiikka',
  'Anything the mechanic should know?': 'Onko jotain, mitä mekaanikon pitäisi tietää?',
  Appointment: 'Aika',
  'Appointments start on the hour, in your local time. Your garage confirms any new time.':
    'Ajat alkavat tasatunnein paikallista aikaasi. Korjaamosi vahvistaa uuden ajan.',
  Approve: 'Hyväksy',
  'Approve membership': 'Hyväksy jäsenyys',
  'AutoFix Tampere · Mon, 10:00': 'AutoFix Tampere · ma 10.00',
  'Available plans': 'Saatavilla olevat jäsenyydet',
  'Available times could not be checked. Please retry.':
    'Vapaita aikoja ei voitu tarkistaa. Yritä uudelleen.',
  'Awaiting garage confirmation': 'Odottaa korjaamon vahvistusta',
  'Awaiting payment': 'Odottaa maksua',
  'Back to home': 'Takaisin etusivulle',
  'Back to log in': 'Takaisin kirjautumiseen',
  'Benefits and billing terms': 'Edut ja laskutusehdot',
  'Benefits created by your mechanic, for their members.': 'Mekaanikkosi luomat edut jäsenilleen.',
  'Benefits that stay with you.': 'Edut, jotka kulkevat mukanasi.',
  'Bills & payments': 'Laskut ja maksut',
  Book: 'Varaa',
  'Book & unlock benefits': 'Varaa ja avaa edut',
  'Book a service': 'Varaa huolto',
  'Book a service to connect with a garage.': 'Varaa huolto yhdistääksesi korjaamoon.',
  'Book appointments': 'Varaa aika',
  'Book services, track your history, and activate your perks.':
    'Varaa huoltoja, seuraa historiaasi ja ota etusi käyttöön.',
  'Book with trusted garages directly — no calls needed.':
    'Varaa suoraan luotettavilta korjaamoilta – ei puheluita.',
  'Booking cancelled.': 'Varaus peruttu.',
  'Booking management': 'Varausten hallinta',
  'Booking moved. Your garage will confirm the new time.':
    'Varaus siirretty. Korjaamosi vahvistaa uuden ajan.',
  Bookings: 'Varaukset',
  'Bookings, records, and reminders stay together in your MotoDoc account.':
    'Varaukset, kirjaukset ja muistutukset pysyvät yhdessä MotoDoc-tililläsi.',
  'Brake Wear': 'Jarrujen kuluminen',
  'Brake wear (%)': 'Jarrujen kuluminen (%)',
  'Bring your customers, bookings, and service records together in one place.':
    'Kokoa asiakkaat, varaukset ja huoltokirjaukset yhteen paikkaan.',
  'Calendar file downloaded. Open it to add your service.':
    'Kalenteritiedosto ladattu. Avaa se lisätäksesi huollon.',
  Call: 'Soita',
  Cancel: 'Peru',
  'Cancel booking': 'Peru varaus',
  'Cancel membership': 'Peru jäsenyys',
  'Cancel this booking': 'Peru tämä varaus',
  'Cancel this booking?': 'Perutaanko tämä varaus?',
  Cancelled: 'Peruttu',
  'Car dashboard': 'Auton näkymä',
  'Change photo': 'Vaihda kuva',
  'Check soon': 'Tarkista pian',
  'Check your public profile': 'Tarkista julkinen profiilisi',
  'Checking Google Sign-In…': 'Tarkistetaan Google-kirjautumista…',
  'Checking free times…': 'Tarkistetaan vapaita aikoja…',
  'Choose a make first, then search': 'Valitse ensin merkki ja hae sitten',
  'Choose a new password.': 'Valitse uusi salasana.',
  'Choose a new time': 'Valitse uusi aika',
  'Choose a valid date and time.': 'Valitse kelvollinen päivä ja aika.',
  'Choose an appointment time.': 'Valitse aika.',
  'Choose an available appointment time before continuing.':
    'Valitse vapaa aika ennen kuin jatkat.',
  'Choose your mechanic': 'Valitse mekaanikkosi',
  'Choose…': 'Valitse…',
  City: 'Kaupunki',
  'Close dialog': 'Sulje ikkuna',
  'Close form': 'Sulje lomake',
  'Close information': 'Sulje tiedot',
  'Close menu': 'Sulje valikko',
  Company: 'Yritys',
  'Company links': 'Yrityksen linkit',
  'Complete reminder': 'Merkitse muistutus tehdyksi',
  'Complete service': 'Merkitse huolto valmiiksi',
  'Complete the service': 'Merkitse huolto valmiiksi',
  'Complete your garage profile and list your services so drivers can find you.':
    'Täydennä korjaamoprofiilisi ja listaa palvelusi, jotta autoilijat löytävät sinut.',
  Completed: 'Valmis',
  'Completed booking': 'Valmis varaus',
  'Completed service records for': 'Ajoneuvon',
  Confirm: 'Vahvista',
  'Confirm booking': 'Vahvista varaus',
  'Confirm that you have agreed the benefits and any billing arrangements with this customer.':
    'Vahvista, että olet sopinut edut ja mahdollisen laskutuksen tämän asiakkaan kanssa.',
  Confirmed: 'Vahvistettu',
  'Connect the Google account with the same email address to use it for future sign-ins.':
    'Yhdistä Google-tili, jossa on sama sähköpostiosoite, käyttääksesi sitä kirjautumiseen.',
  Connected: 'Yhdistetty',
  'Connected Workshop': 'Oma korjaamo',
  'Connected. You can use Google to sign in to this account.':
    'Yhdistetty. Voit kirjautua tälle tilille Googlella.',
  Contact: 'Yhteystiedot',
  'Contact details': 'Yhteystiedot',
  'Contact us': 'Ota yhteyttä',
  'Continue with Google': 'Jatka Googlella',
  Conversation: 'Keskustelu',
  'Create a membership plan': 'Luo jäsenyys',
  'Create a password': 'Luo salasana',
  'Create account': 'Luo tili',
  'Create an account': 'Luo tili',
  'Create an invoice': 'Luo lasku',
  'Create invoice': 'Luo lasku',
  'Create plans with your own pricing and benefits.':
    'Luo jäsenyyksiä omilla hinnoilla ja eduilla.',
  'Create service invoices and record payments received.':
    'Luo huoltolaskuja ja kirjaa vastaanotetut maksut.',
  'Create your account': 'Luo tilisi',
  'Create your account.': 'Luo tilisi.',
  'Customer CRM': 'Asiakashallinta',
  'Customer notes': 'Asiakasmuistiinpanot',
  Customers: 'Asiakkaat',
  'Dashboard sections': 'Näkymän osiot',
  Date: 'Päivä',
  'Discover trusted garages near you and stay connected to your mechanic.':
    'Löydä luotettavat korjaamot läheltäsi ja pidä yhteyttä mekaanikkoosi.',
  Dismiss: 'Sulje',
  'Dismiss notification': 'Sulje ilmoitus',
  'Draft — only you can see it': 'Luonnos – vain sinä näet sen',
  Driver: 'Autoilija',
  'Driver links': 'Autoilijan linkit',
  'Drivers who book with your garage will appear here.':
    'Korjaamostasi varaavat autoilijat näkyvät täällä.',
  Due: 'Erääntyy',
  'Due date': 'Eräpäivä',
  'Easy booking': 'Helppo varaus',
  'Edit contact details': 'Muokkaa yhteystietoja',
  'Edit details': 'Muokkaa tietoja',
  'Edit notes': 'Muokkaa muistiinpanoja',
  'Edit profile': 'Muokkaa profiilia',
  'Edit vehicle': 'Muokkaa ajoneuvoa',
  'Email address': 'Sähköpostiosoite',
  'Enter a valid email address.': 'Anna kelvollinen sähköpostiosoite.',
  'Enter your email address.': 'Anna sähköpostiosoitteesi.',
  'Enter your full name.': 'Anna koko nimesi.',
  'Enter your password': 'Anna salasanasi',
  'Enter your password.': 'Anna salasanasi.',
  'Every service tells a story': 'Jokainen huolto kertoo tarinan',
  'Example upcoming service: Oil change at AutoFix Tampere, Monday at 10:00':
    'Esimerkki tulevasta huollosta: öljynvaihto AutoFix Tampereella maanantaina klo 10.00',
  'Explore member benefits': 'Tutustu jäsenetuihin',
  'FOR DRIVERS': 'AUTOILIJOILLE',
  'FOR GARAGES': 'KORJAAMOILLE',
  Features: 'Ominaisuudet',
  'Find a garage': 'Etsi korjaamo',
  'Find a garage and request your first service.': 'Etsi korjaamo ja pyydä ensimmäinen huolto.',
  'Find trusted garages near you and connect with the right one.':
    'Löydä luotettavat korjaamot läheltäsi ja valitse sopiva.',
  'Find your trusted garage': 'Löydä luotettava korjaamo',
  'For current information, contact the MotoDoc team.':
    'Ajantasaiset tiedot saat MotoDoc-tiimiltä.',
  'For drivers': 'Autoilijoille',
  'For garages': 'Korjaamoille',
  'Forgot password?': 'Unohditko salasanan?',
  'Forgot your password?': 'Unohditko salasanasi?',
  Free: 'Maksuton',
  'From your next appointment to the last repair.': 'Seuraavasta ajasta viimeisimpään korjaukseen.',
  'Full name': 'Koko nimi',
  'GOOD CAR CARE STARTS WITH TRUST': 'HYVÄ AUTONHUOLTO ALKAA LUOTTAMUKSESTA',
  'Garage links': 'Korjaamon linkit',
  'Garage name': 'Korjaamon nimi',
  'Garage name, city, or service': 'Korjaamon nimi, kaupunki tai palvelu',
  'Garage overview': 'Korjaamon yleiskuva',
  'Garage owner': 'Korjaamon omistaja',
  'Garage owners can create an account and publish their profile in this local app.':
    'Korjaamojen omistajat voivat luoda tilin ja julkaista profiilinsa tässä sovelluksessa.',
  'Garage perks': 'Korjaamon edut',
  'Garage photo or logo': 'Korjaamon kuva tai logo',
  'Garage profile': 'Korjaamoprofiili',
  Garages: 'Korjaamot',
  'Get more from the garage you already know. Discover memberships with service discounts, priority booking, and perks from your mechanic.':
    'Saa enemmän jo tutusta korjaamosta. Tutustu jäsenyyksiin, joihin kuuluu huoltoalennuksia, etusija varauksissa ja mekaanikkosi etuja.',
  'Get started': 'Aloita',
  'Get started with MotoDoc': 'Aloita MotoDocin käyttö',
  'Good car care.': 'Hyvää autonhuoltoa.',
  'Good things from a garage you know.': 'Hyviä asioita tutulta korjaamolta.',
  'Good to know.': 'Hyvä tietää.',
  'Google Sign-In': 'Google-kirjautuminen',
  'Google Sign-In connected to your account.': 'Google-kirjautuminen yhdistetty tiliisi.',
  'Google Sign-In could not load. Try again later.':
    'Google-kirjautumista ei voitu ladata. Yritä myöhemmin uudelleen.',
  'Google sign-in could not be completed. Please try again or use your password.':
    'Google-kirjautuminen ei onnistunut. Yritä uudelleen tai käytä salasanaa.',
  'Google sign-in is not available yet. Please use email for now.':
    'Google-kirjautuminen ei ole vielä käytössä. Käytä toistaiseksi sähköpostia.',
  'Google sign-in will be available here when MotoDoc is connected to Google.':
    'Google-kirjautuminen tulee tähän, kun MotoDoc on yhdistetty Googleen.',
  'Great company.': 'Hyvässä seurassa.',
  'Greyed-out times are already booked or in the past.':
    'Harmaat ajat on jo varattu tai ne ovat menneet.',
  'HOW IT WORKS': 'NÄIN SE TOIMII',
  'Hello, {x}.': 'Hei, {x}.',
  'Hide password': 'Piilota salasana',
  Home: 'Etusivu',
  'How it works': 'Näin se toimii',
  'In familiar hands.': 'Tutuissa käsissä.',
  'In good company.': 'Hyvässä seurassa.',
  'Invoice description': 'Laskun kuvaus',
  Invoices: 'Laskut',
  'Invoices can be created after a booking has been completed.':
    'Laskuja voi luoda, kun varaus on valmis.',
  'Invoicing & records': 'Laskutus ja kirjaukset',
  'I’m joining as a': 'Liityn',
  'Keep customer history, private notes, and tags together.':
    'Pidä asiakashistoria, omat muistiinpanot ja tunnisteet yhdessä.',
  'Keep inspection and maintenance dates in view.': 'Pidä katsastus- ja huoltopäivät näkyvillä.',
  'Keep it': 'Pidä',
  'Keep service invoices and payment records together.':
    'Pidä huoltolaskut ja maksutiedot yhdessä.',
  'Keep the details that matter together.': 'Pidä tärkeät tiedot yhdessä.',
  'Know the people who care for your car.': 'Tunne ihmiset, jotka huolehtivat autostasi.',
  'Last updated {x}': 'Päivitetty viimeksi {x}',
  'Last updated': 'Päivitetty viimeksi',
  Legal: 'Oikeudelliset tiedot',
  'Less to keep track of. More peace of mind.': 'Vähemmän muistettavaa. Enemmän mielenrauhaa.',
  'Let’s get your car connected': 'Yhdistetään autosi',
  'Let’s help you get back to your car care.': 'Autetaan sinut takaisin autonhuollon pariin.',
  'Listed in this MotoDoc app': 'Listattu tässä MotoDoc-sovelluksessa',
  'Listing your profile makes it visible to drivers in this MotoDoc app. Bookings are hourly requests, with one active booking per hour.':
    'Listaaminen tuo profiilisi autoilijoiden näkyviin tässä MotoDoc-sovelluksessa. Varaukset ovat tunnin pyyntöjä, ja kullekin tunnille voi olla yksi aktiivinen varaus.',
  'Loading your MotoDoc…': 'Ladataan MotoDociasi…',
  'Local MotoDoc - Your account and data stay on this computer.':
    'Paikallinen MotoDoc – tilisi ja tietosi pysyvät tällä tietokoneella.',
  'Log in': 'Kirjaudu',
  'Log out': 'Kirjaudu ulos',
  'MOT Countdown': 'Katsastukseen',
  'MOT due date': 'Katsastuksen eräpäivä',
  MOTODOC: 'MOTODOC',
  'MOTODOC ACCOUNT': 'MOTODOC-TILI',
  'Made in Finland': 'Tehty Suomessa',
  'Main navigation': 'Päänavigointi',
  Make: 'Merkki',
  'Make it a strong one, just for your MotoDoc account.':
    'Tee siitä vahva, vain MotoDoc-tiliäsi varten.',
  Manage: 'Hallitse',
  'Manage your service': 'Hallitse huoltoasi',
  'Mark done': 'Merkitse tehdyksi',
  'Mechanic drivers will meet': 'Mekaanikko, jonka autoilijat tapaavat',
  'Meet your mechanic. Keep your car’s story together. Feel ready for the road ahead.':
    'Tapaa mekaanikkosi. Pidä autosi tarina yhdessä. Ole valmis tielle.',
  'Member benefits': 'Jäsenedut',
  'Member requests': 'Jäsenyyspyynnöt',
  Membership: 'Jäsenyys',
  'Membership benefits': 'Jäsenedut',
  'Membership offers from listed garages will appear here.':
    'Listattujen korjaamoiden jäsenyystarjoukset näkyvät täällä.',
  'Membership programs': 'Jäsenohjelmat',
  Memberships: 'Jäsenyydet',
  'Memberships and benefits vary by garage.': 'Jäsenyydet ja edut vaihtelevat korjaamoittain.',
  Message: 'Viesti',
  'Message Garage': 'Viesti korjaamolle',
  'Message sent to your garage.': 'Viesti lähetetty korjaamollesi.',
  Messages: 'Viestit',
  'Messages with {x}': 'Viestit: {x}',
  'Mileage (km)': 'Ajokilometrit (km)',
  'Mileage trend': 'Kilometrikehitys',
  'Mobile navigation': 'Mobiilinavigointi',
  Model: 'Malli',
  More: 'Lisää',
  'More sections': 'Lisää osioita',
  'More time for what you do best.': 'Enemmän aikaa siihen, missä olet paras.',
  'More time for your customers. Less time on admin.':
    'Enemmän aikaa asiakkaille. Vähemmän paperityötä.',
  'More value when it’s time to look after your car.':
    'Enemmän arvoa, kun on aika huolehtia autosta.',
  'MotoDoc benefits': 'MotoDocin edut',
  'MotoDoc connects drivers and garages. Find a trusted mechanic, book services, keep your vehicle history together, and discover membership benefits — all in one place.':
    'MotoDoc yhdistää autoilijat ja korjaamot. Löydä luotettava mekaanikko, varaa huoltoja, pidä ajoneuvosi historia yhdessä ja tutustu jäsenetuihin – kaikki yhdessä paikassa.',
  'MotoDoc could not open': 'MotoDocia ei voitu avata',
  'MotoDoc home': 'MotoDoc-etusivu',
  'MotoDoc. All rights reserved.': 'MotoDoc. Kaikki oikeudet pidätetään.',
  'My vehicles': 'Omat ajoneuvot',
  'Need a hand?': 'Tarvitsetko apua?',
  'New to MotoDoc?': 'Uusi MotoDocissa?',
  'No bookings for this vehicle': 'Tällä ajoneuvolla ei ole varauksia',
  'No bookings yet': 'Ei vielä varauksia',
  'No completed services recorded': 'Ei kirjattuja huoltoja',
  'No conversations yet': 'Ei vielä keskusteluja',
  'No garages listed yet': 'Ei vielä listattuja korjaamoita',
  'No invoices yet': 'Ei vielä laskuja',
  'No matching garages': 'Ei hakua vastaavia korjaamoita',
  'No memberships to show yet.': 'Ei vielä näytettäviä jäsenyyksiä.',
  'No messages about this booking yet.': 'Tästä varauksesta ei ole vielä viestejä.',
  'No plans yet': 'Ei vielä jäsenyyksiä',
  'No upcoming service': 'Ei tulevaa huoltoa',
  'No vehicles have been added to this account.': 'Tälle tilille ei ole lisätty ajoneuvoja.',
  'No workshop connected yet': 'Korjaamoa ei ole vielä yhdistetty',
  'Not recorded': 'Ei kirjattu',
  'Notes for {x}': 'Muistiinpanot: {x}',
  'Nothing new. Messages, booking updates and due reminders will appear here.':
    'Ei uutta. Viestit, varausten päivitykset ja erääntyvät muistutukset näkyvät täällä.',
  Notifications: 'Ilmoitukset',
  'Oil Life': 'Öljyn kesto',
  'Oil change': 'Öljynvaihto',
  'Oil life (%)': 'Öljyn kesto (%)',
  'One less thing to remember': 'Yksi muistettava vähemmän',
  'Only record a payment already received outside MotoDoc. This does not charge the customer.':
    'Kirjaa vain maksu, joka on jo saatu MotoDocin ulkopuolella. Tämä ei veloita asiakasta.',
  'Open menu': 'Avaa valikko',
  'Open your account': 'Avaa tilisi',
  'Opening hours': 'Aukioloajat',
  'Opening your MotoDoc…': 'Avataan MotoDociasi…',
  'Outstanding invoices': 'Avoimet laskut',
  Overdue: 'Myöhässä',
  Overview: 'Yleiskuva',
  Password: 'Salasana',
  'Payment reference': 'Maksuviite',
  'Payment reference:': 'Maksuviite:',
  'Payments are arranged directly with the garage. MotoDoc records invoices and payments received; it does not process a charge.':
    'Maksuista sovitaan suoraan korjaamon kanssa. MotoDoc kirjaa laskut ja vastaanotetut maksut; se ei käsittele veloituksia.',
  'Payments recorded as received:': 'Vastaanotetuiksi kirjatut maksut:',
  'Phone number': 'Puhelinnumero',
  'Photo removed.': 'Kuva poistettu.',
  'Photo updated.': 'Kuva päivitetty.',
  'Pick a free hour in your local time. The garage will confirm your request.':
    'Valitse vapaa tunti paikallista aikaasi. Korjaamo vahvistaa pyyntösi.',
  'Pick up where you left off. Your next service and trusted mechanic are right here.':
    'Jatka siitä, mihin jäit. Seuraava huoltosi ja luotettu mekaanikkosi ovat tässä.',
  'Plan name': 'Jäsenyyden nimi',
  'Plan price (EUR)': 'Jäsenyyden hinta (EUR)',
  'Please wait...': 'Odota hetki…',
  'Priority booking': 'Etusija varauksissa',
  'Privacy policy': 'Tietosuojaseloste',
  Profile: 'Profiili',
  'Profile photo': 'Profiilikuva',
  QUESTIONS: 'KYSYMYKSET',
  'Quick navigation': 'Pikanavigointi',
  'Rate this service': 'Arvioi tämä huolto',
  'Ready for your first booking': 'Valmiina ensimmäiseen varaukseen',
  'Record payment': 'Kirjaa maksu',
  'Record received payment': 'Kirjaa vastaanotettu maksu',
  'Register your vehicle in seconds. All its information, in one profile.':
    'Rekisteröi ajoneuvosi sekunneissa. Kaikki sen tiedot yhdessä profiilissa.',
  Registration: 'Rekisterinumero',
  Reminders: 'Muistutukset',
  'Reminders appear in your account. Email and push notifications are not connected.':
    'Muistutukset näkyvät tililläsi. Sähköposti- ja push-ilmoituksia ei ole kytketty.',
  Remove: 'Poista',
  'Remove vehicle': 'Poista ajoneuvo',
  Reopen: 'Avaa uudelleen',
  'Reopen reminder': 'Avaa muistutus uudelleen',
  'Request booking': 'Lähetä varauspyyntö',
  'Request membership': 'Pyydä jäsenyyttä',
  'Reset your password': 'Palauta salasanasi',
  'Retry availability': 'Tarkista vapaat ajat uudelleen',
  'Return to login': 'Palaa kirjautumiseen',
  'Review requests and confirm each appointment.': 'Käy pyynnöt läpi ja vahvista jokainen aika.',
  Save: 'Tallenna',
  'Save new time': 'Tallenna uusi aika',
  'Save readings': 'Tallenna lukemat',
  'Save service record': 'Tallenna huoltokirjaus',
  'Saved to your MotoDoc account.': 'Tallennettu MotoDoc-tilillesi.',
  'Saving…': 'Tallennetaan…',
  'Search garages': 'Hae korjaamoita',
  'See upcoming work, completed services, and invoice totals.':
    'Näe tulevat työt, valmiit huollot ja laskujen summat.',
  'Select vehicle': 'Valitse ajoneuvo',
  'Selected: {x}': 'Valittu: {x}',
  'Send message': 'Lähetä viesti',
  'Send reset link': 'Lähetä palautuslinkki',
  'Sending…': 'Lähetetään…',
  Service: 'Huolto',
  'Service History': 'Huoltohistoria',
  'Service booking': 'Huoltovaraus',
  'Service discounts': 'Huoltoalennukset',
  'Service history': 'Huoltohistoria',
  'Service invoices': 'Huoltolaskut',
  'Services completed': 'Valmiit huollot',
  'Services, separated by commas': 'Palvelut pilkuilla erotettuina',
  'Set up your garage': 'Perusta korjaamosi',
  'Show all garages': 'Näytä kaikki korjaamot',
  'Show drivers your services and where to find you.':
    'Näytä autoilijoille palvelusi ja sijaintisi.',
  'Show password': 'Näytä salasana',
  'Shown to drivers on their workshop card and in messages.':
    'Näytetään autoilijoille heidän korjaamokortissaan ja viesteissä.',
  'Shown to drivers who have a booking with your garage.':
    'Näytetään autoilijoille, joilla on varaus korjaamollesi.',
  'Shown to garages you book with and in messages.':
    'Näytetään korjaamoille, joilta varaat, ja viesteissä.',
  'Sign up as Driver with Google': 'Rekisteröidy autoilijana Googlella',
  'Sign up as Garage with Google': 'Rekisteröidy korjaamona Googlella',
  'Signed in with Google. Welcome to MotoDoc.': 'Kirjauduttu Googlella. Tervetuloa MotoDociin.',
  'Signed in. Welcome back.': 'Kirjauduttu sisään. Tervetuloa takaisin.',
  'Simple by design.': 'Yksinkertainen alusta alkaen.',
  'Skip to content': 'Siirry sisältöön',
  'Skip to form': 'Siirry lomakkeeseen',
  'Smart reminders': 'Älykkäät muistutukset',
  'Something went wrong. Please try again.': 'Jokin meni vikaan. Yritä uudelleen.',
  'Start a conversation about this booking': 'Aloita keskustelu tästä varauksesta',
  'Start typing, e.g. Volvo': 'Ala kirjoittaa, esim. Volvo',
  'Still unsure about something? Write to': 'Onko jokin vielä epäselvää? Kirjoita osoitteeseen',
  Tags: 'Tunnisteet',
  'Tell drivers about your garage.': 'Kerro autoilijoille korjaamostasi.',
  'Terms of service': 'Käyttöehdot',
  'Thanks. Your rating counts towards this garage’s verified reviews.':
    'Kiitos. Arviosi lasketaan korjaamon vahvistettuihin arvioihin.',
  'That image could not be used. Try a JPG or PNG.':
    'Kuvaa ei voitu käyttää. Kokeile JPG- tai PNG-kuvaa.',
  'The garage will review your request. No payment is taken.':
    'Korjaamo käsittelee pyyntösi. Maksua ei veloiteta.',
  'The garage you book with will appear here, with its hours and a way to message it.':
    'Korjaamo, jolta varaat, näkyy täällä aukioloaikoineen ja viestimahdollisuuksineen.',
  'The invoice will remain in your records, marked void.':
    'Lasku jää kirjauksiisi mitätöidyksi merkittynä.',
  'The platform that connects drivers and garages. Digital car care, simplified.':
    'Alusta, joka yhdistää autoilijat ja korjaamot. Digitaalinen autonhuolto, yksinkertaisesti.',
  'These notes are private to your garage.': 'Nämä muistiinpanot näkyvät vain korjaamollesi.',
  'This records your offer. Billing is arranged outside MotoDoc.':
    'Tämä kirjaa tarjouksesi. Laskutuksesta sovitaan MotoDocin ulkopuolella.',
  'This updates the membership record. Arrange any outstanding billing directly with the garage.':
    'Tämä päivittää jäsenyyskirjauksen. Sovi avoimesta laskutuksesta suoraan korjaamon kanssa.',
  'Track every repair and service in one place.':
    'Seuraa jokaista korjausta ja huoltoa yhdessä paikassa.',
  'Trusted garages': 'Luotettavat korjaamot',
  'Try a different name or service.': 'Kokeile toista nimeä tai palvelua.',
  'Try again': 'Yritä uudelleen',
  'Unable to open your MotoDoc.': 'MotoDociasi ei voitu avata.',
  'Unlock discounts and perks from your mechanic.': 'Avaa mekaanikkosi alennukset ja edut.',
  'Up and running in three steps.': 'Käyttövalmis kolmessa vaiheessa.',
  'Upcoming Service': 'Tuleva huolto',
  'Upcoming bookings': 'Tulevat varaukset',
  'Upcoming service': 'Tuleva huolto',
  'Update password': 'Päivitä salasana',
  'Update readings': 'Päivitä lukemat',
  'Upload a photo': 'Lataa kuva',
  'Use at least 8 characters.': 'Käytä vähintään 8 merkkiä.',
  Vehicle: 'Ajoneuvo',
  'Vehicle details': 'Ajoneuvon tiedot',
  'Vehicle health': 'Ajoneuvon kunto',
  'Vehicle image unavailable': 'Ajoneuvon kuvaa ei ole saatavilla',
  'Vehicle management': 'Ajoneuvojen hallinta',
  'Vehicle mileage (km)': 'Ajoneuvon kilometrit (km)',
  'Vehicle readings': 'Ajoneuvon lukemat',
  'Vehicle readings saved.': 'Ajoneuvon lukemat tallennettu.',
  Vehicles: 'Ajoneuvot',
  'Vehicles, invoices & account': 'Ajoneuvot, laskut ja tili',
  'View all': 'Näytä kaikki',
  'View bookings': 'Näytä varaukset',
  Visibility: 'Näkyvyys',
  Void: 'Mitätöi',
  'Void invoice': 'Mitätöi lasku',
  'We all lose track sometimes. Getting back on the road should be simple.':
    'Kaikilta unohtuu joskus jotain. Tielle palaamisen pitäisi olla helppoa.',
  'Welcome back.': 'Tervetuloa takaisin.',
  'What would you like to remember?': 'Mitä haluat muistaa?',
  'When a garage completes a booking, its service record appears here automatically.':
    'Kun korjaamo merkitsee varauksen valmiiksi, huoltokirjaus ilmestyy tänne automaattisesti.',
  'Whenever you': 'Aina kun',
  'Work carried out': 'Tehty työ',
  'Write a message': 'Kirjoita viesti',
  'YOUR MOTODOC': 'SINUN MOTODOCISI',
  Year: 'Vuosimalli',
  'Yes, cancel': 'Kyllä, peru',
  You: 'Sinä',
  'You have been signed out.': 'Olet kirjautunut ulos.',
  'Your account': 'Tilisi',
  'Your account could not be loaded.': 'Tiliäsi ei voitu ladata.',
  'Your bookings': 'Varauksesi',
  'Your car care, clearly organised.': 'Autosi huolto, selkeästi järjestyksessä.',
  'Your car care, connected.': 'Autosi huolto, yhdistettynä.',
  'Your car, your garage, and everything in between.':
    'Autosi, korjaamosi ja kaikki siltä väliltä.',
  'Your car.': 'Autosi.',
  'Your customers, connected': 'Asiakkaasi, yhdistettynä',
  'Your full name': 'Koko nimesi',
  'Your garage profile': 'Korjaamoprofiilisi',
  'Your garage starts here': 'Autotallisi alkaa tästä',
  'Your garage.': 'Korjaamosi.',
  'Your mechanic. Your MotoDoc.': 'Mekaanikkosi. Sinun MotoDocisi.',
  'Your memberships': 'Jäsenyytesi',
  'Your message': 'Viestisi',
  'Your plans': 'Jäsenyytesi',
  'Your public profile': 'Julkinen profiilisi',
  'Your rating': 'Arviosi',
  'Your reminders': 'Muistutuksesi',
  'Your service costs, all in one place.': 'Huoltokulusi yhdessä paikassa.',
  'Your service requests and confirmations will appear here.':
    'Huoltopyyntösi ja vahvistukset näkyvät täällä.',
  'Your vehicles': 'Ajoneuvosi',
  'has not added a phone number yet.': 'ei ole vielä lisännyt puhelinnumeroa.',
  'in with a garage and it will appear here.': 'korjaamolle, niin se näkyy täällä.',
  km: 'km',
  'or continue with email': 'tai jatka sähköpostilla',
  'will appear here.': 'huoltokirjaukset näkyvät täällä.',
  'you@example.com': 'sinä@esimerkki.fi',
  'your garage': 'korjaamosi',
  '· Due': '· Erääntyy',
  '· Your mechanic': '· Mekaanikkosi',
  '— MotoDoc': '— MotoDoc',
  'Your account — MotoDoc': 'Tilisi — MotoDoc',
  'Your car — MotoDoc': 'Autosi — MotoDoc',
  'MotoDoc — Your car. Your mechanic.': 'MotoDoc — Sinun autosi. Sinun mekaanikkosi.',
  vehicle: 'ajoneuvo',
  vehicles: 'ajoneuvoa',
  pending: 'odottaa',
  requested: 'pyydetty',
  confirmed: 'vahvistettu',
  completed: 'valmis',
  cancelled: 'peruttu',
  overdue: 'myöhässä',
  upcoming: 'tulossa',
  done: 'tehty',
  active: 'aktiivinen',
  paid: 'maksettu',
  unpaid: 'maksamatta',
  void: 'mitätöity',
  listed: 'listattu',
  draft: 'luonnos',
  rescheduled: 'siirretty',
  'A driver account is required.': 'Tarvitaan autoilijan tili.',
  'A garage account is required.': 'Tarvitaan korjaamon tili.',
  'Add a service summary and mileage to complete the booking.':
    'Lisää huollon yhteenveto ja kilometrit merkitäksesi varauksen valmiiksi.',
  'Booking not found.': 'Varausta ei löytynyt.',
  'Choose a future hourly appointment within the next year.':
    'Valitse tuleva tasatuntiaika seuraavan vuoden sisältä.',
  'Choose a make and model.': 'Valitse merkki ja malli.',
  'Choose the Google account with the same email as your MotoDoc account.':
    'Valitse Google-tili, jossa on sama sähköposti kuin MotoDoc-tililläsi.',
  'Email or password is incorrect.': 'Sähköposti tai salasana on väärin.',
  'Enter the reference for the payment received outside MotoDoc.':
    'Anna MotoDocin ulkopuolella saadun maksun viite.',
  'Google Sign-In is not configured.': 'Google-kirjautumista ei ole määritetty.',
  'Invalid or expired Google token.': 'Virheellinen tai vanhentunut Google-tunniste.',
  'Invoices require a completed booking at your garage.':
    'Lasku vaatii korjaamollasi valmiin varauksen.',
  'Mileage cannot be lower than the vehicle’s recorded mileage.':
    'Kilometrit eivät voi olla pienemmät kuin ajoneuvon kirjatut kilometrit.',
  'Only upcoming bookings can be rescheduled.': 'Vain tulevia varauksia voi siirtää.',
  'Only your completed services can be reviewed.': 'Vain valmiita huoltojasi voi arvioida.',
  'Only your garage can update service progress.':
    'Vain korjaamosi voi päivittää huollon etenemistä.',
  'Password recovery email is not configured. Contact the site administrator.':
    'Salasanan palautussähköpostia ei ole määritetty. Ota yhteyttä ylläpitäjään.',
  'Please log in to continue.': 'Kirjaudu jatkaaksesi.',
  'Select a service offered by this garage.': 'Valitse korjaamon tarjoama palvelu.',
  'This Google account is already connected to another MotoDoc account.':
    'Tämä Google-tili on jo yhdistetty toiseen MotoDoc-tiliin.',
  'This booking cannot make that status change.': 'Tämän varauksen tilaa ei voi muuttaa näin.',
  'This record already exists, or the appointment slot is no longer available.':
    'Tieto on jo olemassa, tai aika ei ole enää vapaana.',
  'This reset link has expired or has already been used.':
    'Tämä palautuslinkki on vanhentunut tai jo käytetty.',
  'This reset link is no longer valid.': 'Tämä palautuslinkki ei ole enää voimassa.',
  'Too many attempts. Please try again in 15 minutes.':
    'Liian monta yritystä. Yritä uudelleen 15 minuutin kuluttua.',
  'Unable to create this account. Try logging in or resetting your password.':
    'Tiliä ei voitu luoda. Kokeile kirjautua tai palauttaa salasana.',
  'Vehicle not found.': 'Ajoneuvoa ei löytynyt.',
  'Vehicles with bookings or service history cannot be deleted.':
    'Ajoneuvoa, jolla on varauksia tai huoltohistoriaa, ei voi poistaa.',
  'You already have a request or membership for this plan.':
    'Sinulla on jo pyyntö tai jäsenyys tähän jäsenyyteen.',
  'The MotoDoc server is unavailable.': 'MotoDoc-palvelin ei ole käytettävissä.',
  'MotoDoc could not connect. Please try again.': 'MotoDociin ei saatu yhteyttä. Yritä uudelleen.',
};

export const fiGlossary = [
  {
    match: 'MOT',
    en: 'MOT: the yearly roadworthiness test. In Finland this is the “katsastus”.',
    fi: 'Katsastus: määräaikainen tarkastus, jossa varmistetaan, että auto on liikennekelpoinen.',
  },
  {
    match: 'Oil life',
    en: 'Oil life: how much of the engine oil’s service interval is left, as your car or last service reports it.',
    fi: 'Öljyn kesto: kuinka paljon moottoriöljyn vaihtovälistä on jäljellä auton tai edellisen huollon mukaan.',
  },
  {
    match: 'Brake wear',
    en: 'Brake wear: how worn the brake pads are. A higher number means replacement is closer.',
    fi: 'Jarrujen kuluminen: kuinka kuluneet jarrupalat ovat. Suurempi luku tarkoittaa, että vaihto on lähempänä.',
  },
  {
    match: 'Mileage',
    en: 'Mileage: the total distance on the odometer, in kilometres.',
    fi: 'Ajokilometrit: matkamittarin kokonaislukema kilometreinä.',
  },
  {
    match: 'Registration',
    en: 'Registration: the number on the car’s licence plate.',
    fi: 'Rekisterinumero: auton rekisterikilven tunnus.',
  },
];
