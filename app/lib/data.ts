import type { Auction, Lot, TeamMember, Event, PressItem, Stats } from './types';

// ---------------------------------------------------------------------------
// Auctions
// ---------------------------------------------------------------------------

export const auctions: Auction[] = [
  {
    id: 'auc-1',
    slug: 'mistrzowie-polskiego-malarstwa',
    title: 'Mistrzowie Polskiego Malarstwa',
    description:
      'Wyjątkowa kolekcja dzieł najwybitniejszych polskich malarzy XX i XXI wieku. Aukcja obejmuje prace od ekspresjonizmu po sztukę współczesną, prezentując pełnię polskiej tradycji malarskiej.',
    date: '2026-01-15',
    endDate: '2026-01-15',
    status: 'ended',
    category: 'malarstwo',
    coverImage: '/images/auctions/lot-1.jpg',
    totalLots: 12,
    location: 'Dom Aukcyjny Omena, Warszawa',
    curator: 'dr Katarzyna Nowak',
  },
  {
    id: 'auc-2',
    slug: 'wspolczesna-rzezba-europejska',
    title: 'Współczesna Rzeźba Europejska',
    description:
      'Przegląd najważniejszych tendencji w rzeźbie europejskiej — od klasycznej formy po eksperyment materiałowy. W kolekcji znajdą się prace artystów z Polski, Rumunii, Francji i Wielkiej Brytanii.',
    date: '2026-02-27',
    endDate: '2026-02-28',
    status: 'live',
    category: 'rzezba',
    coverImage: '/images/auctions/lot-13.jpg',
    totalLots: 8,
    location: 'Dom Aukcyjny Omena, Warszawa',
    curator: 'prof. Andrzej Kowalski',
  },
  {
    id: 'auc-3',
    slug: 'fotografia-artystyczna-xx-wieku',
    title: 'Fotografia Artystyczna XX Wieku',
    description:
      'Unikalna okazja nabycia prac mistrzów polskiej i europejskiej fotografii artystycznej. Kolekcja obejmuje odbitki vintage oraz współczesne printy autoryzowane przez artystów lub ich spadkobierców.',
    date: '2026-04-10',
    endDate: '2026-04-10',
    status: 'upcoming',
    category: 'fotografia',
    coverImage: '/images/auctions/lot-21.jpg',
    totalLots: 10,
    location: 'Centrum Sztuki Współczesnej, Kraków',
    curator: 'dr Magdalena Zielińska',
  },
  {
    id: 'auc-4',
    slug: 'kolekcja-przelomu-wiekow',
    title: 'Kolekcja Przełomu Wieków',
    description:
      'Interdyscyplinarna kolekcja dzieł z przełomu XX i XXI wieku łącząca malarstwo, rzeźbę, grafikę i obiekty. Aukcja prezentuje dynamikę zmian w polskiej sztuce współczesnej.',
    date: '2026-05-20',
    endDate: '2026-05-20',
    status: 'upcoming',
    category: 'mixed',
    coverImage: '/images/auctions/lot-29.jpg',
    totalLots: 8,
    location: 'Dom Aukcyjny Omena, Warszawa',
    curator: 'dr Katarzyna Nowak',
  },
];

// ---------------------------------------------------------------------------
// Lots — Auction 1: Mistrzowie Polskiego Malarstwa (12 lots, ended)
// ---------------------------------------------------------------------------

