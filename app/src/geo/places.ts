/* Geografía de España: comunidades, provincias y capitales, ríos, cordilleras y picos.
   Los nombres de provincias y ciudades van en español en todos los idiomas; comunidades, ríos,
   cordilleras y mares tienen su nombre en inglés, francés y alemán.
   Los identificadores de provincias y comunidades son los códigos del INE (los del mapa).     */
import type { Lang } from '../data/types';
import type { GeoKind } from '../engine/core';
export type { GeoKind };

type Names = string | { es: string; en?: string; fr?: string; de?: string };

export interface Ccaa { id: string; name: Names }
export interface Prov { id: string; name: string; ccaa: string; capital: string; /** ciudades grandes que no son la capital (distractores difíciles) */ big?: string[] }
export interface River { id: string; name: Names; main: boolean; ccaa: string[]; /** comunidades por las que pasa solo de refilón (no sirven de distractor) */ near?: string[];
  mouth: 'atl' | 'med' | 'guadalquivir'; cities: string[] }
export interface Mount { id: string; name: Names; main: boolean; ccaa: string[]; near?: string[]; peaks: string[] }

export const CCAA: Ccaa[] = [
  { id: '01', name: { es: 'Andalucía', en: 'Andalusia', fr: 'Andalousie', de: 'Andalusien' } },
  { id: '02', name: { es: 'Aragón', en: 'Aragon', fr: 'Aragon', de: 'Aragonien' } },
  { id: '03', name: { es: 'Asturias', fr: 'Asturies', de: 'Asturien' } },
  { id: '04', name: { es: 'Islas Baleares', en: 'Balearic Islands', fr: 'Îles Baléares', de: 'Balearen' } },
  { id: '05', name: { es: 'Canarias', en: 'Canary Islands', fr: 'Îles Canaries', de: 'Kanarische Inseln' } },
  { id: '06', name: { es: 'Cantabria', fr: 'Cantabrie', de: 'Kantabrien' } },
  { id: '07', name: { es: 'Castilla y León', en: 'Castile and León', fr: 'Castille-et-León', de: 'Kastilien und León' } },
  { id: '08', name: { es: 'Castilla-La Mancha', en: 'Castile-La Mancha', fr: 'Castille-La Manche', de: 'Kastilien-La Mancha' } },
  { id: '09', name: { es: 'Cataluña', en: 'Catalonia', fr: 'Catalogne', de: 'Katalonien' } },
  { id: '10', name: { es: 'Comunidad Valenciana', en: 'Valencian Community', fr: 'Communauté valencienne', de: 'Valencia (Region)' } },
  { id: '11', name: { es: 'Extremadura', fr: 'Estrémadure' } },
  { id: '12', name: { es: 'Galicia', fr: 'Galice', de: 'Galicien' } },
  { id: '13', name: { es: 'Comunidad de Madrid', en: 'Community of Madrid', fr: 'Communauté de Madrid', de: 'Madrid (Region)' } },
  { id: '14', name: { es: 'Región de Murcia', en: 'Region of Murcia', fr: 'Région de Murcie', de: 'Murcia (Region)' } },
  { id: '15', name: { es: 'Navarra', en: 'Navarre', fr: 'Navarre' } },
  { id: '16', name: { es: 'País Vasco', en: 'Basque Country', fr: 'Pays basque', de: 'Baskenland' } },
  { id: '17', name: 'La Rioja' },
  { id: '18', name: 'Ceuta' },
  { id: '19', name: 'Melilla' }
];

