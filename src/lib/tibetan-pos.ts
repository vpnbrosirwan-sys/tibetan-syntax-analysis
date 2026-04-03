import type { TibetanPOS } from "./types";

export const POS_COLORS: Record<
  TibetanPOS,
  { bg: string; text: string; border: string; label: string; labelChinese: string }
> = {
  noun:         { bg: "bg-blue-100",   text: "text-blue-800",   border: "border-blue-300",   label: "Noun",         labelChinese: "名詞" },
  verb:         { bg: "bg-red-100",    text: "text-red-800",    border: "border-red-300",    label: "Verb",         labelChinese: "動詞" },
  adjective:    { bg: "bg-green-100",  text: "text-green-800",  border: "border-green-300",  label: "Adjective",    labelChinese: "形容詞" },
  adverb:       { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300", label: "Adverb",       labelChinese: "副詞" },
  pronoun:      { bg: "bg-amber-100",  text: "text-amber-800",  border: "border-amber-300",  label: "Pronoun",      labelChinese: "代詞" },
  particle:     { bg: "bg-gray-100",   text: "text-gray-700",   border: "border-gray-300",   label: "Particle",     labelChinese: "助詞" },
  numeral:      { bg: "bg-teal-100",   text: "text-teal-800",   border: "border-teal-300",   label: "Numeral",      labelChinese: "數詞" },
  conjunction:  { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300", label: "Conjunction",  labelChinese: "連詞" },
  postposition: { bg: "bg-pink-100",   text: "text-pink-800",   border: "border-pink-300",   label: "Postposition", labelChinese: "後置詞" },
  interjection: { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300", label: "Interjection", labelChinese: "感嘆詞" },
  unknown:      { bg: "bg-slate-100",  text: "text-slate-600",  border: "border-slate-300",  label: "Unknown",      labelChinese: "未知" },
};