const lotsMistrzowie: Lot[] = [
  {
    id: 'lot-1',
    auctionSlug: 'mistrzowie-polskiego-malarstwa',
    title: 'Pejzaż fantastyczny',
    artist: 'Zdzisław Beksiński',
    description:
      'Monumentalny obraz olejny z dojrzałego okresu twórczości artysty. Kompozycja ukazuje charakterystyczny dla Beksińskiego surrealistyczny pejzaż, pełen organicznych form i niepokojącego światła.',
    medium: 'Olej na płycie pilśniowej',
    dimensions: '98 × 73 cm',
    year: 1978,
    estimateMin: 350000,
    estimateMax: 500000,
    currentBid: null,
    images: ['/images/auctions/lot-1.jpg'],
    provenance: [
      'Kolekcja prywatna, Warszawa',
      'Galeria Sztuki Współczesnej BWA, Sanok, 1980',
    ],
    exhibited: ['Zdzisław Beksiński — Retrospektywa, Muzeum Narodowe, Kraków, 2005'],
    lotNumber: 1,
  },
  {
    id: 'lot-2',
    auctionSlug: 'mistrzowie-polskiego-malarstwa',
    title: 'Abstrakcja w błękicie',
    artist: 'Jerzy Nowosielski',
    description:
      'Charakterystyczne dla Nowosielskiego zestawienie pól barwnych w tonacji niebiesko-złotej. Praca z lat 70., łącząca tradycję ikony z duchem modernistycznej abstrakcji.',
    medium: 'Olej na płótnie',
    dimensions: '81 × 65 cm',
    year: 1974,
    estimateMin: 180000,
    estimateMax: 260000,
    currentBid: null,
    images: ['/images/auctions/lot-2.jpg'],
    provenance: [
      'Kolekcja artysty',
      'Galeria Starmach, Kraków',
      'Kolekcja prywatna, Kraków',
    ],
    exhibited: ['Nowosielski — Malarstwo, Galeria Starmach, Kraków, 1998'],
    lotNumber: 2,
  },
  {
    id: 'lot-3',
    auctionSlug: 'mistrzowie-polskiego-malarstwa',
    title: 'Postać w czerwieni',
    artist: 'Wojciech Fangor',
    description:
      'Wczesna praca Fangora eksplorująca relację figury i tła. Intensywna kolorystyka i miękkie przejścia tonalne zapowiadają późniejsze eksperymenty artysty z iluzją optyczną.',
    medium: 'Olej na płótnie',
    dimensions: '100 × 80 cm',
    year: 1960,
    estimateMin: 200000,
    estimateMax: 320000,
    currentBid: null,
    images: ['/images/auctions/lot-3.jpg'],
    provenance: [
      'Galeria Foksal, Warszawa, 1962',
      'Kolekcja prywatna, Nowy Jork',
      'Kolekcja prywatna, Warszawa',
    ],
    exhibited: ['Wojciech Fangor, Muzeum Sztuki Nowoczesnej, Warszawa, 2015'],
    lotNumber: 3,
  },
  {
    id: 'lot-4',
    auctionSlug: 'mistrzowie-polskiego-malarstwa',
    title: 'Kobieta z wachlarzem',
    artist: 'Edward Dwurnik',
    description:
      'Barwna, ekspresyjna postać kobieca z cyklu figuratywnego. Dwurnik łączy w tej pracy groteskowy humor z niezwykłą energią malarską i odwagą kolorystyczną.',
    medium: 'Olej na płótnie',
    dimensions: '120 × 90 cm',
    year: 1985,
    estimateMin: 80000,
    estimateMax: 140000,
    currentBid: null,
    images: ['/images/auctions/lot-4.jpg'],
    provenance: [
      'Pracownia artysty, Warszawa',
      'Kolekcja prywatna, Łódź',
    ],
    exhibited: ['Dwurnik — Malarstwo, Zachęta, Warszawa, 2018'],
    lotNumber: 4,
  },
  {
    id: 'lot-5',
    auctionSlug: 'mistrzowie-polskiego-malarstwa',
    title: 'Kompozycja geometryczna nr 12',
    artist: 'Henryk Stażewski',
    description:
      'Doskonały przykład geometrycznej abstrakcji Stażewskiego z późnego okresu. Precyzyjnie wyważona kompozycja kwadratów i prostokątów w subtelnej palecie szarości i bieli.',
    medium: 'Akryl na płótnie',
    dimensions: '60 × 60 cm',
    year: 1972,
    estimateMin: 120000,
    estimateMax: 180000,
    currentBid: null,
    images: ['/images/auctions/lot-5.jpg'],
    provenance: [
      'Galeria Foksal, Warszawa',
      'Kolekcja prywatna, Warszawa',
    ],
    exhibited: [
      'Henryk Stażewski — Retrospektywa, Muzeum Sztuki, Łódź, 1994',
    ],
    lotNumber: 5,
  },
  {
    id: 'lot-6',
    auctionSlug: 'mistrzowie-polskiego-malarstwa',
    title: 'Rozstrzelanie V',
    artist: 'Andrzej Wróblewski',
    description:
      'Wstrząsająca praca z cyklu „Rozstrzelań" — jedno z najważniejszych dzieł polskiej sztuki powojennej. Syntetyczna forma i dramatyczny kolor oddają tragizm wojennego doświadczenia.',
    medium: 'Olej na płótnie',
    dimensions: '130 × 97 cm',
    year: 1949,
    estimateMin: 400000,
    estimateMax: 600000,
    currentBid: null,
    images: ['/images/auctions/lot-6.jpg'],
    provenance: [
      'Spadek po artyście',
      'Fundacja Andrzeja Wróblewskiego, Kraków',
    ],
    exhibited: [
      'Andrzej Wróblewski — Recto / Verso, Muzeum Sztuki Nowoczesnej, Warszawa, 2015',
    ],
    lotNumber: 6,
  },
  {
    id: 'lot-7',
    auctionSlug: 'mistrzowie-polskiego-malarstwa',
    title: 'Figura bestii nr 3',
    artist: 'Jan Lebenstein',
    description:
      'Mocna, ekspresyjna praca z cyklu „Figur osiowych". Lebenstein tworzy niepokojącą hybrydę ludzkiej i zwierzęcej formy, wykorzystując ciemną paletę z akcentami krwistej czerwieni.',
    medium: 'Olej na płótnie',
    dimensions: '146 × 114 cm',
    year: 1962,
    estimateMin: 150000,
    estimateMax: 220000,
    currentBid: null,
    images: ['/images/auctions/lot-7.jpg'],
    provenance: [
      'Galerie Lambert, Paryż',
      'Kolekcja prywatna, Paryż',
      'Kolekcja prywatna, Warszawa',
    ],
    exhibited: ['Lebenstein, Muzeum Narodowe, Warszawa, 2016'],
    lotNumber: 7,
  },
  {
    id: 'lot-8',
    auctionSlug: 'mistrzowie-polskiego-malarstwa',
    title: 'Portret podwójny',
    artist: 'Alina Szapocznikow',
    description:
      'Rzadki obraz olejny Szapocznikow z wczesnego okresu twórczości, zanim artystka skoncentrowała się na rzeźbie. Portret podwójny łączy realizm z delikatną deformacją ekspresjonistyczną.',
    medium: 'Olej na płótnie',
    dimensions: '73 × 60 cm',
    year: 1955,
    estimateMin: 90000,
    estimateMax: 150000,
    currentBid: null,
    images: ['/images/auctions/lot-8.jpg'],
    provenance: [
      'Spadek po artystce',
      'Kolekcja prywatna, Warszawa',
    ],
    exhibited: ['Alina Szapocznikow, Muzeum Sztuki Nowoczesnej, Warszawa, 2012'],
    lotNumber: 8,
  },
  {
    id: 'lot-9',
    auctionSlug: 'mistrzowie-polskiego-malarstwa',
    title: 'Morze Bałtyckie, zmierzch',
    artist: 'Leon Wyczółkowski',
    description:
      'Mistrzowski pejzaż nadmorski w ciepłej tonacji zachodzącego słońca. Wyczółkowski z wirtuozerią oddaje grę światła na falach, wykorzystując szerokie, pastozowe pociągnięcia pędzla.',
    medium: 'Olej na tekturze',
    dimensions: '50 × 70 cm',
    year: 1908,
    estimateMin: 60000,
    estimateMax: 95000,
    currentBid: null,
    images: ['/images/auctions/lot-9.jpg'],
    provenance: [
      'Kolekcja rodziny artysty',
      'Kolekcja prywatna, Gdańsk',
    ],
    exhibited: ['Malarstwo Młodej Polski, Muzeum Narodowe, Kraków, 2010'],
    lotNumber: 9,
  },
  {
    id: 'lot-10',
    auctionSlug: 'mistrzowie-polskiego-malarstwa',
    title: 'Akt w pracowni',
    artist: 'Tadeusz Kantor',
    description:
      'Wczesny akt malarski Kantora, jeszcze przed jego radykalnym zwrotem ku sztuce konceptualnej. Praca ujawnia solidny warsztat malarski artysty i wpływy postimpresjonistyczne.',
    medium: 'Olej na płótnie',
    dimensions: '92 × 73 cm',
    year: 1948,
    estimateMin: 110000,
    estimateMax: 170000,
    currentBid: null,
    images: ['/images/auctions/lot-10.jpg'],
    provenance: [
      'Galeria Krzysztofory, Kraków',
      'Kolekcja prywatna, Kraków',
    ],
    exhibited: ['Tadeusz Kantor — Malarstwo, MOCAK, Kraków, 2014'],
    lotNumber: 10,
  },
  {
    id: 'lot-11',
    auctionSlug: 'mistrzowie-polskiego-malarstwa',
    title: 'Autoportret z paletą',
    artist: 'Jacek Malczewski',
    description:
      'Jeden z licznych autoportretów Malczewskiego, w którym artysta przedstawia siebie w pracowni z paletą i pędzlami. Symboliczny charakter dzieła podkreśla wizjonerska kolorystyka.',
    medium: 'Olej na desce',
    dimensions: '78 × 63 cm',
    year: 1917,
    estimateMin: 250000,
    estimateMax: 380000,
    currentBid: null,
    images: ['/images/auctions/lot-11.jpg'],
    provenance: [
      'Kolekcja rodziny artysty',
      'Kolekcja prywatna, Kraków',
    ],
    exhibited: ['Malczewski — Malarstwo, Muzeum Narodowe, Kraków, 2000'],
    lotNumber: 11,
  },
  {
    id: 'lot-12',
    auctionSlug: 'mistrzowie-polskiego-malarstwa',
    title: 'Pejzaż industrialny — Nowa Huta',
    artist: 'Rafał Malczewski',
    description:
      'Dynamiczny pejzaż ukazujący przemysłowy krajobraz Nowej Huty w charakterystycznym dla Malczewskiego syntetycznym stylu. Żywa kolorystyka kontrastuje z surowym tematem industrialnym.',
    medium: 'Olej na płótnie',
    dimensions: '65 × 81 cm',
    year: 1956,
    estimateMin: 35000,
    estimateMax: 55000,
    currentBid: null,
    images: ['/images/auctions/lot-12.jpg'],
    provenance: [
      'Kolekcja prywatna, Kraków',
      'Dom Aukcyjny Omena, 2024',
    ],
    exhibited: ['Polska szkoła pejzażu, BWA Kraków, 2019'],
    lotNumber: 12,
  },
];