export const PROVS: Prov[] = [
  { id: '01', name: 'Álava', ccaa: '16', capital: 'vitoria', big: ['llodio'] },
  { id: '02', name: 'Albacete', ccaa: '08', capital: 'albacete', big: ['hellin', 'almansa'] },
  { id: '03', name: 'Alicante', ccaa: '10', capital: 'alicante', big: ['elche', 'benidorm', 'torrevieja'] },
  { id: '04', name: 'Almería', ccaa: '01', capital: 'almeria', big: ['el-ejido', 'roquetas'] },
  { id: '05', name: 'Ávila', ccaa: '07', capital: 'avila', big: ['arevalo'] },
  { id: '06', name: 'Badajoz', ccaa: '11', capital: 'badajoz', big: ['merida', 'don-benito'] },
  { id: '07', name: 'Islas Baleares', ccaa: '04', capital: 'palma', big: ['ibiza', 'mahon'] },
  { id: '08', name: 'Barcelona', ccaa: '09', capital: 'barcelona', big: ['sabadell', 'terrassa', 'badalona'] },
  { id: '09', name: 'Burgos', ccaa: '07', capital: 'burgos', big: ['miranda', 'aranda'] },
  { id: '10', name: 'Cáceres', ccaa: '11', capital: 'caceres', big: ['plasencia'] },
  { id: '11', name: 'Cádiz', ccaa: '01', capital: 'cadiz', big: ['jerez', 'algeciras'] },
  { id: '12', name: 'Castellón', ccaa: '10', capital: 'castellon', big: ['vila-real'] },
  { id: '13', name: 'Ciudad Real', ccaa: '08', capital: 'ciudad-real', big: ['puertollano', 'tomelloso'] },
  { id: '14', name: 'Córdoba', ccaa: '01', capital: 'cordoba', big: ['lucena'] },
  { id: '15', name: 'A Coruña', ccaa: '12', capital: 'a-coruna', big: ['santiago', 'ferrol'] },
  { id: '16', name: 'Cuenca', ccaa: '08', capital: 'cuenca', big: ['tarancon'] },
  { id: '17', name: 'Girona', ccaa: '09', capital: 'girona', big: ['figueres'] },
  { id: '18', name: 'Granada', ccaa: '01', capital: 'granada', big: ['motril'] },
  { id: '19', name: 'Guadalajara', ccaa: '08', capital: 'guadalajara', big: ['azuqueca'] },
  { id: '20', name: 'Gipuzkoa', ccaa: '16', capital: 'san-sebastian', big: ['irun', 'eibar'] },
  { id: '21', name: 'Huelva', ccaa: '01', capital: 'huelva', big: ['lepe'] },
  { id: '22', name: 'Huesca', ccaa: '02', capital: 'huesca', big: ['monzon', 'jaca'] },
  { id: '23', name: 'Jaén', ccaa: '01', capital: 'jaen', big: ['linares', 'ubeda'] },
  { id: '24', name: 'León', ccaa: '07', capital: 'leon', big: ['ponferrada', 'astorga'] },
  { id: '25', name: 'Lleida', ccaa: '09', capital: 'lleida', big: ['tarrega'] },
  { id: '26', name: 'La Rioja', ccaa: '17', capital: 'logrono', big: ['calahorra'] },
  { id: '27', name: 'Lugo', ccaa: '12', capital: 'lugo', big: ['monforte'] },
  { id: '28', name: 'Madrid', ccaa: '13', capital: 'madrid', big: ['alcala', 'mostoles'] },
  { id: '29', name: 'Málaga', ccaa: '01', capital: 'malaga', big: ['marbella', 'ronda'] },
  { id: '30', name: 'Murcia', ccaa: '14', capital: 'murcia', big: ['cartagena', 'lorca'] },
  { id: '31', name: 'Navarra', ccaa: '15', capital: 'pamplona', big: ['tudela'] },
  { id: '32', name: 'Ourense', ccaa: '12', capital: 'ourense', big: ['verin'] },
  { id: '33', name: 'Asturias', ccaa: '03', capital: 'oviedo', big: ['gijon', 'aviles'] },
  { id: '34', name: 'Palencia', ccaa: '07', capital: 'palencia', big: ['aguilar'] },
  { id: '35', name: 'Las Palmas', ccaa: '05', capital: 'las-palmas', big: ['telde', 'arrecife'] },
  { id: '36', name: 'Pontevedra', ccaa: '12', capital: 'pontevedra', big: ['vigo'] },
  { id: '37', name: 'Salamanca', ccaa: '07', capital: 'salamanca', big: ['bejar'] },
  { id: '38', name: 'Santa Cruz de Tenerife', ccaa: '05', capital: 'santa-cruz', big: ['la-laguna'] },
  { id: '39', name: 'Cantabria', ccaa: '06', capital: 'santander', big: ['torrelavega'] },
  { id: '40', name: 'Segovia', ccaa: '07', capital: 'segovia', big: ['cuellar'] },
  { id: '41', name: 'Sevilla', ccaa: '01', capital: 'sevilla', big: ['dos-hermanas', 'ecija'] },
  { id: '42', name: 'Soria', ccaa: '07', capital: 'soria', big: ['almazan'] },
  { id: '43', name: 'Tarragona', ccaa: '09', capital: 'tarragona', big: ['reus', 'tortosa'] },
  { id: '44', name: 'Teruel', ccaa: '02', capital: 'teruel', big: ['alcaniz'] },
  { id: '45', name: 'Toledo', ccaa: '08', capital: 'toledo', big: ['talavera'] },
  { id: '46', name: 'Valencia', ccaa: '10', capital: 'valencia', big: ['gandia', 'alzira'] },
  { id: '47', name: 'Valladolid', ccaa: '07', capital: 'valladolid', big: ['medina'] },
  { id: '48', name: 'Bizkaia', ccaa: '16', capital: 'bilbao', big: ['getxo', 'barakaldo'] },
  { id: '49', name: 'Zamora', ccaa: '07', capital: 'zamora', big: ['benavente'] },
  { id: '50', name: 'Zaragoza', ccaa: '02', capital: 'zaragoza', big: ['calatayud'] },
  { id: '51', name: 'Ceuta', ccaa: '18', capital: 'ceuta' },
  { id: '52', name: 'Melilla', ccaa: '19', capital: 'melilla' }
];

