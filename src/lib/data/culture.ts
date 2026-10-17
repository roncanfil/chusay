import type { Culture } from '../types';

// Sample culture notes. In the real app these come from Wikivoyage, summarized by Claude, and cached per country.
export const CULTURE: Record<string, Culture> = {
  morocco: {
    lang: 'Moroccan Arabic', variant: 'Darija, with French widely spoken',
    note: 'Darija is the everyday language. French works in shops, hotels and cities. A polite “la, shukran” (no, thank you) is the most useful phrase in the souks.',
    phrases: [['Hello', 'Salam alaikum', 'sah-LAAM ah-LAY-koom'], ['Thank you', 'Shukran', 'SHOOK-ran'], ['Please', 'Afak', 'AH-fak'], ['No, thank you', 'La, shukran', 'lah, SHOOK-ran'], ['How much is this?', 'Bshhal hada?', 'b-SHAL HAH-da'], ['Excuse me / sorry', 'Smeh liya', 'SMEH LEE-ya'], ['OK', 'Wakha', 'WAH-kha'], ['Good / delicious', 'Mezyan', 'mez-YAN'], ['Goodbye', 'Bslama', 'b-SLAH-ma']],
    dos: ['Dress modestly, with shoulders and knees covered, especially outside Marrakech.', 'Use your right hand to eat, pay and pass things.', 'Bargain in the souks. Start around half and keep it friendly.', 'Ask before photographing people, and expect some to say no or ask for a tip.', 'Accept mint tea when it is offered. It is part of doing business.'],
    donts: ['Entering mosques. Most are closed to non-Muslims, apart from Hassan II in Casablanca.', 'Kissing or long hugs in public.', 'Eating, drinking or smoking in public during daylight in Ramadan.', 'Following people who offer directions in the medina. They expect payment.'],
  },
  lisbon: {
    lang: 'Portuguese', variant: 'European Portuguese',
    note: 'People in Lisbon usually switch to English quickly, but opening with Portuguese is noticed and appreciated. Say obrigado if you are a man and obrigada if you are a woman. It follows the speaker, not the listener.',
    phrases: [['Hello', 'Olá', 'oh-LAH'], ['Good morning', 'Bom dia', 'bõ DEE-uh'], ['Thank you', 'Obrigado / Obrigada', 'oh-bree-GAH-doo / -duh'], ['Please', 'Por favor', 'poor fuh-VOR'], ['Excuse me', 'Com licença', 'kõ lee-SEN-suh'], ['Sorry', 'Desculpe', 'dish-KOOL-puh'], ['Do you speak English?', 'Fala inglês?', 'FAH-luh een-GLAYSH'], ['The bill, please', 'A conta, se faz favor', 'uh KÕ-tuh, suh fash fuh-VOR'], ['How much is it?', 'Quanto custa?', 'KWAN-too KOOSH-tuh'], ['An espresso, please', 'Uma bica, por favor', 'OO-muh BEE-kuh'], ['Cheers!', 'Saúde!', 'sah-OO-duh'], ['Goodbye', 'Adeus', 'uh-DAY-oosh']],
    dos: ['Say “bom dia” or “boa tarde” when you walk into a small shop or café.', 'Plan on dinner from 20:00. Kitchens are quiet before 19:30.', 'Round up or leave 5–10% at sit-down meals. Tipping is appreciated, not expected.', 'Wear shoes with grip. The polished limestone pavements get slippery.', 'Cover shoulders and knees in churches and monasteries.'],
    donts: ['Speaking Spanish and assuming it will do. Portuguese is its own language.', 'Eating the bread, olives or cheese placed on the table unless you want them. They are charged as “couvert”.', 'Riding on tram steps or crowding the doors on Tram 28. It is also a pickpocket hotspot.', 'Treating fado shows as background music. People expect silence while someone sings.'],
  },
  cdmx: {
    lang: 'Spanish', variant: 'Mexican Spanish',
    note: 'Politeness carries a lot of weight. Short greetings and “por favor” go far, and requests are often softened with “¿me regala…?” instead of a direct “give me”.',
    phrases: [['Good morning', 'Buenos días', 'BWAY-nohs DEE-ahs'], ['Please', 'Por favor', 'por fah-VOR'], ['Thank you', 'Gracias', 'GRAH-see-ahs'], ['Could I have…?', '¿Me regala…?', 'meh reh-GAH-lah'], ['The bill, please', 'La cuenta, por favor', 'lah KWEN-tah'], ['How much is it?', '¿Cuánto cuesta?', 'KWAN-toh KWES-tah'], ['Excuse me (passing)', 'Con permiso', 'kon pehr-MEE-soh'], ['Enjoy your meal', '¡Provecho!', 'pro-VEH-choh'], ['Do you speak English?', '¿Habla inglés?', 'AH-blah een-GLES'], ['Not spicy, please', 'Sin chile, por favor', 'seen CHEE-leh'], ['Cheers!', '¡Salud!', 'sah-LOOD']],
    dos: ['Say “provecho” to people eating as you pass their table.', 'Tip 10–15% in restaurants and a few pesos to grocery baggers.', 'Greet the room when you step into a small shop or a lift.', 'Carry small cash for markets, street stands and tips.', 'Book Casa Azul and Pujol well ahead.'],
    donts: ['Drinking tap water, including ice from street stands.', 'Calling the US “America”. Say “Estados Unidos”.', 'Taking “ahorita” literally. It can mean now, soon or much later.', 'Hailing taxis on the street at night. Use an app or a sitio stand.'],
  },
  kyoto: {
    lang: 'Japanese', variant: 'Japanese',
    note: 'A few polite set phrases do most of the work. Sumimasen covers excuse me, sorry and getting a server’s attention.',
    phrases: [['Hello', 'Konnichiwa · こんにちは', 'kon-nee-chee-wah'], ['Thank you', 'Arigatō gozaimasu', 'ah-ree-GAH-toh go-zai-mass'], ['Excuse me / sorry', 'Sumimasen', 'soo-mee-mah-sen'], ['Please (asking)', 'Onegaishimasu', 'oh-neh-gai-shee-mass'], ['This one, please', 'Kore o kudasai', 'koh-reh oh koo-dah-sai'], ['The bill, please', 'Okaikei onegaishimasu', 'oh-kai-kay oh-neh-gai-shee-mass'], ['Before eating', 'Itadakimasu', 'ee-tah-dah-kee-mass'], ['After eating', 'Gochisōsama deshita', 'go-chee-soh-sah-mah desh-tah'], ['No thanks, I’m fine', 'Daijōbu desu', 'dai-joh-boo dess'], ['Where is the toilet?', 'Toire wa doko desu ka?', 'toy-reh wah doh-koh dess kah']],
    dos: ['Carry your rubbish with you. Public bins are rare.', 'Take your shoes off wherever you see a step up or a row of slippers.', 'Keep your voice down on trains and buses, and skip phone calls.', 'Put cash on the small tray at the register, not in the cashier’s hand.'],
    donts: ['Tipping. It can cause confusion or be handed back.', 'Eating while walking. Nishiki Market asks you not to.', 'Photographing geiko or entering private lanes in Gion. Fines apply.', 'Standing chopsticks upright in rice or passing food chopstick to chopstick.', 'Assuming tattoos are fine at onsen and pools. Ask first.'],
  },
};
