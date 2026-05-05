export const ISC_SECTORS = [
  {
    key: "informal_isc",
    bn: "ইনফরমাল সেক্টর",
    en: "Informal Sector",
    searchTerms: ["general", "labor", "helper", "driver", "cleaner", "domestic", "security"],
  },
  {
    key: "ict_isc",
    bn: "আইসিটি",
    en: "ICT",
    searchTerms: ["IT", "software", "developer", "tech", "digital", "programmer", "network"],
  },
  {
    key: "agrofood_isc",
    bn: "অ্যাগ্রোফুড",
    en: "Agrofood",
    searchTerms: ["food processing", "agriculture", "farm", "fishery", "food", "dairy"],
  },
  {
    key: "jute_isc",
    bn: "জুট সেক্টর",
    en: "Jute Sector",
    searchTerms: ["jute", "fiber", "yarn"],
  },
  {
    key: "ceramic_isc",
    bn: "সিরামিক",
    en: "Ceramic",
    searchTerms: ["ceramic", "tile", "pottery", "glass"],
  },
  {
    key: "leather_isc",
    bn: "লেদার ও লেদার গুডস",
    en: "Leather & Leather Goods",
    searchTerms: ["leather", "footwear", "tannery", "shoe"],
  },
  {
    key: "light_eng_isc",
    bn: "লাইট ইঞ্জিনিয়ারিং",
    en: "Light Engineering",
    searchTerms: ["engineering", "mechanic", "lathe", "machinist", "fitter", "welder"],
  },
  {
    key: "rgt_isc",
    bn: "রেডিমেড গার্মেন্টস ও টেক্সটাইল",
    en: "Readymade Garments & Textile",
    searchTerms: ["garments", "textile", "sewing", "fabric", "apparel", "tailoring"],
  },
  {
    key: "pharma_isc",
    bn: "ফার্মাসিউটিক্যাল",
    en: "Pharmaceutical",
    searchTerms: ["pharmaceutical", "medicine", "laboratory", "pharmacy", "medical"],
  },
  {
    key: "furniture_isc",
    bn: "ফার্নিচার",
    en: "Furniture",
    searchTerms: ["furniture", "carpentry", "wood", "cabinet"],
  },
  {
    key: "plastics_isc",
    bn: "প্লাস্টিকস",
    en: "Plastics",
    searchTerms: ["plastic", "polymer", "molding", "packaging"],
  },
  {
    key: "tourism_isc",
    bn: "ট্যুরিজম ও হসপিটালিটি",
    en: "Tourism & Hospitality",
    searchTerms: ["hotel", "hospitality", "restaurant", "tourism", "cook", "waiter", "chef"],
  },
  {
    key: "creative_media_isc",
    bn: "ক্রিয়েটিভ মিডিয়া",
    en: "Creative Media",
    searchTerms: ["media", "graphic", "video", "design", "creative", "photography"],
  },
  {
    key: "construction_isc",
    bn: "কনস্ট্রাকশন",
    en: "Construction",
    searchTerms: ["construction", "civil", "mason", "welder", "carpenter", "plumber", "electrician"],
  },
  {
    key: "agriculture_isc",
    bn: "এগ্রিকালচার",
    en: "Agriculture",
    searchTerms: ["agriculture", "farming", "crop", "livestock", "poultry"],
  },
] as const;

export type ISCSectorKey = (typeof ISC_SECTORS)[number]["key"];

export function getISCSectorSearchParam(key: string): string {
  const sector = ISC_SECTORS.find((item) => item.key === key);
  return sector ? sector.searchTerms.join(",") : "";
}

export function getISCSectorFromSearchParam(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const normalizedValue = value
    .replace(/\s+ISC$/i, "")
    .replace(/\s+আইএসসি$/u, "")
    .trim();

  return ISC_SECTORS.find((item) => {
    const normalizedEn = item.en.replace(/\s+ISC$/i, "").trim();
    const normalizedBn = item.bn.replace(/\s+আইএসসি$/u, "").trim();

    if (item.key === value || item.en === value || item.bn === value) {
      return true;
    }

    if (normalizedEn === normalizedValue || normalizedBn === normalizedValue) {
      return true;
    }
    return item.searchTerms.join(",") === value;
  });
}