/** Nombres de las ciudades (capitales y otras) */
export const CITY_NAMES: Record<string, string> = {
  'a-coruna': 'A Coruña', lugo: 'Lugo', ourense: 'Ourense', pontevedra: 'Pontevedra', oviedo: 'Oviedo', santander: 'Santander', bilbao: 'Bilbao',
  'san-sebastian': 'San Sebastián', vitoria: 'Vitoria', pamplona: 'Pamplona', logrono: 'Logroño', huesca: 'Huesca', zaragoza: 'Zaragoza', teruel: 'Teruel',
  lleida: 'Lleida', girona: 'Girona', barcelona: 'Barcelona', tarragona: 'Tarragona', castellon: 'Castellón de la Plana', valencia: 'Valencia', alicante: 'Alicante',
  murcia: 'Murcia', albacete: 'Albacete', cuenca: 'Cuenca', guadalajara: 'Guadalajara', toledo: 'Toledo', 'ciudad-real': 'Ciudad Real', madrid: 'Madrid',
  leon: 'León', palencia: 'Palencia', burgos: 'Burgos', soria: 'Soria', segovia: 'Segovia', avila: 'Ávila', salamanca: 'Salamanca', zamora: 'Zamora',
  valladolid: 'Valladolid', caceres: 'Cáceres', badajoz: 'Badajoz', huelva: 'Huelva', sevilla: 'Sevilla', cadiz: 'Cádiz', cordoba: 'Córdoba', jaen: 'Jaén',
  granada: 'Granada', malaga: 'Málaga', almeria: 'Almería', palma: 'Palma', 'las-palmas': 'Las Palmas de Gran Canaria', 'santa-cruz': 'Santa Cruz de Tenerife',
  ceuta: 'Ceuta', melilla: 'Melilla',
  llodio: 'Llodio', hellin: 'Hellín', almansa: 'Almansa', elche: 'Elche', benidorm: 'Benidorm', torrevieja: 'Torrevieja', 'el-ejido': 'El Ejido',
  roquetas: 'Roquetas de Mar', arevalo: 'Arévalo', merida: 'Mérida', 'don-benito': 'Don Benito', ibiza: 'Ibiza', mahon: 'Mahón', sabadell: 'Sabadell',
  terrassa: 'Terrassa', badalona: 'Badalona', miranda: 'Miranda de Ebro', aranda: 'Aranda de Duero', plasencia: 'Plasencia', jerez: 'Jerez de la Frontera',
  algeciras: 'Algeciras', 'vila-real': 'Vila-real', puertollano: 'Puertollano', tomelloso: 'Tomelloso', lucena: 'Lucena', santiago: 'Santiago de Compostela',
  ferrol: 'Ferrol', tarancon: 'Tarancón', figueres: 'Figueres', motril: 'Motril', azuqueca: 'Azuqueca de Henares', irun: 'Irun', eibar: 'Eibar', lepe: 'Lepe',
  monzon: 'Monzón', jaca: 'Jaca', linares: 'Linares', ubeda: 'Úbeda', ponferrada: 'Ponferrada', astorga: 'Astorga', tarrega: 'Tàrrega', calahorra: 'Calahorra',
  monforte: 'Monforte de Lemos', alcala: 'Alcalá de Henares', mostoles: 'Móstoles', marbella: 'Marbella', ronda: 'Ronda', cartagena: 'Cartagena', lorca: 'Lorca',
  tudela: 'Tudela', verin: 'Verín', gijon: 'Gijón', aviles: 'Avilés', aguilar: 'Aguilar de Campoo', telde: 'Telde', arrecife: 'Arrecife', vigo: 'Vigo',
  bejar: 'Béjar', 'la-laguna': 'San Cristóbal de La Laguna', torrelavega: 'Torrelavega', cuellar: 'Cuéllar', 'dos-hermanas': 'Dos Hermanas', ecija: 'Écija',
  almazan: 'Almazán', reus: 'Reus', tortosa: 'Tortosa', alcaniz: 'Alcañiz', talavera: 'Talavera de la Reina', gandia: 'Gandia', alzira: 'Alzira',
  medina: 'Medina del Campo', getxo: 'Getxo', barakaldo: 'Barakaldo', benavente: 'Benavente', calatayud: 'Calatayud',
  aranjuez: 'Aranjuez', tordesillas: 'Tordesillas', orihuela: 'Orihuela', loja: 'Loja', tui: 'Tui', andujar: 'Andújar'
};

