/**
 * Seed 52 artists + 3 new auctions with ~30 lots, then link all lots → artists.
 *
 * Idempotent: uses ON CONFLICT DO NOTHING throughout.
 * Usage: npx tsx db/seed-artists.ts
 */

import { db } from './connection';
import { artists, auctions, lots } from './schema';
import { sql } from 'drizzle-orm';

// ─── Phase 1: 52 Artists ──────────────────────────────────────────────────────

const ARTISTS = [
  // ── 37 matching existing lots ──
  {
    name: 'Zdzisław Beksiński',
    slug: 'zdzislaw-beksinski',
    nationality: 'polska',
    birthYear: 1929,
    deathYear: 2005,
    bio: 'Jeden z najwybitniejszych polskich artystów XX wieku. Twórca fantastycznych, onirycznych wizji, które przyniosły mu międzynarodową sławę. Malował głównie obrazy olejne i wykonywał fotografie.',
  },
  {
    name: 'Jerzy Nowosielski',
    slug: 'jerzy-nowosielski',
    nationality: 'polska',
    birthYear: 1923,
    deathYear: 2011,
    bio: 'Malarz, rysownik, scenograf i teoretyk sztuki. Tworzył w duchu sztuki bizantyjskiej i abstrakcji, łącząc sacrum z erotyką. Jeden z najważniejszych polskich artystów powojennych.',
  },
  {
    name: 'Wojciech Fangor',
    slug: 'wojciech-fangor',
    nationality: 'polska',
    birthYear: 1922,
    deathYear: 2015,
    bio: 'Malarz i grafik, pionier op-artu. Jego obrazy z rozmytymi kręgami barwnymi wyprzedzały poszukiwania zachodnich artystów. Wykładał na amerykańskich uczelniach.',
  },
  {
    name: 'Edward Dwurnik',
    slug: 'edward-dwurnik',
    nationality: 'polska',
    birthYear: 1943,
    deathYear: 2018,
    bio: 'Malarz, rysownik i grafik. Jeden z najważniejszych przedstawicieli polskiego malarstwa figuratywnego. Autor słynnych cykli „Podróże autostopem" i „Malarstwo pejzażowe".',
  },
  {
    name: 'Henryk Stażewski',
    slug: 'henryk-stazewski',
    nationality: 'polska',
    birthYear: 1894,
    deathYear: 1988,
    bio: 'Pionier polskiej awangardy konstruktywistycznej. Tworzył sztukę geometryczną przez ponad siedem dekad. Członek grupy a.r. i Blok.',
  },
  {
    name: 'Andrzej Wróblewski',
    slug: 'andrzej-wroblewski',
    nationality: 'polska',
    birthYear: 1927,
    deathYear: 1957,
    bio: 'Malarz i teoretyk sztuki, jedna z najważniejszych postaci polskiej sztuki powojennej. Autor przejmujących cykli „Rozstrzelania" i „Kolejki". Zginął tragicznie w Tatrach.',
  },
  {
    name: 'Jan Lebenstein',
    slug: 'jan-lebenstein',
    nationality: 'polska',
    birthYear: 1930,
    deathYear: 1999,
    bio: 'Malarz i grafik, przedstawiciel nurtu figuratywnego. Laureat Grand Prix na Biennale w São Paulo (1959). Od 1966 r. mieszkał i tworzył w Paryżu.',
  },
  {
    name: 'Alina Szapocznikow',
    slug: 'alina-szapocznikow',
    nationality: 'polska',
    birthYear: 1926,
    deathYear: 1973,
    bio: 'Rzeźbiarka, jedna z najważniejszych polskich artystek XX wieku. Tworzyła z żywic, poliestru i odlewów ciała. Jej prace są w zbiorach MoMA i Centre Pompidou.',
  },
  {
    name: 'Leon Wyczółkowski',
    slug: 'leon-wyczolkowski',
    nationality: 'polska',
    birthYear: 1852,
    deathYear: 1936,
    bio: 'Malarz, grafik i pedagog, czołowy przedstawiciel Młodej Polski. Malował krajobrazy, portrety i sceny historyczne. Mistrz pasteli i litografii.',
  },
  {
    name: 'Tadeusz Kantor',
    slug: 'tadeusz-kantor',
    nationality: 'polska',
    birthYear: 1915,
    deathYear: 1990,
    bio: 'Malarz, reżyser teatralny, scenograf i teoretyk sztuki. Twórca Teatru Cricot 2 i słynnego spektaklu „Umarła klasa". Ikona polskiej awangardy.',
  },
  {
    name: 'Jacek Malczewski',
    slug: 'jacek-malczewski',
    nationality: 'polska',
    birthYear: 1854,
    deathYear: 1929,
    bio: 'Malarz, jeden z najwybitniejszych przedstawicieli symbolizmu w sztuce polskiej. Autor alegorycznych kompozycji łączących wątki patriotyczne z mitologią.',
  },
  {
    name: 'Rafał Malczewski',
    slug: 'rafal-malczewski',
    nationality: 'polska',
    birthYear: 1892,
    deathYear: 1965,
    bio: 'Malarz, syn Jacka Malczewskiego. Malował głównie pejzaże tatrzańskie i podhalańskie. Po wojnie przebywał na emigracji w Kanadzie i Argentynie.',
  },
  {
    name: 'Katarzyna Kobro',
    slug: 'katarzyna-kobro',
    nationality: 'polska',
    birthYear: 1898,
    deathYear: 1951,
    bio: 'Rzeźbiarka awangardowa, współtwórczyni grupy a.r. Tworzyła rzeźby przestrzenne oparte na zasadach unizmu. Żona Władysława Strzemińskiego.',
  },
  {
    name: 'Władysław Hasior',
    slug: 'wladyslaw-hasior',
    nationality: 'polska',
    birthYear: 1928,
    deathYear: 1999,
    bio: 'Rzeźbiarz i twórca asamblaży. Jego monumentalne kompozycje z przedmiotów znalezionych stały się symbolami polskiej sztuki powojennej. Założyciel galerii w Zakopanem.',
  },
  {
    name: 'Igor Mitoraj',
    slug: 'igor-mitoraj',
    nationality: 'polska',
    birthYear: 1944,
    deathYear: 2014,
    bio: 'Rzeźbiarz, tworzył monumentalne rzeźby inspirowane antykiem. Jego prace stoją w przestrzeniach publicznych na całym świecie, m.in. w Pompejach i Rzymie.',
  },
  {
    name: 'Zofia Chomętowska',
    slug: 'zofia-chometowska',
    nationality: 'polska',
    birthYear: 1902,
    deathYear: 1991,
    bio: 'Fotografka, jedna z pionierek polskiej fotografii artystycznej. Dokumentowała życie międzywojennej Warszawy i Polesia. Jej archiwum liczy tysiące negatywów.',
  },
  {
    name: 'Zbigniew Dłubak',
    slug: 'zbigniew-dlubak',
    nationality: 'polska',
    birthYear: 1921,
    deathYear: 2005,
    bio: 'Fotograf, malarz i teoretyk sztuki. Łączył fotografię z malarstwem abstrakcyjnym. Współzałożyciel grupy „Foto-Forma".',
  },
  {
    name: 'Jan Bułhak',
    slug: 'jan-bulhak',
    nationality: 'polska',
    birthYear: 1876,
    deathYear: 1950,
    bio: 'Fotograf, „ojciec polskiej fotografii artystycznej". Twórca koncepcji „fotografii ojczystej". Dokumentował architekturę Wilna i polskie krajobrazy.',
  },
  {
    name: 'Jerzy Lewczyński',
    slug: 'jerzy-lewczynski',
    nationality: 'polska',
    birthYear: 1924,
    deathYear: 2014,
    bio: 'Fotograf, pionier „archeologii fotografii". Wykorzystywał znalezione zdjęcia i archiwa do tworzenia wielowarstwowych narracji wizualnych.',
  },
  {
    name: 'Adam Bujak',
    slug: 'adam-bujak',
    nationality: 'polska',
    birthYear: 1942,
    deathYear: null,
    bio: 'Fotograf, kronikarz pontyfikatu Jana Pawła II. Autor ponad 100 albumów fotograficznych poświęconych kulturze i duchowości polskiej.',
  },
  {
    name: 'Zofia Rydet',
    slug: 'zofia-rydet',
    nationality: 'polska',
    birthYear: 1911,
    deathYear: 1997,
    bio: 'Fotografka, autorka monumentalnego cyklu „Zapis socjologiczny" — wieloletniego projektu dokumentującego polskie wnętrza domowe i ich mieszkańców.',
  },
  {
    name: 'Tadeusz Rolke',
    slug: 'tadeusz-rolke',
    nationality: 'polska',
    birthYear: 1929,
    deathYear: 2022,
    bio: 'Fotograf dokumentalista i reportażysta. Jeden z najważniejszych polskich fotografów XX wieku. Portretował m.in. Dalego, Duchampa i polską scenę artystyczną.',
  },
  {
    name: 'Chris Niedenthal',
    slug: 'chris-niedenthal',
    nationality: 'polska',
    birthYear: 1950,
    deathYear: null,
    bio: 'Fotoreporter, autor ikonicznych zdjęć z okresu stanu wojennego. Jego fotografia czołgu przed kinem „Moskwa" stała się symbolem epoki.',
  },
  {
    name: 'Natalia LL',
    slug: 'natalia-ll',
    nationality: 'polska',
    birthYear: 1937,
    deathYear: 2022,
    bio: 'Artystka intermedialna, pionierka sztuki feministycznej w Polsce. Autorka słynnego cyklu „Sztuka konsumpcyjna". Współzałożycielka galerii PERMAFO.',
  },
  {
    name: 'Leon Tarasewicz',
    slug: 'leon-tarasewicz',
    nationality: 'polska',
    birthYear: 1957,
    deathYear: null,
    bio: 'Malarz, autor wielkoformatowych, abstrakcyjnych pejzaży. Jego obrazy nawiązują do krajobrazu Podlasia. Tworzył monumentalne instalacje malarskie.',
  },
  {
    name: 'Mirosław Bałka',
    slug: 'miroslaw-balka',
    nationality: 'polska',
    birthYear: 1958,
    deathYear: null,
    bio: 'Rzeźbiarz i twórca instalacji, jeden z najważniejszych polskich artystów współczesnych. Autor instalacji „How It Is" w Tate Modern (2009).',
  },
  {
    name: 'Wilhelm Sasnal',
    slug: 'wilhelm-sasnal',
    nationality: 'polska',
    birthYear: 1972,
    deathYear: null,
    bio: 'Malarz i filmowiec, jeden z najważniejszych polskich artystów współczesnych. Jego obrazy czerpią z popkultury, historii i codzienności.',
  },
  {
    name: 'Paweł Althamer',
    slug: 'pawel-althamer',
    nationality: 'polska',
    birthYear: 1967,
    deathYear: null,
    bio: 'Rzeźbiarz i performer, znany z partycypacyjnych projektów artystycznych. Tworzył rzeźby z niekonwencjonalnych materiałów, m.in. własne autoportrety.',
  },
  {
    name: 'Katarzyna Kozyra',
    slug: 'katarzyna-kozyra',
    nationality: 'polska',
    birthYear: 1963,
    deathYear: null,
    bio: 'Artystka intermedialna, znana z prowokacyjnych projektów wideo i performansów. Reprezentantka Polski na Biennale w Wenecji (1999).',
  },
  {
    name: 'Jarosław Kozłowski',
    slug: 'jaroslaw-kozlowski',
    nationality: 'polska',
    birthYear: 1945,
    deathYear: null,
    bio: 'Artysta konceptualny, twórca sieci NET (1971) — jednej z pierwszych międzynarodowych sieci mail-artu. Profesor Akademii Sztuk Pięknych w Poznaniu.',
  },
  {
    name: 'Constantin Brâncuși',
    slug: 'constantin-brancusi',
    nationality: 'rumuńska',
    birthYear: 1876,
    deathYear: 1957,
    bio: 'Rumuński rzeźbiarz, jeden z najważniejszych twórców XX wieku. Jego abstrakcyjne formy zrewolucjonizowały rzeźbę nowoczesną. Tworzył w Paryżu.',
  },
  {
    name: 'Henry Moore',
    slug: 'henry-moore',
    nationality: 'brytyjska',
    birthYear: 1898,
    deathYear: 1986,
    bio: 'Brytyjski rzeźbiarz, jeden z największych twórców rzeźby XX wieku. Znany z monumentalnych, biomorficznych rzeźb w przestrzeni publicznej.',
  },
  {
    name: 'Alberto Giacometti',
    slug: 'alberto-giacometti',
    nationality: 'szwajcarska',
    birthYear: 1901,
    deathYear: 1966,
    bio: 'Szwajcarski rzeźbiarz i malarz, jeden z najważniejszych artystów XX wieku. Jego wydłużone figury ludzkie stały się ikoną sztuki egzystencjalnej.',
  },
  {
    name: 'Barbara Hepworth',
    slug: 'barbara-hepworth',
    nationality: 'brytyjska',
    birthYear: 1903,
    deathYear: 1975,
    bio: 'Brytyjska rzeźbiarka, jedna z najważniejszych artystek XX wieku. Tworzyła abstrakcyjne rzeźby z kamienia, brązu i drewna.',
  },
  {
    name: 'Marlene Dumas',
    slug: 'marlene-dumas',
    nationality: 'południowoafrykańska',
    birthYear: 1953,
    deathYear: null,
    bio: 'Artystka z Afryki Południowej, mieszkająca w Holandii. Maluje portrety i figury ludzkie oparte na fotografiach. Jedna z najdroższych żyjących artystek.',
  },
  {
    name: 'Olafur Eliasson',
    slug: 'olafur-eliasson',
    nationality: 'duńsko-islandzka',
    birthYear: 1967,
    deathYear: null,
    bio: 'Duńsko-islandzki artysta, znany z wielkoformatowych instalacji eksplorujących światło, wodę i przestrzeń. Autor „The Weather Project" w Tate Modern.',
  },
  {
    name: 'Edward Hartwig',
    slug: 'edward-hartwig',
    nationality: 'polska',
    birthYear: 1909,
    deathYear: 2003,
    bio: 'Fotograf, jeden z najwybitniejszych polskich fotografów XX wieku. Mistrz fotografii architektury i krajobrazu. Autor albumów o Warszawie i Polsce.',
  },

  // ── 15 additional artists ──
  {
    name: 'Władysław Strzemiński',
    slug: 'wladyslaw-strzeminski',
    nationality: 'polska',
    birthYear: 1893,
    deathYear: 1952,
    bio: 'Malarz i teoretyk sztuki, twórca unizmu i teorii widzenia. Współzałożyciel grupy a.r. i Muzeum Sztuki w Łodzi. Mąż Katarzyny Kobro.',
  },
  {
    name: 'Stanisław Wyspiański',
    slug: 'stanislaw-wyspianski',
    nationality: 'polska',
    birthYear: 1869,
    deathYear: 1907,
    bio: 'Dramaturg, malarz, grafik i projektant. Czołowy przedstawiciel Młodej Polski. Autor „Wesela" i witraży dla kościoła Franciszkanów w Krakowie.',
  },
  {
    name: 'Józef Mehoffer',
    slug: 'jozef-mehoffer',
    nationality: 'polska',
    birthYear: 1869,
    deathYear: 1946,
    bio: 'Malarz i witrażysta, czołowy przedstawiciel Młodej Polski. Autor witraży dla katedry we Fryburgu i polichromii Skarbca na Wawelu.',
  },
  {
    name: 'Olga Boznańska',
    slug: 'olga-boznanska',
    nationality: 'polska',
    birthYear: 1865,
    deathYear: 1940,
    bio: 'Malarka, jedna z najwybitniejszych polskich portrecistek. Tworzyła w Paryżu portrety o wyjątkowej subtelności tonalnej i psychologicznej głębi.',
  },
  {
    name: 'Jan Cybis',
    slug: 'jan-cybis',
    nationality: 'polska',
    birthYear: 1897,
    deathYear: 1972,
    bio: 'Malarz, czołowy przedstawiciel polskiego koloryzmu. Uczeń Bonnarda w Paryżu. Profesor ASP w Warszawie, nauczyciel wielu wybitnych artystów.',
  },
  {
    name: 'Jerzy Kossak',
    slug: 'jerzy-kossak',
    nationality: 'polska',
    birthYear: 1886,
    deathYear: 1955,
    bio: 'Malarz batalistyczny, syn Wojciecha Kossaka i wnuk Juliusza Kossaka. Kontynuator rodzinnej tradycji malarstwa batalistycznego i koni.',
  },
  {
    name: 'Alfons Karny',
    slug: 'alfons-karny',
    nationality: 'polska',
    birthYear: 1901,
    deathYear: 1989,
    bio: 'Rzeźbiarz, jeden z najwybitniejszych polskich portrecistów w rzeźbie. Autor ponad 500 portretów znanych postaci kultury i nauki.',
  },
  {
    name: 'Magdalena Abakanowicz',
    slug: 'magdalena-abakanowicz',
    nationality: 'polska',
    birthYear: 1930,
    deathYear: 2017,
    bio: 'Rzeźbiarka i artystka tkaniny, światowej sławy twórczyni „Abakanów". Jej monumentalne instalacje z juty i brązu wystawiano na całym świecie.',
  },
  {
    name: 'Włodzimierz Tetmajer',
    slug: 'wlodzimierz-tetmajer',
    nationality: 'polska',
    birthYear: 1861,
    deathYear: 1923,
    bio: 'Malarz, przedstawiciel Młodej Polski. Malował życie wsi podkrakowskiej i sceny rodzajowe. Tworzył polichromie kościelne, w tym we Franciszkanach.',
  },
  {
    name: 'Józef Pankiewicz',
    slug: 'jozef-pankiewicz',
    nationality: 'polska',
    birthYear: 1866,
    deathYear: 1940,
    bio: 'Malarz i grafik, pionier impresjonizmu i postimpresjonizmu w Polsce. Założyciel paryskiej filii krakowskiej ASP. Nauczyciel Cybisa i Czapskiego.',
  },
  {
    name: 'Roman Opałka',
    slug: 'roman-opalka',
    nationality: 'polska',
    birthYear: 1931,
    deathYear: 2011,
    bio: 'Malarz konceptualny, autor jednego z najkonsekwentniejszych projektów w historii sztuki — „OPALKA 1965/1-∞". Malował kolejne liczby od 1 do nieskończoności.',
  },
  {
    name: 'Tamara de Lempicka',
    slug: 'tamara-de-lempicka',
    nationality: 'polska',
    birthYear: 1898,
    deathYear: 1980,
    bio: 'Malarka art déco, ikona stylu lat 20. i 30. Znana z zmysłowych portretów i aktów. Jedna z najdroższych polskich artystek na rynku aukcyjnym.',
  },
  {
    name: 'Aleksander Gierymski',
    slug: 'aleksander-gierymski',
    nationality: 'polska',
    birthYear: 1850,
    deathYear: 1901,
    bio: 'Malarz realistyczny, jeden z najwybitniejszych polskich artystów XIX wieku. Autor „Żydówki z pomarańczami" i nocnych pejzaży Warszawy.',
  },
  {
    name: 'Józef Chełmoński',
    slug: 'jozef-chelmonski',
    nationality: 'polska',
    birthYear: 1849,
    deathYear: 1914,
    bio: 'Malarz realistyczny, mistrz polskiego pejzażu i scen z życia wsi. Autor słynnych obrazów „Czwórka", „Bociany" i „Jesień". Tworzył w Paryżu i na Mazowszu.',
  },
  {
    name: 'Stefan Gierowski',
    slug: 'stefan-gierowski',
    nationality: 'polska',
    birthYear: 1925,
    deathYear: 2022,
    bio: 'Malarz abstrakcyjny, jeden z najważniejszych polskich artystów powojennych. Tworzył cykle numerowanych obrazów eksplorujących kolor i światło.',
  },
];

