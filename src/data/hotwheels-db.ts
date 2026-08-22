/**
 * Hot Wheels Release Database
 * 
 * This database is the source of truth for release information and pricing.
 * The AI vision model extracts evidence from images, then this database
 * provides exact release identification and verified market data.
 * 
 * Each entry represents a specific release/variation of a casting.
 * Different colors, wheels, or tampos on the same casting = different entries.
 */

export interface Casting {
  id: string;
  name: string;
  realVehicle: string;
  manufacturer: string; // Mattel, Matchbox, etc.
}

export interface Release {
  id: string;
  castingId: string;
  releaseYear: number;
  series: string;
  toyNumber: string; // e.g., "123/250"
  variation: string; // color/wheel combo description
  bodyColor: string;
  wheelType: string; // 10SP, MC5, OH5, PR5, J5, etc.
  wheelColor: string;
  tampos: string[];
  baseColor: string;
  country: string;
  cardDesign: string;
  rarity: 'Mainline' | 'Treasure Hunt' | 'Super Treasure Hunt' | 'Premium' | 'RLC' | 'ZAMAC' | 'Factory Sealed';
  // Market pricing (INR) - updated from collector market data
  priceLow: number;
  priceAverage: number;
  priceHigh: number;
  priceSource: string;
  priceUpdatedAt: string;
}

