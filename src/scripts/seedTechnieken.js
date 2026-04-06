import { db } from '../firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';

// 🔧 ID normalizer (future-proof, consistent met Excel merge later)
const normalizeId = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');

// 🔍 Check of collectie al data bevat
const collectionHasData = async () => {
  const snapshot = await getDocs(collection(db, 'technieken'));
  return !snapshot.empty;
};

export const seedTechnieken = async () => {
  try {
    const hasData = await collectionHasData();

    if (hasData) {
      console.log('⛔ technieken collectie bevat al data — seeding overgeslagen');
      return;
    }

    console.log('🚀 Start seeding technieken...');

    const technieken = [
      {
        type: "Val",
        techniek: "Yoko-ukemi",
        basisvoorwaarden: ["Afslaan links rechts","Afslaan L +R met benen wisselen","Outen ukemi: 4punten, arm doorsteken","verste hand wegnemen: hoge 4puntensteun"],
        basisfase: ["vanuit stand","op knieën, partner meetrekken"],
        verdieping: ["Zijwaarts","hindernis: 4punten, achterwaarts","hindernis: 4punten, zijwaarts hand in kraag"],
        aandachtspunten: ["Op zij rollen","benen gespreid","voeten op de mat blijven","1 lijn"],
        remediering: ["naar hand kijken dat afklopt","kijk naar benen bij het rechtkomen","gordel onder de voet","mat/lijn gebruiken"],
        oefenvormen: ["hurkje, partner tikt schouder","Spiegelbeeld"],
        kyu_graden: ["6","5","4","3","2","1"],
        basis_vanaf_kyu: "6",
        verdieping_vanaf_kyu: "5"
      },
      {
        type: "Val",
        techniek: "Zempo-Kaiten",
        basisvoorwaarden: ["koprol (voor/achter)","koprol + rechtstaan"],
        basisfase: ["beginnen kioshi","start recht, blijven liggen","rechtstaan na val","verplaatsing"],
        verdieping: [],
        aandachtspunten: ["enkel over arm, schouder en rug","vermijden hielen op mat","benen niet kruisen","niet op zij rollen"],
        remediering: ["Pink contact mat, hoofd wegkijken","naar voeten kijken","goed afduwen"],
        oefenvormen: ["huppelen + val","touw over de mat"],
        kyu_graden: ["6","5","4","3","2","1"],
        basis_vanaf_kyu: "6",
        verdieping_vanaf_kyu: "5"
      },
      {
        type: "Val",
        techniek: "Ushiro-ukemi",
        basisvoorwaarden: ["koprol","schouderrol","liggend slaan","afslaan uit rol","hurk + afslaan"],
        basisfase: ["stand","achterwaartse verplaatsing","hindernis"],
        verdieping: [],
        aandachtspunten: ["hoofd niet tegen mat","kin bij borst","dicht bij hielen","bolle rug"],
        remediering: ["voorwerp onder kin","knieën omsluiten","lijnen maken"],
        oefenvormen: ["sabaki + val","evenwichtspel"],
        kyu_graden: ["6","5","4","3","2","1"],
        basis_vanaf_kyu: "6",
        verdieping_vanaf_kyu: "5"
      },
      {
        type: "Val",
        techniek: "mae-ukemi",
        basisvoorwaarden: ["plank"],
        basisfase: ["op knieën starten","kioshi"],
        verdieping: ["rechtstaand","na duw"],
        aandachtspunten: ["voorarm afkloppen","buik geen contact","steun tenen"],
        remediering: ["vormspanning","naar tenen kijken"],
        oefenvormen: ["mountain climbers","mexican wave"],
        kyu_graden: ["5","4","3","2","1"],
        basis_vanaf_kyu: "5",
        verdieping_vanaf_kyu: "4"
      },

      // 🥋 HOUDGREPEN
      {
        type: "houdgreep",
        techniek: "Kesa-gatame",
        basisvoorwaarden: ["positie innemen","overstap"],
        basisfase: ["Techniek","verdedigen ebi"],
        verdieping: ["transitie","bevrijding"],
        aandachtspunten: ["heup dicht","hoofd laag","knie recht"],
        remediering: ["lijn gebruiken","contact behouden"],
        oefenvormen: ["randori houdgrepen"],
        kyu_graden: ["5","4","3","2","1"],
        basis_vanaf_kyu: "5",
        verdieping_vanaf_kyu: "4"
      },
      {
        type: "houdgreep",
        techniek: "Kuzure-kesa-gatame",
        basisvoorwaarden: ["Yoko-shiho-gatame"],
        basisfase: ["Techniek","verdedigen"],
        verdieping: ["transities","bevrijding"],
        aandachtspunten: ["greep mouw","knie tegen schouder"],
        remediering: ["controle oefenen"],
        oefenvormen: ["houdgreep randori"],
        kyu_graden: ["4","3","2","1"],
        basis_vanaf_kyu: "4",
        verdieping_vanaf_kyu: "3"
      },

      // 🚶 VERPLAATSING
      {
        type: "Verplaatsing",
        techniek: "ushiro-mawari-sabaki",
        basisvoorwaarden: ["evenwicht","draai"],
        basisfase: ["staand","met stap"],
        verdieping: ["koppeling val","koppeling worp"],
        aandachtspunten: ["voet niet kruisen","vloeiend"],
        remediering: ["lijn volgen"],
        oefenvormen: ["slalom"],
        kyu_graden: ["6","5","4","3","2","1"],
        basis_vanaf_kyu: "6",
        verdieping_vanaf_kyu: "5"
      },

      // 🥋 WORPEN
      {
        type: "Worpen",
        techniek: "Seo nage",
        basisvoorwaarden: ["kuzushi","tsukuri"],
        basisfase: ["techniek","in verplaatsing"],
        verdieping: ["links/rechts","koppeling"],
        aandachtspunten: ["ellebogen dicht","knieën buigen"],
        remediering: ["uchi-komi"],
        oefenvormen: ["uchi-komi wandeling"],
        kyu_graden: ["4","3","2","1"],
        basis_vanaf_kyu: "4",
        verdieping_vanaf_kyu: "3"
      },
      {
        type: "Worpen",
        techniek: "O Soto Gari",
        basisvoorwaarden: ["kuzushi achterwaarts"],
        basisfase: ["techniek","verplaatsing"],
        verdieping: ["links/rechts"],
        aandachtspunten: ["groot been","borst op borst"],
        remediering: ["muur oefening"],
        oefenvormen: ["randori o-soto"],
        kyu_graden: ["5","4","3","2","1"],
        basis_vanaf_kyu: "5",
        verdieping_vanaf_kyu: "4"
      },
      {
        type: "Worpen",
        techniek: "O-uchi-gari",
        basisvoorwaarden: ["been binnenkant"],
        basisfase: ["techniek","verplaatsing"],
        verdieping: ["koppeling"],
        aandachtspunten: ["been tot heup"],
        remediering: ["voet positie"],
        oefenvormen: ["combinatie o-soto"],
        kyu_graden: ["5","4","3","2","1"],
        basis_vanaf_kyu: "5",
        verdieping_vanaf_kyu: "4"
      },

      // 🔁 TRANSITIE
      {
        type: "Transitie",
        techniek: "Transitie nage-waza → katame-waza",
        basisvoorwaarden: ["basisworpen","houdgrepen"],
        basisfase: ["worp + houdgreep"],
        verdieping: ["schakelrandori"],
        aandachtspunten: ["niet loslaten","snel reageren"],
        remediering: ["slow motion"],
        oefenvormen: ["transitieparcours"],
        kyu_graden: ["4","3","2","1"],
        basis_vanaf_kyu: "4",
        verdieping_vanaf_kyu: "3"
      }
    ];

    for (const tech of technieken) {
      const id = normalizeId(tech.techniek);

      await setDoc(doc(db, 'technieken', id), {
        ...tech,
        updatedAt: serverTimestamp(),
        updatedBy: 'system-seed'
      });
    }

    console.log(`✅ ${technieken.length} technieken succesvol geseed`);

  } catch (error) {
    console.error('❌ Fout bij seeding:', error);
  }
};