// ─── Phase 2: 3 new auctions + ~30 lots ─────────────────────────────────────

const NEW_AUCTIONS = [
  {
    slug: 'polska-sztuka-klasyczna',
    title: 'Polska Sztuka Klasyczna',
    description: 'Aukcja dzieł mistrzów polskiego malarstwa XIX i początku XX wieku. Realizm, impresjonizm i Młoda Polska.',
    category: 'malarstwo',
    startDate: '2025-10-15T18:00:00+02:00',
    endDate: '2025-10-15T21:00:00+02:00',
    location: 'Warszawa, Hotel Europejski',
    curator: 'dr Anna Król',
    status: 'archive' as const,
  },
  {
    slug: 'awangarda-i-neoawangarda',
    title: 'Awangarda i Neoawangarda',
    description: 'Od konstruktywizmu po sztukę konceptualną. Najważniejsi twórcy polskiej awangardy XX i XXI wieku.',
    category: 'mixed',
    startDate: '2026-03-20T18:00:00+01:00',
    endDate: '2026-03-20T21:00:00+01:00',
    location: 'Warszawa, Muzeum Sztuki Nowoczesnej',
    curator: 'prof. Piotr Rypson',
    status: 'preview' as const,
  },
  {
    slug: 'wielcy-mistrzowie-kolekcja-jubileuszowa',
    title: 'Wielcy Mistrzowie — Kolekcja Jubileuszowa',
    description: 'Jubileuszowa aukcja z wyborem najcenniejszych prac polskich i międzynarodowych artystów. Malarstwo, rzeźba, fotografia.',
    category: 'mixed',
    startDate: '2026-03-05T19:00:00+01:00',
    endDate: '2026-03-05T22:00:00+01:00',
    location: 'Kraków, Zamek Królewski na Wawelu',
    curator: 'dr hab. Marek Bartelik',
    status: 'live' as const,
  },
];