// ---------------------------------------------------------------------------
// Lots — Auction 2: Współczesna Rzeźba Europejska (8 lots, live)
// ---------------------------------------------------------------------------

const lotsRzezba: Lot[] = [
  {
    id: 'lot-13',
    auctionSlug: 'wspolczesna-rzezba-europejska',
    title: 'Ptak w przestrzeni',
    artist: 'Constantin Brâncuși',
    description:
      'Brązowa edycja słynnej formy „Ptaka w przestrzeni" — jedno z najbardziej rozpoznawalnych dzieł rzeźby XX wieku. Doskonale wypolerowana powierzchnia oddaje ideę czystego ruchu.',
    medium: 'Brąz polerowany',
    dimensions: '137 × 21 × 16 cm',
    year: 1941,
    estimateMin: 450000,
    estimateMax: 650000,
    currentBid: 510000,
    images: ['/images/auctions/lot-13.jpg'],
    provenance: [
      'Atelier Brâncuși, Paryż',
      'Kolekcja prywatna, Bukareszt',
      'Kolekcja prywatna, Warszawa',
    ],
    exhibited: ['Brâncuși — Esencja formy, Centre Pompidou, Paryż, 2010'],
    lotNumber: 1,
  },
  {
    id: 'lot-14',
    auctionSlug: 'wspolczesna-rzezba-europejska',
    title: 'Leżąca figura nr 5',
    artist: 'Henry Moore',
    description:
      'Charakterystyczna dla Moore\'a biomorficzna forma postaci ludzkiej w pozycji leżącej. Brązowa rzeźba zachwyca płynnością linii i monumentalnym spokojem mimo niewielkich rozmiarów.',
    medium: 'Brąz patynowany',
    dimensions: '42 × 78 × 35 cm',
    year: 1963,
    estimateMin: 380000,
    estimateMax: 520000,
    currentBid: 395000,
    images: ['/images/auctions/lot-14.jpg'],
    provenance: [
      'Henry Moore Foundation, Perry Green',
      'Kolekcja prywatna, Londyn',
    ],
    exhibited: ['Henry Moore — Retrospektywa, Tate Britain, Londyn, 2010'],
    lotNumber: 2,
  },
  {
    id: 'lot-15',
    auctionSlug: 'wspolczesna-rzezba-europejska',
    title: 'Człowiek kroczący II',
    artist: 'Alberto Giacometti',
    description:
      'Wydłużona, ascetyczna postać człowieka w ruchu — ikona egzystencjalnej rzeźby powojennej. Szorstka faktura powierzchni brązu nadaje figurze dramatyczną ekspresję i kruchość.',
    medium: 'Brąz',
    dimensions: '162 × 27 × 53 cm',
    year: 1960,
    estimateMin: 500000,
    estimateMax: 750000,
    currentBid: 580000,
    images: ['/images/auctions/lot-15.jpg'],
    provenance: [
      'Fondation Giacometti, Paryż',
      'Kolekcja prywatna, Genewa',
    ],
    exhibited: ['Giacometti, Fondation Beyeler, Bazylea, 2009'],
    lotNumber: 3,
  },
  {
    id: 'lot-16',
    auctionSlug: 'wspolczesna-rzezba-europejska',
    title: 'Kompozycja przestrzenna nr 9',
    artist: 'Katarzyna Kobro',
    description:
      'Awangardowa rzeźba konstruktywistyczna z barwionego metalu. Kobro bada relację formy i przestrzeni, tworząc dynamiczny układ geometrycznych płaszczyzn przenikających się nawzajem.',
    medium: 'Stal spawana, lakierowana',
    dimensions: '50 × 64 × 40 cm',
    year: 1933,
    estimateMin: 280000,
    estimateMax: 420000,
    currentBid: 310000,
    images: ['/images/auctions/lot-16.jpg'],
    provenance: [
      'Muzeum Sztuki, Łódź (depozyt)',
      'Kolekcja prywatna, Łódź',
    ],
    exhibited: ['Kobro / Strzemiński, Muzeum Sztuki, Łódź, 2017'],
    lotNumber: 4,
  },
  {
    id: 'lot-17',
    auctionSlug: 'wspolczesna-rzezba-europejska',
    title: 'Słoneczny zegar',
    artist: 'Władysław Hasior',
    description:
      'Asamblaż z elementów metalowych i znalezionych przedmiotów tworzących formę zegara słonecznego. Hasior łączy ludową symbolikę z ekspresją materii w typowy dla siebie monumentalny sposób.',
    medium: 'Metal, drewno, obiekty znalezione',
    dimensions: '120 × 85 × 45 cm',
    year: 1972,
    estimateMin: 95000,
    estimateMax: 150000,
    currentBid: 105000,
    images: ['/images/auctions/lot-17.jpg'],
    provenance: [
      'Galeria Władysława Hasiora, Zakopane',
      'Kolekcja prywatna, Warszawa',
    ],
    exhibited: ['Hasior — Rzeźba i asamblaż, CSW Zamek Ujazdowski, Warszawa, 2004'],
    lotNumber: 5,
  },
  {
    id: 'lot-18',
    auctionSlug: 'wspolczesna-rzezba-europejska',
    title: 'Wielki tors',
    artist: 'Igor Mitoraj',
    description:
      'Monumentalny fragment postaci ludzkiej w brązie z charakterystycznymi pęknięciami i ubytkami. Mitoraj tworzy dialog między antykiem a współczesnością, nadając klasycznej formie nową dramaturgię.',
    medium: 'Brąz patynowany',
    dimensions: '95 × 55 × 40 cm',
    year: 1998,
    estimateMin: 160000,
    estimateMax: 240000,
    currentBid: 175000,
    images: ['/images/auctions/lot-18.jpg'],
    provenance: [
      'Atelier Mitoraj, Pietrasanta',
      'Galeria Dolce Vita, Warszawa',
    ],
    exhibited: ['Mitoraj — Rzeźba, Kraków Rynek Główny, 2003'],
    lotNumber: 6,
  },
  {
    id: 'lot-19',
    auctionSlug: 'wspolczesna-rzezba-europejska',
    title: 'Forma organiczna III',
    artist: 'Barbara Hepworth',
    description:
      'Elegancka forma z białego marmuru z charakterystycznym otworem przenikającym bryłę. Hepworth bada napięcie między masą kamienia a pustką, tworząc rzeźbę o niemal muzycznej harmonii.',
    medium: 'Marmur biały',
    dimensions: '48 × 32 × 28 cm',
    year: 1956,
    estimateMin: 220000,
    estimateMax: 340000,
    currentBid: 245000,
    images: ['/images/auctions/lot-19.jpg'],
    provenance: [
      'Hepworth Estate, St Ives',
      'Kolekcja prywatna, Londyn',
    ],
    exhibited: ['Barbara Hepworth — Retrospektywa, Tate St Ives, 2015'],
    lotNumber: 7,
  },
  {
    id: 'lot-20',
    auctionSlug: 'wspolczesna-rzezba-europejska',
    title: 'Kolumna nieskończona — model',
    artist: 'Constantin Brâncuși',
    description:
      'Studyjny model „Kolumny nieskończoności" w drewnie dębowym. Rytmicznie powtarzający się moduł romboidalny symbolizuje nieskończoność i aspiracje duchowe.',
    medium: 'Drewno dębowe',
    dimensions: '180 × 22 × 22 cm',
    year: 1937,
    estimateMin: 300000,
    estimateMax: 450000,
    currentBid: 340000,
    images: ['/images/auctions/lot-20.jpg'],
    provenance: [
      'Atelier Brâncuși, Paryż',
      'Kolekcja prywatna, Paryż',
    ],
    exhibited: ['Brâncuși — Rzeźba, MOMA, Nowy Jork, 2018'],
    lotNumber: 8,
  },
];