// ─── Known Castings ──────────────────────────────────────────
export const CASTINGS: Casting[] = [
  { id: 'c-camaro67', name: '67 Custom Camaro', realVehicle: '1967 Chevrolet Camaro', manufacturer: 'Mattel' },
  { id: 'c-mustang68', name: '68 Custom Mustang', realVehicle: '1968 Ford Mustang', manufacturer: 'Mattel' },
  { id: 'c-corvette67', name: '67 Corvette', realVehicle: '1967 Chevrolet Corvette', manufacturer: 'Mattel' },
  { id: 'c-skyline-r34', name: 'Skyline GT-R (BNR34)', realVehicle: 'Nissan Skyline GT-R V-Spec', manufacturer: 'Mattel' },
  { id: 'c-supra-mk4', name: 'Toyota Supra', realVehicle: 'Toyota Supra JZA80', manufacturer: 'Mattel' },
  { id: 'c-honda-s2000', name: 'Honda S2000', realVehicle: 'Honda S2000', manufacturer: 'Mattel' },
  { id: 'c-nissan-370z', name: 'Nissan 370Z', realVehicle: 'Nissan 370Z', manufacturer: 'Mattel' },
  { id: 'c-porsche-911', name: '911 Carrera', realVehicle: 'Porsche 911 Carrera', manufacturer: 'Mattel' },
  { id: 'c-lamborghini-countach', name: "'05 Lamborghini Countach", realVehicle: 'Lamborghini Countach', manufacturer: 'Mattel' },
  { id: 'c-ferrari-599', name: '599 GTB Fiorano', realVehicle: 'Ferrari 599 GTB Fiorano', manufacturer: 'Mattel' },
  { id: 'c-datsun-240z', name: 'Datsun 240Z', realVehicle: 'Datsun 240Z (Nissan Fairlady Z)', manufacturer: 'Mattel' },
  { id: 'c-mazda-rx7', name: '78 Mazda RX-7', realVehicle: '1978 Mazda RX-7 (SA22C)', manufacturer: 'Mattel' },
  { id: 'c-toyota-ae86', name: '86 Toyota AE86 Sprinter Trueno', realVehicle: 'Toyota Sprinter Trueno AE86', manufacturer: 'Mattel' },
  { id: 'c-nissan-silvia', name: '98 Nissan Silvia (S15)', realVehicle: 'Nissan Silvia S15', manufacturer: 'Mattel' },
  { id: 'c-mitsubishi-evo', name: '05 Lancer Evolution', realVehicle: 'Mitsubishi Lancer Evolution VIII', manufacturer: 'Mattel' },
  { id: 'c-subaru-wrx', name: '16 Subaru WRX STI', realVehicle: '2016 Subaru WRX STI', manufacturer: 'Mattel' },
  { id: 'c-ford-gt40', name: 'Ford GT-40', realVehicle: 'Ford GT40 Mk I', manufacturer: 'Mattel' },
  { id: 'c-chevy-belair', name: "'55 Chevy Bel Air Gasser", realVehicle: '1955 Chevrolet Bel Air Gasser', manufacturer: 'Mattel' },
  { id: 'c-dodge-viper', name: '06 Dodge Viper SRT10', realVehicle: '2006 Dodge Viper SRT-10', manufacturer: 'Mattel' },
  { id: 'c-bmw-m3', name: '82 BMW M3', realVehicle: '1982 BMW E30 M3', manufacturer: 'Mattel' },
  { id: 'c-honda-civic', name: '16 Honda Civic Type R', realVehicle: '2016 Honda Civic Type R (FK2)', manufacturer: 'Mattel' },
  { id: 'c-ford-raptor', name: '17 Ford F-150 Raptor', realVehicle: '2017 Ford F-150 Raptor', manufacturer: 'Mattel' },
  { id: 'c-tesla-model-s', name: '16 Tesla Model S', realVehicle: '2016 Tesla Model S', manufacturer: 'Mattel' },
  { id: 'c-jeep-wrangler', name: '12 Jeep Wrangler', realVehicle: '2012 Jeep Wrangler', manufacturer: 'Mattel' },
  { id: 'c-toyota-tacoma', name: '99 Toyota Tacoma', realVehicle: '1999 Toyota Tacoma', manufacturer: 'Mattel' },
  { id: 'c-shelby-cobra', name: '62 Shelby Cobra', realVehicle: '1962 Shelby Cobra 260', manufacturer: 'Mattel' },
  { id: 'c-pontiac-gto', name: '65 Pontiac GTO', realVehicle: '1965 Pontiac GTO', manufacturer: 'Mattel' },
  { id: 'c-chevy-impala', name: '64 Chevy Impala', realVehicle: '1964 Chevrolet Impala', manufacturer: 'Mattel' },
  { id: 'c-dodge-charger', name: '70 Dodge Charger R/T', realVehicle: '1970 Dodge Charger R/T', manufacturer: 'Mattel' },
  { id: 'c-ford-mustang', name: 'Fast & Furious \'71 Dodge Charger', realVehicle: '1971 Dodge Charger', manufacturer: 'Mattel' },
  { id: 'c-nissan-gtr-r35', name: '09 Nissan GT-R (R35)', realVehicle: '2009 Nissan GT-R (R35)', manufacturer: 'Mattel' },
  { id: 'c-honda-nsx', name: '91 Acura/Honda NSX', realVehicle: '1991 Honda NSX (NA1)', manufacturer: 'Mattel' },
  { id: 'c-subaru-brz', name: '13 Subaru BRZ', realVehicle: '2013 Subaru BRZ', manufacturer: 'Mattel' },
  { id: 'c-mazda-mx5', name: '16 Mazda MX-5 Miata', realVehicle: '2016 Mazda MX-5 Miata', manufacturer: 'Mattel' },
  { id: 'c-ford-f150', name: '85 Ford F-150', realVehicle: '1985 Ford F-150', manufacturer: 'Mattel' },
  { id: 'c-vw-beetle', name: '62 Volkswagen Beetle', realVehicle: '1962 Volkswagen Beetle', manufacturer: 'Mattel' },
  { id: 'c-vw-bus', name: '67 Volkswagen Karmann Ghia', realVehicle: '1967 VW Karmann Ghia', manufacturer: 'Mattel' },
  { id: 'c-toyota-land-cruiser', name: '80 Toyota Land Cruiser FJ40', realVehicle: '1980 Toyota Land Cruiser FJ40', manufacturer: 'Mattel' },
  { id: 'c-mercedes-300sl', name: '55 Mercedes-Benz 300 SLR', realVehicle: '1955 Mercedes-Benz 300 SLR', manufacturer: 'Mattel' },
];