// Lot status derived from auction status
function lotStatusForAuction(auctionStatus: string) {
  if (auctionStatus === 'archive') return 'sold' as const;
  if (auctionStatus === 'preview') return 'published' as const;
  if (auctionStatus === 'live') return 'active' as const;
  return 'published' as const;
}

interface NewLot {
  auctionSlug: string;
  lotNumber: number;
  title: string;
  artist: string;
  description: string;
  medium: string;
  dimensions: string;
  year: number;
  estimateMin: number;
  estimateMax: number;
  category: 'malarstwo' | 'rzezba' | 'grafika' | 'fotografia' | 'rzemiosto' | 'design' | 'bizuteria' | 'inne';
}

const NEW_LOTS: NewLot[] = [
  // ── Polska Sztuka Klasyczna (archive) ──
  {
    auctionSlug: 'polska-sztuka-klasyczna',
    lotNumber: 1,
    title: 'Autoportret z kwiatem hiacyntu',
    artist: 'Stanisław Wyspiański',
    description: 'Pastel na papierze, jeden z licznych autoportretów artysty. Wyrazisty, intymny wizerunek z charakterystycznym kwiatem hiacyntu w dłoni.',
    medium: 'pastel na papierze',
    dimensions: '47 × 35 cm',
    year: 1902,
    estimateMin: 800000,
    estimateMax: 1200000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'polska-sztuka-klasyczna',
    lotNumber: 2,
    title: 'Ogród różany w Fryburgu',
    artist: 'Józef Mehoffer',
    description: 'Olej na płótnie z okresu pracy artysty nad witrażami katedry fryburskiej. Barwna, dekoracyjna kompozycja inspirowana ogrodami Szwajcarii.',
    medium: 'olej na płótnie',
    dimensions: '90 × 120 cm',
    year: 1900,
    estimateMin: 350000,
    estimateMax: 500000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'polska-sztuka-klasyczna',
    lotNumber: 3,
    title: 'Portret damy w szarym kapeluszu',
    artist: 'Olga Boznańska',
    description: 'Olej na tekturze, portret kobiety w jasnych tonach szarości i beżu. Typowy dla artystki subtelny modelunek światłocieniowy i matowa faktura.',
    medium: 'olej na tekturze',
    dimensions: '65 × 50 cm',
    year: 1912,
    estimateMin: 600000,
    estimateMax: 900000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'polska-sztuka-klasyczna',
    lotNumber: 4,
    title: 'Wieczór nad Wisłą',
    artist: 'Aleksander Gierymski',
    description: 'Olej na płótnie, nocny widok nadwiślańskiej Warszawy w ciepłym oświetleniu gazowych latarni. Dzieło z ostatniego okresu twórczości artysty.',
    medium: 'olej na płótnie',
    dimensions: '55 × 75 cm',
    year: 1895,
    estimateMin: 900000,
    estimateMax: 1500000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'polska-sztuka-klasyczna',
    lotNumber: 5,
    title: 'Bociany na łące',
    artist: 'Józef Chełmoński',
    description: 'Olej na płótnie, pejzaż z bocianami na rozległej łące mazowieckiej. Dzieło pełne światła i spokoju, typowe dla dojrzałego okresu twórczości.',
    medium: 'olej na płótnie',
    dimensions: '80 × 130 cm',
    year: 1900,
    estimateMin: 500000,
    estimateMax: 800000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'polska-sztuka-klasyczna',
    lotNumber: 6,
    title: 'Chłopka z Bronowic',
    artist: 'Włodzimierz Tetmajer',
    description: 'Olej na desce, portret młodej chłopki w ludowym stroju podkrakowskim. Jasna kolorystyka i realistyczne oddanie detali kostiumologicznych.',
    medium: 'olej na desce',
    dimensions: '60 × 45 cm',
    year: 1905,
    estimateMin: 120000,
    estimateMax: 180000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'polska-sztuka-klasyczna',
    lotNumber: 7,
    title: 'Szarża pod Rokitną',
    artist: 'Jerzy Kossak',
    description: 'Olej na płótnie, dynamiczna scena batalistyczna z I wojny światowej. Ułani polscy w ataku kawaleryjskim, typowy temat dla kontynuatora kossakowskiej tradycji.',
    medium: 'olej na płótnie',
    dimensions: '90 × 140 cm',
    year: 1934,
    estimateMin: 150000,
    estimateMax: 250000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'polska-sztuka-klasyczna',
    lotNumber: 8,
    title: 'Martwa natura z pomarańczami',
    artist: 'Józef Pankiewicz',
    description: 'Olej na płótnie, martwa natura z okresu postimpresjonistycznego. Owoce na białej serwecie w ciepłym, nasyconym kolorze inspirowanym Cézannem.',
    medium: 'olej na płótnie',
    dimensions: '50 × 65 cm',
    year: 1908,
    estimateMin: 400000,
    estimateMax: 600000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'polska-sztuka-klasyczna',
    lotNumber: 9,
    title: 'Bukiet polnych kwiatów',
    artist: 'Jan Cybis',
    description: 'Olej na płótnie, kolorystyczna kompozycja kwiaty w wazonie. Bujne, swobodne uderzenia pędzla w manierze polskiego koloryzmu.',
    medium: 'olej na płótnie',
    dimensions: '73 × 60 cm',
    year: 1955,
    estimateMin: 200000,
    estimateMax: 300000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'polska-sztuka-klasyczna',
    lotNumber: 10,
    title: 'Kompozycja unistyczna nr 14',
    artist: 'Władysław Strzemiński',
    description: 'Olej na płótnie, abstrakcyjna kompozycja zgodna z teorią unizmu. Równomierny rozkład form na powierzchni obrazu, brak dominanty i głębi.',
    medium: 'olej na płótnie',
    dimensions: '50 × 60 cm',
    year: 1934,
    estimateMin: 700000,
    estimateMax: 1000000,
    category: 'malarstwo',
  },

  // ── Awangarda i Neoawangarda (preview) ──
  {
    auctionSlug: 'awangarda-i-neoawangarda',
    lotNumber: 1,
    title: 'Tłum III',
    artist: 'Magdalena Abakanowicz',
    description: 'Brąz, grupa figur z cyklu „Tłumy". Bezgłowe torsy ludzkie w ekspresyjnej, surowej formie. Odlew autorski z lat 90.',
    medium: 'brąz, patyna',
    dimensions: '180 × 50 × 35 cm (każda figura)',
    year: 1992,
    estimateMin: 600000,
    estimateMax: 900000,
    category: 'rzezba',
  },
  {
    auctionSlug: 'awangarda-i-neoawangarda',
    lotNumber: 2,
    title: 'OPALKA 1965/1-∞, detal 4 571 003–4 589 168',
    artist: 'Roman Opałka',
    description: 'Akryl na płótnie, fragment cyklu malowanych liczb. Białe cyfry na szarym tle, tworzące medytacyjną, nieskończoną sekwencję.',
    medium: 'akryl na płótnie',
    dimensions: '196 × 135 cm',
    year: 1990,
    estimateMin: 800000,
    estimateMax: 1200000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'awangarda-i-neoawangarda',
    lotNumber: 3,
    title: 'Obraz DLXXVIII',
    artist: 'Stefan Gierowski',
    description: 'Olej na płótnie, abstrakcyjna kompozycja z cyklu numerowanych obrazów. Przenikające się płaszczyzny barwne w tonacji błękitu i bieli.',
    medium: 'olej na płótnie',
    dimensions: '130 × 100 cm',
    year: 1999,
    estimateMin: 250000,
    estimateMax: 400000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'awangarda-i-neoawangarda',
    lotNumber: 4,
    title: 'Portret Marii Łączyńskiej',
    artist: 'Alfons Karny',
    description: 'Brąz patynowany, popiersie portretowe z lat 30. Wyrazista, psychologiczna głębia modelunku. Odlew autorski.',
    medium: 'brąz patynowany',
    dimensions: '45 × 30 × 25 cm',
    year: 1936,
    estimateMin: 80000,
    estimateMax: 120000,
    category: 'rzezba',
  },
  {
    auctionSlug: 'awangarda-i-neoawangarda',
    lotNumber: 5,
    title: 'Kobieta w zielonym bugatti',
    artist: 'Tamara de Lempicka',
    description: 'Olej na desce, portret kobiety w stylu art déco. Geometryzowane formy, intensywne kolory i blask charakterystyczny dla artystki.',
    medium: 'olej na desce',
    dimensions: '35 × 27 cm',
    year: 1929,
    estimateMin: 2000000,
    estimateMax: 3500000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'awangarda-i-neoawangarda',
    lotNumber: 6,
    title: 'Bez tytułu (z cyklu Pejzaże semantyczne)',
    artist: 'Jarosław Kozłowski',
    description: 'Technika mieszana na papierze, praca konceptualna z wpisanymi fragmentami tekstu. Charakterystyczna dla artysty gra między słowem a obrazem.',
    medium: 'technika mieszana na papierze',
    dimensions: '70 × 100 cm',
    year: 1975,
    estimateMin: 50000,
    estimateMax: 80000,
    category: 'grafika',
  },
  {
    auctionSlug: 'awangarda-i-neoawangarda',
    lotNumber: 7,
    title: 'Emballage – Wielopole',
    artist: 'Tadeusz Kantor',
    description: 'Technika mieszana, asamblaż z płótnem i przedmiotami. Praca z okresu koncepcji „biednego przedmiotu" i teatru niemożliwego.',
    medium: 'asamblaż, technika mieszana',
    dimensions: '90 × 70 cm',
    year: 1970,
    estimateMin: 400000,
    estimateMax: 600000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'awangarda-i-neoawangarda',
    lotNumber: 8,
    title: 'M 45',
    artist: 'Wojciech Fangor',
    description: 'Olej na płótnie, obraz z cyklu kolorowych kręgów. Rozmyte, koncentryczne pierścienie barwne tworzące efekt pulsacji optycznej.',
    medium: 'olej na płótnie',
    dimensions: '120 × 120 cm',
    year: 1968,
    estimateMin: 700000,
    estimateMax: 1100000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'awangarda-i-neoawangarda',
    lotNumber: 9,
    title: 'Powidoki – Kompozycja z łukiem',
    artist: 'Władysław Strzemiński',
    description: 'Gwasz na papierze, praca z cyklu „Powidoki". Uproszczone formy organiczne wynikające z fizjologicznej teorii widzenia artysty.',
    medium: 'gwasz na papierze',
    dimensions: '21 × 30 cm',
    year: 1948,
    estimateMin: 500000,
    estimateMax: 800000,
    category: 'grafika',
  },
  {
    auctionSlug: 'awangarda-i-neoawangarda',
    lotNumber: 10,
    title: 'Relief nr 23',
    artist: 'Henryk Stażewski',
    description: 'Relief biały, drewno lakierowane. Geometryczna kompozycja z wypukłymi kwadratami na białym tle. Praca z dojrzałego okresu twórczości.',
    medium: 'relief, drewno lakierowane',
    dimensions: '60 × 60 × 5 cm',
    year: 1972,
    estimateMin: 300000,
    estimateMax: 450000,
    category: 'rzezba',
  },

  // ── Wielcy Mistrzowie — Kolekcja Jubileuszowa (live) ──
  {
    auctionSlug: 'wielcy-mistrzowie-kolekcja-jubileuszowa',
    lotNumber: 1,
    title: 'Pejzaż fantastyczny z katedrą',
    artist: 'Zdzisław Beksiński',
    description: 'Olej na płycie pilśniowej, monumentalny pejzaż z okresu fantastycznego. Gotycka katedra wyłaniająca się z apokaliptycznego krajobrazu.',
    medium: 'olej na płycie pilśniowej',
    dimensions: '98 × 68 cm',
    year: 1979,
    estimateMin: 500000,
    estimateMax: 800000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'wielcy-mistrzowie-kolekcja-jubileuszowa',
    lotNumber: 2,
    title: 'Ikona – Akt z ptakiem',
    artist: 'Jerzy Nowosielski',
    description: 'Olej na płótnie, akt kobiecy z elementami sztuki bizantyjskiej. Płaskie plamy barwne i stylizowany kontur w ciepłej tonacji.',
    medium: 'olej na płótnie',
    dimensions: '100 × 81 cm',
    year: 1975,
    estimateMin: 400000,
    estimateMax: 650000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'wielcy-mistrzowie-kolekcja-jubileuszowa',
    lotNumber: 3,
    title: 'La Musicienne',
    artist: 'Tamara de Lempicka',
    description: 'Olej na płótnie, portret muzykalnej kobiety w stylu art déco. Monumentalna forma, błyszczące tkaniny, dynamiczna kompozycja.',
    medium: 'olej na płótnie',
    dimensions: '116 × 73 cm',
    year: 1933,
    estimateMin: 3000000,
    estimateMax: 5000000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'wielcy-mistrzowie-kolekcja-jubileuszowa',
    lotNumber: 4,
    title: 'Katharsis IV',
    artist: 'Magdalena Abakanowicz',
    description: 'Rzeźba z juty i żywicy, wielkoformatowa forma organiczna. Praca z przełomowego cyklu, w którym artystka odeszła od tkaniny ku rzeźbie.',
    medium: 'juta, żywica epoksydowa',
    dimensions: '150 × 90 × 80 cm',
    year: 1985,
    estimateMin: 500000,
    estimateMax: 750000,
    category: 'rzezba',
  },
  {
    auctionSlug: 'wielcy-mistrzowie-kolekcja-jubileuszowa',
    lotNumber: 5,
    title: 'Bez tytułu (Powidoki nr 7)',
    artist: 'Władysław Strzemiński',
    description: 'Olej na płótnie, abstrakcyjna kompozycja z cyklu „Powidoki słoneczne". Wibrujące linie światła na tle błękitu — wizja po zapatrzeniu się w słońce.',
    medium: 'olej na płótnie',
    dimensions: '75 × 60 cm',
    year: 1949,
    estimateMin: 900000,
    estimateMax: 1400000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'wielcy-mistrzowie-kolekcja-jubileuszowa',
    lotNumber: 6,
    title: 'Pejzaż podlaski – lato',
    artist: 'Leon Tarasewicz',
    description: 'Olej na płótnie, wielkoformatowy abstrakcyjny pejzaż. Pulsujące pola zieleni i żółci, typowe dla artystycznych wizji Podlasia.',
    medium: 'olej na płótnie',
    dimensions: '200 × 300 cm',
    year: 2005,
    estimateMin: 200000,
    estimateMax: 350000,
    category: 'malarstwo',
  },
  {
    auctionSlug: 'wielcy-mistrzowie-kolekcja-jubileuszowa',
    lotNumber: 7,
    title: 'Eros związany',
    artist: 'Igor Mitoraj',
    description: 'Brąz patynowany, fragmentaryczna rzeźba męskiego torsu z drapowaną tkaniną. Nawiązanie do antyku w monumentalnej skali.',
    medium: 'brąz patynowany',
    dimensions: '85 × 55 × 40 cm',
    year: 2000,
    estimateMin: 300000,
    estimateMax: 500000,
    category: 'rzezba',
  },
  {
    auctionSlug: 'wielcy-mistrzowie-kolekcja-jubileuszowa',
    lotNumber: 8,
    title: 'Zapis socjologiczny — Wnętrze, Podhale',
    artist: 'Zofia Rydet',
    description: 'Fotografia analogowa, odbitka żelatynowo-srebrowa. Wnętrze góralskiego domu z kolekcją świętych obrazów. Z najsłynniejszego cyklu artystki.',
    medium: 'fotografia, odbitka żelatynowo-srebrowa',
    dimensions: '40 × 50 cm',
    year: 1982,
    estimateMin: 50000,
    estimateMax: 80000,
    category: 'fotografia',
  },
  {
    auctionSlug: 'wielcy-mistrzowie-kolekcja-jubileuszowa',
    lotNumber: 9,
    title: 'Sztuka konsumpcyjna — Banan VII',
    artist: 'Natalia LL',
    description: 'Fotografia, odbitka żelatynowo-srebrowa z kultowego cyklu. Prowokacyjny, ironiczny komentarz na temat konsumpcjonizmu i seksualności.',
    medium: 'fotografia, odbitka żelatynowo-srebrowa',
    dimensions: '50 × 70 cm',
    year: 1975,
    estimateMin: 80000,
    estimateMax: 130000,
    category: 'fotografia',
  },
  {
    auctionSlug: 'wielcy-mistrzowie-kolekcja-jubileuszowa',
    lotNumber: 10,
    title: 'Obraz bezprzedmiotowy nr 98',
    artist: 'Stefan Gierowski',
    description: 'Olej na płótnie, abstrakcyjna kompozycja z przenikającymi się pasmami ciepłego i chłodnego koloru. Dojrzałe dzieło mistrza polskiej abstrakcji.',
    medium: 'olej na płótnie',
    dimensions: '140 × 110 cm',
    year: 2010,
    estimateMin: 350000,
    estimateMax: 550000,
    category: 'malarstwo',
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function seedArtists() {
  console.log('🎨 Seeding 52 artists + 3 auctions + 30 lots...\n');

  // ── Phase 1: Insert artists ──
  console.log('Phase 1: Inserting artists...');
  let artistCount = 0;
  for (const a of ARTISTS) {
    const [inserted] = await db
      .insert(artists)
      .values({
        name: a.name,
        slug: a.slug,
        nationality: a.nationality,
        birthYear: a.birthYear,
        deathYear: a.deathYear,
        bio: a.bio,
      })
      .onConflictDoNothing({ target: artists.slug })
      .returning();

    if (inserted) {
      artistCount++;
      console.log(`  ✅ ${a.name}`);
    } else {
      console.log(`  ℹ️  ${a.name} (already exists)`);
    }
  }
  console.log(`\n  → ${artistCount} new artists inserted\n`);

  // ── Phase 2: Insert auctions + lots ──
  console.log('Phase 2: Inserting auctions and lots...');
  const auctionIdMap = new Map<string, { id: string; status: string }>();

  for (let i = 0; i < NEW_AUCTIONS.length; i++) {
    const a = NEW_AUCTIONS[i];
    const [inserted] = await db
      .insert(auctions)
      .values({
        slug: a.slug,
        title: a.title,
        description: a.description,
        category: a.category,
        startDate: new Date(a.startDate),
        endDate: new Date(a.endDate),
        location: a.location,
        curator: a.curator,
        status: a.status,
        visibilityLevel: '0',
        sortOrder: 10 + i, // after existing auctions
      })
      .onConflictDoNothing({ target: auctions.slug })
      .returning();

    if (inserted) {
      auctionIdMap.set(a.slug, { id: inserted.id, status: a.status });
      console.log(`  ✅ Auction: ${a.title} (${a.status})`);
    } else {
      // Already exists — fetch ID
      const rows = await db
        .select({ id: auctions.id, status: auctions.status })
        .from(auctions)
        .where(sql`${auctions.slug} = ${a.slug}`)
        .limit(1);
      if (rows[0]) {
        auctionIdMap.set(a.slug, { id: rows[0].id, status: rows[0].status });
        console.log(`  ℹ️  Auction exists: ${a.title}`);
      }
    }
  }

  let lotCount = 0;
  for (const lot of NEW_LOTS) {
    const auction = auctionIdMap.get(lot.auctionSlug);
    if (!auction) {
      console.warn(`  ⚠️  Skipping lot: auction ${lot.auctionSlug} not found`);
      continue;
    }

    const [inserted] = await db
      .insert(lots)
      .values({
        auctionId: auction.id,
        lotNumber: lot.lotNumber,
        title: lot.title,
        artist: lot.artist,
        description: lot.description,
        medium: lot.medium,
        dimensions: lot.dimensions,
        year: lot.year,
        estimateMin: lot.estimateMin,
        estimateMax: lot.estimateMax,
        status: lotStatusForAuction(auction.status),
        category: lot.category,
        sortOrder: lot.lotNumber - 1,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted) {
      lotCount++;
      console.log(`  ✅ Lot ${lot.lotNumber}: ${lot.title} (${lot.artist})`);
    } else {
      console.log(`  ℹ️  Lot exists: ${lot.title}`);
    }
  }
  console.log(`\n  → ${lotCount} new lots inserted\n`);

  // ── Phase 3: Link all lots → artists ──
  console.log('Phase 3: Linking lots to artists...');
  const result = await db.execute(sql`
    UPDATE lots SET artist_id = a.id, updated_at = NOW()
    FROM artists a
    WHERE lots.artist_id IS NULL
      AND TRIM(lots.artist) ILIKE TRIM(a.name)
  `);
  const linkedCount = result.rowCount ?? 0;
  console.log(`  → ${linkedCount} lots linked to artists\n`);

  // ── Summary ──
  const artistTotal = await db.execute(sql`SELECT COUNT(*) AS c FROM artists`);
  const auctionTotal = await db.execute(sql`SELECT COUNT(*) AS c FROM auctions`);
  const lotTotal = await db.execute(sql`SELECT COUNT(*) AS c FROM lots WHERE artist_id IS NOT NULL`);
  const unlinked = await db.execute(sql`SELECT COUNT(*) AS c FROM lots WHERE artist_id IS NULL AND artist != ''`);

  console.log('── Summary ──');
  console.log(`  Artists:            ${artistTotal.rows[0].c}`);
  console.log(`  Auctions:           ${auctionTotal.rows[0].c}`);
  console.log(`  Lots with artist:   ${lotTotal.rows[0].c}`);
  console.log(`  Unlinked lots:      ${unlinked.rows[0].c}`);
  console.log('');

  process.exit(0);
}

seedArtists().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