// ---------------------------------------------------------------------------
// Lots — Auction 3: Fotografia Artystyczna XX Wieku (10 lots, upcoming)
// ---------------------------------------------------------------------------

const lotsFotografia: Lot[] = [
  {
    id: 'lot-21',
    auctionSlug: 'fotografia-artystyczna-xx-wieku',
    title: 'Łódź — ulica Piotrkowska, 1948',
    artist: 'Edward Hartwig',
    description:
      'Klasyczna fotografia uliczna ukazująca powojenną Łódź w zimowym świetle. Hartwig mistrzowsko operuje kontrastem i głębią, nadając miejskiemu krajobrazowi poetycki wymiar.',
    medium: 'Żelatynowo-srebrowa odbitka vintage',
    dimensions: '30 × 40 cm',
    year: 1948,
    estimateMin: 15000,
    estimateMax: 25000,
    currentBid: null,
    images: ['/images/auctions/lot-21.jpg'],
    provenance: [
      'Archiwum artysty, Warszawa',
      'Kolekcja prywatna, Warszawa',
    ],
    exhibited: ['Edward Hartwig — Fotografie, Zachęta, Warszawa, 2009'],
    lotNumber: 1,
  },
  {
    id: 'lot-22',
    auctionSlug: 'fotografia-artystyczna-xx-wieku',
    title: 'Podwórko na Pradze',
    artist: 'Zofia Chomętowska',
    description:
      'Dokumentalny portret podwórka praskiego z lat 30. — fotograficzny zapis codzienności przedwojennej Warszawy. Zdjęcie wyróżnia się precyzyjną kompozycją i ciepłą tonacją sepii.',
    medium: 'Żelatynowo-srebrowa odbitka vintage',
    dimensions: '24 × 30 cm',
    year: 1936,
    estimateMin: 18000,
    estimateMax: 28000,
    currentBid: null,
    images: ['/images/auctions/lot-22.jpg'],
    provenance: [
      'Archiwum Chomętowskiej, Warszawa',
      'Fundacja Archeologia Fotografii, Warszawa',
    ],
    exhibited: ['Zofia Chomętowska, Fundacja Archeologia Fotografii, 2018'],
    lotNumber: 2,
  },
  {
    id: 'lot-23',
    auctionSlug: 'fotografia-artystyczna-xx-wieku',
    title: 'Akt — studium światła',
    artist: 'Zbigniew Dłubak',
    description:
      'Minimalistyczny akt eksperymentalny z lat 60. Dłubak bada relację ciała i światła, redukując fotografię do esencji formy i tonalności.',
    medium: 'Żelatynowo-srebrowa odbitka autorska',
    dimensions: '40 × 30 cm',
    year: 1967,
    estimateMin: 12000,
    estimateMax: 20000,
    currentBid: null,
    images: ['/images/auctions/lot-23.jpg'],
    provenance: [
      'Kolekcja artysty',
      'Galeria Asymetria, Warszawa',
    ],
    exhibited: ['Zbigniew Dłubak — Fotografia, CSW Zamek Ujazdowski, 2010'],
    lotNumber: 3,
  },
  {
    id: 'lot-24',
    auctionSlug: 'fotografia-artystyczna-xx-wieku',
    title: 'Kraków, Rynek Główny we mgle',
    artist: 'Jan Bułhak',
    description:
      'Romantyczny widok krakowskiego rynku spowitego poranną mgłą. Bułhak, ojciec polskiej fotografii artystycznej, tworzy obraz o niemal malarskiej jakości światłocienia.',
    medium: 'Bromowa odbitka vintage',
    dimensions: '28 × 38 cm',
    year: 1930,
    estimateMin: 22000,
    estimateMax: 35000,
    currentBid: null,
    images: ['/images/auctions/lot-24.jpg'],
    provenance: [
      'Archiwum Jana Bułhaka, Wilno/Warszawa',
      'Kolekcja prywatna, Kraków',
    ],
    exhibited: ['Jan Bułhak — Fotografia ojczysta, Muzeum Narodowe, Warszawa, 2006'],
    lotNumber: 4,
  },
  {
    id: 'lot-25',
    auctionSlug: 'fotografia-artystyczna-xx-wieku',
    title: 'Konstrukcja z cieniem',
    artist: 'Jerzy Lewczyński',
    description:
      'Abstrakcyjna kompozycja łącząca architekturę przemysłową z grą świateł i cieni. Lewczyński przekształca banalny motyw w fascynujący obraz graficzny o silnym rytmie wizualnym.',
    medium: 'Żelatynowo-srebrowa odbitka autorska',
    dimensions: '30 × 30 cm',
    year: 1959,
    estimateMin: 8000,
    estimateMax: 14000,
    currentBid: null,
    images: ['/images/auctions/lot-25.jpg'],
    provenance: [
      'Kolekcja artysty, Gliwice',
      'Kolekcja prywatna, Katowice',
    ],
    exhibited: ['Jerzy Lewczyński — Archeologia fotografii, BWA Wrocław, 2005'],
    lotNumber: 5,
  },
  {
    id: 'lot-26',
    auctionSlug: 'fotografia-artystyczna-xx-wieku',
    title: 'Portret Wisławy Szymborskiej',
    artist: 'Adam Bujak',
    description:
      'Intymny portret noblistki w jej krakowskim mieszkaniu. Bujak uchwycił poetkę w chwili zamyślenia, otoczoną książkami i rękopisami, tworząc ikoniczny wizerunek polskiej literatury.',
    medium: 'Srebrowa odbitka autorska',
    dimensions: '40 × 50 cm',
    year: 1996,
    estimateMin: 10000,
    estimateMax: 18000,
    currentBid: null,
    images: ['/images/auctions/lot-26.jpg'],
    provenance: [
      'Archiwum Adama Bujaka, Kraków',
    ],
    exhibited: ['Adam Bujak — Portrety, Galeria ZPAF, Kraków, 2012'],
    lotNumber: 6,
  },
  {
    id: 'lot-27',
    auctionSlug: 'fotografia-artystyczna-xx-wieku',
    title: 'Seria „Zapis socjologiczny" nr 7',
    artist: 'Zofia Rydet',
    description:
      'Fragment monumentalnego projektu dokumentalnego Rydet, rejestrującego życie polskiej wsi. Zdjęcie przedstawia wnętrze izby mieszkalnej z portretami rodzinnymi na ścianie.',
    medium: 'Żelatynowo-srebrowa odbitka autorska',
    dimensions: '30 × 40 cm',
    year: 1983,
    estimateMin: 20000,
    estimateMax: 32000,
    currentBid: null,
    images: ['/images/auctions/lot-27.jpg'],
    provenance: [
      'Fundacja Zofia Rydet, Gliwice',
      'Kolekcja prywatna, Warszawa',
    ],
    exhibited: ['Zofia Rydet — Zapis socjologiczny, Muzeum Sztuki Nowoczesnej, Warszawa, 2017'],
    lotNumber: 7,
  },
  {
    id: 'lot-28',
    auctionSlug: 'fotografia-artystyczna-xx-wieku',
    title: 'Tancerka, Teatr Wielki',
    artist: 'Tadeusz Rolke',
    description:
      'Dynamiczne ujęcie baleriny podczas próby w Teatrze Wielkim w Warszawie. Rolke łączy reporterską precyzję z artystycznym wyczuciem ruchu i kompozycji.',
    medium: 'Żelatynowo-srebrowa odbitka autorska',
    dimensions: '40 × 50 cm',
    year: 1965,
    estimateMin: 14000,
    estimateMax: 22000,
    currentBid: null,
    images: ['/images/auctions/lot-28.jpg'],
    provenance: [
      'Archiwum Tadeusza Rolke, Warszawa',
      'Galeria Asymetria, Warszawa',
    ],
    exhibited: ['Tadeusz Rolke — Retrospektywa, CSW Zamek Ujazdowski, 2016'],
    lotNumber: 8,
  },
  {
    id: 'lot-29',
    auctionSlug: 'fotografia-artystyczna-xx-wieku',
    title: 'Cmentarz żydowski, Łódź',
    artist: 'Chris Niedenthal',
    description:
      'Poruszająca fotografia opuszczonego cmentarza żydowskiego w Łodzi. Niedenthal z właściwą sobie powściągliwością dokumentuje ślady pamięci i upływającego czasu.',
    medium: 'Srebrowa odbitka autorska',
    dimensions: '30 × 45 cm',
    year: 1978,
    estimateMin: 16000,
    estimateMax: 26000,
    currentBid: null,
    images: ['/images/auctions/lot-29.jpg'],
    provenance: [
      'Archiwum Chris Niedenthal, Warszawa',
    ],
    exhibited: ['Chris Niedenthal — Wybrane fotografie, Leica Gallery, Warszawa, 2014'],
    lotNumber: 9,
  },
  {
    id: 'lot-30',
    auctionSlug: 'fotografia-artystyczna-xx-wieku',
    title: 'Autoportret z lustrem',
    artist: 'Natalia LL',
    description:
      'Konceptualna praca z serii eksplorujących tożsamość i ciało kobiece. Natalia LL wykorzystuje lustrzane odbicie do stworzenia wielowarstwowej narracji o podmiotowości i spojrzeniu.',
    medium: 'Fotografia czarno-biała, odbitka autorska',
    dimensions: '50 × 40 cm',
    year: 1975,
    estimateMin: 25000,
    estimateMax: 40000,
    currentBid: null,
    images: ['/images/auctions/lot-30.jpg'],
    provenance: [
      'Kolekcja artystki, Wrocław',
      'Galeria Awangarda, Wrocław',
    ],
    exhibited: ['Natalia LL — Sztuka konsumpcyjna, Muzeum Narodowe, Wrocław, 2017'],
    lotNumber: 10,
  },
];

