/**
 * Utility functions for working with Wikidata data
 */

/**
 * Returns a mapping of Wikidata property IDs to human-readable labels
 */
export const getWikidataPropertyLabels = (): Record<string, string> => ({
  'P31': 'instance of',
  'P279': 'subclass of',
  'P131': 'located in',
  'P17': 'country',
  'P138': 'named after',
  'P36': 'capital',
  'P6': 'head of government',
  'P19': 'place of birth',
  'P20': 'place of death',
  'P27': 'country of citizenship',
  'P37': 'official language',
  'P39': 'position held',
  'P47': 'shares border with',
  'P54': 'member of sports team',
  'P101': 'field of work',
  'P106': 'occupation',
  'P108': 'employer',
  'P112': 'founded by',
  'P121': 'item operated',
  'P123': 'publisher',
  'P135': 'movement',
  'P136': 'genre',
  'P140': 'religion',
  'P150': 'contains administrative unit',
  'P159': 'headquarters location',
  'P166': 'award received',
  'P169': 'chief executive officer',
  'P176': 'manufacturer',
  'P180': 'depicts',
  'P190': 'sister city',
  'P205': 'basin country',
  'P241': 'military branch',
  'P264': 'record label',
  'P276': 'location',
  'P361': 'part of',
  'P366': 'use',
  'P400': 'platform',
  'P403': 'mouth of the watercourse',
  'P449': 'original network',
  'P460': 'said to be the same as',
  'P463': 'member of',
  'P495': 'country of origin',
  'P527': 'has part',
  'P551': 'residence',
  'P607': 'conflict',
  'P625': 'coordinate location',
  'P706': 'located on terrain feature',
  'P740': 'location of formation',
  'P750': 'distributor',
  'P793': 'significant event',
  'P800': 'notable work',
  'P856': 'official website',
  'P1001': 'applies to jurisdiction',
  'P1056': 'product or material produced',
  'P1196': 'manner of death',
  'P1343': 'described by source',
  'P1376': 'capital of',
  'P1412': 'languages spoken, written or signed',
  'P1441': 'present in work',
  'P1542': 'has effect',
  'P1552': 'has quality',
  'P1889': 'different from',
  'P2541': 'operating area',
  'P2670': 'has parts of the class',
  'P3373': 'sibling',
  'P3828': 'armament',
  'P4743': 'animal breed'
});

/**
 * Translates Wikidata property IDs in link labels to human-readable names
 * @param links Array of link objects that may contain Wikidata IDs
 * @returns Array of links with translated labels
 */
export function translateWikidataPropertyLabels(links: any[]): any[] {
  const propertyLabels = getWikidataPropertyLabels();
  
  return links.map(link => {
    // Only process links that have Wikidata IDs
    if (link.enriched && link.wikidataId && propertyLabels[link.wikidataId]) {
      return {
        ...link,
        label: propertyLabels[link.wikidataId]
      };
    }
    return link;
  });
}