export const RIVERS: River[] = [
  { id: 'ebro', name: 'Ebro', main: true, ccaa: ['06', '07', '17', '15', '02', '09'], near: ['16'], mouth: 'med', cities: ['logrono', 'tudela', 'zaragoza', 'tortosa'] },
  { id: 'duero', name: { es: 'Duero', en: 'Douro', fr: 'Douro', de: 'Duero' }, main: true, ccaa: ['07'], mouth: 'atl', cities: ['soria', 'aranda', 'tordesillas', 'zamora'] },
  { id: 'tajo', name: { es: 'Tajo', en: 'Tagus', fr: 'Tage', de: 'Tajo' }, main: true, ccaa: ['02', '08', '13', '11'], mouth: 'atl', cities: ['aranjuez', 'toledo', 'talavera'] },
  { id: 'guadiana', name: 'Guadiana', main: true, ccaa: ['08', '11', '01'], mouth: 'atl', cities: ['merida', 'badajoz'] },
  { id: 'guadalquivir', name: 'Guadalquivir', main: true, ccaa: ['01'], mouth: 'atl', cities: ['andujar', 'cordoba', 'sevilla'] },
  { id: 'mino', name: { es: 'Miño', en: 'Minho', fr: 'Minho', de: 'Miño' }, main: false, ccaa: ['12'], mouth: 'atl', cities: ['lugo', 'ourense', 'tui'] },
  { id: 'jucar', name: 'Júcar', main: false, ccaa: ['08', '10'], mouth: 'med', cities: ['cuenca', 'alzira'] },
  { id: 'segura', name: 'Segura', main: false, ccaa: ['01', '08', '14', '10'], mouth: 'med', cities: ['murcia', 'orihuela'] },
  { id: 'turia', name: 'Turia', main: false, ccaa: ['02', '10'], near: ['08'], mouth: 'med', cities: ['teruel', 'valencia'] },
  { id: 'genil', name: 'Genil', main: false, ccaa: ['01'], mouth: 'guadalquivir', cities: ['granada', 'loja', 'ecija'] }
];

