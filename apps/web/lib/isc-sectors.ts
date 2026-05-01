export const ISC_SECTORS = [
  {
    key: "informal_isc",
    bn: "ইনফরমাল সেক্টর আইএসসি",
    en: "Informal Sector ISC",
    searchTerms: ["general", "labor", "helper", "driver", "cleaner", "domestic", "security"],
  },
  {
    key: "ict_isc",
    bn: "আইসিটি আইএসসি",
    en: "ICT ISC",
    searchTerms: ["IT", "software", "developer", "tech", "digital", "programmer", "network"],
  },
  {
    key: "agrofood_isc",
    bn: "অ্যাগ্রোফুড আইএসসি",
    en: "Agrofood ISC",
    searchTerms: ["food processing", "agriculture", "farm", "fishery", "food", "dairy"],
  },
  {
    key: "jute_isc",
    bn: "জুট সেক্টর আইএসসি",
    en: "Jute Sector ISC",
    searchTerms: ["jute", "fiber", "yarn"],
  },
  {
    key: "ceramic_isc",
    bn: "সিরামিক আইএসসি",
    en: "Ceramic ISC",
    searchTerms: ["ceramic", "tile", "pottery", "glass"],
  },
  {
    key: "leather_isc",
    bn: "লেদার ও লেদার গুডস আইএসসি",
    en: "Leather & Leather Goods ISC",
    searchTerms: ["leather", "footwear", "tannery", "shoe"],
  },
  {
    key: "light_eng_isc",
    bn: "লাইট ইঞ্জিনিয়ারিং আইএসসি",
    en: "Light Engineering ISC",
    searchTerms: ["engineering", "mechanic", "lathe", "machinist", "fitter", "welder"],
  },
  {
    key: "rgt_isc",
    bn: "রেডিমেড গার্মেন্টস ও টেক্সটাইল আইএসসি",
    en: "Readymade Garments & Textile ISC",
    searchTerms: ["garments", "textile", "sewing", "fabric", "apparel", "tailoring"],
  },
  {
    key: "pharma_isc",
    bn: "ফার্মাসিউটিক্যাল আইএসসি",
    en: "Pharmaceutical ISC",
    searchTerms: ["pharmaceutical", "medicine", "laboratory", "pharmacy", "medical"],
  },
  {
    key: "furniture_isc",
    bn: "ফার্নিচার আইএসসি",
    en: "Furniture ISC",
    searchTerms: ["furniture", "carpentry", "wood", "cabinet"],
  },
  {
    key: "plastics_isc",
    bn: "প্লাস্টিকস আইএসসি",
    en: "Plastics ISC",
    searchTerms: ["plastic", "polymer", "molding", "packaging"],
  },
  {
    key: "tourism_isc",
    bn: "ট্যুরিজম ও হসপিটালিটি আইএসসি",
    en: "Tourism & Hospitality ISC",
    searchTerms: ["hotel", "hospitality", "restaurant", "tourism", "cook", "waiter", "chef"],
  },
  {
    key: "creative_media_isc",
    bn: "ক্রিয়েটিভ মিডিয়া আইএসসি",
    en: "Creative Media ISC",
    searchTerms: ["media", "graphic", "video", "design", "creative", "photography"],
  },
  {
    key: "construction_isc",
    bn: "কনস্ট্রাকশন আইএসসি",
    en: "Construction ISC",
    searchTerms: ["construction", "civil", "mason", "welder", "carpenter", "plumber", "electrician"],
  },
  {
    key: "agriculture_isc",
    bn: "এগ্রিকালচার আইএসসি",
    en: "Agriculture ISC",
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

  return ISC_SECTORS.find((item) => {
    if (item.key === value || item.en === value || item.bn === value) {
      return true;
    }
    return item.searchTerms.join(",") === value;
  });
}