// ---------------------------------------------------------------------------
// Lots — Auction 4: Kolekcja Przełomu Wieków (8 lots, upcoming)
// ---------------------------------------------------------------------------

const lotsPrzelom: Lot[] = [
  {
    id: 'lot-31',
    auctionSlug: 'kolekcja-przelomu-wiekow',
    title: 'Mapa nieba nocnego',
    artist: 'Leon Tarasewicz',
    description:
      'Wielkoformatowa abstrakcja inspirowana nocnym niebem nad Podlasiem. Tarasewicz pokrywa płótno gęstą siecią punktów i linii, tworząc hipnotyzującą konstelację barwnych znaków.',
    medium: 'Olej na płótnie',
    dimensions: '200 × 300 cm',
    year: 2001,
    estimateMin: 120000,
    estimateMax: 180000,
    currentBid: null,
    images: ['/images/auctions/lot-31.jpg'],
    provenance: [
      'Galeria Foksal, Warszawa',
      'Kolekcja prywatna, Warszawa',
    ],
    exhibited: ['Tarasewicz — Malarstwo, Zachęta, Warszawa, 2006'],
    lotNumber: 1,
  },
  {
    id: 'lot-32',
    auctionSlug: 'kolekcja-przelomu-wiekow',
    title: 'Obiekt świetlny — Pulsacja',
    artist: 'Mirosław Bałka',
    description:
      'Instalacja świetlna wykorzystująca neonowe rurki i lustrzane powierzchnie. Bałka tworzy przestrzeń medytacyjną, w której światło i cień tworzą nieskończone odbicia.',
    medium: 'Neon, lustro, stal',
    dimensions: '80 × 120 × 30 cm',
    year: 2005,
    estimateMin: 95000,
    estimateMax: 145000,
    currentBid: null,
    images: ['/images/auctions/lot-32.jpg'],
    provenance: [
      'Galeria Foksal, Warszawa',
      'Kolekcja prywatna, Berlin',
    ],
    exhibited: ['Mirosław Bałka, White Cube, Londyn, 2009'],
    lotNumber: 2,
  },
  {
    id: 'lot-33',
    auctionSlug: 'kolekcja-przelomu-wiekow',
    title: 'Bez tytułu (z cyklu Twarze)',
    artist: 'Marlene Dumas',
    description:
      'Ekspresyjny portret akwarelowy z serii „Twarze", w której Dumas bada emocjonalną intensywność ludzkiego oblicza. Rozpuszczone kontury i nasycone kolory nadają twarzy niemal widmowy charakter.',
    medium: 'Akwarela i tusz na papierze',
    dimensions: '62 × 50 cm',
    year: 1999,
    estimateMin: 180000,
    estimateMax: 270000,
    currentBid: null,
    images: ['/images/auctions/lot-33.jpg'],
    provenance: [
      'Zeno X Gallery, Antwerpia',
      'Kolekcja prywatna, Amsterdam',
    ],
    exhibited: ['Marlene Dumas — Retrospektywa, Stedelijk Museum, Amsterdam, 2014'],
    lotNumber: 3,
  },
  {
    id: 'lot-34',
    auctionSlug: 'kolekcja-przelomu-wiekow',
    title: 'Carpathia — fragment',
    artist: 'Wilhelm Sasnal',
    description:
      'Oszczędny w formie obraz inspirowany archiwalną fotografią statku Carpathia. Sasnal redukuje obraz do podstawowych kształtów, tworząc napięcie między rozpoznawalnością a abstrakcją.',
    medium: 'Olej na płótnie',
    dimensions: '100 × 140 cm',
    year: 2003,
    estimateMin: 150000,
    estimateMax: 230000,
    currentBid: null,
    images: ['/images/auctions/lot-34.jpg'],
    provenance: [
      'Galeria Foksal, Warszawa',
      'Saatchi Gallery, Londyn',
      'Kolekcja prywatna, Warszawa',
    ],
    exhibited: ['Wilhelm Sasnal, Whitechapel Gallery, Londyn, 2011'],
    lotNumber: 4,
  },
  {
    id: 'lot-35',
    auctionSlug: 'kolekcja-przelomu-wiekow',
    title: 'Podróżnik w czasie',
    artist: 'Paweł Althamer',
    description:
      'Autoportretowa rzeźba z materiałów organicznych i syntetycznych. Althamer tworzy prowokacyjną figurę na pograniczu sztuki i życia, łącząc elementy autobiograficzne z uniwersalną refleksją.',
    medium: 'Technika mieszana: tworzywo sztuczne, włosy, tkanina',
    dimensions: '175 × 50 × 40 cm',
    year: 2008,
    estimateMin: 110000,
    estimateMax: 170000,
    currentBid: null,
    images: ['/images/auctions/lot-35.jpg'],
    provenance: [
      'Galeria Foksal, Warszawa',
      'Kolekcja prywatna, Berlin',
    ],
    exhibited: ['Paweł Althamer, New Museum, Nowy Jork, 2014'],
    lotNumber: 5,
  },
  {
    id: 'lot-36',
    auctionSlug: 'kolekcja-przelomu-wiekow',
    title: 'Pływaczka',
    artist: 'Katarzyna Kozyra',
    description:
      'Wielkoformatowa fotografia z serii badającej cielesność i kulturowe konstrukty piękna. Kozyra reinterpretuje tradycyjny motyw kąpieli w kontekście współczesnej kultury wizualnej.',
    medium: 'C-print na aluminium',
    dimensions: '120 × 180 cm',
    year: 2002,
    estimateMin: 65000,
    estimateMax: 100000,
    currentBid: null,
    images: ['/images/auctions/lot-36.jpg'],
    provenance: [
      'Galeria Żak | Branicka, Berlin',
      'Kolekcja prywatna, Warszawa',
    ],
    exhibited: ['Katarzyna Kozyra, CSW Zamek Ujazdowski, Warszawa, 2006'],
    lotNumber: 6,
  },
  {
    id: 'lot-37',
    auctionSlug: 'kolekcja-przelomu-wiekow',
    title: 'Rzeźba akustyczna — Wiatr',
    artist: 'Olafur Eliasson',
    description:
      'Kinetyczna instalacja dźwiękowa reagująca na ruch powietrza. Cienkie stalowe pręty generują subtelne dźwięki, tworząc zmienną kompozycję zależną od warunków otoczenia.',
    medium: 'Stal nierdzewna, silnik',
    dimensions: '90 × 90 × 90 cm',
    year: 2010,
    estimateMin: 200000,
    estimateMax: 300000,
    currentBid: null,
    images: ['/images/auctions/lot-37.jpg'],
    provenance: [
      'Studio Olafur Eliasson, Berlin',
      'Kolekcja prywatna, Kopenhaga',
    ],
    exhibited: ['Olafur Eliasson, Tate Modern, Londyn, 2019'],
    lotNumber: 7,
  },
  {
    id: 'lot-38',
    auctionSlug: 'kolekcja-przelomu-wiekow',
    title: 'Grafika cyfrowa — Kod genetyczny',
    artist: 'Jarosław Kozłowski',
    description:
      'Konceptualna praca łącząca wizualizację danych genetycznych z tradycją grafiki artystycznej. Kozłowski przekształca ciąg kodu DNA w złożony wzór graficzny o hipnotycznym rytmie.',
    medium: 'Druk cyfrowy na papierze bawełnianym',
    dimensions: '100 × 70 cm',
    year: 2015,
    estimateMin: 15000,
    estimateMax: 25000,
    currentBid: null,
    images: ['/images/auctions/lot-38.jpg'],
    provenance: [
      'Galeria AT, Poznań',
      'Kolekcja prywatna, Poznań',
    ],
    exhibited: ['Kozłowski — Prace na papierze, Galeria AT, Poznań, 2016'],
    lotNumber: 8,
  },
];