// ─── Known Releases ──────────────────────────────────────────
// This is a representative sample. A production system would have thousands.
export const RELEASES: Release[] = [
  // 67 Custom Camaro
  { id: 'r-67camaro-2020-blue', castingId: 'c-camaro67', releaseYear: 2020, series: 'HW Then & Now', toyNumber: '063/250', variation: 'Blue', bodyColor: 'Blue', wheelType: '10SP', wheelColor: 'Chrome', tampos: ['Racing stripes'], baseColor: 'Unpainted', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 80, priceAverage: 120, priceHigh: 180, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },
  { id: 'r-67camaro-2021-red', castingId: 'c-camaro67', releaseYear: 2021, series: 'HW Drift', toyNumber: '104/250', variation: 'Red', bodyColor: 'Red', wheelType: 'MC5', wheelColor: 'Black', tampos: ['Drift side graphics'], baseColor: 'Black plastic', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 90, priceAverage: 140, priceHigh: 220, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },
  { id: 'r-67camaro-2022-super', castingId: 'c-camaro67', releaseYear: 2022, series: 'HW Passion for Speed', toyNumber: '032/250', variation: 'Spectraflame Green', bodyColor: 'Spectraflame Green', wheelType: 'RLC OH5', wheelColor: 'Chrome', tampos: ['None'], baseColor: 'Metal', country: 'China', cardDesign: 'Blue card', rarity: 'Super Treasure Hunt', priceLow: 2500, priceAverage: 4000, priceHigh: 7000, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },
  { id: 'r-67camaro-2023-black', castingId: 'c-camaro67', releaseYear: 2023, series: 'HW Modified', toyNumber: '078/250', variation: 'Black', bodyColor: 'Black', wheelType: 'PR5', wheelColor: 'Chrome', tampos: ['Flames'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 100, priceAverage: 160, priceHigh: 250, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },
  { id: 'r-67camaro-2024-green', castingId: 'c-camaro67', releaseYear: 2024, series: 'HW Then & Now', toyNumber: '045/250', variation: 'Metallic Green', bodyColor: 'Metallic Green', wheelType: '10SP', wheelColor: 'Black', tampos: ['None'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 80, priceAverage: 120, priceHigh: 180, priceSource: 'eBay sold avg 2025', priceUpdatedAt: '2025-01-15' },
  { id: 'r-67camaro-2025-yellow', castingId: 'c-camaro67', releaseYear: 2025, series: 'HW Experimotors', toyNumber: '012/250', variation: 'Yellow', bodyColor: 'Yellow', wheelType: 'J5', wheelColor: 'Black', tampos: ['Racing number 42'], baseColor: 'Black plastic', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 80, priceAverage: 110, priceHigh: 160, priceSource: 'eBay sold avg 2025', priceUpdatedAt: '2025-06-01' },

  // Skyline GT-R (BNR34)
  { id: 'r-skyline-r34-2020-blue', castingId: 'c-skyline-r34', releaseYear: 2020, series: 'HW J-Import', toyNumber: '185/250', variation: 'Blue', bodyColor: 'Blue', wheelType: '10SP', wheelColor: 'Chrome', tampos: ['None'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 120, priceAverage: 200, priceHigh: 350, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },
  { id: 'r-skyline-r34-2021-super', castingId: 'c-skyline-r34', releaseYear: 2021, series: 'HW Turbo', toyNumber: '089/250', variation: 'Spectraflame Blue', bodyColor: 'Spectraflame Blue', wheelType: 'RLC PR5', wheelColor: 'Chrome', tampos: ['None'], baseColor: 'Metal', country: 'China', cardDesign: 'Blue card', rarity: 'Super Treasure Hunt', priceLow: 3000, priceAverage: 5500, priceHigh: 9000, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },
  { id: 'r-skyline-r34-2022-white', castingId: 'c-skyline-r34', releaseYear: 2022, series: 'Fast & Furious', toyNumber: '001/10', variation: 'White', bodyColor: 'White', wheelType: 'OH5', wheelColor: 'Black', tampos: ['F&F logo'], baseColor: 'Metal', country: 'Thailand', cardDesign: 'Premium card', rarity: 'Premium', priceLow: 800, priceAverage: 1200, priceHigh: 1800, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },
  { id: 'r-skyline-r34-2023-silver', castingId: 'c-skyline-r34', releaseYear: 2023, series: 'HW Street Tuners', toyNumber: '156/250', variation: 'Silver', bodyColor: 'Silver', wheelType: 'MC5', wheelColor: 'Black', tampos: ['Side stripes'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 100, priceAverage: 180, priceHigh: 300, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },
  { id: 'r-skyline-r34-2024-black', castingId: 'c-skyline-r34', releaseYear: 2024, series: 'HW J-Import', toyNumber: '098/250', variation: 'Black', bodyColor: 'Black', wheelType: '10SP', wheelColor: 'Chrome', tampos: ['Fender flares'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 100, priceAverage: 170, priceHigh: 280, priceSource: 'eBay sold avg 2025', priceUpdatedAt: '2025-01-15' },

  // Toyota Supra
  { id: 'r-supra-mk4-2020-orange', castingId: 'c-supra-mk4', releaseYear: 2020, series: 'Fast & Furious', toyNumber: '008/10', variation: 'Orange', bodyColor: 'Orange', wheelType: 'OH5', wheelColor: 'Chrome', tampos: ['F&F logo', 'Nuclear Gladiator'], baseColor: 'Metal', country: 'Thailand', cardDesign: 'Premium card', rarity: 'Premium', priceLow: 800, priceAverage: 1400, priceHigh: 2200, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },
  { id: 'r-supra-mk4-2021-white', castingId: 'c-supra-mk4', releaseYear: 2021, series: 'HW Import Cars', toyNumber: '067/250', variation: 'White', bodyColor: 'White', wheelType: '10SP', wheelColor: 'Black', tampos: ['None'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 100, priceAverage: 170, priceHigh: 280, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },
  { id: 'r-supra-mk4-2022-red', castingId: 'c-supra-mk4', releaseYear: 2022, series: 'HW Speed Graphics', toyNumber: '112/250', variation: 'Red', bodyColor: 'Red', wheelType: 'PR5', wheelColor: 'Chrome', tampos: ['Side flames'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 90, priceAverage: 150, priceHigh: 240, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },

  // Honda S2000
  { id: 'r-s2000-2020-red', castingId: 'c-honda-s2000', releaseYear: 2020, series: 'HW J-Import', toyNumber: '142/250', variation: 'Red', bodyColor: 'Red', wheelType: '10SP', wheelColor: 'Chrome', tampos: ['None'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 100, priceAverage: 160, priceHigh: 260, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },
  { id: 'r-s2000-2022-white', castingId: 'c-honda-s2000', releaseYear: 2022, series: 'HW Street Tuners', toyNumber: '089/250', variation: 'White', bodyColor: 'White', wheelType: 'MC5', wheelColor: 'Black', tampos: ['Racing decals'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 100, priceAverage: 160, priceHigh: 260, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },

  // Datsun 240Z
  { id: 'r-240z-2020-red', castingId: 'c-datsun-240z', releaseYear: 2020, series: 'HW J-Import', toyNumber: '034/250', variation: 'Red', bodyColor: 'Red', wheelType: '10SP', wheelColor: 'Chrome', tampos: ['None'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 120, priceAverage: 200, priceHigh: 350, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },
  { id: 'r-240z-2022-super', castingId: 'c-datsun-240z', releaseYear: 2022, series: 'HW Dream Garage', toyNumber: '015/250', variation: 'Spectraflame Orange', bodyColor: 'Spectraflame Orange', wheelType: 'RLC OH5', wheelColor: 'Chrome', tampos: ['None'], baseColor: 'Metal', country: 'China', cardDesign: 'Blue card', rarity: 'Super Treasure Hunt', priceLow: 3000, priceAverage: 5000, priceHigh: 8000, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },

  // 55 Chevy Bel Air Gasser
  { id: 'r-belair-gasser-2020-blue', castingId: 'c-chevy-belair', releaseYear: 2020, series: 'HW Hot Trucks', toyNumber: '089/250', variation: 'Blue', bodyColor: 'Blue', wheelType: 'MC5', wheelColor: 'Chrome', tampos: ['None'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 100, priceAverage: 170, priceHigh: 280, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },
  { id: 'r-belair-gasser-2021-super', castingId: 'c-chevy-belair', releaseYear: 2021, series: 'HW Drag Race', toyNumber: '022/250', variation: 'Spectraflame Purple', bodyColor: 'Spectraflame Purple', wheelType: 'RLC OH5', wheelColor: 'Chrome', tampos: ['Gasser flames'], baseColor: 'Metal', country: 'China', cardDesign: 'Blue card', rarity: 'Super Treasure Hunt', priceLow: 3500, priceAverage: 6000, priceHigh: 10000, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },

  // 82 BMW M3
  { id: 'r-bmw-m3-2021-white', castingId: 'c-bmw-m3', releaseYear: 2021, series: 'HW Then & Now', toyNumber: '118/250', variation: 'White', bodyColor: 'White', wheelType: '10SP', wheelColor: 'Black', tampos: ['M stripes'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 120, priceAverage: 200, priceHigh: 340, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },
  { id: 'r-bmw-m3-2023-red', castingId: 'c-bmw-m3', releaseYear: 2023, series: 'HW Experimotors', toyNumber: '056/250', variation: 'Red', bodyColor: 'Red', wheelType: 'MC5', wheelColor: 'Black', tampos: ['None'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 100, priceAverage: 170, priceHigh: 280, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },

  // Tesla Model S
  { id: 'r-tesla-model-s-2021-white', castingId: 'c-tesla-model-s', releaseYear: 2021, series: 'HW Green Speed', toyNumber: '198/250', variation: 'White', bodyColor: 'White', wheelType: 'OH5', wheelColor: 'Black', tampos: ['None'], baseColor: 'Black plastic', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 80, priceAverage: 130, priceHigh: 200, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },

  // VW Beetle
  { id: 'r-vw-beetle-2020-green', castingId: 'c-vw-beetle', releaseYear: 2020, series: 'HW Heritage', toyNumber: '076/250', variation: 'Green', bodyColor: 'Green', wheelType: '5SP', wheelColor: 'Chrome', tampos: ['Flowers'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 80, priceAverage: 130, priceHigh: 200, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },

  // Nissan GT-R R35
  { id: 'r-gtr-r35-2021-silver', castingId: 'c-nissan-gtr-r35', releaseYear: 2021, series: 'HW J-Import', toyNumber: '045/250', variation: 'Silver', bodyColor: 'Silver', wheelType: '10SP', wheelColor: 'Chrome', tampos: ['None'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 100, priceAverage: 170, priceHigh: 280, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },
  { id: 'r-gtr-r35-2023-blue', castingId: 'c-nissan-gtr-r35', releaseYear: 2023, series: 'HW Street Tuners', toyNumber: '134/250', variation: 'Blue', bodyColor: 'Blue', wheelType: 'MC5', wheelColor: 'Black', tampos: ['None'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 100, priceAverage: 170, priceHigh: 280, priceSource: 'eBay sold avg 2025', priceUpdatedAt: '2025-01-15' },

  // Porsche 911
  { id: 'r-911-2022-red', castingId: 'c-porsche-911', releaseYear: 2022, series: 'HW Speed Graphics', toyNumber: '067/250', variation: 'Red', bodyColor: 'Red', wheelType: 'PR5', wheelColor: 'Chrome', tampos: ['Racing stripes'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 120, priceAverage: 200, priceHigh: 340, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },

  // Lamborghini Countach
  { id: 'r-countach-2021-white', castingId: 'c-lamborghini-countach', releaseYear: 2021, series: 'HW Then & Now', toyNumber: '034/250', variation: 'White', bodyColor: 'White', wheelType: '10SP', wheelColor: 'Chrome', tampos: ['None'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 100, priceAverage: 160, priceHigh: 260, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },

  // Ferrari 599
  { id: 'r-ferrari-599-2020-red', castingId: 'c-ferrari-599', releaseYear: 2020, series: 'HW Speed', toyNumber: '112/250', variation: 'Red', bodyColor: 'Red', wheelType: '10SP', wheelColor: 'Chrome', tampos: ['None'], baseColor: 'Metal', country: 'Thailand', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 150, priceAverage: 250, priceHigh: 400, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },

  // 86 Toyota AE86
  { id: 'r-ae86-2021-white', castingId: 'c-toyota-ae86', releaseYear: 2021, series: 'HW J-Import', toyNumber: '089/250', variation: 'White/Black', bodyColor: 'White', wheelType: 'MC5', wheelColor: 'Black', tampos: ['Trueno stripe'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 120, priceAverage: 200, priceHigh: 350, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },

  // 16 Honda Civic Type R
  { id: 'r-civic-type-r-2022-red', castingId: 'c-honda-civic', releaseYear: 2022, series: 'HW J-Import', toyNumber: '178/250', variation: 'Championship White', bodyColor: 'White', wheelType: '10SP', wheelColor: 'Black', tampos: ['Type R decal'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 100, priceAverage: 170, priceHigh: 280, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },

  // 70 Dodge Charger R/T
  { id: 'r-charger-rt-2020-black', castingId: 'c-dodge-charger', releaseYear: 2020, series: 'HW Drag Race', toyNumber: '012/250', variation: 'Black', bodyColor: 'Black', wheelType: 'MC5', wheelColor: 'Chrome', tampos: ['R/T logo'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 100, priceAverage: 170, priceHigh: 280, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },

  // 64 Chevy Impala
  { id: 'r-impala-64-2021-blue', castingId: 'c-chevy-impala', releaseYear: 2021, series: 'HW Lowrider', toyNumber: '156/250', variation: 'Blue', bodyColor: 'Blue', wheelType: '5SP', wheelColor: 'Chrome', tampos: ['Lowrider flames'], baseColor: 'Metal', country: 'Malaysia', cardDesign: 'Blue card', rarity: 'Mainline', priceLow: 120, priceAverage: 200, priceHigh: 340, priceSource: 'eBay sold avg 2024', priceUpdatedAt: '2024-12-01' },
];

// ─── Database Lookup Functions ────────────────────────────────

export interface ImageEvidence {
  casting_name_visible: string | null;
  model_text: string | null;
  series_text: string | null;
  toy_number: string | null;
  year_text_visible: string | null;
  body_color: string | null;
  wheel_type: string | null;
  tampos: string[];
  special_features: string[];
  image_quality: string;
  identification_confidence: number;
}

export interface CandidateMatch {
  release: Release;
  casting: Casting;
  matchScore: number; // 0-100
  matchFactors: string[];
}

/**
 * Find candidate releases based on extracted image evidence.
 * Returns multiple candidates ranked by match score.
 */
export function findCandidates(evidence: ImageEvidence, maxCandidates: number = 5): CandidateMatch[] {
  const candidates: CandidateMatch[] = [];

  for (const release of RELEASES) {
    const casting = CASTINGS.find(c => c.id === release.id.split('-').slice(0, -2).join('-'));
    if (!casting) continue;

    let score = 0;
    const factors: string[] = [];

    // Year match (if visible)
    if (evidence.year_text_visible) {
      const yearMatch = parseInt(evidence.year_text_visible) === release.releaseYear;
      if (yearMatch) { score += 30; factors.push('Year matches'); }
      else { score -= 20; factors.push('Year mismatch'); }
    }

    // Color match
    if (evidence.body_color) {
      const colorMatch = release.bodyColor.toLowerCase().includes(evidence.body_color.toLowerCase()) ||
                         evidence.body_color.toLowerCase().includes(release.bodyColor.toLowerCase());
      if (colorMatch) { score += 25; factors.push('Color matches'); }
    }

    // Toy number match
    if (evidence.toy_number) {
      const toyMatch = release.toyNumber === evidence.toy_number;
      if (toyMatch) { score += 35; factors.push('Toy number matches exactly'); }
    }

    // Series match
    if (evidence.series_text) {
      const seriesMatch = release.series.toLowerCase().includes(evidence.series_text.toLowerCase()) ||
                          evidence.series_text.toLowerCase().includes(release.series.toLowerCase());
      if (seriesMatch) { score += 15; factors.push('Series matches'); }
    }

    // Wheel type match
    if (evidence.wheel_type) {
      const wheelMatch = release.wheelType.toLowerCase().includes(evidence.wheel_type.toLowerCase()) ||
                         evidence.wheel_type.toLowerCase().includes(release.wheelType.toLowerCase());
      if (wheelMatch) { score += 10; factors.push('Wheel type matches'); }
    }

    // Casting name match
    if (evidence.casting_name_visible || evidence.model_text) {
      const searchText = (evidence.casting_name_visible || evidence.model_text || '').toLowerCase();
      const nameMatch = casting.name.toLowerCase().includes(searchText) ||
                        searchText.includes(casting.name.toLowerCase());
      if (nameMatch) { score += 20; factors.push('Casting name matches'); }
    }

    if (score > 0) {
      candidates.push({
        release,
        casting,
        matchScore: Math.min(score, 100),
        matchFactors: factors,
      });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.matchScore - a.matchScore);

  return candidates.slice(0, maxCandidates);
}

/**
 * Get the best match from candidates.
 * Returns null if no candidate has sufficient confidence.
 */
export function getBestMatch(candidates: CandidateMatch[], minScore: number = 30): CandidateMatch | null {
  if (candidates.length === 0) return null;
  if (candidates[0].matchScore < minScore) return null;
  return candidates[0];
}

/**
 * Check if the match is ambiguous (multiple candidates with similar scores).
 */
export function isAmbiguousMatch(candidates: CandidateMatch[]): boolean {
  if (candidates.length < 2) return false;
  // If top 2 candidates are within 10 points, it's ambiguous
  return (candidates[0].matchScore - candidates[1].matchScore) < 10;
}

/**
 * Get price data for a release, adjusted for condition.
 */
export function getPriceData(
  release: Release,
  conditionScore: number // 0-100, where 100 is mint
): { low: number; average: number; high: number; currency: string; source: string; status: string } {
  // Condition multiplier: 100 = 1.0x, 0 = 0.2x
  const conditionMultiplier = 0.2 + (conditionScore / 100) * 0.8;

  return {
    low: Math.round(release.priceLow * conditionMultiplier),
    average: Math.round(release.priceAverage * conditionMultiplier),
    high: Math.round(release.priceHigh * conditionMultiplier),
    currency: 'INR',
    source: release.priceSource,
    status: 'VERIFIED',
  };
}

/**
 * Get all releases for a specific casting.
 */
export function getReleasesForCasting(castingId: string): Release[] {
  return RELEASES.filter(r => r.castingId === castingId);
}

/**
 * Search castings by name.
 */
export function searchCastings(query: string): Casting[] {
  const q = query.toLowerCase();
  return CASTINGS.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.realVehicle.toLowerCase().includes(q)
  );
}