export const MOUNTS: Mount[] = [
  { id: 'pirineos', name: { es: 'Pirineos', en: 'Pyrenees', fr: 'Pyrénées', de: 'Pyrenäen' }, main: true, ccaa: ['15', '02', '09'], near: ['16'], peaks: ['aneto', 'perdido'] },
  { id: 'cantabrica', name: { es: 'Cordillera Cantábrica', en: 'Cantabrian Mountains', fr: 'Cordillère Cantabrique', de: 'Kantabrisches Gebirge' }, main: true,
    ccaa: ['03', '06', '07'], near: ['12', '16'], peaks: ['cerredo'] },
  { id: 'iberico', name: { es: 'Sistema Ibérico', en: 'Iberian System', fr: 'Système ibérique', de: 'Iberisches Randgebirge' }, main: true,
    ccaa: ['07', '17', '02', '08', '10'], near: ['15', '09'], peaks: ['moncayo', 'urbion'] },
  { id: 'central', name: { es: 'Sistema Central', en: 'Central System', fr: 'Système central', de: 'Kastilisches Scheidegebirge' }, main: true,
    ccaa: ['07', '13', '11'], near: ['08'], peaks: ['almanzor', 'penalara'] },
  { id: 'morena', name: 'Sierra Morena', main: true, ccaa: ['01', '08', '11'], peaks: ['banuela'] },
  { id: 'beticas', name: { es: 'Cordilleras Béticas', en: 'Baetic System', fr: 'Cordillères Bétiques', de: 'Betische Kordillere' }, main: true,
    ccaa: ['01', '14', '10'], near: ['08'], peaks: ['mulhacen', 'veleta'] },
  { id: 'galaico', name: { es: 'Macizo Galaico-Leonés', en: 'Galician-Leonese Massif', fr: 'Massif galicien-léonais', de: 'Galicisch-Leonesisches Bergland' }, main: false,
    ccaa: ['12', '07'], peaks: ['trevinca'] },
  { id: 'vascos', name: { es: 'Montes Vascos', en: 'Basque Mountains', fr: 'Montagnes basques', de: 'Baskische Berge' }, main: false, ccaa: ['16'], near: ['15'], peaks: ['gorbea'] },
  { id: 'toledo', name: { es: 'Montes de Toledo', en: 'Toledo Mountains', fr: 'Monts de Tolède', de: 'Montes de Toledo' }, main: false, ccaa: ['08', '11'], peaks: ['rocigalgo'] },
  { id: 'costero', name: { es: 'Cordillera Costero-Catalana', en: 'Catalan Coastal Range', fr: 'Chaîne côtière catalane', de: 'Katalanisches Küstengebirge' }, main: false,
    ccaa: ['09'], peaks: ['turo'] },
  { id: 'tramuntana', name: { es: 'Sierra de Tramuntana', en: 'Serra de Tramuntana', fr: 'Serra de Tramuntana', de: 'Serra de Tramuntana' }, main: false,
    ccaa: ['04'], peaks: ['puigmajor'] },
  { id: 'teide', name: { es: 'Teide', en: 'Mount Teide', fr: 'Teide', de: 'Teide' }, main: false, ccaa: ['05'], peaks: ['teide'] }
];

export const PEAK_NAMES: Record<string, string> = {
  aneto: 'Aneto', perdido: 'Monte Perdido', mulhacen: 'Mulhacén', veleta: 'Veleta', almanzor: 'Almanzor', moncayo: 'Moncayo', cerredo: 'Torre Cerredo',
  penalara: 'Peñalara', teide: 'Teide', puigmajor: 'Puig Major', turo: "Turó de l'Home", banuela: 'Bañuela', rocigalgo: 'Rocigalgo', gorbea: 'Gorbea',
  trevinca: 'Peña Trevinca', urbion: 'Pico de Urbión'
};
export const SEA_NAMES: Record<string, Names> = {
  atl: { es: 'Océano Atlántico', en: 'Atlantic Ocean', fr: 'Océan Atlantique', de: 'Atlantik' },
  med: { es: 'Mar Mediterráneo', en: 'Mediterranean Sea', fr: 'Mer Méditerranée', de: 'Mittelmeer' },
  cant: { es: 'Mar Cantábrico', en: 'Cantabrian Sea', fr: 'Mer Cantabrique', de: 'Kantabrisches Meer' }
};

export const CCAA_BY_ID = Object.fromEntries(CCAA.map(c => [c.id, c]));
export const PROV_BY_ID = Object.fromEntries(PROVS.map(p => [p.id, p]));
export const RIVER_BY_ID = Object.fromEntries(RIVERS.map(r => [r.id, r]));
export const MOUNT_BY_ID = Object.fromEntries(MOUNTS.map(m => [m.id, m]));
export const provsOf = (ccaa: string) => PROVS.filter(p => p.ccaa === ccaa);

const named = (n: Names | undefined, lang: Lang) => n === undefined ? undefined : typeof n === 'string' ? n : n[lang] ?? n.es;
/** Nombre que ve el niño */
export function geoName(t: GeoKind, id: string, lang: Lang): string {
  switch (t) {
    case 'ccaa': return named(CCAA_BY_ID[id]?.name, lang) ?? id;
    case 'prov': return PROV_BY_ID[id]?.name ?? id;
    case 'city': return CITY_NAMES[id] ?? id;
    case 'river': return named(RIVER_BY_ID[id]?.name, lang) ?? id;
    case 'mount': return named(MOUNT_BY_ID[id]?.name, lang) ?? id;
    case 'peak': return PEAK_NAMES[id] ?? id;
    case 'sea': return named(SEA_NAMES[id], lang) ?? (id === 'guadalquivir' ? named(RIVER_BY_ID.guadalquivir.name, lang)! : id);
  }
}