// ---------------------------------------------------------------------------
// Combined lots array
// ---------------------------------------------------------------------------

export const lots: Lot[] = [
  ...lotsMistrzowie,
  ...lotsRzezba,
  ...lotsFotografia,
  ...lotsPrzelom,
];

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export const teamMembers: TeamMember[] = [
  {
    name: 'Aleksandra Wiśniewska',
    role: 'Dyrektor Generalna',
    bio: 'Absolwentka historii sztuki na Uniwersytecie Jagiellońskim oraz MBA na INSEAD. Przez 15 lat kierowała działem sztuki współczesnej w jednym z największych domów aukcyjnych w Europie Środkowej. Pod jej kierownictwem Omena stała się wiodącą platformą aukcyjną w Polsce.',
    image: '/images/team/aleksandra-wisniewska.jpg',
  },
  {
    name: 'Prof. Andrzej Kowalski',
    role: 'Dyrektor Artystyczny',
    bio: 'Historyk sztuki, kurator i krytyk z ponad 25-letnim doświadczeniem. Profesor Akademii Sztuk Pięknych w Warszawie, autor licznych publikacji o polskiej sztuce współczesnej. Odpowiada za program kuratorski i strategię artystyczną Omeny.',
    image: '/images/team/andrzej-kowalski.jpg',
  },
  {
    name: 'Dr Katarzyna Nowak',
    role: 'Główna Kuratorka',
    bio: 'Doktor nauk o sztuce, specjalistka w zakresie malarstwa polskiego XX wieku. Kuratorka ponad 40 wystaw w Polsce i za granicą. W Omenie odpowiada za selekcję dzieł, wyceny oraz relacje z kolekcjonerami i galeriami.',
    image: '/images/team/katarzyna-nowak.jpg',
  },
  {
    name: 'Marek Zieliński',
    role: 'Dyrektor ds. Aukcji',
    bio: 'Licencjonowany rzeczoznawca z 18-letnim stażem w branży aukcyjnej. Prowadził ponad 200 aukcji sztuki w Polsce i Europie. Specjalizuje się w logistyce aukcji, procedurach licytacyjnych oraz obsłudze klientów VIP.',
    image: '/images/team/marek-zielinski.jpg',
  },
  {
    name: 'Joanna Kamińska',
    role: 'Dyrektor ds. Komunikacji',
    bio: 'Absolwentka dziennikarstwa i komunikacji społecznej na Uniwersytecie Warszawskim. Przez 10 lat pracowała w mediach kulturalnych, w tym jako redaktor naczelna magazynu o sztuce. Odpowiada za strategię komunikacji, relacje z mediami i obecność Omeny w przestrzeni cyfrowej.',
    image: '/images/team/joanna-kaminska.jpg',
  },
];

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const events: Event[] = [
  {
    id: 'evt-1',
    title: 'Aukcja: Współczesna Rzeźba Europejska',
    date: '2026-02-27',
    location: 'Dom Aukcyjny Omena, Warszawa',
    description:
      'Licytacja 8 wybitnych dzieł rzeźbiarskich artystów z Polski i Europy. Transmisja na żywo online z możliwością licytacji zdalnej.',
    image: '/images/events/rzezba-aukcja.jpg',
    type: 'auction',
  },
  {
    id: 'evt-2',
    title: 'Aukcja: Fotografia Artystyczna XX Wieku',
    date: '2026-04-10',
    location: 'Centrum Sztuki Współczesnej, Kraków',
    description:
      'Wyjątkowa aukcja poświęcona fotografii artystycznej. W ofercie prace mistrzów polskiej fotografii od lat 30. po współczesność.',
    image: '/images/events/fotografia-aukcja.jpg',
    type: 'auction',
  },
  {
    id: 'evt-3',
    title: 'Wystawa: Nowe Oblicza Malarstwa Polskiego',
    date: '2026-03-15',
    location: 'Galeria Omena, Warszawa',
    description:
      'Wystawa prezentująca prace młodych polskich malarzy. Wernisaż z udziałem artystów i kuratorów, wstęp wolny.',
    image: '/images/events/wystawa-malarstwo.jpg',
    type: 'exhibition',
  },
  {
    id: 'evt-4',
    title: 'Wystawa: Architektura Światła — Instalacje',
    date: '2026-06-01',
    location: 'Centrum Sztuki Współczesnej, Kraków',
    description:
      'Interaktywna wystawa instalacji świetlnych artystów z Polski, Niemiec i Danii. Ekspozycja czynna do końca sierpnia 2026.',
    image: '/images/events/wystawa-swiatlo.jpg',
    type: 'exhibition',
  },
  {
    id: 'evt-5',
    title: 'Gala Omena — Wieczór Kolekcjonerów',
    date: '2026-05-08',
    location: 'Hotel Bristol, Warszawa',
    description:
      'Coroczna gala Omeny łącząca świat sztuki i biznesu. Kolacja, pokaz wybranych dzieł z nadchodzących aukcji oraz panel dyskusyjny o rynku sztuki w Polsce.',
    image: '/images/events/gala-kolekcjonerow.jpg',
    type: 'gala',
  },
  {
    id: 'evt-6',
    title: 'Gala charytatywna: Sztuka dla Dzieci',
    date: '2026-09-20',
    location: 'Zamek Królewski, Warszawa',
    description:
      'Charytatywna gala aukcyjna, z której dochód zostanie przeznaczony na programy edukacji artystycznej dla dzieci z mniejszych miejscowości.',
    image: '/images/events/gala-charytatywna.jpg',
    type: 'gala',
  },
];

