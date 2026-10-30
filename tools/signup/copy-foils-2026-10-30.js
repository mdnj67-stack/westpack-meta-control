/**
 * One-off copy change, 2026-10-30: Logo studio got a carrier bag and the 25 foils of Westpack's logo-print module,
 * so its copy no longer promises gold or names only lids. Written by hand for every language rather than through
 * tools/signup/transcreate.js, which regenerates whole files and would undo the 56 proofread fixes; the
 * transcreated files keep their status and are marked so a native read knows which strings are newer.
 *
 * Changes in "logo-studio": peek and title say foil instead of gold; boxLabel, disclaimer, the light hints, zoomOut
 * and hintLong no longer say box or lid; boxes gains bag; foil (six names) becomes finish (3), colour (18) and the
 * foilName pattern that joins them in each language's order.
 *
 * Usage: node tools/signup/copy-foils-2026-10-30.js   (idempotent; rewrites signup/core/copy/*.js)
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const DIR = path.join(__dirname, "..", "..", "signup", "core", "copy");

// per language: the strings that change. colour keys follow the order of the picker
const C = ["gold", "silver", "copper", "red", "orange", "pink", "purple", "blue", "mint", "black", "white", "darkblue", "green", "oldrose", "yellow", "clear", "grey", "brown"];
const col = (...names) => Object.fromEntries(C.map((k, i) => [k, names[i]]));
const L = {
  da: {
    peek: "Hvordan ser dit brand ud i folie?", title: "Skriv dit brandnavn. Vi trykker det i folie.", boxLabel: "Emballage", bag: "Sort luksuspose",
    finish: { metallic: "Metallisk", matt: "Mat", gloss: "Blank" }, foilName: "{finish} {colour}",
    colour: col("Guld", "Sølv", "Kobber", "Rød", "Orange", "Pink", "Lilla", "Blå", "Mint", "Sort", "Hvid", "Mørkeblå", "Grøn", "Gammelrosa", "Gul", "Gennemsigtig", "Grå", "Brun"),
    hintLong: "Mange bogstaver! Logoet skaleres, så det passer.",
    disclaimer: "Illustration på rigtig Westpack-emballage. Dit logo trykkes i én foliefarve.",
    lightHintMouse: "Bevæg musen over trykket, og se folien fange lyset.",
    lightHintTouch: "Træk fingeren over trykket, og se folien fange lyset. Swipe for den næste.",
    zoomOut: "Se det hele",
  },
  en: {
    peek: "What does your brand look like in foil?", title: "Type your brand name. We'll print it in foil.", boxLabel: "Packaging", bag: "Black luxury bag",
    finish: { metallic: "Metallic", matt: "Matt", gloss: "Gloss" }, foilName: "{finish} {colour}",
    colour: col("Gold", "Silver", "Copper", "Red", "Orange", "Pink", "Purple", "Blue", "Mint", "Black", "White", "Dark blue", "Green", "Old rose", "Yellow", "Transparent", "Grey", "Brown"),
    hintLong: "That's a lot of letters. The logo is scaled to fit.",
    disclaimer: "Illustration on real Westpack packaging. Your logo is printed in one foil colour.",
    lightHintMouse: "Move your mouse over the print and watch the foil catch the light.",
    lightHintTouch: "Drag a finger over the print and watch the foil catch the light. Swipe for the next one.",
    zoomOut: "See it all",
  },
  "en-US": {
    peek: "What does your brand look like in foil?", title: "Type your brand name. We'll print it in foil.", boxLabel: "Packaging", bag: "Black luxury bag",
    finish: { metallic: "Metallic", matt: "Matte", gloss: "Gloss" }, foilName: "{finish} {colour}",
    colour: col("Gold", "Silver", "Copper", "Red", "Orange", "Pink", "Purple", "Blue", "Mint", "Black", "White", "Dark blue", "Green", "Old rose", "Yellow", "Transparent", "Gray", "Brown"),
    hintLong: "That's a lot of letters. The logo is scaled to fit.",
    disclaimer: "Illustration on real Westpack packaging. Your logo is printed in one foil color.",
    lightHintMouse: "Move your mouse over the print and watch the foil catch the light.",
    lightHintTouch: "Drag a finger over the print and watch the foil catch the light. Swipe for the next one.",
    zoomOut: "See it all",
  },
  de: {
    peek: "Wie sieht Ihre Marke in Folie aus?", title: "Geben Sie Ihren Markennamen ein. Wir prägen ihn in Folie.", boxLabel: "Verpackung", bag: "Schwarze Luxus-Tragetasche",
    finish: { metallic: "Metallic", matt: "Matt", gloss: "Glänzend" }, foilName: "{colour} {finish}",
    colour: col("Gold", "Silber", "Kupfer", "Rot", "Orange", "Pink", "Lila", "Blau", "Mint", "Schwarz", "Weiß", "Dunkelblau", "Grün", "Altrosa", "Gelb", "Transparent", "Grau", "Braun"),
    hintLong: "Ganz schön viele Buchstaben. Das Logo wird passend skaliert.",
    disclaimer: "Darstellung auf echten Westpack-Verpackungen. Ihr Logo wird in einer Folienfarbe gedruckt.",
    lightHintMouse: "Bewegen Sie die Maus über den Druck und sehen Sie, wie die Folie das Licht einfängt.",
    lightHintTouch: "Ziehen Sie einen Finger über den Druck und sehen Sie, wie die Folie das Licht einfängt. Wischen Sie zum nächsten Motiv.",
    zoomOut: "Gesamtansicht",
  },
  fr: {
    peek: "Votre marque, marquée à chaud. Ça donne quoi ?", title: "Tapez le nom de votre marque. On le marque à chaud.", boxLabel: "Emballage", bag: "Sac de luxe noir",
    finish: { metallic: "Métallisé", matt: "Mat", gloss: "Brillant" }, foilName: "{colour} {finish}",
    colour: col("Or", "Argent", "Cuivre", "Rouge", "Orange", "Rose", "Violet", "Bleu", "Menthe", "Noir", "Blanc", "Bleu foncé", "Vert", "Vieux rose", "Jaune", "Transparent", "Gris", "Marron"),
    hintLong: "Ça fait beaucoup de lettres. Le logo est réduit pour tenir.",
    disclaimer: "Illustration sur de vrais emballages Westpack. Votre logo est marqué à chaud en une seule couleur.",
    lightHintMouse: "Passez la souris sur le marquage et regardez-le accrocher la lumière.",
    lightHintTouch: "Faites glisser un doigt sur le marquage et regardez-le accrocher la lumière. Balayez pour voir le suivant.",
    zoomOut: "Voir l’ensemble",
  },
  it: {
    peek: "Come sta il tuo brand stampato a caldo?", title: "Scrivi il nome del tuo brand. Noi lo stampiamo a caldo.", boxLabel: "Packaging", bag: "Shopper di lusso nera",
    finish: { metallic: "Metallizzato", matt: "Opaco", gloss: "Lucido" }, foilName: "{colour} {finish}",
    colour: col("Oro", "Argento", "Rame", "Rosso", "Arancione", "Rosa", "Viola", "Blu", "Menta", "Nero", "Bianco", "Blu scuro", "Verde", "Rosa antico", "Giallo", "Trasparente", "Grigio", "Marrone"),
    hintLong: "Quante lettere! Il logo viene ridimensionato per starci.",
    disclaimer: "Simulazione su veri packaging Westpack. Il tuo logo viene stampato a caldo in un solo colore.",
    lightHintMouse: "Passa il mouse sulla stampa e guarda il foil catturare la luce.",
    lightHintTouch: "Trascina un dito sulla stampa e guarda come la lamina riflette la luce. Scorri per passare al successivo.",
    zoomOut: "Vista intera",
  },
  es: {
    peek: "¿Cómo queda tu marca estampada en caliente?", title: "Escribe el nombre de tu marca. Lo estampamos en caliente.", boxLabel: "Envase", bag: "Bolsa de lujo negra",
    finish: { metallic: "Metalizado", matt: "Mate", gloss: "Brillo" }, foilName: "{colour} {finish}",
    colour: col("Dorado", "Plateado", "Cobre", "Rojo", "Naranja", "Rosa", "Morado", "Azul", "Menta", "Negro", "Blanco", "Azul oscuro", "Verde", "Rosa antiguo", "Amarillo", "Transparente", "Gris", "Marrón"),
    hintLong: "Son unas cuantas letras. El logo se ajusta para que quepa.",
    disclaimer: "Simulación sobre envases Westpack reales. Tu logo se estampa en caliente en un solo color.",
    lightHintMouse: "Mueve el ratón sobre el estampado y mira cómo atrapa la luz.",
    lightHintTouch: "Desliza un dedo sobre el estampado y mira cómo atrapa la luz. Desliza para ver el siguiente.",
    zoomOut: "Ver todo",
  },
  nl: {
    peek: "Hoe ziet je merk eruit in folie?", title: "Typ je merknaam. Wij drukken hem in folie.", boxLabel: "Verpakking", bag: "Zwarte luxe draagtas",
    finish: { metallic: "Metallic", matt: "Mat", gloss: "Glans" }, foilName: "{colour} {finish}",
    colour: col("Goud", "Zilver", "Koper", "Rood", "Oranje", "Roze", "Paars", "Blauw", "Mint", "Zwart", "Wit", "Donkerblauw", "Groen", "Oudroze", "Geel", "Transparant", "Grijs", "Bruin"),
    hintLong: "Dat zijn flink wat letters. Het logo wordt passend gemaakt.",
    disclaimer: "Illustratie op echte Westpack-verpakkingen. Je logo wordt in één foliekleur gedrukt.",
    lightHintMouse: "Beweeg je muis over de opdruk en zie hoe de folie het licht vangt.",
    lightHintTouch: "Sleep je vinger over de opdruk en zie hoe de folie het licht vangt. Swipe voor de volgende.",
    zoomOut: "Alles bekijken",
  },
  pt: {
    peek: "Como fica a sua marca estampada a quente?", title: "Escreva o nome da sua marca. Nós estampamo-lo a quente.", boxLabel: "Embalagem", bag: "Saco de luxo preto",
    finish: { metallic: "Metalizado", matt: "Mate", gloss: "Brilhante" }, foilName: "{colour} {finish}",
    colour: col("Dourado", "Prateado", "Cobre", "Vermelho", "Laranja", "Rosa", "Roxo", "Azul", "Menta", "Preto", "Branco", "Azul-escuro", "Verde", "Rosa antigo", "Amarelo", "Transparente", "Cinzento", "Castanho"),
    hintLong: "São muitas letras. O logótipo é ajustado para caber.",
    disclaimer: "Ilustração em embalagens reais da Westpack. O seu logótipo é estampado a quente numa única cor.",
    lightHintMouse: "Mova o rato sobre a impressão e veja o foil apanhar a luz.",
    lightHintTouch: "Arraste um dedo sobre a impressão e veja o foil apanhar a luz. Deslize para a seguinte.",
    zoomOut: "Ver tudo",
  },
  sv: {
    peek: "Hur ser ditt varumärke ut i folie?", title: "Skriv ditt varumärkesnamn. Vi trycker det i folie.", boxLabel: "Förpackning", bag: "Svart lyxkasse",
    finish: { metallic: "Metallic", matt: "Matt", gloss: "Blank" }, foilName: "{finish} {colour}",
    colour: col("Guld", "Silver", "Koppar", "Röd", "Orange", "Rosa", "Lila", "Blå", "Mint", "Svart", "Vit", "Mörkblå", "Grön", "Gammalrosa", "Gul", "Transparent", "Grå", "Brun"),
    hintLong: "Många bokstäver! Logotypen skalas så att den passar.",
    disclaimer: "Illustration på riktiga Westpack-förpackningar. Din logotyp trycks i en foliefärg.",
    lightHintMouse: "För musen över trycket och se folien fånga ljuset.",
    lightHintTouch: "Dra fingret över trycket och se folien fånga ljuset. Svep till nästa.",
    zoomOut: "Visa allt",
  },
  nb: {
    peek: "Hvordan ser merkevaren din ut i folie?", title: "Skriv merkenavnet ditt. Vi trykker det i folie.", boxLabel: "Emballasje", bag: "Svart luksuspose",
    finish: { metallic: "Metallisk", matt: "Matt", gloss: "Blank" }, foilName: "{finish} {colour}",
    colour: col("Gull", "Sølv", "Kobber", "Rød", "Oransje", "Rosa", "Lilla", "Blå", "Mint", "Svart", "Hvit", "Mørkeblå", "Grønn", "Gammelrosa", "Gul", "Gjennomsiktig", "Grå", "Brun"),
    hintLong: "Det var mange bokstaver! Logoen skaleres så den passer.",
    disclaimer: "Illustrasjon på ekte Westpack-emballasje. Logoen din trykkes i én foliefarge.",
    lightHintMouse: "Beveg musen over trykket og se folien fange lyset.",
    lightHintTouch: "Dra fingeren over trykket og se folien fange lyset. Swipe til neste.",
    zoomOut: "Se alt",
  },
  fi: {
    peek: "Miltä brändisi näyttää foliopainettuna?", title: "Kirjoita brändisi nimi. Näet sen foliopainettuna.", boxLabel: "Pakkaus", bag: "Musta luksuskassi",
    finish: { metallic: "Metallinen", matt: "Matta", gloss: "Kiiltävä" }, foilName: "{finish} {colour}",
    colour: col("Kulta", "Hopea", "Kupari", "Punainen", "Oranssi", "Pinkki", "Violetti", "Sininen", "Minttu", "Musta", "Valkoinen", "Tummansininen", "Vihreä", "Vanha roosa", "Keltainen", "Läpinäkyvä", "Harmaa", "Ruskea"),
    hintLong: "Siinäpä monta kirjainta. Logo skaalataan sopivaksi.",
    disclaimer: "Havainnekuva aidoilla Westpack-pakkauksilla. Logosi painetaan yhdellä foliovärillä.",
    lightHintMouse: "Liikuta hiirtä painatuksen päällä ja katso, miten folio nappaa valon.",
    lightHintTouch: "Vedä sormea painatuksen päällä ja katso, miten folio nappaa valon. Pyyhkäise seuraavaan.",
    zoomOut: "Näytä kaikki",
  },
  pl: {
    peek: "Jak wygląda Twoja marka w folii?", title: "Wpisz nazwę marki. Wytłoczymy ją folią.", boxLabel: "Opakowanie", bag: "Czarna luksusowa torba",
    finish: { metallic: "Metaliczna", matt: "Matowa", gloss: "Błyszcząca" }, foilName: "{colour} {finish}",
    colour: col("Złota", "Srebrna", "Miedziana", "Czerwona", "Pomarańczowa", "Różowa", "Fioletowa", "Niebieska", "Miętowa", "Czarna", "Biała", "Granatowa", "Zielona", "Staroróżowa", "Żółta", "Przezroczysta", "Szara", "Brązowa"),
    hintLong: "Sporo liter! Logo zostanie zmniejszone, żeby się zmieściło.",
    disclaimer: "Wizualizacja na prawdziwych opakowaniach Westpack. Twoje logo jest tłoczone folią w jednym kolorze.",
    lightHintMouse: "Przesuń mysz nad nadrukiem i zobacz, jak folia łapie światło.",
    lightHintTouch: "Przesuń palcem po nadruku i zobacz, jak folia łapie światło. Przesuń dalej, by zobaczyć następne.",
    zoomOut: "Całość",
  },
  ro: {
    peek: "Cum arată brandul tău imprimat cu folie?", title: "Scrie numele brandului. Îl imprimăm cu folie.", boxLabel: "Ambalaj", bag: "Sacoșă de lux neagră",
    finish: { metallic: "Metalizat", matt: "Mat", gloss: "Lucios" }, foilName: "{colour} {finish}",
    colour: col("Auriu", "Argintiu", "Arămiu", "Roșu", "Portocaliu", "Roz", "Mov", "Albastru", "Mentă", "Negru", "Alb", "Bleumarin", "Verde", "Roz antic", "Galben", "Transparent", "Gri", "Maro"),
    hintLong: "Sunt multe litere. Logoul este redimensionat ca să încapă.",
    disclaimer: "Ilustrație pe ambalaje reale de la Westpack. Logoul tău este imprimat cu folie într-o singură culoare.",
    lightHintMouse: "Mișcă mouse-ul peste imprimeu și vezi cum folia prinde lumina.",
    lightHintTouch: "Treci degetul peste imprimeu și vezi cum folia prinde lumina. Glisează pentru următorul.",
    zoomOut: "Vezi tot",
  },
  cs: {
    peek: "Jak vypadá vaše značka ve fólii?", title: "Napište název značky. Vyrazíme ho fólií.", boxLabel: "Obal", bag: "Černá luxusní taška",
    finish: { metallic: "Metalická", matt: "Matná", gloss: "Lesklá" }, foilName: "{finish} {colour}",
    colour: col("Zlatá", "Stříbrná", "Měděná", "Červená", "Oranžová", "Růžová", "Fialová", "Modrá", "Mátová", "Černá", "Bílá", "Tmavě modrá", "Zelená", "Starorůžová", "Žlutá", "Průhledná", "Šedá", "Hnědá"),
    hintLong: "To je pořádná řádka písmen. Logo upravíme, aby se vešlo.",
    disclaimer: "Vizualizace na skutečných obalech Westpack. Vaše logo se razí fólií v jedné barvě.",
    lightHintMouse: "Přejeďte myší přes potisk a sledujte, jak fólie chytá světlo.",
    lightHintTouch: "Přejeďte prstem přes potisk a sledujte, jak fólie chytá světlo. Tažením zobrazíte další.",
    zoomOut: "Celý pohled",
  },
  sk: {
    peek: "Ako vyzerá vaša značka vo fólii?", title: "Napíšte názov značky. Vyrazíme ho fóliou.", boxLabel: "Obal", bag: "Čierna luxusná taška",
    finish: { metallic: "Metalická", matt: "Matná", gloss: "Lesklá" }, foilName: "{finish} {colour}",
    colour: col("Zlatá", "Strieborná", "Medená", "Červená", "Oranžová", "Ružová", "Fialová", "Modrá", "Mätová", "Čierna", "Biela", "Tmavomodrá", "Zelená", "Staroružová", "Žltá", "Priehľadná", "Sivá", "Hnedá"),
    hintLong: "To je poriadna nádielka písmen. Logo zmenšíme, aby sa zmestilo.",
    disclaimer: "Vizualizácia na skutočných obaloch Westpack. Vaše logo sa tlačí jednou farbou fólie.",
    lightHintMouse: "Prejdite myšou po potlači a sledujte, ako fólia chytá svetlo.",
    lightHintTouch: "Prejdite prstom po potlači a sledujte, ako fólia chytá svetlo. Potiahnutím prejdete na ďalší.",
    zoomOut: "Celý pohľad",
  },
  hu: {
    peek: "Hogy mutat a márkád fóliaprégeléssel?", title: "Írd be a márkád nevét. Fóliával nyomjuk rá.", boxLabel: "Csomagolás", bag: "Fekete luxustáska",
    finish: { metallic: "Metál", matt: "Matt", gloss: "Fényes" }, foilName: "{finish} {colour}",
    colour: col("Arany", "Ezüst", "Réz", "Piros", "Narancs", "Pink", "Lila", "Kék", "Menta", "Fekete", "Fehér", "Sötétkék", "Zöld", "Órózsaszín", "Sárga", "Átlátszó", "Szürke", "Barna"),
    hintLong: "Ez jó sok betű. A logót a mérethez igazítjuk.",
    disclaimer: "Illusztráció valódi Westpack-csomagolásokon. A logódat egyetlen fóliaszínnel nyomtatjuk.",
    lightHintMouse: "Mozgasd az egeret a nyomat fölött, és nézd, ahogy megcsillan a fólia.",
    lightHintTouch: "Húzd végig az ujjad a nyomaton, és nézd, ahogy megcsillan a fólia. Lapozz a következőhöz.",
    zoomOut: "Teljes nézet",
  },
};

// the lede said "on a real lid"; with a bag among the pieces it says packaging
const LEDE = {
  cs: "Živě, na skutečném obalu. Nestojí to nic – ani váš e-mail.",
  da: "Live, på rigtig emballage. Det koster ingenting – ikke engang din e-mail.",
  de: "Live auf echter Verpackung. Kostet nichts – nicht mal Ihre E-Mail-Adresse.",
  "en-US": "Live, on real packaging. It costs nothing—not even your email.",
  en: "Live, on real packaging. It costs nothing – not even your email.",
  es: "Al instante, sobre un envase real. No cuesta nada, ni siquiera tu email.",
  fi: "Livenä, aidolla pakkauksella. Ei maksa mitään – ei edes sähköpostiosoitettasi.",
  fr: "En direct, sur un vrai emballage. Ça ne coûte rien, même pas votre e-mail.",
  hu: "Élőben, valódi csomagoláson. Semmibe sem kerül – még az e-mail-címedbe sem.",
  it: "In tempo reale, su un vero packaging. Non costa nulla, nemmeno la tua e-mail.",
  nb: "Se det direkte på ekte emballasje. Det koster ingenting – ikke engang e-postadressen din.",
  nl: "Live, op een echte verpakking. Kost niets – zelfs je e-mailadres niet.",
  pl: "Na żywo, na prawdziwym opakowaniu. Bez opłat – nawet bez podawania e-maila.",
  pt: "Em direto, numa embalagem real. Não custa nada — nem sequer o seu e-mail.",
  ro: "Pe loc, pe un ambalaj adevărat. Nu costă nimic – nici măcar e-mailul tău.",
  sk: "Priamo na skutočnom obale. Nestojí to nič – ani váš e-mail.",
  sv: "Live, på en riktig förpackning. Det kostar inget – inte ens din e-post.",
};
for (const [lang, lede] of Object.entries(LEDE)) L[lang].lede = lede;

const SIMPLE = ["peek", "title", "lede", "boxLabel", "hintLong", "disclaimer", "lightHintMouse", "lightHintTouch", "zoomOut"];

// the new logo-studio block, keys in the old order with foil replaced in place
function rebuild(ls, d) {
  const out = {};
  for (const [k, v] of Object.entries(ls)) {
    if (k === "foil" || k === "finish" || k === "colour" || k === "foilName") {
      if (!("finish" in out)) { out.finish = d.finish; out.colour = d.colour; out.foilName = d.foilName; }
      continue;
    }
    if (k === "boxes") {
      const b = {};
      for (const [id, name] of Object.entries(v)) { if (id === "bag") continue; b[id] = name; if (id === "london") b.bag = d.bag; }
      out.boxes = b;
      continue;
    }
    out[k] = SIMPLE.includes(k) ? d[k] : v;
  }
  return out;
}

// the masters are written by hand with unquoted keys: their block is replaced as text, in the same style
const q = (s) => JSON.stringify(s);
function masterBlock(ls, d) {
  const o = rebuild(ls, d);
  const line = (k, v) => {
    if (k === "boxes" || k === "foil" || k === "type") return `    ${k}: { ${Object.entries(v).map(([a, b]) => `${a}: ${q(b)}`).join(", ")} },`;
    if (k === "finish") return `    finish: { ${Object.entries(v).map(([a, b]) => `${a}: ${q(b)}`).join(", ")} },`;
    if (k === "colour") {
      const e = Object.entries(v).map(([a, b]) => `${a}: ${q(b)}`);
      return `    colour: {\n      ${e.slice(0, 9).join(", ")},\n      ${e.slice(9).join(", ")},\n    },`;
    }
    return `    ${k}: ${q(v)},`;
  };
  return `  "logo-studio": {\n${Object.entries(o).map(([k, v]) => line(k, v)).join("\n")}\n  },`;
}

for (const f of fs.readdirSync(DIR)) {
  const lang = f.replace(/\.js$/, "");
  const d = L[lang];
  if (!d) throw new Error(`no copy for ${lang}`);
  const file = path.join(DIR, f);
  const src = fs.readFileSync(file, "utf8");
  const crlf = src.includes("\r\n");
  const s = src.replace(/\r\n/g, "\n");
  const sb = {}; sb.globalThis = sb;
  vm.runInNewContext(src, sb);
  const obj = sb.WestpackSignupCopy[lang];
  let out;
  if (obj.meta && obj.meta.status === "master") {
    const start = s.indexOf('  "logo-studio": {'), end = s.indexOf('\n  },', start) + 5;
    out = s.slice(0, start) + masterBlock(obj["logo-studio"], d) + s.slice(end);
  } else {
    obj["logo-studio"] = rebuild(obj["logo-studio"], d);
    obj.meta.logoStudioUpdate = "2026-10-30: the foil headline, the carrier bag, the 25 foil names and the box-free hints were written by hand (Claude), not by transcreate.js and not proofread";
    out = s.slice(0, s.indexOf("= {") + 2) + JSON.stringify(obj, null, 2) + ";\n";
  }
  fs.writeFileSync(file, crlf ? out.replace(/\n/g, "\r\n") : out);
  console.log(`${lang}: ok`);
}