// ---------------------------------------------------------------------------
// Press
// ---------------------------------------------------------------------------

export const pressItems: PressItem[] = [
  {
    id: 'press-1',
    title: 'Rekordowa aukcja w Omenie — Beksiński za pół miliona',
    source: 'Gazeta Artystyczna',
    date: '2026-01-16',
    excerpt:
      'Dom Aukcyjny Omena zakończył aukcję „Mistrzowie Polskiego Malarstwa" z łącznym wynikiem przekraczającym 2,5 miliona złotych. Najdroższym dziełem okazał się obraz Zdzisława Beksińskiego.',
    url: '/prasa/rekordowa-aukcja-beksinski',
    image: '/images/press/beksinski-rekord.jpg',
  },
  {
    id: 'press-2',
    title: 'Omena otwiera sezon aukcji rzeźby',
    source: 'Sztuka.pl',
    date: '2026-02-20',
    excerpt:
      'Warszawski dom aukcyjny Omena zapowiada pierwszą w tym roku aukcję poświęconą wyłącznie rzeźbie europejskiej. W katalogu prace Brâncușiego, Moore\'a i Giacomettiego.',
    url: '/prasa/sezon-rzezby',
    image: '/images/press/rzezba-sezon.jpg',
  },
  {
    id: 'press-3',
    title: 'Rynek sztuki w Polsce rośnie — raport 2025',
    source: 'Rzeczpospolita Kultura',
    date: '2025-12-10',
    excerpt:
      'Według najnowszego raportu rynek aukcyjny w Polsce odnotował 18% wzrost w porównaniu z rokiem poprzednim. Omena zajmuje czołową pozycję wśród polskich domów aukcyjnych.',
    url: '/prasa/raport-rynek-sztuki-2025',
    image: '/images/press/raport-rynek.jpg',
  },
  {
    id: 'press-4',
    title: 'Wywiad: Dr Katarzyna Nowak o przyszłości kolekcjonerstwa',
    source: 'Art & Business',
    date: '2026-01-05',
    excerpt:
      'Główna kuratorka Omeny mówi o zmieniającym się profilu kolekcjonera, rosnącym zainteresowaniu fotografią artystyczną i wyzwaniach autentyfikacji dzieł w erze AI.',
    url: '/prasa/wywiad-nowak',
    image: '/images/press/wywiad-nowak.jpg',
  },
  {
    id: 'press-5',
    title: 'Młode talenty w Galerii Omena',
    source: 'Obieg',
    date: '2026-03-01',
    excerpt:
      'Galeria Omena prezentuje nowy cykl wystaw poświęconych młodym polskim artystom. Pierwsza ekspozycja skupia się na nowych tendencjach w malarstwie figuratywnym.',
    url: '/prasa/mlode-talenty',
    image: '/images/press/mlode-talenty.jpg',
  },
  {
    id: 'press-6',
    title: 'Fotografia artystyczna wraca na rynek aukcyjny',
    source: 'Magazyn Sztuki',
    date: '2026-02-15',
    excerpt:
      'Dom Aukcyjny Omena zapowiada wiosenną aukcję fotografii artystycznej XX wieku. Eksperci przewidują rosnące zainteresowanie kolekcjonerów odbitkami vintage.',
    url: '/prasa/fotografia-rynek',
    image: '/images/press/fotografia-rynek.jpg',
  },
  {
    id: 'press-7',
    title: 'Omena partnerem Biennale Sztuki Współczesnej w Wenecji',
    source: 'Dziennik Kulturalny',
    date: '2026-02-01',
    excerpt:
      'Warszawski dom aukcyjny Omena został oficjalnym partnerem polskiego pawilonu na Biennale w Wenecji 2026. Współpraca obejmuje wsparcie logistyczne i promocyjne.',
    url: '/prasa/biennale-wenecja',
    image: '/images/press/biennale-wenecja.jpg',
  },
  {
    id: 'press-8',
    title: 'Top 10 polskich domów aukcyjnych 2025',
    source: 'Forbes Polska',
    date: '2025-11-20',
    excerpt:
      'W rankingu Forbes Polska dom aukcyjny Omena zajął drugie miejsce pod względem obrotów i pierwsze w kategorii innowacyjności. Wyróżniono platformę licytacji online.',
    url: '/prasa/ranking-forbes',
    image: '/images/press/ranking-forbes.jpg',
  },
];

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const stats: Stats = {
  totalAuctions: 47,
  totalLots: 1240,
  totalArtists: 380,
  totalRaised: '12 500 000 PLN',
};
